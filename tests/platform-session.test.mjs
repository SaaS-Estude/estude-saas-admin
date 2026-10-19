import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function client(t, fetch) {
  const source = fs.readFileSync(
    new URL("../lib/platform-api.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const compiled = { exports: {} };
  new Function("module", "exports", outputText)(compiled, compiled.exports);
  const previous = globalThis.fetch;
  globalThis.fetch = fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  return compiled.exports;
}
const reply = (status, data = {}) =>
  new Response(
    JSON.stringify({ success: status === 200, data, message: "fixture" }),
    { status },
  );

test("one expiry notification for concurrent protected requests, with unsubscribe", async (t) => {
  const { platformApi, PlatformError, onPlatformSessionExpired } = client(
    t,
    async () => reply(401),
  );
  let notifications = 0;
  const unsubscribe = onPlatformSessionExpired(() => ++notifications);
  const results = await Promise.allSettled([
    platformApi.tenant("school"),
    platformApi.settings("school"),
    platformApi.subscription("school"),
    platformApi.usage("school"),
  ]);
  assert(
    results.every(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof PlatformError &&
        result.reason.status === 401,
    ),
  );
  assert.equal(notifications, 1);
  unsubscribe();
  await assert.rejects(platformApi.tenantProfile("school"));
  assert.equal(notifications, 1);
});

test("bad login credentials, forbidden access and service errors do not expire a session", async (t) => {
  let status = 401;
  const { platformApi, onPlatformSessionExpired } = client(t, async () =>
    reply(status),
  );
  let notifications = 0;
  onPlatformSessionExpired(() => ++notifications);
  await assert.rejects(platformApi.login("admin", "wrong"));
  status = 403;
  await assert.rejects(
    platformApi.setDomainSettings({ baseDomain: "example.test", revision: 0 }),
  );
  status = 503;
  await assert.rejects(platformApi.plans());
  assert.equal(notifications, 0);
});

test("late unauthorized responses from an old session do not sign out a new login", async (t) => {
  let releaseOld;
  let expireCurrent = true;
  const { platformApi, onPlatformSessionExpired } = client(t, async (path) => {
    if (path.includes("/tenants/old/"))
      return new Promise((resolve) => {
        releaseOld = () => resolve(reply(401));
      });
    if (path.endsWith("/login")) return reply(200);
    if (path.endsWith("/me"))
      return reply(200, { id: "operator", accountName: "admin", active: true });
    return reply(expireCurrent ? 401 : 200);
  });
  let notifications = 0;
  onPlatformSessionExpired(() => ++notifications);
  const old = platformApi.settings("old").catch((error) => error);
  await assert.rejects(platformApi.tenant("current"));
  assert.equal(notifications, 1);
  expireCurrent = false;
  assert.equal(
    (await platformApi.login("admin", "correct")).accountName,
    "admin",
  );
  releaseOld();
  assert.equal((await old).status, 401);
  assert.equal(notifications, 1);
  expireCurrent = true;
  await assert.rejects(platformApi.tenant("current"));
  assert.equal(notifications, 2);
});

test("unauthorized non-JSON replies still clear the session", async (t) => {
  const { platformApi, onPlatformSessionExpired } = client(
    t,
    async () => new Response("unauthorized", { status: 401 }),
  );
  let notifications = 0;
  onPlatformSessionExpired(() => ++notifications);
  await assert.rejects(platformApi.tenant("school"));
  assert.equal(notifications, 1);
});
