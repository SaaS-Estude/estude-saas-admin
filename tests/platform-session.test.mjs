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

test("concurrent expired requests share one refresh and replay their original methods and bodies", async (t) => {
  let refreshed = false;
  let refreshes = 0;
  const calls = [];
  const { platformApi, onPlatformSessionExpired } = client(
    t,
    async (path, init) => {
      calls.push({ path, ...init });
      if (path.endsWith("/refresh-token")) {
        ++refreshes;
        // Yield so all initial unauthorized responses join the same refresh.
        await new Promise((resolve) => setImmediate(resolve));
        refreshed = true;
        return reply(200);
      }
      return reply(refreshed ? 200 : 401, { baseDomain: "example.test" });
    },
  );
  let notifications = 0;
  onPlatformSessionExpired(() => ++notifications);
  await Promise.all([
    platformApi.me(),
    platformApi.settings("school"),
    platformApi.setDomainSettings({ baseDomain: "example.test", revision: 1 }),
  ]);
  assert.equal(refreshes, 1);
  assert.equal(notifications, 0);
  const writes = calls.filter((call) => call.path.endsWith("/domain-settings"));
  assert.equal(writes.length, 2);
  assert.equal(writes[1].method, "PUT");
  assert.equal(writes[1].body, writes[0].body);
  assert.equal(writes[1].credentials, "same-origin");
});

test("a late 401 after a completed refresh reuses the new cookies", async (t) => {
  let releaseLate;
  let refreshed = false;
  let refreshes = 0;
  const { platformApi } = client(t, async (path) => {
    if (path.includes("/tenants/late/") && !refreshed)
      return new Promise((resolve) => {
        releaseLate = () => resolve(reply(401));
      });
    if (path.endsWith("/refresh-token")) {
      ++refreshes;
      refreshed = true;
      return reply(200);
    }
    return reply(refreshed ? 200 : 401);
  });
  const late = platformApi.settings("late");
  await platformApi.me();
  releaseLate();
  await late;
  assert.equal(refreshes, 1);
});

test("temporary refresh failures preserve the session and allow a later retry", async (t) => {
  let refreshes = 0;
  let restored = false;
  const { platformApi, onPlatformSessionExpired } = client(t, async (path) => {
    if (path.endsWith("/refresh-token")) {
      if (++refreshes === 1) return reply(503);
      restored = true;
      return reply(200);
    }
    return reply(restored ? 200 : 401);
  });
  let notifications = 0;
  onPlatformSessionExpired(() => ++notifications);
  await assert.rejects(platformApi.me(), (error) => error.status === 503);
  assert.equal(notifications, 0);
  await platformApi.me();
  assert.equal(refreshes, 2);
  assert.equal(notifications, 0);
});

test("a still unauthorized retry expires once without a refresh loop", async (t) => {
  let refreshes = 0;
  let requests = 0;
  const { platformApi, onPlatformSessionExpired } = client(t, async (path) => {
    if (path.endsWith("/refresh-token")) {
      ++refreshes;
      return reply(200);
    }
    ++requests;
    return reply(401);
  });
  let notifications = 0;
  onPlatformSessionExpired(() => ++notifications);
  await assert.rejects(platformApi.me(), (error) => error.status === 401);
  assert.equal(refreshes, 1);
  assert.equal(requests, 2);
  assert.equal(notifications, 1);
});

test("logout refreshes expired access before revocation", async (t) => {
  const paths = [];
  let restored = false;
  const { platformApi } = client(t, async (path) => {
    paths.push(path);
    if (path.endsWith("/refresh-token")) {
      restored = true;
      return reply(200);
    }
    return reply(restored ? 200 : 401);
  });
  await platformApi.logout();
  assert.deepEqual(paths, [
    "/api/platform/v1/logout",
    "/api/platform/v1/refresh-token",
    "/api/platform/v1/logout",
  ]);
});

test("refresh completion after logout cannot replay an old request", async (t) => {
  let releaseRefresh;
  let refreshStarted;
  const started = new Promise((resolve) => {
    refreshStarted = resolve;
  });
  let protectedCalls = 0;
  const { platformApi, onPlatformSessionExpired } = client(t, async (path) => {
    if (path.endsWith("/refresh-token")) {
      refreshStarted();
      return new Promise((resolve) => {
        releaseRefresh = () => resolve(reply(200));
      });
    }
    if (path.endsWith("/logout")) return reply(200);
    ++protectedCalls;
    return reply(401);
  });
  let notifications = 0;
  onPlatformSessionExpired(() => ++notifications);
  const old = platformApi.me().catch((error) => error);
  await started;
  await platformApi.logout();
  releaseRefresh();
  assert.equal((await old).status, 401);
  assert.equal(protectedCalls, 1);
  assert.equal(notifications, 0);
});

function webLocks(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let pending = Promise.resolve();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request(name, action) {
          assert.equal(name, "estude:platform-auth");
          const next = pending.then(action, action);
          pending = next.catch(() => {});
          return next;
        },
      },
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "navigator", previous);
    else delete globalThis.navigator;
  });
}

test("separate tabs serialize refresh cookie rotation with Web Locks", async (t) => {
  webLocks(t);
  let rotating = false;
  let cookieVersion = 0;
  const fetch = async (path) => {
    if (path.endsWith("/refresh-token")) {
      assert.equal(
        rotating,
        false,
        "two tabs used the same refresh cookie concurrently",
      );
      rotating = true;
      const version = cookieVersion;
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(cookieVersion, version);
      ++cookieVersion;
      rotating = false;
      return reply(200);
    }
    return reply(cookieVersion ? 200 : 401);
  };
  const tabA = client(t, fetch);
  const tabB = client(t, fetch);
  await Promise.all([tabA.platformApi.me(), tabB.platformApi.me()]);
  assert.equal(cookieVersion, 2);
});

test("logout waits for an in-flight refresh then revokes the new cookies", async (t) => {
  webLocks(t);
  let releaseRefresh;
  let refreshStarted;
  const started = new Promise((resolve) => {
    refreshStarted = resolve;
  });
  let refreshed = false;
  let logoutCalls = 0;
  const { platformApi } = client(t, async (path) => {
    if (path.endsWith("/refresh-token")) {
      refreshStarted();
      return new Promise((resolve) => {
        releaseRefresh = () => {
          refreshed = true;
          resolve(reply(200));
        };
      });
    }
    if (path.endsWith("/logout")) {
      assert.equal(refreshed, true);
      ++logoutCalls;
      return reply(200);
    }
    return reply(401);
  });
  const old = platformApi.me().catch((error) => error);
  await started;
  const logout = platformApi.logout();
  assert.equal(logoutCalls, 0);
  releaseRefresh();
  await logout;
  assert.equal((await old).status, 401);
  assert.equal(logoutCalls, 1);
});
