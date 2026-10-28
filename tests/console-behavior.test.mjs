import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadComponent } from "./component-loader.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const rules = loadComponent("lib/console-rules.ts");
const ui = loadComponent("components/platform/console-ui.tsx");
const hooks = loadComponent("lib/use-unsaved-changes.ts");
const noop = () => {};
const event = { preventDefault: noop };
const settle = () => new Promise(setImmediate);
function Modal({ children, ...props }) {
  return React.createElement(
    "test-modal",
    props,
    typeof children === "function" ? children(props.close) : children,
  );
}
function environment(t) {
  const previous = globalThis.window;
  globalThis.window = { addEventListener: noop, removeEventListener: noop };
  t.after(() => {
    if (previous) globalThis.window = previous;
    else delete globalThis.window;
  });
}
async function mount(t, Component, props = {}) {
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Component, props));
    await settle();
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  return renderer;
}
const text = (renderer) => JSON.stringify(renderer.toJSON());
const button = (renderer, label) =>
  renderer.root
    .findAllByType("button")
    .find(
      (node) =>
        node.children.filter((child) => typeof child === "string").join("") ===
        label,
    );

function domainPanel(api) {
  return loadComponent("components/platform/domain-settings-panel.tsx", {
    "@/lib/platform-api": { platformApi: api },
    "./domain-provision-panel": { DomainProvisionPanel: () => null },
    "@/lib/tenant-domains": { previewTenantDomains: () => [] },
    "@/lib/use-unsaved-changes": hooks,
    "./console-ui": {
      ...ui,
      Modal,
      DiscardChangesDialog: (props) =>
        React.createElement("test-discard", props),
    },
  }).DomainSettingsPanel;
}

test("renewal rejects impossible, reversed, overlapping, past and oversized periods", () => {
  const now = Date.parse("2026-10-20T00:00:00Z");
  const previousEnd = "2026-10-19T16:59:59Z";
  const period = (start, end) =>
    rules.renewalPeriod(start, end, previousEnd, now);
  assert.deepEqual(period("2026-10-20", "2026-11-20"), {
    periodStart: "2026-10-20",
    periodEnd: "2026-11-20T16:59:59.000Z",
  });
  for (const [start, end] of [
    ["", ""],
    ["2026-02-30", "2026-11-20"],
    ["2026-11-20", "2026-10-20"],
    ["2026-10-19", "2026-11-20"],
    ["2026-10-20", "2028-01-01"],
    ["2026-10-01", "2026-10-02"],
  ])
    assert.throws(() => period(start, end));
});

test("tenant pagination returns to an existing page after the result count shrinks", () => {
  assert.equal(rules.tenantPage(20, 1), 0);
  assert.equal(rules.tenantPage(0, 8), 0);
  assert.equal(rules.tenantPage(41, 2), 2);
});

test("shared password control preserves its label, value and autocomplete while toggling", async (t) => {
  const renderer = await mount(t, ui.PasswordField, {
    label: "Mật khẩu",
    id: "password",
    value: "Fixture-123!",
    readOnly: true,
    autoComplete: "new-password",
  });
  const input = () => renderer.root.findByType("input");
  assert.equal(
    renderer.root.findByType("label").props.htmlFor,
    input().props.id,
  );
  assert.equal(input().props.type, "password");
  await act(async () => renderer.root.findByType("button").props.onClick());
  assert.equal(input().props.type, "text");
  assert.equal(input().props.value, "Fixture-123!");
  assert.equal(input().props.autoComplete, "new-password");
  assert.equal(renderer.root.findByType("button").props.type, "button");
  assert.equal(
    renderer.root.findByType("button").props["aria-label"],
    "Ẩn mật khẩu",
  );
});

test("domain settings retain a dirty draft when reload is cancelled", async (t) => {
  environment(t);
  let reads = 0;
  const Panel = domainPanel({
    domainSettings: async () => {
      ++reads;
      return { baseDomain: "old.test", revision: 1 };
    },
  });
  const renderer = await mount(t, Panel, { onSaved: noop });
  await act(async () =>
    renderer.root
      .findByType("input")
      .props.onChange({ target: { value: "draft.test" } }),
  );
  await act(async () =>
    button(renderer, "Tải lại cấu hình tên miền").props.onClick(),
  );
  assert.equal(reads, 1);
  await act(async () =>
    renderer.root.findByType("test-discard").props.cancel(),
  );
  assert.equal(renderer.root.findByType("input").props.value, "draft.test");
  assert.equal(reads, 1);
});

