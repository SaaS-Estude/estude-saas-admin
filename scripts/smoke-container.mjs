import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync } from "node:child_process";
const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8" }).trim();
const id = docker(
  "run",
  "--rm",
  "-d",
  "--name",
  `estude-admin-smoke-${process.pid}`,
  "--network",
  process.env.ADMIN_SMOKE_NETWORK ?? "estude-saas_default",
  "-e",
  `CONTROL_API_URL=${process.env.CONTROL_API_URL ?? "http://control:8092"}`,
  "-e",
  "PLATFORM_HOST=platform.localhost",
  "-p",
  "127.0.0.1::3005",
  "estude-saas-admin:local",
);
try {
  const address = docker("port", id, "3005"),
    port = address.split(":").at(-1);
  const request = (pathname, host = `platform.localhost:${port}`) =>
    new Promise((resolve, reject) => {
      const call = http.get(
        `http://${address}${pathname}`,
        { headers: { host }, timeout: 5000 },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              location: res.headers.location,
              body,
            }),
          );
        },
      );
      call.on("error", reject);
      call.on("timeout", () => call.destroy(new Error("timeout")));
    });
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await request("/healthz")).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert(ready, "standalone container did not start");
  for (const route of ["/", "/login"]) {
    const res = await request(route);
    assert([307, 308].includes(res.status));
    assert.equal(res.location, "/platform");
    console.log(route, res.status, "/platform");
  }
  assert.equal((await request("/platform")).status, 200);
  console.log("/platform 200");
  assert.equal((await request("/api/platform/v1/me")).status, 401);
  console.log("Unauthenticated Go control 401");
  assert.equal(
    (await request("/api/platform/v1/me", "admin.demo-school.localhost"))
      .status,
    404,
  );
  console.log("Tenant host rejected 404");
  assert.equal((await request("/api/v1/auth/me")).status, 404);
  console.log("Tenant API absent 404");
  console.log(
    "PASS: standalone admin container, own web/API transport, root/login redirects and host isolation",
  );
} finally {
  execFileSync("docker", ["stop", id], { stdio: "ignore" });
}
