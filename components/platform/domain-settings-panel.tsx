"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Globe, RefreshCw, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { platformApi, type DomainSettings } from "@/lib/platform-api";
import { previewTenantDomains } from "@/lib/tenant-domains";
import {
  Field,
  Notice,
  errorText,
  inputClass,
  primaryClass,
  secondaryClass,
} from "./console-ui";

export function DomainSettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [settings, setSettings] = useState<DomainSettings | null>(null);
  const [base, setBase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const value = await platformApi.domainSettings();
      setSettings(value);
      setBase(value.baseDomain);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await platformApi.setDomainSettings({ ...settings, baseDomain: base });
      await load();
      setNotice("Đã lưu tên miền mặc định cho trường mới.");
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
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
      {notice && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          <CheckCircle2 size={17} />
          {notice}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void load()}
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
                disabled={busy}
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
              Lưu tên miền chỉ đăng ký địa chỉ trong hệ thống. Cần cấu hình DNS,
              domain trên nơi triển khai frontend và HTTPS để truy cập từ
              Internet. Chứng chỉ *.estude.vn không bao phủ
              admin.nguyen-trai.estude.vn.
            </p>
            <button type="submit" disabled={busy} className={primaryClass}>
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
