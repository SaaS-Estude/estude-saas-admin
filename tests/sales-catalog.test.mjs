import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadComponent } from "./component-loader.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("sales catalogue picks up price changes and hidden plans when returning to the tab", async (t) => {
  const previous = { window: globalThis.window, document: globalThis.document, now: Date.now };
  let now = 10000;
  Date.now = () => now;
  const listeners = {};
  let periodic;
  let cleared = false;
  globalThis.window = {
    setInterval: (callback) => { periodic = callback; return 1; },
    clearInterval: () => { cleared = true; },
    addEventListener: (name, callback) => { listeners[name] = callback; },
    removeEventListener: (name) => { delete listeners[name]; },
  };
  globalThis.document = {
    visibilityState: "visible",
    addEventListener: (name, callback) => { listeners[name] = callback; },
    removeEventListener: (name) => { delete listeners[name]; },
  };
  t.after(() => {
    Date.now = previous.now;
    for (const name of ["window", "document"]) {
      if (previous[name] === undefined) delete globalThis[name];
      else globalThis[name] = previous[name];
    }
  });
  let next = { paymentsEnabled: true, plans: [{ code: "basic", prices: { MONTH: 299000 } }] };
  let reads = 0;
  const { useBillingCatalog } = loadComponent("lib/use-billing-catalog.ts", {
    "./billing-public": { billingPublic: { plans: async () => { ++reads; return next; } } },
  });
  let current;
  function Consumer() { current = useBillingCatalog(); return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(Consumer)); });
  assert.equal(current.catalog.plans[0].prices.MONTH, 299000);
  next = { ...next, plans: [{ code: "new", prices: { YEAR: 5000000 } }] };
  now += 3000;
  await act(async () => { await listeners.focus(); });
  assert.equal(current.catalog.plans[0].code, "new");
  assert.equal(current.catalog.plans[0].prices.YEAR, 5000000);
  next = { ...next, plans: [] };
  now += 30000;
  globalThis.document.visibilityState = "hidden";
  await act(async () => { await periodic(); });
  assert.equal(reads, 2);
  globalThis.document.visibilityState = "visible";
  await act(async () => { await listeners.visibilitychange(); });
  assert.deepEqual(current.catalog.plans, []);
  await act(async () => { renderer.unmount(); });
  assert.equal(cleared, true);
  assert.deepEqual(listeners, {});
});
