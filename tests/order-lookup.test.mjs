import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadComponent } from "./component-loader.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const billing = loadComponent("lib/billing-public.ts");
const ui = loadComponent("components/platform/console-ui.tsx");

test("lookup accepts email or phone and selects the right next step", () => {
  for (const contact of ["buyer@example.com", "0901234567", "+84 901234567"]) assert.equal(billing.validateLookupContact(contact), "");
  for (const contact of ["", "bad email", "123", "Buyer <buyer@example.com>"]) assert.ok(billing.validateLookupContact(contact));
  assert.equal(billing.lookupOrderAction({ status: "PAID", fulfilmentStatus: "NONE" }), "Hoàn tất thông tin trường");
  assert.equal(billing.lookupOrderAction({ status: "PAID", fulfilmentStatus: "DONE" }), "Xem trường và đăng nhập");
});

test("lost checkout can be found and resumed without an order code or OTP", async (t) => {
  const previous = { window: globalThis.window, sessionStorage: globalThis.sessionStorage };
  const navigations = [], storage = new Map(), requests = [];
  globalThis.window = { location: { assign: (url) => navigations.push(url) } };
  globalThis.sessionStorage = { setItem: (key, value) => storage.set(key, value) };
  t.after(() => { for (const key of ["window", "sessionStorage"]) { if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key]; } });
  const order = { orderCode: 123, status: "PAID", fulfilmentStatus: "NONE", planName: "Cơ bản", cycle: "MONTH", amount: 299000, createdAt: "2026-10-28T12:00:00Z" };
  const { OrderLookup } = loadComponent("components/sales/order-lookup.tsx", {
    "@/lib/billing-public": { ...billing, billingPublic: {
      lookup: async (contact, page = 0) => { requests.push({ contact, page }); return { orders: [order], hasMore: false }; },
      resume: async (code, contact) => { requests.push({ code, contact }); return { orderCode: code, accessToken: "resumed-capability" }; },
    } },
    "@/components/platform/console-ui": ui,
    "./sales-shell": { SalesShell: ({ children }) => React.createElement("div", null, children) },
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(OrderLookup)); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.equal(renderer.root.findAllByType("input").length, 1);
  await act(async () => renderer.root.findByType("input").props.onChange({ target: { value: "buyer@example.com" } }));
  await act(async () => { await renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
  assert.equal(renderer.root.findAllByType("article").length, 1);
  const resume = renderer.root.findAllByType("button").find((button) => button.props.type === "button");
  await act(async () => { await resume.props.onClick(); });
  assert.deepEqual(requests, [{ contact: "buyer@example.com", page: 0 }, { code: 123, contact: "buyer@example.com" }]);
  assert.equal(storage.get("estude-order-123"), "resumed-capability");
  assert.deepEqual(navigations, ["/payment/result?orderCode=123"]);
});
