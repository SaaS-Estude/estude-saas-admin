import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadComponent } from "./component-loader.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("domain status hides premature login, synchronizes once and exposes ready link",async(t) => {
  const previous = {setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
  globalThis.setInterval = () => 1;globalThis.clearInterval = () => {};
  t.after(() => Object.assign(globalThis,previous));
  let next = {domains:[{hostname:"admin-school.estude.io.vn",portal:"admin",status:"WAITING"}]};
  let syncs = 0, release;
  const pending = new Promise(resolve => {release = resolve;});
  const {DomainProvisionPanel} = loadComponent("components/platform/domain-provision-panel.tsx",{
    "@/lib/platform-api":{platformApi:{tenant:async() => next,domainSettings:async() => ({automationEnabled:true}),syncDomains:async() => {++syncs;await pending;}}},
    "@/lib/tenant-portal":{tenantPortalUrl:host => `https://${host}/login`},
    "./console-ui":{Notice:({children}) => React.createElement("div",null,children),errorText:e => String(e),secondaryClass:""},
  });
  let renderer;await act(async() => {renderer = create(React.createElement(DomainProvisionPanel,{id:"school"}));});
  assert.equal(renderer.root.findAllByType("a").length,0);
  const button = () => renderer.root.findByType("button");
  await act(async() => {void button().props.onClick();});
  assert.equal(syncs,1);assert.equal(button().props.disabled,true);
  next = {domains:[{...next.domains[0],status:"READY"}]};
  await act(async() => {release();await pending;});
  assert.equal(renderer.root.findByType("a").props.href,"https://admin-school.estude.io.vn/login");
  assert.equal(button().props.disabled,false);
  await act(async() => renderer.unmount());
});
