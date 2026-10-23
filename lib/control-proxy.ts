import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

import { portalProxyHeaders } from "./portal-proxy-headers";

const maxBody = 1024 * 1024;
const maxResponse = 2 * 1024 * 1024;
const prefix = "/api/platform/v1/";
function fail(status: number, message: string) {
  return Response.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

// Transport only. Go remains responsible for authentication and all business
// decisions. The destination is server configuration, never client input.
export async function forwardControl(request: Request): Promise<Response> {
  const host = request.headers.get("host");
  const platform = process.env.PLATFORM_HOST ?? "platform.localhost";
  let upstream: URL;
  try {
    if (
      !host ||
      !/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(host) ||
      new URL(`http://${host}`).hostname !== platform.toLowerCase()
    )
      return fail(404, "Không tìm thấy API");
    upstream = new URL(process.env.CONTROL_API_URL ?? "http://127.0.0.1:8092");
    if (
      !["http:", "https:"].includes(upstream.protocol) ||
      upstream.username ||
      upstream.password ||
      upstream.pathname !== "/" ||
      upstream.search ||
      upstream.hash
    )
      return fail(503, "Cấu hình control API không hợp lệ");
    const incoming = new URL(request.url);
    if (!incoming.pathname.startsWith(prefix))
      return fail(404, "Không tìm thấy API");
    upstream.pathname = incoming.pathname;
    upstream.search = incoming.search;
  } catch {
    return fail(400, "Yêu cầu không hợp lệ");
  }

  const chunks: Uint8Array[] = [];
  let length = 0;
  if (request.body) {
    const reader = request.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBody) {
          await reader.cancel();
          return fail(413, "Dữ liệu vượt giới hạn");
        }
        chunks.push(value);
      }
    } catch {
      return fail(400, "Không đọc được yêu cầu");
    } finally {
      reader.releaseLock();
    }
  }
  const body = Buffer.concat(chunks);
  let routing: Record<string, string>;
  try { routing = portalProxyHeaders(request, upstream, host!); }
  catch { return fail(503, "Chưa cấu hình PORTAL_PROXY_SECRET cho proxy API"); }
  const headers: Record<string, string> = {
    ...routing,
    "content-length": String(body.length),
  };
  // x-forwarded-for is passed so public sales endpoints can rate limit per
  // client; Go honours it only from TRUSTED_PROXY_CIDRS. Host/proto stay excluded.
  for (const name of [
    "x-forwarded-for",
    "content-type",
    "accept",
    "cookie",
    "authorization",
    "origin",
    "user-agent",
  ]) {
    const value = request.headers.get(name);
    if (value !== null) headers[name] = value;
  }
  // Incoming forwarded headers and tenant headers are intentionally excluded.
  return new Promise<Response>((resolve) => {
    let settled = false;
    const finish = (response: Response) => {
      if (!settled) {
        settled = true;
        request.signal.removeEventListener("abort", abort);
        resolve(response);
      }
    };
    const send = upstream.protocol === "https:" ? httpsRequest : httpRequest;
    const outgoing = send(
      upstream,
      {
        method: request.method,
        headers,
        // HTTP Host and TLS SNI both identify the API destination.
        ...(upstream.protocol === "https:" ? { servername: upstream.hostname } : {}),
      },
      (incoming) => {
        const parts: Buffer[] = [];
        let bytes = 0;
        incoming.on("data", (part: Buffer) => {
          bytes += part.length;
          if (bytes > maxResponse) {
            incoming.destroy();
            outgoing.destroy();
            finish(fail(502, "Phản hồi control API vượt giới hạn"));
          } else parts.push(part);
        });
        incoming.on("error", () =>
          finish(fail(502, "Control API không phản hồi đầy đủ")),
        );
        incoming.on("end", () => {
          if (settled) return;
          const reply = new Headers({ "Cache-Control": "no-store" });
          for (const name of [
            "content-type",
            "x-request-id",
            "x-content-type-options",
            "x-frame-options",
            "retry-after",
            "x-total-count",
          ]) {
            const value = incoming.headers[name];
            if (typeof value === "string") reply.set(name, value);
          }
          for (const cookie of incoming.headers["set-cookie"] ?? [])
            reply.append("set-cookie", cookie);
          const status = incoming.statusCode ?? 502;
          finish(
            new Response(
              [204, 304].includes(status) || request.method === "HEAD"
                ? null
                : Buffer.concat(parts),
              { status, headers: reply },
            ),
          );
        });
      },
    );
    function abort() {
      outgoing.destroy();
      finish(fail(502, "Yêu cầu đã đóng"));
    }
    request.signal.addEventListener("abort", abort, { once: true });
    outgoing.setTimeout(15000, () => {
      outgoing.destroy();
      finish(fail(504, "Control API phản hồi quá chậm"));
    });
    outgoing.on("error", () =>
      finish(
        fail(
          502,
          "Không kết nối được control API. Kiểm tra dịch vụ backend và cấu hình CONTROL_API_URL.",
        ),
      ),
    );
    if (request.signal.aborted) abort();
    else outgoing.end(body);
  });
}
