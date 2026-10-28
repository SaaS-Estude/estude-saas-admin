import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadComponent } from "./component-loader.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { Modal, lockModalScroll } = loadComponent(
  "components/platform/console-ui.tsx", {}, "\nexport { lockModalScroll };",
);
function documentFixture() {
  const listeners = new Set();
  return {
    documentElement: { style: { overflow: "auto" }, clientWidth: 980 },
    body: { style: { overflow: "scroll", paddingRight: "4px" } },
    defaultView: { innerWidth: 1000, getComputedStyle: () => ({ paddingRight: "4px" }) },
    activeElement: null,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
    listeners,
  };
}

test("modal locks the root and body, compensates the gutter and restores original styles", () => {
  const doc = documentFixture();
  const release = lockModalScroll(doc);
  assert.equal(doc.documentElement.style.overflow, "hidden");
  assert.equal(doc.body.style.overflow, "hidden");
  assert.equal(doc.body.style.paddingRight, "24px");
  release();
  assert.equal(doc.documentElement.style.overflow, "auto");
  assert.deepEqual(doc.body.style, { overflow: "scroll", paddingRight: "4px" });
  release(); // Effect cleanups must be safe to repeat.
  const next = lockModalScroll(doc);
  next();
  assert.equal(doc.documentElement.style.overflow, "auto");
});

for (const parentFirst of [true, false]) {
  test(`nested dialogs keep the background locked when ${parentFirst ? "parent" : "child"} closes first`, () => {
    const doc = documentFixture();
    const releases = [lockModalScroll(doc), lockModalScroll(doc)];
    assert.equal(doc.body.style.paddingRight, "24px");
    releases[parentFirst ? 0 : 1]();
    assert.equal(doc.documentElement.style.overflow, "hidden");
    assert.equal(doc.body.style.overflow, "hidden");
    releases[parentFirst ? 1 : 0]();
    assert.equal(doc.documentElement.style.overflow, "auto");
    assert.equal(doc.body.style.paddingRight, "4px");
  });
}

test("hidden parent retains its scroll lock while only the confirmation handles keyboard input", async (t) => {
  const previousDocument = globalThis.document;
  const previousElement = globalThis.HTMLElement;
  const doc = documentFixture();
  globalThis.document = doc;
  globalThis.HTMLElement = class {};
  let renderer;
  t.after(async () => {
    if (renderer) await act(() => renderer.unmount());
    globalThis.document = previousDocument;
    globalThis.HTMLElement = previousElement;
  });
  const parent = (hidden) => React.createElement(Modal, { key: "parent", title: "School", close() {}, hidden }, "Long form");
  await act(() => {
    renderer = create(parent(false), {
      createNodeMock: () => ({ querySelectorAll: () => [] }),
    });
  });
  assert.equal(doc.documentElement.style.overflow, "hidden");
  assert.equal(doc.listeners.size, 1);
  await act(() => renderer.update(React.createElement(React.Fragment, null,
    parent(true), React.createElement(Modal, { key: "child", title: "Confirm", close() {} }, "Discard?"),
  )));
  assert.equal(doc.listeners.size, 1);
  assert.equal(doc.body.style.overflow, "hidden");
  await act(() => renderer.update(parent(false)));
  assert.equal(doc.listeners.size, 1);
  assert.equal(doc.documentElement.style.overflow, "hidden");
  await act(() => renderer.unmount());
  renderer = null;
  assert.equal(doc.listeners.size, 0);
  assert.equal(doc.documentElement.style.overflow, "auto");
  assert.equal(doc.body.style.overflow, "scroll");
});
