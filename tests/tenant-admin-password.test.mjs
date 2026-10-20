import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadComponent } from "./component-loader.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const ui = loadComponent("components/platform/console-ui.tsx");
const hooks = loadComponent("lib/use-unsaved-changes.ts");
const noop = () => {};
const settle = () => new Promise(setImmediate);
const event = { preventDefault: noop };
const accounts = [
  {
    id: "admin-a",
    accountName: "school.admin",
    fullName: "Admin",
    status: "ACTIVE",
  },
  {
    id: "admin-b",
    accountName: "other.admin",
    fullName: "Other",
    status: "SUSPENDED",
  },
];
const text = (renderer) => JSON.stringify(renderer.toJSON());
const submit = (renderer) =>
  renderer.root.findByType("form").props.onSubmit(event);
const inputs = (renderer) => renderer.root.findAllByType("input");

async function mount(t, api, props = {}) {
  const previous = globalThis.window;
  globalThis.window = { addEventListener: noop, removeEventListener: noop };
  const { TenantAdminPasswordPanel } = loadComponent(
    "components/platform/tenant-admin-password-panel.tsx",
    {
      "@/lib/platform-api": {
        platformApi: { tenantAdminAccounts: async () => accounts, ...api },
      },
      "@/lib/use-unsaved-changes": hooks,
      "./console-ui": ui,
    },
  );
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(TenantAdminPasswordPanel, {
        id: "school-a",
        onDirtyChange: noop,
        onBusyChange: noop,
        ...props,
      }),
    );
    await settle();
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
    if (previous) globalThis.window = previous;
    else delete globalThis.window;
  });
  return renderer;
}

async function fill(renderer, password, confirmation = password) {
  await act(async () => {
    inputs(renderer)[0].props.onChange({ target: { value: password } });
    inputs(renderer)[1].props.onChange({ target: { value: confirmation } });
  });
}

test("admin reset rejects weak, mismatching and oversized UTF-8 credentials before sending", async (t) => {
  let writes = 0;
  const renderer = await mount(t, {
    resetTenantAdminPassword: async () => {
      ++writes;
    },
  });
  for (const [password, confirmation] of [
    ["ValidReset123!", "different"],
    ["short", "short"],
    ["Has space123!", "Has space123!"],
    ["nouppercase123!", "nouppercase123!"],
    ["A1!" + "ệ".repeat(43), "A1!" + "ệ".repeat(43)],
  ]) {
    await fill(renderer, password, confirmation);
    await act(async () => {
      await submit(renderer);
    });
    assert.equal(renderer.root.findAllByProps({ role: "alert" }).length, 1);
  }
  assert.equal(writes, 0);
});

test("admin reset sends the selected school account once, locks while saving and clears credentials on success", async (t) => {
  const calls = [],
    dirty = [],
    busy = [];
  let finish;
  const renderer = await mount(
    t,
    {
      resetTenantAdminPassword: (...args) => {
        calls.push(args);
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
    {
      onDirtyChange: (value) => dirty.push(value),
      onBusyChange: (value) => busy.push(value),
    },
  );
  await act(async () =>
    renderer.root
      .findByType("select")
      .props.onChange({ target: { value: "admin-b" } }),
  );
  await fill(renderer, "ValidReset123!");
  assert.equal(dirty.at(-1), true);
  let saving;
  await act(async () => {
    saving = submit(renderer);
    await submit(renderer);
    await settle();
  });
  assert.deepEqual(calls, [
    ["school-a", "admin-b", "ValidReset123!", "ValidReset123!"],
  ]);
  assert.equal(renderer.root.findByType("fieldset").props.disabled, true);
  assert.equal(busy.at(-1), true);
  assert.ok(inputs(renderer).every((node) => node.props.disabled));
  await act(async () => {
    finish();
    await saving;
  });
  assert.ok(inputs(renderer).every((node) => node.props.value === ""));
  assert.match(text(renderer), /Đã đặt lại mật khẩu tài khoản other.admin/);
  assert.match(text(renderer), /Các phiên đăng nhập cũ đã được thu hồi/);
  assert.equal(dirty.at(-1), false);
  assert.equal(busy.at(-1), false);
});

test("switching target accounts clears the password draft and server failures never show success", async (t) => {
  const renderer = await mount(t, {
    resetTenantAdminPassword: async () => {
      throw new Error("Không đủ quyền");
    },
  });
  await fill(renderer, "ValidReset123!");
  await act(async () =>
    renderer.root
      .findByType("select")
      .props.onChange({ target: { value: "admin-b" } }),
  );
  assert.ok(inputs(renderer).every((node) => node.props.value === ""));
  await fill(renderer, "ValidReset123!");
  await act(async () => {
    await submit(renderer);
  });
  assert.match(text(renderer), /Không đủ quyền/);
  assert.doesNotMatch(text(renderer), /Đã đặt lại mật khẩu tài khoản/);
  assert.equal(inputs(renderer)[0].props.value, "ValidReset123!");
});

test("unavailable admin accounts can be reloaded without offering an empty reset form", async (t) => {
  let reads = 0;
  const renderer = await mount(t, {
    tenantAdminAccounts: async () => {
      if (++reads === 1) throw new Error("Không tải được tài khoản");
      return [];
    },
  });
  assert.match(text(renderer), /Không tải được tài khoản/);
  assert.equal(renderer.root.findAllByType("form").length, 0);
  await act(async () => {
    await renderer.root.findByType("button").props.onClick();
    await settle();
  });
  assert.match(text(renderer), /Trường chưa có tài khoản quản trị/);
  assert.equal(renderer.root.findAllByType("form").length, 0);
});
