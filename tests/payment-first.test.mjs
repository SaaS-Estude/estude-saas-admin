import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadComponent } from "./component-loader.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const billing = loadComponent("lib/billing-public.ts");
const ui = loadComponent("components/platform/console-ui.tsx");
const shell = { SalesShell: ({ children }) => React.createElement("div", null, children) };
const event = { preventDefault() {} };
const noop = () => {};
const settle = () => new Promise(setImmediate);
const token = "buyer-test-access-token-00000000000000000000";

function environment(t) {
  const previous = { window: globalThis.window, sessionStorage: globalThis.sessionStorage };
  const navigations = [];
  globalThis.window = {
    location: { href: `http://platform.localhost:3005/payment/result?orderCode=123&token=${token}&status=PAID`, assign: (url) => navigations.push(url) },
    history: { replaceState: noop },
    addEventListener: noop, removeEventListener: noop,
  };
  globalThis.sessionStorage = { setItem: noop, getItem: () => token };
  t.after(() => {
    for (const key of ["window", "sessionStorage"]) {
      if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key];
    }
  });
  return navigations;
}
async function mount(t, Component, props = {}) {
  let renderer;
  await act(async () => { renderer = create(React.createElement(Component, props)); await settle(); });
  t.after(async () => { await act(async () => { renderer.unmount(); }); });
  return renderer;
}

test("checkout collects only plan and contact details; credentials are never requested or sent", async (t) => {
  const navigations = environment(t);
  let payload;
  const catalog = { paymentsEnabled: true, plans: [{ code: "basic", name: "Cơ bản", prices: { MONTH: 299000 } }] };
  const { BuyForm } = loadComponent("components/sales/buy-form.tsx", {
    "next/navigation": { useSearchParams: () => new URLSearchParams("plan=basic&cycle=MONTH") },
    "@/lib/billing-public": { ...billing, billingPublic: { createOrder: async (input) => { payload = input; return { orderCode: 123, accessToken: token, checkoutUrl: "https://pay.example/123" }; } } },
    "@/components/platform/console-ui": ui,
    "./sales-shell": shell,
    "@/lib/use-billing-catalog": { useBillingCatalog: () => ({ catalog, error: "" }) },
  });
  const renderer = await mount(t, BuyForm);
  const inputs = () => renderer.root.findAllByType("input");
  assert.equal(inputs().length, 4);
  assert.equal(inputs().some((node) => ["organization", "username", "new-password"].includes(node.props.autoComplete)), false);
  assert.equal(inputs().some((node) => node.props.type === "password"), false);
  for (const [autoComplete, value] of [["name", "Người mua"], ["email", "buyer@example.com"]]) {
    await act(async () => { inputs().find((node) => node.props.autoComplete === autoComplete).props.onChange({ target: { value } }); });
  }
  await act(async () => { inputs().find((node) => node.props.type === "checkbox").props.onChange({ target: { checked: true } }); });
  await act(async () => { await renderer.root.findByType("form").props.onSubmit(event); });
  assert.deepEqual(Object.keys(payload).sort(), ["contactEmail", "contactName", "contactPhone", "cycle", "idempotencyKey", "planCode"]);
  assert.equal(payload.planCode, "basic");
  assert.deepEqual(navigations, ["https://pay.example/123"]);
});

test("school form appears only after the server confirms a paid order needing setup", async (t) => {
  environment(t);
  const base = { orderCode: 123, kind: "NEW", amount: 299000, cycle: "MONTH", planName: "Cơ bản" };
  for (const state of [
    { status: "PENDING", fulfilmentStatus: "NONE", setupRequired: false },
    { status: "CANCELLED", fulfilmentStatus: "NONE", setupRequired: false },
    { status: "PAID", fulfilmentStatus: "PENDING", setupRequired: false },
    { status: "PAID", fulfilmentStatus: "DONE", setupRequired: false },
    { status: "PAID", fulfilmentStatus: "NONE", setupRequired: true },
  ]) {
    const { PaymentResult } = loadComponent("components/sales/payment-result.tsx", {
      "next/link": { default: ({ children }) => React.createElement("a", null, children) },
      "next/navigation": { useSearchParams: () => new URLSearchParams(`orderCode=123&token=${token}&status=PAID`) },
      "@/lib/billing-public": { ...billing, billingPublic: { status: async () => ({ ...base, ...state }) } },
      "@/components/platform/console-ui": ui,
      "./sales-shell": shell,
      "./school-setup": { SchoolSetup: (props) => React.createElement("test-school-setup", props) },
    });
    const renderer = await mount(t, PaymentResult);
    assert.equal(renderer.root.findAllByType("test-school-setup").length, state.setupRequired ? 1 : 0);
    // The URL always says PAID; the server's state decides whether to unlock setup.
    await act(async () => { renderer.unmount(); });
  }
});

test("paid school setup validates passwords, blocks duplicate sends, and clears credentials", async (t) => {
  environment(t);
  let sent, finish, calls = 0, completed;
  const { SchoolSetup } = loadComponent("components/sales/school-setup.tsx", {
    "@/lib/billing-public": { ...billing, billingPublic: {
      slugCheck: async () => ({ available: true }),
      setup: (code, secret, input) => { ++calls; sent = { code, secret, input }; return new Promise((resolve) => { finish = resolve; }); },
    } },
    "@/components/platform/console-ui": ui,
    "@/lib/use-unsaved-changes": { useUnsavedChanges: noop },
  });
  const renderer = await mount(t, SchoolSetup, { orderCode: 123, token, completed: (order) => { completed = order; } });
  const change = async (name, value) => act(async () => { renderer.root.findAllByType("input").find((node) => node.props.name === name).props.onChange({ target: { value } }); });
  await change("schoolName", "Trường Lê Quý Đôn");
  await change("adminAccount", "owner01");
  await change("adminPassword", "Fixture-Strong-123!");
  await change("confirmPassword", "Mismatch");
  await act(async () => { await renderer.root.findByType("form").props.onSubmit(event); });
  assert.equal(calls, 0);
  await change("confirmPassword", "Fixture-Strong-123!");
  let saving;
  await act(async () => { saving = renderer.root.findByType("form").props.onSubmit(event); await settle(); });
  assert.equal(renderer.root.findByType("fieldset").props.disabled, true);
  await act(async () => { await renderer.root.findByType("form").props.onSubmit(event); });
  assert.equal(calls, 1);
  assert.equal(sent.code, 123);
  assert.equal(sent.secret, token);
  assert.deepEqual(sent.input, { schoolName: "Trường Lê Quý Đôn", slug: "truong-le-quy-don", adminAccount: "owner01", adminPassword: "Fixture-Strong-123!" });
  const next = { status: "PAID", fulfilmentStatus: "PENDING", setupRequired: false };
  await act(async () => { finish(next); await saving; });
  assert.equal(completed, next);
  for (const node of renderer.root.findAllByType("input")) assert.equal(node.props.value, "");
});
