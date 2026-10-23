"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Globe, RefreshCw, ArrowUpRight } from "lucide-react";
import { platformApi, type DomainSettings } from "@/lib/platform-api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { previewTenantDomains } from "@/lib/tenant-domains";
import {
  DiscardChangesDialog,
  Field,
  SuccessNotice,
  Notice,
  errorText,
  inputClass,
  primaryClass,
  secondaryClass,
} from "./console-ui";

export function DomainSettingsPanel({
  onSaved,
  onDirtyChange,
  onBusyChange,
}: {
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [settings, setSettings] = useState<DomainSettings | null>(null);
  const [base, setBase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [committed, setCommitted] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const dirty = !!settings && base !== settings.baseDomain && !committed;
  useUnsavedChanges(dirty || busy);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(
    () => () => {
      onDirtyChange?.(false);
      onBusyChange?.(false);
    },
    [onDirtyChange, onBusyChange],
  );
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const value = await platformApi.domainSettings();
      setSettings(value);
      setBase(value.baseDomain);
      setCommitted(false);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || busy || !dirty || committed) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await platformApi.setDomainSettings({ ...settings, baseDomain: base });
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
      return;
    }
    setCommitted(true);
    onSaved();
    if (await load()) setNotice("Đã lưu tên miền mặc định cho trường mới.");
    else
      setError(
        "Đã lưu tên miền nhưng chưa tải được cấu hình mới. Vui lòng tải lại trước khi tiếp tục chỉnh sửa.",
      );
  }
  return (
    <section className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/20 sm:p-7">
      <div>
        <span className="mb-4 inline-flex rounded-xl bg-blue-50 p-3 text-blue-600">
          <Globe size={23} />
        </span>
        <h2 className="text-lg font-bold tracking-tight">Cấu hình tên miền</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Đặt tên miền gốc mặc định khi tạo trường. Mỗi trường có subdomain
          riêng và bốn portal: quản trị, giáo viên, học sinh, phụ huynh.
        </p>
      </div>
      {error && <Notice>{error}</Notice>}
      {notice && <SuccessNotice>{notice}</SuccessNotice>}
      {confirmReload && (
        <DiscardChangesDialog
          cancel={() => setConfirmReload(false)}
          discard={() => {
            setConfirmReload(false);
            void load();
          }}
        />
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setNotice("");
          if (dirty) setConfirmReload(true);
          else void load();
        }}
        className={secondaryClass}
      >
        <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
        {busy ? "Đang tải…" : "Tải lại cấu hình tên miền"}
      </button>
      {settings && (
        <form onSubmit={save} className="grid gap-7 xl:grid-cols-2">
          <div className="space-y-4">
            <Field label="Tên miền gốc mặc định">
              <input
                value={base}
                onChange={(e) => {
                  setBase(e.target.value);
                  setNotice("");
                }}
                required
                maxLength={253}
                placeholder="estude.vn"
                autoCapitalize="none"
                spellCheck={false}
                disabled={busy || committed}
                className={inputClass}
              />
            </Field>
            <p className="text-xs leading-5 text-slate-500">
              Chỉ nhập tên miền, không kèm https://, cổng hoặc đường dẫn. Dùng
              localhost cho môi trường local.
            </p>
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm leading-6 text-blue-900">
              Thay đổi này áp dụng cho các yêu cầu tạo trường sau khi lưu. Địa
              chỉ của trường đã tạo và yêu cầu đang chờ xử lý được giữ nguyên.
            </div>
            <p className="text-xs leading-6 text-slate-500">
              {settings.automationEnabled
                ? "Đã bật tự động tạo DNS Cloudflare và gắn domain Vercel cho từng trường. Trạng thái thiết lập hiển thị trong chi tiết trường."
                : "Chưa bật tự động thiết lập tên miền. Cần cấu hình kết nối Cloudflare và Vercel trên máy chủ để tạo DNS và HTTPS tự động."}
            </p>
            <button
              type="submit"
              disabled={busy || !dirty || committed}
              className={primaryClass}
            >
              Lưu cấu hình tên miền
            </button>
          </div>
          <div className="self-start rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Xem trước địa chỉ
            </p>
            <p className="mb-2 text-sm font-medium">
              Ví dụ trường có subdomain nguyen-trai
            </p>
            {previewTenantDomains("nguyen-trai", base).map((domain) => (
              <div
                key={domain.id}
                className="mt-3 flex items-start justify-between gap-2 rounded-xl border border-slate-200/70 bg-white p-3"
              >
                <p className="min-w-0 break-all font-mono text-xs leading-6 text-slate-600">
                  {domain.hostname}
                </p>
                <ArrowUpRight
                  size={15}
                  className="mt-1 shrink-0 text-slate-300"
                />
              </div>
            ))}
          </div>
        </form>
      )}
    </section>
  );
}
