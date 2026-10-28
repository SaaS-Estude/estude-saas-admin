"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { platformApi, type TenantDetail } from "@/lib/platform-api";
import { tenantPortalUrl } from "@/lib/tenant-portal";
import { previewTenantDomains, tenantPortals } from "@/lib/tenant-domains";
import { Notice, errorText, secondaryClass } from "./console-ui";

const labels: Record<string,string> = {
  MANUAL: "Chưa đồng bộ", PENDING: "Chờ thiết lập", PROCESSING: "Đang thiết lập",
  WAITING: "Chờ DNS / HTTPS", READY: "Sẵn sàng", ERROR: "Sẽ thử lại",
};
function failure(code?: string) {
  if (!code) return "";
  if (code === "DNS_CONFLICT") return "Bản ghi DNS đang trỏ nơi khác; cần kiểm tra trên Cloudflare.";
  if (code === "HOSTNAME_OUTSIDE_ZONE_OR_SSL") return "Địa chỉ nằm ngoài zone hoặc có nhiều cấp subdomain. Hãy cập nhật sang địa chỉ một cấp trong zone đã cấu hình.";
  if (code === "CLEANUP_DNS_NOT_MANAGED") return "Bản ghi cũ không thuộc hệ thống hoặc đã đổi đích. Cần kiểm tra trên Cloudflare trước khi dọn.";
  if (code === "CLEANUP_HOSTNAME_OUTSIDE_ZONE") return "Địa chỉ cũ nằm ngoài tên miền được cấu hình. Cần dọn tại nhà cung cấp cũ.";
  if (code.includes("401") || code.includes("403")) return "Cần kiểm tra quyền API token của nhà cung cấp.";
  if (code.includes("PENDING")) return "Đang đợi DNS hoặc chứng chỉ HTTPS được cấp.";
  return `Chưa thiết lập được địa chỉ (${code}).`;
}

export function DomainStatusTable({ domains }: { domains: TenantDetail["domains"] }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200">
    <table className="w-full min-w-[780px] text-left text-sm">
      <caption className="sr-only">Trạng thái DNS và HTTPS của các cổng trường</caption>
      <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
        <tr>{["Cổng truy cập", "Tên miền", "Trạng thái", "Chi tiết", "Thao tác"].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {domains.map(domain => {
          const local = domain.hostname.endsWith(".localhost");
          const ready = local || domain.status === "READY";
          const status = domain.status ?? "MANUAL";
          const portal = tenantPortals.find(portal => portal.id === domain.portal)?.label ?? domain.portal;
          const color = ready ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15" : status === "ERROR" ? "bg-rose-50 text-rose-700 ring-rose-600/15" : status === "WAITING" ? "bg-amber-50 text-amber-800 ring-amber-600/15" : "bg-slate-100 text-slate-600 ring-slate-500/10";
          const description = domain.lastError ? failure(domain.lastError) : local ? "Địa chỉ dùng trong môi trường local." : ready ? "DNS và HTTPS đã sẵn sàng." : status === "WAITING" ? "Đang chờ DNS hoặc chứng chỉ HTTPS được cấp." : status === "PROCESSING" ? "Hệ thống đang thiết lập địa chỉ." : status === "ERROR" ? "Hệ thống sẽ tự thử lại. Có thể đồng bộ lại để kiểm tra." : "Chờ hệ thống đồng bộ cấu hình địa chỉ.";
          return <tr key={domain.hostname} className="align-top hover:bg-slate-50/60">
            <th scope="row" className="whitespace-nowrap px-4 py-4 font-medium text-slate-700">{portal}</th>
            <td className="px-4 py-4"><span className="break-all font-mono text-xs leading-6 text-slate-700">{domain.hostname}</span></td>
            <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${color}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{local ? "Môi trường local" : labels[status] ?? status}</span></td>
            <td className={`min-w-44 px-4 py-4 text-xs leading-6 ${domain.lastError ? "text-amber-800" : "text-slate-500"}`}>{description}</td>
            <td className="px-4 py-4">{ready ? <a className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-blue-600 hover:text-blue-800" href={tenantPortalUrl(domain.hostname)} target="_blank" rel="noreferrer" aria-label={`Mở cổng ${portal}`} >Mở cổng<ExternalLink size={13} aria-hidden="true" /></a> : <span className="text-slate-400" aria-label="Chưa thể mở cổng">—</span>}</td>
          </tr>;
        })}
        {!domains.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Chưa có địa chỉ được cấu hình.</td></tr>}
      </tbody>
    </table>
  </div>;
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
  const readyCount = detail?.domains.filter(domain => domain.status === "READY" || domain.hostname.endsWith(".localhost")).length ?? 0;
  return <section className="my-6 min-w-0 space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-bold">Thiết lập DNS và HTTPS</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">Địa chỉ được tự động thiết lập sau khi tạo trường hoặc lưu thay đổi địa chỉ.</p>
      </div>
      <button type="button" className={secondaryClass} disabled={disabled || busy || !enabled} onClick={() => void sync()}><RefreshCw size={15} aria-hidden="true" className={busy ? "animate-spin" : ""} />{busy ? "Đang xếp lịch…" : "Đồng bộ lại DNS và Vercel"}</button>
    </div>
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
    {detail ? <>
      <p className="text-xs text-slate-500"><span className={readyCount === detail.domains.length && readyCount > 0 ? "font-semibold text-emerald-700" : "font-semibold text-slate-700"}>{readyCount}/{detail.domains.length} cổng sẵn sàng</span><span className="mx-2 text-slate-300" aria-hidden="true">·</span>Trạng thái tự cập nhật</p>
      <DomainStatusTable domains={detail.domains} />
    </> : <p role="status" className="py-6 text-center text-sm text-slate-500">Đang tải trạng thái tên miền…</p>}
    {!!detail?.domainCleanup?.length && <div className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm">
      <h4 className="font-semibold">Dọn địa chỉ cũ</h4>
      <p>Hệ thống tự xóa địa chỉ cũ trên Cloudflare và Vercel sau khi cả bốn địa chỉ mới sẵn sàng.</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs">
        <thead className="text-slate-500"><tr><th scope="col" className="px-2 py-3">Tên miền cũ</th><th scope="col" className="px-2 py-3">Trạng thái</th><th scope="col" className="px-2 py-3">Chi tiết</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{detail.domainCleanup.map(domain => <tr key={domain.hostname} className="align-top">
          <td className="break-all px-2 py-3 font-mono">{domain.hostname}</td>
          <td className="px-2 py-3">{domain.status === "REMOVED" ? "Đã dọn" : domain.status === "CLEANING" ? "Đang dọn" : domain.status === "CLEANUP_ERROR" ? "Chưa dọn được, sẽ thử lại" : "Chờ bốn địa chỉ mới sẵn sàng"}</td>
          <td className="px-2 py-3 text-amber-800">{domain.lastError ? failure(domain.lastError) : "—"}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}
  </section>;
}
