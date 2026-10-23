import { createHmac } from "node:crypto";
import { isIP } from "node:net";

// Called only on the server. Incoming X-Estude-* headers are never forwarded.
export function portalProxyHeaders(request: Request, upstream: URL, host: string): Record<string, string> {
  const secret = process.env.PORTAL_PROXY_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("PORTAL_PROXY_SECRET chưa được cấu hình");
    return { host }; // local direct-origin compatibility
  }
  if (secret.length < 32) throw new Error("PORTAL_PROXY_SECRET phải có ít nhất 32 ký tự");
  const stamp = String(Math.floor(Date.now() / 1000));
  // Vercel overwrites this header. Never trust generic forwarded-for or a
  // browser-provided CF-Connecting-IP on a directly accessible deployment.
  const candidate = request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ?? "";
  const ip = process.env.VERCEL === "1" && isIP(candidate) ? candidate : "";
  const message = ["v1", stamp, request.method, upstream.pathname + upstream.search, host, ip].join("\n");
  return {
    host: upstream.host,
    "x-estude-portal-host": host,
    "x-estude-proxy-time": stamp,
    "x-estude-client-ip": ip,
    "x-estude-proxy-signature": createHmac("sha256", secret).update(message).digest("hex"),
  };
}