test("saved domain changes cannot be submitted again when the follow-up read fails", async (t) => {
  environment(t);
  let reads = 0,
    writes = 0;
  const Panel = domainPanel({
    domainSettings: async () => {
      if (++reads > 1) throw new Error("offline");
      return { baseDomain: "old.test", revision: 1 };
    },
    setDomainSettings: async () => {
      ++writes;
    },
  });
  const renderer = await mount(t, Panel, { onSaved: noop });
  await act(async () =>
    renderer.root
      .findByType("input")
      .props.onChange({ target: { value: "new.test" } }),
  );
  await act(async () => {
    await renderer.root.findByType("form").props.onSubmit(event);
  });
  assert.match(text(renderer), /Đã lưu tên miền nhưng chưa tải được/);
  assert.equal(button(renderer, "Lưu cấu hình tên miền").props.disabled, true);
  assert.equal(renderer.root.findByType("input").props.disabled, true);
  await act(async () => {
    await renderer.root.findByType("form").props.onSubmit(event);
  });
  assert.equal(writes, 1);
});

function consoleModule(api, components = {}) {
  class PlatformError extends Error {}
  return loadComponent(
    "components/platform/platform-console.tsx",
    {
      "@/lib/platform-api": {
        platformApi: api,
        PlatformError,
        onPlatformSessionExpired: () => noop,
      },
      "./domain-provision-panel": { DomainProvisionPanel: () => null },
    "@/lib/tenant-domains": { previewTenantDomains: () => [] },
      "@/lib/console-rules": rules,
      "@/lib/tenant-quota": loadComponent("lib/tenant-quota.ts"),
      "@/lib/use-unsaved-changes": hooks,
      "./console-ui": {
        ...ui,
        Modal,
        DiscardChangesDialog: (props) =>
          React.createElement("test-discard", props),
      },
      "./tenant-panel": { TenantPanel: () => null },
      "./domain-settings-panel": { DomainSettingsPanel: () => null },
      "./admin-accounts-panel": { AdminAccountsPanel: () => null },
      "./billing-orders-panel": { BillingOrdersPanel: () => null },
      ...components,
    },
    "\nexport { NewPlan };",
  );
}

