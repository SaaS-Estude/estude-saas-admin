import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {loadComponent} from './component-loader.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const ui=loadComponent('components/platform/console-ui.tsx');
const hooks=loadComponent('lib/use-unsaved-changes.ts');
const rules=loadComponent('lib/console-rules.ts');
const logo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2r0AAAAASUVORK5CYII=';
test('logo selection stays in the draft and one confirmation saves branding; removal is explicit',async t=>{
 const oldWindow=globalThis.window,oldReader=globalThis.FileReader;
 globalThis.window={addEventListener(){},removeEventListener(){}};
 globalThis.FileReader=class {readAsDataURL(){this.result=logo;this.onload()}};
 const writes=[];
 let settings={displayName:'Trường thử nghiệm',primaryColor:'#2563eb',timezone:'Asia/Ho_Chi_Minh',revision:3};
 const api={tenant:async()=>({tenant:{name:'Trường thử nghiệm',slug:'school',status:'ACTIVE'},domains:[]}),tenantProfile:async()=>({name:'Trường thử nghiệm',slug:'school',baseDomain:'example.test',revision:1}),settings:async()=>({...settings}),subscription:async()=>({planId:'plan',status:'ACTIVE',periodStart:'2026-01-01',periodEnd:'2030-01-01T00:00:00Z',revision:1}),usage:async()=>[],updateTenant:async(id,input)=>{writes.push({id,input});settings={...settings,...input.settings,revision:settings.revision+1}}};
 const {TenantPanel}=loadComponent('components/platform/tenant-panel.tsx',{
  'next/image':{default:p=>React.createElement('img',p)},
  '@/lib/platform-api':{platformApi:api},'./tenant-admin-password-panel':{TenantAdminPasswordPanel:()=>null},
  './domain-provision-panel':{DomainProvisionPanel:()=>null},'@/lib/tenant-domains':{previewTenantDomains:()=>[]},'@/lib/tenant-portal':{tenantPortalUrl:()=>''},'@/lib/use-unsaved-changes':hooks,'@/lib/console-rules':rules,
  './console-ui':{...ui,Modal:({children,footer,close})=>React.createElement('test-modal',null,children,typeof footer==='function'?footer(close):footer),DiscardChangesDialog:()=>null},
 });
 let renderer;await act(async()=>{renderer=create(React.createElement(TenantPanel,{id:'school-id',plans:[{id:'plan',active:true,limits:{}}],close(){},updated(){}}));await new Promise(setImmediate);});
 t.after(async()=>{await act(async()=>renderer.unmount());globalThis.window=oldWindow;globalThis.FileReader=oldReader});
 const file=renderer.root.findByProps({'aria-label':'Chọn logo trường'});
 await act(async()=>{file.props.onChange({target:{files:[{type:'image/svg+xml',size:10}],value:''}});await new Promise(setImmediate)});
 assert.match(JSON.stringify(renderer.toJSON()),/Chọn ảnh PNG/);assert.equal(writes.length,0);
 await act(async()=>{file.props.onChange({target:{files:[{type:'image/png',size:100}],value:''}});await new Promise(setImmediate)});
 assert.equal(renderer.root.findByType('img').props.src,logo);assert.equal(writes.length,0);
 await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate)});
 assert.deepEqual(writes,[{id:'school-id',input:{settings:{displayName:'Trường thử nghiệm',primaryColor:'#2563eb',expectedRevision:3,logoDataUrl:logo}}}]);
 const remove=renderer.root.findAllByType('button').find(node=>node.children.includes('Gỡ logo'));
 await act(async()=>remove.props.onClick());assert.equal(writes.length,1);
 await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate)});
 assert.equal(writes[1].input.settings.logoDataUrl,'');
});
