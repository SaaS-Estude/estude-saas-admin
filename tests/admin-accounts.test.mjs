import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadComponent } from "./component-loader.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const ui = loadComponent("components/platform/console-ui.tsx");
const hooks = loadComponent("lib/use-unsaved-changes.ts");
const noop = () => {};
const event = { preventDefault() {} };
const account = {
  id: "admin-a",
  tenantId: "school-a",
  schoolName: "Trường A",
  slug: "school-a",
  accountName: "admin",
  fullName: "Quản trị A",
  status: "ACTIVE",
};
const school = {
  id: "school-a",
  name: "Trường A",
  slug: "school-a",
  status: "ACTIVE",
};
const text = (renderer) => JSON.stringify(renderer.toJSON());
const button = (renderer, label) =>
  renderer.root
    .findAllByType("button")
    .find(
      (node) =>
        node.children.filter((child) => typeof child === "string").join("") ===
        label,
    );
async function mount(t, overrides = {}) {
  const old = globalThis.window;
  globalThis.window = { addEventListener: noop, removeEventListener: noop };
  const calls = [],
    dirty = [],
    busy = [];
  const api = {
    adminDirectory: async (...args) => {
      calls.push(args);
      return { items: [account], total: 1 };
    },
    tenants: async () => ({ data: [school], total: 1 }),
    ...overrides,
  };
  const { TenantAdminPasswordPanel } = loadComponent(
    "components/platform/tenant-admin-password-panel.tsx",
    {
      "@/lib/platform-api": { platformApi: api },
      "@/lib/use-unsaved-changes": hooks,
      "./console-ui": ui,
    },
  );
  const { AdminAccountsPanel } = loadComponent(
    "components/platform/admin-accounts-panel.tsx",
    {
      "@/lib/platform-api": { platformApi: api },
      "@/lib/use-unsaved-changes": hooks,
      "./tenant-admin-password-panel": { TenantAdminPasswordPanel },
      "./console-ui": {
        ...ui,
        Modal: ({ children, ...props }) =>
          React.createElement("test-modal", props, children),
        DiscardChangesDialog: (props) =>
          React.createElement("test-discard", props),
      },
    },
  );
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(AdminAccountsPanel, {
        onDirtyChange: (value) => dirty.push(value),
        onBusyChange: (value) => busy.push(value),
      }),
    );
    await new Promise(setImmediate);
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 230)));
  t.after(async () => {
    await act(async () => renderer.unmount());
    if (old) globalThis.window = old;
    else delete globalThis.window;
  });
  const change = async (label, value) =>
    act(async () =>
      renderer.root
        .findByProps({ "aria-label": label })
        .props.onChange({ target: { value } }),
    );
  const submit = async () =>
    act(async () => {
      await renderer.root
        .findByType("test-modal")
        .findByType("form")
        .props.onSubmit(event);
    });
  return { renderer, calls, dirty, busy, change, submit };
}

test("directory filters by school, account and status and password form binds the clicked account", async (t) => {
  const writes = [];
  const f = await mount(t, {
    resetTenantAdminPassword: async (...args) => writes.push(args),
  });
  assert.match(text(f.renderer), /Trường A/);
  assert.equal(button(f.renderer, "Cấp tài khoản").props.disabled, true);
  await f.change("Trường quản trị", "school-a");
  assert.equal(f.calls.at(-1)[1], "school-a");
  await f.change("Trạng thái quản trị", "LOCKED");
  await f.change("Tìm tài khoản quản trị", "admin");
  await act(async () =>
    f.renderer.root.findByType("form").props.onSubmit(event),
  );
  assert.deepEqual(f.calls.at(-1), ["admin", "school-a", "LOCKED", 0]);
  await act(async () => button(f.renderer, "Đổi mật khẩu").props.onClick());
  const modal = f.renderer.root.findByType("test-modal");
  assert.equal(modal.findAllByType("select").length, 0);
  assert.equal(
    modal.findAllByType("input").find((node) => node.props.readOnly).props
      .value,
    "admin — Quản trị A",
  );
  for (const input of modal
    .findAllByType("input")
    .filter((node) => node.props.autoComplete === "new-password"))
    await act(async () =>
      input.props.onChange({ target: { value: "NewSchool123!" } }),
    );
  await f.submit();
  assert.deepEqual(writes, [
    ["school-a", "admin-a", "NewSchool123!", "NewSchool123!"],
  ]);
  assert.equal(f.dirty.at(-1), false);
});

