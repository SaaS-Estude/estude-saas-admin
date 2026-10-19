import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import ts from "typescript";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localRequire = createRequire(import.meta.url);
function load(file, requireModule = localRequire) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", code)(
    requireModule,
    compiled,
    compiled.exports,
  );
  return compiled.exports;
}
const { forwardControl } = load("lib/control-proxy.ts");
const { tenantPortalUrl } = load("lib/tenant-portal.ts");
async function fixture(t, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = process.env.CONTROL_API_URL,
    platform = process.env.PLATFORM_HOST;
  process.env.CONTROL_API_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.PLATFORM_HOST = "platform.localhost";
  t.after(async () => {
    if (previous === undefined) delete process.env.CONTROL_API_URL;
    else process.env.CONTROL_API_URL = previous;
    if (platform === undefined) delete process.env.PLATFORM_HOST;
    else process.env.PLATFORM_HOST = platform;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
}
function request(path = "/api/platform/v1/me", options = {}) {
  return new Request("http://platform.localhost:3005" + path, {
    ...options,
    headers: { host: "platform.localhost:3005", ...options.headers },
  });
}
test("forwards real platform host, Origin, auth, pagination and host-only cookies", async (t) => {
  await fixture(t, (req, res) => {
    assert.equal(req.headers.host, "platform.localhost:3005");
    assert.equal(req.headers.origin, "http://platform.localhost:3005");
    assert.equal(req.headers.cookie, "estude_platform_session=fixture");
    assert.equal(req.headers.authorization, "Bearer fixture");
    assert.equal(req.headers["x-tenant-slug"], undefined);
    assert.equal(req.headers["x-forwarded-host"], undefined);
    assert.equal(req.url, "/api/platform/v1/tenants?offset=20&limit=20");
    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-Total-Count": "21",
      "Set-Cookie": [
        "estude_platform_session=next; Path=/api/platform/v1; HttpOnly; SameSite=Strict",
        "other=fixture; HttpOnly",
      ],
    });
    res.end('{"success":true,"data":[]}');
  });
  const response = await forwardControl(
    request("/api/platform/v1/tenants?offset=20&limit=20", {
      headers: {
        Origin: "http://platform.localhost:3005",
        Cookie: "estude_platform_session=fixture",
        Authorization: "Bearer fixture",
        "X-Tenant-Slug": "untrusted",
        "X-Forwarded-Host": "admin.demo.localhost",
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-total-count"), "21");
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.deepEqual(await response.json(), { success: true, data: [] });
});
test("rejects tenant host and tenant API paths before contacting control", async (t) => {
  let calls = 0;
  await fixture(t, (_req, res) => {
    calls++;
    res.end();
  });
  assert.equal(
    (
      await forwardControl(
        request(undefined, {
          headers: { host: "admin.demo-school.localhost:3005" },
        }),
      )
    ).status,
    404,
  );
  assert.equal((await forwardControl(request("/api/v1/auth/me"))).status, 404);
  assert.equal(calls, 0);
});
test("keeps Go rejection and CSRF errors unchanged, does not follow redirects", async (t) => {
  await fixture(t, (req, res) => {
    assert.equal(req.headers.origin, "http://foreign.localhost:3005");
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end('{"success":false,"message":"Origin không hợp lệ"}');
  });
  const response = await forwardControl(
    request("/api/platform/v1/logout", {
      method: "POST",
      headers: { Origin: "http://foreign.localhost:3005" },
    }),
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).message, "Origin không hợp lệ");
});
test("preserves JSON mutation body, method and response status", async (t) => {
  await fixture(t, (req, res) => {
    assert.equal(req.method, "POST");
    let body = "";
    req.on("data", (part) => (body += part));
    req.on("end", () => {
      assert.deepEqual(JSON.parse(body), { name: "School", slug: "my-school" });
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end('{"success":true,"data":{"status":"PENDING"}}');
    });
  });
  const response = await forwardControl(
    request("/api/platform/v1/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "School", slug: "my-school" }),
    }),
  );
  assert.equal(response.status, 202);
});
test("rejects oversized input before forwarding", async (t) => {
  let calls = 0;
  await fixture(t, (_req, res) => {
    calls++;
    res.end();
  });
  const response = await forwardControl(
    request("/api/platform/v1/tenants", {
      method: "POST",
      body: "x".repeat(1024 * 1024 + 1),
    }),
  );
  assert.equal(response.status, 413);
  assert.equal(calls, 0);
});
test("reports a bounded API error when control is offline", async (t) => {
  await fixture(t, (_req, res) => res.end());
  const url = process.env.CONTROL_API_URL;
  // Port 0 is not a destination listener; do not touch the real local control API.
  process.env.CONTROL_API_URL = "http://127.0.0.1:0";
  const response = await forwardControl(request());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).success, false);
  process.env.CONTROL_API_URL = url;
});
test("HTTPS verifies the backend certificate while preserving the frontend Host", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "estude-proxy-tls-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const keyPath = path.join(directory, "key.pem");
  const certPath = path.join(directory, "cert.pem");
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost",
    "-keyout", keyPath, "-out", certPath,
  ], { stdio: "ignore" });
  const certificate = fs.readFileSync(certPath);
  const server = https.createServer({ key: fs.readFileSync(keyPath), cert: certificate }, (req, res) => {
    assert.equal(req.socket.servername, "localhost");
    assert.equal(req.headers.host, "platform.localhost:3005");
    res.setHeader("Content-Type", "application/json");
    res.end('{"success":true}');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const previous = process.env.CONTROL_API_URL;
  const platform = process.env.PLATFORM_HOST;
  process.env.CONTROL_API_URL = `https://localhost:${server.address().port}`;
  process.env.PLATFORM_HOST = "platform.localhost";
  t.after(async () => {
    if (previous === undefined) delete process.env.CONTROL_API_URL;
    else process.env.CONTROL_API_URL = previous;
    if (platform === undefined) delete process.env.PLATFORM_HOST;
    else process.env.PLATFORM_HOST = platform;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  // Trust only this fixture CA; normal hostname/certificate verification stays on.
  const { forwardControl: forwardTLS } = load("lib/control-proxy.ts", (name) =>
    name === "node:https" ? {
      request(url, options, callback) {
        assert.equal(options.rejectUnauthorized, undefined);
        return https.request(url, { ...options, ca: certificate }, callback);
      },
    } : localRequire(name),
  );
  const response = await forwardTLS(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
});
test("school portal links target the separate tenant frontend", () => {
  const previous = process.env.NEXT_PUBLIC_TENANT_PORTAL_PORT;
  delete process.env.NEXT_PUBLIC_TENANT_PORTAL_PORT;
  assert.equal(
    tenantPortalUrl("admin.demo-school.localhost"),
    "http://admin.demo-school.localhost:8091/login",
  );
  assert.equal(
    tenantPortalUrl("admin.demo-school.estude.io.vn"),
    "https://admin.demo-school.estude.io.vn/login",
  );
  if (previous !== undefined)
    process.env.NEXT_PUBLIC_TENANT_PORTAL_PORT = previous;
});