test("plan dialog guards drafts and blocks closing and duplicate submissions while saving", async (t) => {
  environment(t);
  const previous = globalThis.FormData;
  globalThis.FormData = class {
    get(name) {
      return {
        name: "Fixture",
        code: "fixture",
        storage: "5",
        tokens: "100",
        emails: "10",
        ai: "on",
      }[name];
    }
  };
  t.after(() => {
    globalThis.FormData = previous;
  });
  let finish,
    writes = 0;
  const { NewPlan } = consoleModule({
    createPlan: () => {
      ++writes;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const renderer = await mount(t, NewPlan, { done: noop, close: noop });
  await act(async () => renderer.root.findByType("form").props.onChange());
  assert.equal(
    renderer.root.findByType("test-modal").props.confirmDiscard,
    true,
  );
  let saving;
  await act(async () => {
    saving = renderer.root.findByType("form").props.onSubmit(event);
    await settle();
  });
  assert.equal(
    renderer.root.findByType("test-modal").props.closeDisabled,
    true,
  );
  assert.equal(renderer.root.findByType("fieldset").props.disabled, true);
  await act(async () => {
    await renderer.root.findByType("form").props.onSubmit(event);
  });
  assert.equal(writes, 1);
  await act(async () => {
    finish();
    await saving;
  });
});

test("plan sale editor sends prices and revision, preserves existing quotas, and reports conflicts", async (t) => {
  environment(t);
  const previous = globalThis.FormData;
  const fields = { name: "Gói mới", description: "Giá mới", tier: "3", sortOrder: "2", publicSale: "on", active: "on", MONTH: "456000", YEAR: "" };
  globalThis.FormData = class { get(name) { return fields[name] ?? null; } };
  t.after(() => { globalThis.FormData = previous; });
  let saved;
  const { NewPlan } = consoleModule({
    updatePlanSale: async (id, input) => {
      saved = { id, input };
      throw new Error("Dữ liệu đã thay đổi; hãy tải lại");
    },
  });
  const renderer = await mount(t, NewPlan, { done: noop, close: noop, plan: {
    id: "plan", code: "school_pro", name: "Gói cũ", revision: 7, active: true, publicSale: true, tier: 2, sortOrder: 1,
    limits: { storage_bytes: 5 * 1024 ** 3, ai_tokens: 1000000, email_messages: 5000 }, features: { ai: true }, prices: { MONTH: 300000, YEAR: 3000000 },
  } });
  assert.equal(renderer.root.findAllByType("input").find((node) => node.props.name === "storage").props.disabled, true);
  await act(async () => { await renderer.root.findByType("form").props.onSubmit(event); });
  assert.deepEqual(saved, { id: "plan", input: { name: "Gói mới", description: "Giá mới", tier: 3, sortOrder: 2, publicSale: true, active: true, prices: { MONTH: 456000 }, expectedRevision: 7 } });
  assert.match(text(renderer), /Dữ liệu đã thay đổi/);
  assert.equal(renderer.root.findByType("fieldset").props.disabled, false);
});

test("public plans require a valid price before creation", async (t) => {
  environment(t);
  const previous = globalThis.FormData;
  const fields = { name: "Gói mới", code: "school_pro", storage: "5", tokens: "1000", emails: "100", tier: "1", sortOrder: "0", publicSale: "on", MONTH: "", YEAR: "" };
  globalThis.FormData = class { get(name) { return fields[name] ?? null; } };
  t.after(() => { globalThis.FormData = previous; });
  let writes = 0;
  const { NewPlan } = consoleModule({ createPlan: async () => { ++writes; } });
  const renderer = await mount(t, NewPlan, { done: noop, close: noop });
  await act(async () => { await renderer.root.findByType("form").props.onSubmit(event); });
  assert.equal(writes, 0);
  assert.match(text(renderer), /ít nhất một giá/);
  fields.MONTH = "1999";
  await act(async () => { await renderer.root.findByType("form").props.onSubmit(event); });
  assert.equal(writes, 0);
  assert.match(text(renderer), /2.000/);
});

test("a failed overview request does not hide a successfully loaded school directory", async (t) => {
  environment(t);
  const { PlatformConsole } = consoleModule({
    me: async () => ({ id: "operator", accountName: "admin", active: true }),
    overview: async () => {
      throw new Error("Overview unavailable");
    },
    tenants: async () => ({
      data: [
        {
          id: "school",
          name: "Fixture school",
          slug: "fixture",
          status: "ACTIVE",
          createdAt: "2026-10-20T00:00:00Z",
        },
      ],
      total: 1,
    }),
    plans: async () => [],
  });
  const renderer = await mount(t, PlatformConsole);
  assert.match(text(renderer), /Fixture school/);
  assert.match(text(renderer), /Overview unavailable/);
});

test("unsaved domain settings require confirmation before switching tabs", async (t) => {
  environment(t);
  function DraftDomain({ onDirtyChange }) {
    React.useEffect(() => {
      onDirtyChange(true);
      return () => onDirtyChange(false);
    }, [onDirtyChange]);
    return React.createElement("test-domain");
  }
  const { PlatformConsole } = consoleModule(
    {
      me: async () => ({ accountName: "admin" }),
      overview: async () => ({
        total: 0,
        active: 0,
        pending: 0,
        failed: 0,
        suspended: 0,
      }),
      tenants: async () => ({ data: [], total: 0 }),
      plans: async () => [],
    },
    { "./domain-settings-panel": { DomainSettingsPanel: DraftDomain }, "./admin-accounts-panel": { AdminAccountsPanel: () => null },
      "./billing-orders-panel": { BillingOrdersPanel: () => null } },
  );
  const renderer = await mount(t, PlatformConsole);
  await act(async () => button(renderer, "Tên miền").props.onClick());
  await act(async () => button(renderer, "Gói dịch vụ").props.onClick());
  assert.equal(renderer.root.findAllByType("test-domain").length, 1);
  await act(async () =>
    renderer.root.findByType("test-discard").props.cancel(),
  );
  assert.equal(renderer.root.findAllByType("test-domain").length, 1);
  await act(async () => button(renderer, "Gói dịch vụ").props.onClick());
  await act(async () =>
    renderer.root.findByType("test-discard").props.discard(),
  );
  assert.equal(renderer.root.findAllByType("test-domain").length, 0);
});

test("refreshing a directory whose last page vanished reloads the last valid page", async (t) => {
  environment(t);
  const calls = [];
  let total = 21;
  const { PlatformConsole } = consoleModule({
    me: async () => ({ accountName: "admin" }),
    overview: async () => ({
      total: 21,
      active: 21,
      pending: 0,
      failed: 0,
      suspended: 0,
    }),
    tenants: async (_query, _status, page) => {
      calls.push(page);
      return { data: [], total };
    },
    plans: async () => [],
  });
  const renderer = await mount(t, PlatformConsole);
  await act(async () => {
    button(renderer, "Sau").props.onClick();
    await settle();
  });
  total = 20;
  await act(async () => {
    button(renderer, "Làm mới").props.onClick();
    await settle();
  });
  assert.deepEqual(calls, [0, 1, 1, 0]);
  assert.doesNotMatch(text(renderer), /21–20/);
});

test("date formatting follows Vietnam time even for an evening UTC timestamp", () => {
  assert.match(ui.dateOnlyText("2026-10-20T23:00:00Z"), /21\/10\/2026/);
});

test("conflicted tenant drafts use the shared discard confirmation before reload", async (t) => {
  environment(t);
  const api = {
    tenant: async () => ({
      tenant: { name: "Fixture", slug: "fixture", status: "ACTIVE" },
      domains: [],
    }),
    tenantProfile: async () => ({
      name: "Fixture",
      slug: "fixture",
      baseDomain: "example.test",
      revision: 1,
    }),
    settings: async () => ({
      displayName: "Fixture",
      primaryColor: "#2563eb",
      revision: 1,
    }),
    subscription: async () => ({
      planId: "plan",
      status: "ACTIVE",
      periodStart: "2026-01-01",
      periodEnd: "2030-01-01T00:00:00Z",
      revision: 1,
    }),
    usage: async () => [],
    quota: async () => ({additional:{ai_tokens:0,email_messages:0,storage_bytes:0},limits:{},revision:0}),
    updateTenant: async () => {
      throw Object.assign(new Error("conflict"), { status: 409 });
    },
  };
  const { TenantPanel } = loadComponent(
    "components/platform/tenant-panel.tsx",
    {
      "./tenant-admin-password-panel": { TenantAdminPasswordPanel: () => null },
      "./tenant-usage-panel": { TenantUsagePanel: () => null },
      "@/lib/platform-api": { platformApi: api },
      "./domain-provision-panel": { DomainProvisionPanel: () => null },
    "@/lib/tenant-domains": { previewTenantDomains: () => [] },
      "@/lib/tenant-portal": { tenantPortalUrl: () => "" },
      "@/lib/use-unsaved-changes": hooks,
      "@/lib/console-rules": rules,
      "@/lib/tenant-quota": loadComponent("lib/tenant-quota.ts"),
      "./console-ui": {
        ...ui,
        Modal,
        DiscardChangesDialog: (props) =>
          React.createElement("test-discard", props),
      },
    },
  );
  const renderer = await mount(t, TenantPanel, {
    id: "school",
    plans: [{ id: "plan", active: true, limits: {} }],
    close: noop,
    updated: noop,
  });
  const nameInput = () =>
    renderer.root
      .findAllByType("input")
      .find(
        (node) =>
          node.props.value === "Fixture" || node.props.value === "Draft",
      );
  await act(async () =>
    nameInput().props.onChange({ target: { value: "Draft" } }),
  );
  await act(async () => {
    await renderer.root.findByType("form").props.onSubmit(event);
  });
  await act(async () => button(renderer, "Tải lại thông tin").props.onClick());
  assert.equal(renderer.root.findAllByType("test-discard").length, 1);
  await act(async () =>
    renderer.root.findByType("test-discard").props.cancel(),
  );
  assert.equal(nameInput().props.value, "Draft");
});

test("an unavailable overview does not turn an empty but loaded plan list into an error", async (t) => {
  environment(t);
  const { PlatformConsole } = consoleModule({
    me: async () => ({ accountName: "admin" }),
    overview: async () => {
      throw new Error("Overview unavailable");
    },
    tenants: async () => ({ data: [], total: 0 }),
    plans: async () => [],
  });
  const renderer = await mount(t, PlatformConsole);
  await act(async () => button(renderer, "Gói dịch vụ").props.onClick());
  assert.match(text(renderer), /Chưa có gói dịch vụ/);
  assert.doesNotMatch(text(renderer), /Chưa tải được gói dịch vụ/);
});


test("admin account tab omits school actions and metrics while the schools tab retains them", async t => {
  environment(t);
  const {PlatformConsole} = consoleModule({
    me: async () => ({accountName:"operator"}),
    overview: async () => ({total:1,active:1,pending:0,failed:0,suspended:0}),
    tenants: async () => ({data:[],total:0}), plans: async () => [],
  }, {"./admin-accounts-panel":{AdminAccountsPanel:()=>React.createElement("test-accounts")}});
  const renderer = await mount(t,PlatformConsole);
  await act(async () => button(renderer,"Quản trị trường").props.onClick());
  assert.equal(renderer.root.findAllByType("test-accounts").length,1);
  assert.equal(button(renderer,"Tạo trường"),undefined);
  assert.equal(button(renderer,"Làm mới"),undefined);
  assert.doesNotMatch(text(renderer),/Tổng trường học|Chờ tạo trường/);
  assert.match(text(renderer),/Tài khoản quản trị trường/);
  await act(async () => button(renderer,"Trường học").props.onClick());
  assert.ok(button(renderer,"Tạo trường"));
  assert.ok(button(renderer,"Làm mới"));
});