test("locking confirms the exact school/account, sends expected status once and blocks closing while saving", async (t) => {
  const writes = [];
  let finish;
  const f = await mount(t, {
    setTenantAdminStatus: (...args) => {
      writes.push(args);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  await act(async () => button(f.renderer, "Khóa").props.onClick());
  assert.match(text(f.renderer), /Trường A · admin/);
  assert.equal(writes.length, 0);
  let saving;
  await act(async () => {
    const form = f.renderer.root.findByType("test-modal").findByType("form");
    saving = form.props.onSubmit(event);
    await form.props.onSubmit(event);
  });
  assert.deepEqual(writes, [["school-a", "admin-a", "LOCKED", "ACTIVE"]]);
  assert.equal(f.busy.at(-1), true);
  assert.equal(
    f.renderer.root.findByType("test-modal").props.closeDisabled,
    true,
  );
  await act(async () => f.renderer.root.findByType("test-modal").props.close());
  assert.equal(f.renderer.root.findAllByType("test-modal").length, 1);
  await act(async () => {
    finish();
    await saving;
  });
  assert.equal(f.renderer.root.findAllByType("test-modal").length, 0);
  assert.match(text(f.renderer), /Đã khóa tài khoản admin/);
});

test("fourth-account failure retains draft without success and closing requires discarding", async (t) => {
  const writes = [];
  const f = await mount(t, {
    createTenantAdmin: async (...args) => {
      writes.push(args);
      throw Error("Mỗi trường chỉ được cấp tối đa 3 tài khoản quản trị");
    },
  });
  await f.change("Trường quản trị", "school-a");
  await act(async () => button(f.renderer, "Cấp tài khoản").props.onClick());
  await f.change("Họ tên quản trị", "Admin mới");
  await f.change("Tên đăng nhập quản trị", "admin.new");
  for (const input of f.renderer.root
    .findByType("test-modal")
    .findAllByType("input")
    .filter((node) => node.props.autoComplete === "new-password"))
    await act(async () =>
      input.props.onChange({ target: { value: "NewSchool123!" } }),
    );
  await f.submit();
  assert.equal(writes.length, 1);
  assert.match(text(f.renderer), /tối đa 3/);
  assert.doesNotMatch(text(f.renderer), /Đã cấp tài khoản/);
  assert.equal(
    f.renderer.root.findByProps({ "aria-label": "Tên đăng nhập quản trị" })
      .props.value,
    "admin.new",
  );
  await act(async () => f.renderer.root.findByType("test-modal").props.close());
  assert.equal(f.renderer.root.findAllByType("test-discard").length, 1);
  await act(async () =>
    f.renderer.root.findByType("test-discard").props.discard(),
  );
  assert.equal(f.renderer.root.findAllByType("test-modal").length, 0);
  assert.equal(f.dirty.at(-1), false);
});

test("create validates passwords and clears credentials after successful allocation", async (t) => {
  const writes = [];
  const f = await mount(t, {
    createTenantAdmin: async (...args) => writes.push(args),
  });
  await f.change("Trường quản trị", "school-a");
  await act(async () => button(f.renderer, "Cấp tài khoản").props.onClick());
  await f.change("Họ tên quản trị", "Admin mới");
  await f.change("Tên đăng nhập quản trị", "admin.new");
  const inputs = () =>
    f.renderer.root
      .findByType("test-modal")
      .findAllByType("input")
      .filter((node) => node.props.autoComplete === "new-password");
  for (const input of inputs())
    await act(async () => input.props.onChange({ target: { value: "weak" } }));
  await f.submit();
  assert.equal(writes.length, 0);
  for (const input of inputs())
    await act(async () =>
      input.props.onChange({ target: { value: "NewSchool123!" } }),
    );
  await f.submit();
  assert.deepEqual(writes, [
    [
      "school-a",
      {
        fullName: "Admin mới",
        accountName: "admin.new",
        newPassword: "NewSchool123!",
        confirmNewPassword: "NewSchool123!",
      },
    ],
  ]);
  assert.match(text(f.renderer), /Đã cấp tài khoản admin.new/);
  assert.equal(f.dirty.at(-1), false);
  assert.equal(f.renderer.root.findAllByType("test-modal").length, 0);
});
