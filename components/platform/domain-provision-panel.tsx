"use client";

import { useCallback, useEffect, useState } from "react";
import { platformApi, type TenantDetail } from "@/lib/platform-api";
import { tenantPortalUrl } from "@/lib/tenant-portal";
import { previewTenantDomains } from "@/lib/tenant-domains";
import { Notice, errorText, secondaryClass } from "./console-ui";

const labels: Record<string,string> = {
  MANUAL: "Chưa đồng bộ", PENDING: "Chờ thiết lập", PROCESSING: "Đang thiết lập",
  WAITING: "Chờ DNS / HTTPS", READY: "Sẵn sàng", ERROR: "Sẽ thử lại",
};
function failure(code?: string) {
  if (!code) return "";
  if (code === "DNS_CONFLICT") return "Bản ghi DNS đang trỏ nơi khác; cần kiểm tra trên Cloudflare.";
  if (code === "HOSTNAME_OUTSIDE_ZONE_OR_SSL") return "Địa chỉ nằm ngoài zone hoặc có nhiều cấp subdomain. Hãy cập nhật sang địa chỉ một cấp trong zone đã cấu hình.";
  if (code.includes("401") || code.includes("403")) return "Cần kiểm tra quyền API token của nhà cung cấp.";
  if (code.includes("PENDING")) return "Đang đợi DNS hoặc chứng chỉ HTTPS được cấp.";
  return `Chưa thiết lập được địa chỉ (${code}).`;
}

export function DomainProvisionPanel({ id, disabled, onChanged }: { id: string; disabled?: boolean; onChanged?: () => Promise<void> }) {
  const [detail,setDetail] = useState<TenantDetail | null>(null);
  const [enabled,setEnabled] = useState(false);
  const [automationBase,setAutomationBase] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const load = useCallback(async () => {
    const [next,settings] = await Promise.all([platformApi.tenant(id),platformApi.domainSettings()]);
    setDetail(next); setEnabled(!!settings.automationEnabled);
    setAutomationBase(settings.automationBaseDomain ?? "");
  },[id]);
  useEffect(() => {
    let active = true;
    const refresh = async () => { if (!active) return; try { await load(); } catch(e) { if(active) setError(errorText(e)); } };
    void refresh();
    const timer = setInterval(() => { if(document.visibilityState === "visible") void refresh(); },10000);
    return () => { active = false; clearInterval(timer); };
  },[load]);
  async function sync() {
    setBusy(true);setError("");setNotice("");
    try { await platformApi.syncDomains(id); await load();setNotice("Đã xếp lịch đồng bộ địa chỉ. Trạng thái sẽ tự cập nhật."); }
    catch(e) {setError(errorText(e));} finally {setBusy(false);}
  }
  async function convert() {
    if (disabled || busy || !enabled || !automationBase) return;
    setBusy(true);setError("");setNotice("");
    try {
      const profile = await platformApi.tenantProfile(id);
      await platformApi.updateTenant(id,{profile:{name:profile.name,slug:profile.slug,baseDomain:automationBase,expectedRevision:profile.revision}});
      await load(); await onChanged?.();
    } catch(e) {setError(errorText(e));} finally {setBusy(false);}
  }
  const targetDomains = detail && automationBase ? previewTenantDomains(detail.tenant.slug,automationBase) : [];
  const needsConversion = detail?.domains.some(domain =>
    /^(admin|teacher|student|parent)\./.test(domain.hostname) ||
    (targetDomains.length > 0 && !domain.hostname.endsWith(".localhost") && !targetDomains.some(target => target.hostname === domain.hostname)));
  return <section className="my-6 space-y-3 rounded-2xl border border-slate-200 p-5">
    <h3 className="font-bold">Thiết lập DNS và HTTPS</h3>
    <p className="text-sm text-slate-500">Địa chỉ được tự động thiết lập sau khi tạo trường hoặc lưu thay đổi địa chỉ.</p>
    {!enabled && <Notice>Chưa bật tự động thiết lập tên miền trên máy chủ. Quản trị hệ thống cần cấu hình kết nối Cloudflare và Vercel.</Notice>}
    {error && <Notice>{error}</Notice>}
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {needsConversion && <div className="space-y-2 text-sm text-amber-900">
      <p>Trường đang dùng địa chỉ nhiều cấp. Chuyển sang admin-ten-truong để dùng HTTPS với Cloudflare Universal SSL. Sau khi chuyển, địa chỉ cũ ngừng truy cập.</p>
      {targetDomains.length > 0 && <div>
        <p>Địa chỉ mới sau khi chuyển:</p>
        {targetDomains.map(domain => <p key={domain.id} className="break-all font-mono">{domain.hostname}</p>)}
      </div>}
      {enabled && !automationBase && <p>Chưa tải được tên miền gốc từ cấu hình tự động. Hãy cập nhật backend và tải lại.</p>}
      <button type="button" className={secondaryClass} disabled={disabled || busy || !enabled || !automationBase} onClick={() => void convert()}>Chuyển địa chỉ sang một cấp và thiết lập DNS</button>
    </div>}
    {detail?.domains.map(domain => <div key={domain.hostname} className="rounded-xl bg-slate-50 p-3 text-sm">
      <p className="break-all font-mono">{domain.hostname}</p>
      <p className="mt-1">{domain.hostname.endsWith(".localhost") ? "Môi trường local" : labels[domain.status ?? "MANUAL"] ?? domain.status}</p>
      {domain.lastError && <p className="mt-1 text-amber-800">{failure(domain.lastError)}</p>}
      {(domain.status === "READY" || domain.hostname.endsWith(".localhost")) && <a className="mt-1 inline-block font-medium text-blue-600" href={tenantPortalUrl(domain.hostname)} target="_blank" rel="noreferrer">Mở cổng trường</a>}
    </div>)}
    <button type="button" className={secondaryClass} disabled={disabled || busy || !enabled} onClick={() => void sync()}>{busy ? "Đang xếp lịch…" : "Đồng bộ lại DNS và Vercel"}</button>
  </section>;
}
