import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {loadComponent} from './component-loader.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const quotaHelpers=loadComponent('lib/tenant-quota.ts');
const {parseQuotaValue,quotaDraft,mib}=quotaHelpers;

test('quota parsing keeps exact bytes and rejects negative, fractional counts and overflow',()=>{
  assert.equal(parseQuotaValue('storage_bytes','1.5'),1572864);
  assert.equal(parseQuotaValue('ai_tokens','1000000000000'),1e12);
  for(const value of ['','-1','1.5','1e3','1000000000001','NaN']) assert.throws(()=>parseQuotaValue('email_messages',value));
  assert.throws(()=>parseQuotaValue('storage_bytes','0.00000001'));
  for(const bytes of [0,1,1024,1572864,1e12]) assert.equal(parseQuotaValue('storage_bytes',quotaDraft({storage_bytes:bytes}).storage_bytes),bytes);
});

async function mount(t,options={}) {
  const oldWindow=globalThis.window;
  globalThis.window={addEventListener(){},removeEventListener(){}};
  let quota={additional:{ai_tokens:100,email_messages:2,storage_bytes:mib},limits:{ai_tokens:100100,email_messages:1002,storage_bytes:1025*mib},revision:4};
  let subscription={planId:'starter',status:'ACTIVE',periodStart:'2026-01-01',periodEnd:'2030-01-01T00:00:00Z',revision:7};
  const writes=[];
  const plans=[{id:'starter',name:'Starter',active:true,limits:{ai_tokens:100000,email_messages:1000,storage_bytes:1024*mib}},{id:'pro',name:'Pro',active:true,limits:{ai_tokens:200000,email_messages:2000,storage_bytes:2048*mib}}];
  const api={
    tenant:async()=>({tenant:{name:'School',slug:'school',status:'ACTIVE'},domains:[]}),
    tenantProfile:async()=>({name:'School',slug:'school',baseDomain:'example.test',revision:1}),
    settings:async()=>({displayName:'School',primaryColor:'#2563eb',revision:1}),
    subscription:async()=>({...subscription}),
    usage:async()=>[{resource:'ai_tokens',used:20457,reserved:50,periodStart:'2026-10-01'}],
    quota:async()=>{if(options.refreshFails&&writes.length) throw Error('offline');return structuredClone(quota)},
    updateTenant:async(id,input)=>{
      writes.push({id,input});
      if(options.conflict) throw Object.assign(Error('Dữ liệu đã thay đổi'),{status:409});
      if(input.quota) quota={...quota,additional:input.quota.additional,revision:quota.revision+1};
      if(input.subscription) subscription={...subscription,...input.subscription,revision:subscription.revision+1};
    },
  };
  const ui=loadComponent('components/platform/console-ui.tsx');
  const {TenantPanel}=loadComponent('components/platform/tenant-panel.tsx',{
    'next/image':{default:p=>React.createElement('img',p)},
    '@/lib/platform-api':{platformApi:api},
    './tenant-admin-password-panel':{TenantAdminPasswordPanel:()=>null},
    './domain-provision-panel':{DomainProvisionPanel:()=>null},
    './tenant-usage-panel':loadComponent('components/platform/tenant-usage-panel.tsx',{'@/lib/tenant-quota':quotaHelpers,'./console-ui':ui}),
    '@/lib/tenant-domains':{previewTenantDomains:()=>[]},
    '@/lib/tenant-portal':{tenantPortalUrl:()=>''},
    '@/lib/use-unsaved-changes':loadComponent('lib/use-unsaved-changes.ts'),
    '@/lib/console-rules':loadComponent('lib/console-rules.ts'),
    '@/lib/tenant-quota':quotaHelpers,
    './console-ui':{...ui,Modal:({children,footer,close})=>React.createElement('test-modal',null,children,typeof footer==='function'?footer(close):footer),DiscardChangesDialog:()=>null},
  });
  let renderer;
  await act(async()=>{renderer=create(React.createElement(TenantPanel,{id:'school-id',plans,close(){},updated(){}}));await new Promise(setImmediate)});
  t.after(async()=>{await act(async()=>renderer.unmount());globalThis.window=oldWindow});
  const edit=async(label,value)=>act(async()=>renderer.root.findByProps({'aria-label':label}).props.onChange({target:{value}}));
  const submit=async()=>act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate)});
  const text=()=>JSON.stringify(renderer.toJSON());
  return {renderer,writes,plans,edit,submit,text};
}

test('school quota draft previews selected plan, includes current usage, and saves atomically in bytes',async t=>{
  const f=await mount(t);
  assert.match(f.text(),/100\.100/);
  assert.match(f.text(),/20\.457/); // monthly usage need not start on subscription's first day
  await f.edit('Bổ sung AI tokens','200');
  await f.edit('Bổ sung Email','10');
  await f.edit('Bổ sung Dung lượng (MiB)','1.5');
  const planSelect=f.renderer.root.findAllByType('select').find(n=>n.props.value==='starter');
  await act(async()=>planSelect.props.onChange({target:{value:'pro'}}));
  assert.match(f.text(),/200\.200/);
  // An unsaved allowance or plan change must not inflate the live usage meter.
  const meter=f.renderer.root.findAllByProps({role:'progressbar'})[0];
  assert.match(meter.props['aria-valuetext'],/100\.100 tokens/);
  assert.equal(f.writes.length,0);
  await f.submit();
  assert.deepEqual(f.writes,[{id:'school-id',input:{quota:{additional:{ai_tokens:200,email_messages:10,storage_bytes:1572864},expectedRevision:4},subscription:{planId:'pro',status:'ACTIVE',expectedRevision:7}}}]);
  assert.equal(f.plans[0].limits.ai_tokens,100000);
  assert.equal(f.renderer.root.findByProps({'aria-label':'Bổ sung AI tokens'}).props.value,'200');
  await f.submit();assert.equal(f.writes.length,1);
});

test('invalid quota draft is retained and blocks the entire save',async t=>{
  const f=await mount(t);
  await f.edit('Bổ sung AI tokens','-1');await f.submit();
  assert.equal(f.writes.length,0);assert.match(f.text(),/phải là số nguyên/);
  assert.equal(f.renderer.root.findByProps({'aria-label':'Bổ sung AI tokens'}).props.value,'-1');
});

test('quota conflict retains draft and prevents another write until reload',async t=>{
  const f=await mount(t,{conflict:true});
  await f.edit('Bổ sung Email','20');await f.submit();await f.submit();
  assert.equal(f.writes.length,1);
  assert.equal(f.renderer.root.findByProps({'aria-label':'Bổ sung Email'}).props.value,'20');
  assert.match(f.text(),/Dữ liệu đã thay đổi/);
});

test('successful quota write followed by failed refresh cannot be submitted twice',async t=>{
  const f=await mount(t,{refreshFails:true});
  await f.edit('Bổ sung Email','20');await f.submit();await f.submit();
  assert.equal(f.writes.length,1);assert.match(f.text(),/Đã lưu thay đổi nhưng chưa tải/);
});
