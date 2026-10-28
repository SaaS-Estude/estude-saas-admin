import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadComponent } from "./component-loader.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const tenantDomains = loadComponent("lib/tenant-domains.ts");

test("domain status hides premature login, synchronizes once and exposes ready link",async(t) => {
  const previous = {setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
  globalThis.setInterval = () => 1;globalThis.clearInterval = () => {};
  t.after(() => Object.assign(globalThis,previous));
  let next = {tenant:{slug:"school"},domains:[{hostname:"admin-school.estude.io.vn",portal:"admin",status:"WAITING"}]};
  let syncs = 0, release;
  const pending = new Promise(resolve => {release = resolve;});
  const {DomainProvisionPanel} = loadComponent("components/platform/domain-provision-panel.tsx",{
    "@/lib/platform-api":{platformApi:{tenant:async() => next,domainSettings:async() => ({automationEnabled:true,automationBaseDomain:"estude.io.vn"}),syncDomains:async() => {++syncs;await pending;}}},
    "@/lib/tenant-domains":tenantDomains,
    "@/lib/tenant-portal":{tenantPortalUrl:host => `https://${host}/login`},
    "./console-ui":{Notice:({children}) => React.createElement("div",null,children),errorText:e => String(e),secondaryClass:""},
  });
  let renderer;await act(async() => {renderer = create(React.createElement(DomainProvisionPanel,{id:"school"}));});
  assert.equal(renderer.root.findAllByType("a").length,0);
  const button = () => renderer.root.findByType("button");
  await act(async() => {void button().props.onClick();});
  assert.equal(syncs,1);assert.equal(button().props.disabled,true);
  next = {...next,domains:[{...next.domains[0],status:"READY"}]};
  await act(async() => {release();await pending;});
  assert.equal(renderer.root.findByType("a").props.href,"https://admin-school.estude.io.vn/login");
  assert.equal(button().props.disabled,false);
  await act(async() => renderer.unmount());
});

for (const oldHostname of ["admin.lequydonlequy.saas.estude.io.vn","admin-lequydonlequy.saas.estude.io.vn"]) {
  test(`conversion removes the legacy base from ${oldHostname}`,async(t) => {
    const previous = {setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
    globalThis.setInterval = () => 1;globalThis.clearInterval = () => {};
    t.after(() => Object.assign(globalThis,previous));
    const profile = {name:"Trường Lê Quý Đôn",slug:"lequydonlequy",baseDomain:"saas.estude.io.vn",revision:7};
    let detail = {tenant:{slug:profile.slug},domains:[{hostname:oldHostname,portal:"admin",status:"ERROR"}]};
    const updates = [];
    let changed = 0;
    const {DomainProvisionPanel} = loadComponent("components/platform/domain-provision-panel.tsx",{
      "@/lib/platform-api":{platformApi:{
        tenant:async() => detail,
        // Even the default may still be stale: conversion must use the managed zone.
        domainSettings:async() => ({automationEnabled:true,automationBaseDomain:"estude.io.vn",baseDomain:"saas.estude.io.vn"}),
        tenantProfile:async() => profile,
        updateTenant:async(id,input) => {
          updates.push({id,input});
          detail = {...detail,domains:tenantDomains.previewTenantDomains(profile.slug,input.profile.baseDomain).map(domain => ({hostname:domain.hostname,portal:domain.id,status:"PENDING"}))};
        },
      }},
      "@/lib/tenant-domains":tenantDomains,
      "@/lib/tenant-portal":{tenantPortalUrl:host => `https://${host}/login`},
      "./console-ui":{Notice:({children}) => React.createElement("div",null,children),errorText:e => String(e),secondaryClass:""},
    });
    let renderer;
    await act(async() => {renderer = create(React.createElement(DomainProvisionPanel,{id:"school",onChanged:async() => {++changed;}}));});
    t.after(async() => {await act(async() => renderer.unmount());});
    const conversion = () => renderer.root.findAllByType("button").find(button => button.props.children === "Chuyển địa chỉ sang một cấp và thiết lập DNS");
    assert.ok(conversion());
    for (const portal of tenantDomains.tenantPortals) {
      assert.ok(JSON.stringify(renderer.toJSON()).includes(`${portal.id}-lequydonlequy.estude.io.vn`));
    }
    await act(async() => conversion().props.onClick());
    assert.deepEqual(updates,[{id:"school",input:{profile:{name:profile.name,slug:profile.slug,baseDomain:"estude.io.vn",expectedRevision:7}}}]);
    assert.equal(changed,1);
    assert.equal(conversion(),undefined);
    assert.equal(renderer.root.findAllByType("a").length,0);
    assert.equal(JSON.stringify(renderer.toJSON()).includes("saas.estude.io.vn"),false);
  });
}

test("old address cleanup is shown separately and disappears after completion",async(t) => {
  const previous = {setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
  globalThis.setInterval = () => 1;globalThis.clearInterval = () => {};
  t.after(() => Object.assign(globalThis,previous));
  let detail = {
    tenant:{slug:"school"},
    domains:tenantDomains.previewTenantDomains("school","estude.io.vn").map(domain => ({hostname:domain.hostname,portal:domain.id,status:"READY"})),
    domainCleanup:[
      {hostname:"admin.school.saas.estude.io.vn",status:"REMOVED"},
      {hostname:"teacher.school.saas.estude.io.vn",status:"CLEANUP_ERROR",lastError:"CLEANUP_DNS_NOT_MANAGED"},
    ],
  };
  const {DomainProvisionPanel} = loadComponent("components/platform/domain-provision-panel.tsx",{
    "@/lib/platform-api":{platformApi:{
      tenant:async() => detail,
      domainSettings:async() => ({automationEnabled:true,automationBaseDomain:"estude.io.vn"}),
      syncDomains:async() => {detail = {...detail,domainCleanup:[]};},
    }},
    "@/lib/tenant-domains":tenantDomains,
    "@/lib/tenant-portal":{tenantPortalUrl:host => `https://${host}/login`},
    "./console-ui":{Notice:({children}) => React.createElement("div",null,children),errorText:e => String(e),secondaryClass:""},
  });
  let renderer;
  await act(async() => {renderer = create(React.createElement(DomainProvisionPanel,{id:"school"}));});
  t.after(async() => {await act(async() => renderer.unmount());});
  assert.ok(JSON.stringify(renderer.toJSON()).includes("Dọn địa chỉ cũ"));
  assert.ok(JSON.stringify(renderer.toJSON()).includes("Bản ghi cũ không thuộc hệ thống"));
  assert.equal(renderer.root.findAllByType("a").length,4);
  assert.ok(renderer.root.findAllByType("a").every(link => !link.props.href.includes("saas.estude.io.vn")));
  await act(async() => renderer.root.findByType("button").props.onClick());
  assert.equal(JSON.stringify(renderer.toJSON()).includes("Dọn địa chỉ cũ"),false);
});
