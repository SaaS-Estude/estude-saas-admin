"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import Image from "next/image";
import { ExternalLink, LoaderCircle, Save } from "lucide-react";
import { renewalPeriod } from "@/lib/console-rules";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { tenantPortalUrl } from "@/lib/tenant-portal";
import { previewTenantDomains } from "@/lib/tenant-domains";
import { DomainProvisionPanel } from "./domain-provision-panel";
import { TenantAdminPasswordPanel } from "./tenant-admin-password-panel";
import {
  platformApi,
  type Plan,
  type Settings,
  type Subscription,
  type TenantDetail,
  type TenantProfile,
  type TenantUpdate,
  type Usage,
} from "@/lib/platform-api";
import {
  Badge,
  DiscardChangesDialog,
  Field,
  Modal,
  Notice,
  SuccessNotice,
  amount,
  dateOnlyText,
  errorText,
  inputClass,
  primaryClass,
  secondaryClass,
} from "./console-ui";

type Snapshot = {
  detail: TenantDetail;
  profile: TenantProfile;
  settings: Settings;
  subscription: Subscription;
  usage: Usage[];
};
export function TenantPanel({
  id,
  plans,
  close,
  updated,
}: {
  id: string;
  plans: Plan[];
  close: () => void;
  updated: () => void;
}) {
  const formId = useId();
  const [saved, setSaved] = useState<Snapshot | null>(null);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [status, setStatus] = useState("");
  const [renew, setRenew] = useState(false),
    [periodStart, setPeriodStart] = useState(""),
    [periodEnd, setPeriodEnd] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [adminDirty, setAdminDirty] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminPanelKey, setAdminPanelKey] = useState(0);
  const load = useCallback(async () => {
    const [detail, schoolProfile, branding, subscription, usage] =
      await Promise.all([
        platformApi.tenant(id),
        platformApi.tenantProfile(id),
        platformApi.settings(id),
        platformApi.subscription(id),
        platformApi.usage(id),
      ]);
    setSaved({
      detail,
      profile: schoolProfile,
      settings: branding,
      subscription,
      usage,
    });
    setProfile(schoolProfile);
    setSettings(branding);
    setSub(subscription);
    setStatus(detail.tenant.status);
    setRenew(false);
    setPeriodStart("");
    setPeriodEnd("");
    setConfirmed(false);
    setConflict(false);
    setCommitted(false);
  }, [id]);
  useEffect(() => {
    let active = true;
    void load()
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);
  const profileDirty =
    !!profile &&
    !!saved &&
    (profile.name !== saved.profile.name ||
      profile.slug !== saved.profile.slug ||
      profile.baseDomain !== saved.profile.baseDomain);
  const settingsDirty =
    !!settings &&
    !!saved &&
    (settings.displayName !== saved.settings.displayName ||
      settings.primaryColor !== saved.settings.primaryColor ||
      (settings.logoDataUrl ?? "") !== (saved.settings.logoDataUrl ?? ""));
  const subDirty =
    !!sub &&
    !!saved &&
    (sub.planId !== saved.subscription.planId ||
      sub.status !== saved.subscription.status);
  const statusDirty = !!saved && status !== saved.detail.tenant.status;
  const addressDirty =
    !!profile &&
    !!saved &&
    (profile.slug !== saved.profile.slug ||
      profile.baseDomain !== saved.profile.baseDomain ||
      (profileDirty && saved.detail.domains.some(domain =>
        !previewTenantDomains(profile.slug, profile.baseDomain).some(next => next.hostname === domain.hostname))));
  const dirty =
    profileDirty || settingsDirty || subDirty || statusDirty || renew;
  useUnsavedChanges((dirty && !committed) || busy);
  async function selectLogo(file?: File) {
    if (!file || busy || !settings) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 512 * 1024 || file.size === 0) {
      setError("Chọn ảnh PNG, JPG hoặc WebP, tối đa 512 KB.");
      return;
    }
    setBusy(true); setError(""); setSuccess("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Không đọc được ảnh logo."));
        reader.readAsDataURL(file);
      });
      setSettings((current) => current ? { ...current, logoDataUrl: data } : current);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  async function reload() {
    setBusy(true);
    setError("");
    try {
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !saved ||
      !profile ||
      !settings ||
      !sub ||
      !dirty ||
      busy ||
      adminBusy ||
      committed ||
      conflict
    )
      return;
    if ((addressDirty || statusDirty) && !confirmed) return;
    const changes: TenantUpdate = {};
    if (profileDirty)
      changes.profile = {
        name: profile.name,
        slug: profile.slug,
        baseDomain: profile.baseDomain,
        expectedRevision: saved.profile.revision,
      };
    if (settingsDirty)
      changes.settings = {
        displayName: settings.displayName,
        primaryColor: settings.primaryColor,
        expectedRevision: saved.settings.revision,
        ...((settings.logoDataUrl ?? "") !== (saved.settings.logoDataUrl ?? "") ? {logoDataUrl: settings.logoDataUrl ?? ""} : {}),
      };
    if (subDirty)
      changes.subscription = {
        planId: sub.planId,
        status: sub.status,
        expectedRevision: saved.subscription.revision,
      };
    if (statusDirty)
      changes.status = { status, expectedStatus: saved.detail.tenant.status };
    if (renew) {
      try {
        changes.renewal = {
          ...renewalPeriod(
            periodStart,
            periodEnd,
            saved.subscription.periodEnd,
          ),
          expectedRevision: saved.subscription.revision,
        };
      } catch (cause) {
        setError(errorText(cause));
        return;
      }
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await platformApi.updateTenant(id, changes);
    } catch (e) {
      setError(errorText(e));
      if (e instanceof Error && "status" in e && e.status === 409)
        setConflict(true);
      setBusy(false);
      return;
    }
    // Once committed, a failed refresh must not invite resubmission of a saved edit.
    setCommitted(true);
    updated();
    try {
      await load();
      setSuccess("Đã lưu tất cả thay đổi của trường.");
    } catch {
      setError(
        "Đã lưu thay đổi nhưng chưa tải được dữ liệu mới. Vui lòng tải lại thông tin.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <Modal title="Quản lý trường" close={close}>
        <p role="status" className="text-sm text-slate-500">
          Đang tải thông tin…
        </p>
      </Modal>
    );
  if (!saved || !profile || !settings || !sub)
    return (
      <Modal title="Quản lý trường" close={close}>
        <Notice>{error || "Không tải được trường."}</Notice>
        <button
          className={secondaryClass}
          onClick={() => void reload()}
          disabled={busy}
        >
          Tải lại thông tin
        </button>
      </Modal>
    );
  const { detail, usage } = saved;
  const plan = plans.find((p) => p.id === saved.subscription.planId);
  const currentUsage = usage.filter(
    (row) =>
      row.resource === "storage_bytes" ||
      row.periodStart.slice(0, 10) ===
        saved.subscription.periodStart.slice(0, 10),
  );
  const resources = [
    ...new Set([
      ...Object.keys(plan?.limits ?? {}),
      ...currentUsage.map((row) => row.resource),
    ]),
  ];
  const expired =
    new Date(saved.subscription.periodEnd).getTime() <= Date.now();
  return [
    <Modal
      key="tenant"
      hidden={confirmReload}
      title={detail.tenant.name}
      titleBadge={<Badge status={detail.tenant.status} />}
      size="wide"
      close={close}
      confirmDiscard={(dirty && !committed) || adminDirty}
      closeDisabled={busy || adminBusy || confirmReload}
      footer={(requestClose) => (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span role="status" className="text-xs text-slate-500">
            {adminBusy
              ? "Đang đặt lại mật khẩu quản trị trường…"
              : busy
                ? "Đang lưu thay đổi…"
                : adminDirty || (dirty && !committed)
                  ? "Có thay đổi chưa lưu"
                  : committed
                    ? "Thay đổi đã được lưu"
                    : "Chưa có thay đổi"}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className={secondaryClass}
              disabled={busy || adminBusy}
              onClick={requestClose}
            >
              Hủy
            </button>
            <button
              form={formId}
              type="submit"
              disabled={busy || adminBusy || !dirty || conflict || committed}
              className={primaryClass}
            >
              {busy ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {busy ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      )}
    >
      <form
        id={formId}
        onSubmit={submit}
        onChange={() => {
          setConflict(false);
          setSuccess("");
        }}
        className="space-y-6"
      >
        {error && <Notice>{error}</Notice>}
        {(conflict || committed) && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>
              {conflict
                ? "Chưa lưu thay đổi nào. Dữ liệu có thể đã được cập nhật, địa chỉ bị trùng hoặc gói chưa đáp ứng hạn mức. Bản nháp của bạn vẫn được giữ; có thể tiếp tục kiểm tra hoặc tải lại dữ liệu mới nhất."
                : "Thay đổi đã được lưu. Tải lại thông tin để tiếp tục chỉnh sửa."}
            </p>
            <button
              type="button"
              className={secondaryClass}
              onClick={() => {
                if ((dirty && !committed) || adminDirty) setConfirmReload(true);
                else void reload();
              }}
              disabled={busy || adminBusy}
            >
              Tải lại thông tin
            </button>
          </div>
        )}
        {success && <SuccessNotice>{success}</SuccessNotice>}
        <fieldset
          disabled={busy || adminBusy || committed}
          className="min-w-0 space-y-6"
        >
          <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="min-w-0 space-y-6">
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                <div>
                  <h3 className="font-bold">Thông tin trường</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Tên trường dùng trong danh sách quản trị SaaS; tên trên cổng
                    trường được chỉnh tại mục Nhận diện trường.
                  </p>
                </div>
                <Field label="Tên trường">
                  <input
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({ ...profile, name: e.target.value })
                    }
                    required
                    minLength={2}
                    maxLength={150}
                    className={inputClass}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Subdomain của trường">
                    <input
                      value={profile.slug}
                      onChange={(e) => {
                        setProfile({ ...profile, slug: e.target.value });
                        setConfirmed(false);
                      }}
                      required
                      minLength={3}
                      maxLength={50}
                      pattern="[a-z][a-z0-9\-]{1,48}[a-z0-9]"
                      autoCapitalize="none"
                      spellCheck={false}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Tên miền gốc">
                    <input
                      value={profile.baseDomain}
                      onChange={(e) => {
                        setProfile({
                          ...profile,
                          baseDomain: e.target.value,
                        });
                        setConfirmed(false);
                      }}
                      required
                      maxLength={253}
                      autoCapitalize="none"
                      spellCheck={false}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  Subdomain gồm 3–50 chữ thường, số hoặc dấu gạch ngang. Tên
                  miền gốc không kèm giao thức, cổng hoặc đường dẫn.
                </p>
                <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold">
                    Địa chỉ sau khi lưu
                  </p>
                  {previewTenantDomains(profile.slug, profile.baseDomain).map(
                    (domain) => (
                      <p
                        key={domain.id}
                        className="break-all font-mono text-xs leading-5 text-slate-500"
                      >
                        {domain.hostname}
                      </p>
                    ),
                  )}
                </div>
                <Field label="Trạng thái trường">
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setConfirmed(false);
                    }}
                    className={inputClass}
                  >
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="SUSPENDED">Tạm khóa</option>
                  </select>
                </Field>
              </section>
              <section className="space-y-3">
                <h3 className="font-bold">Địa chỉ truy cập hiện tại</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {detail.domains.map((domain) => (
                    <a
                      key={domain.hostname}
                      href={tenantPortalUrl(domain.hostname)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-blue-600"
                    >
                      <span className="truncate">{domain.hostname}</span>
                      <ExternalLink size={13} className="shrink-0" />
                    </a>
                  ))}
                </div>
              </section>
            </div>
            <div className="min-w-0 space-y-6">
              <section className="space-y-4">
                <h3 className="font-bold">Nhận diện trường</h3>
                <Field label="Tên hiển thị">
                  <input
                    value={settings.displayName}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        displayName: e.target.value,
                      })
                    }
                    required
                    minLength={2}
                    maxLength={150}
                    className={inputClass}
                  />
                </Field>
                <Field label="Logo trường">
                  <div className="flex flex-wrap items-center gap-4">
                    {settings.logoDataUrl ? <Image unoptimized src={settings.logoDataUrl} alt="Logo trường" width={80} height={80} className="size-20 rounded-xl border border-slate-200 bg-white p-1 object-contain" /> : <div className="grid size-20 place-items-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">Chưa có logo</div>}
                    <div className="min-w-0 flex-1 space-y-2">
                      <input type="file" aria-label="Chọn logo trường" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void selectLogo(file); }} />
                      {settings.logoDataUrl ? <button type="button" className="text-sm font-semibold text-rose-700" onClick={() => setSettings({ ...settings, logoDataUrl: "" })}>Gỡ logo</button> : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">PNG, JPG hoặc WebP, tối đa 512 KB. Logo dùng ở trang đăng nhập, thanh điều hướng và biểu tượng tab của trường. Bấm Lưu thay đổi để áp dụng; gỡ logo để dùng lại EStude.</p>
                </Field>
                <Field label="Màu thương hiệu">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        primaryColor: e.target.value,
                      })
                    }
                    className="h-10 w-20 rounded-lg border border-slate-200"
                  />
                </Field>
              </section>
              <section className="space-y-4 border-t border-slate-100 pt-5">
                <h3 className="font-bold">Gói đăng ký</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Gói dịch vụ">
                    <select
                      value={sub.planId}
                      onChange={(e) =>
                        setSub({ ...sub, planId: e.target.value })
                      }
                      className={inputClass}
                    >
                      {!plans.some((p) => p.id === sub.planId) && (
                        <option value={sub.planId} disabled>
                          Gói hiện tại chưa tải được
                        </option>
                      )}
                      {plans
                        .filter((p) => p.active || p.id === sub.planId)
                        .map((p) => (
                          <option key={p.id} value={p.id} disabled={!p.active}>
                            {p.name}
                            {p.active ? "" : " (Ngừng cung cấp)"}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Trạng thái đăng ký">
                    <select
                      value={sub.status}
                      onChange={(e) =>
                        setSub({ ...sub, status: e.target.value })
                      }
                      disabled={renew}
                      className={inputClass}
                    >
                      <option value="TRIAL">Dùng thử</option>
                      <option value="ACTIVE">Hoạt động</option>
                      <option value="SUSPENDED">Tạm khóa</option>
                      <option value="EXPIRED">Hết hạn</option>
                    </select>
                  </Field>
                </div>
                <p className="text-xs text-slate-500">
                  Kỳ hiện tại: {dateOnlyText(saved.subscription.periodStart)} —{" "}
                  {dateOnlyText(saved.subscription.periodEnd)}
                </p>
                {expired && (
                  <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={renew}
                        onChange={(e) => {
                          setRenew(e.target.checked);
                          setSub({
                            ...sub,
                            status: e.target.checked
                              ? "ACTIVE"
                              : saved.subscription.status,
                          });
                        }}
                      />
                      Gia hạn kỳ sử dụng
                    </label>
                    {renew && (
                      <>
                        <p className="text-xs text-slate-500">
                          Kỳ mới sẽ có trạng thái Hoạt động sau khi lưu.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Ngày bắt đầu kỳ mới">
                            <input
                              type="date"
                              required
                              value={periodStart}
                              onChange={(e) => setPeriodStart(e.target.value)}
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Ngày kết thúc kỳ mới">
                            <input
                              type="date"
                              required
                              min={periodStart || undefined}
                              value={periodEnd}
                              onChange={(e) => setPeriodEnd(e.target.value)}
                              className={inputClass}
                            />
                          </Field>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
              <section className="space-y-3 border-t border-slate-100 pt-5">
                <h3 className="font-bold">Mức sử dụng</h3>
                <p className="text-xs leading-5 text-slate-500">
                  Dung lượng được tính tích lũy; email và AI tính theo kỳ. Hạn
                  mức dưới đây thuộc gói đã lưu. “Đang giữ” là phần đã đặt trước
                  cho tác vụ chưa hoàn tất.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="py-2">Tài nguyên</th>
                        <th>Đã dùng</th>
                        <th>Đang giữ</th>
                        <th>Hạn mức</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resources.map((resource) => {
                        const rows = currentUsage.filter(
                            (row) => row.resource === resource,
                          ),
                          used = rows.reduce((n, r) => n + r.used, 0),
                          reserved = rows.reduce((n, r) => n + r.reserved, 0);
                        const format = (n: number) =>
                          resource === "storage_bytes"
                            ? `${amount(Math.round((n / 1024 ** 2) * 100) / 100)} MiB`
                            : amount(n);
                        return (
                          <tr
                            key={resource}
                            className="border-t border-slate-100"
                          >
                            <td className="py-3">
                              {resource === "storage_bytes"
                                ? "Dung lượng"
                                : resource === "ai_tokens"
                                  ? "AI tokens"
                                  : resource === "email_messages"
                                    ? "Email"
                                    : resource}
                            </td>
                            <td>{format(used)}</td>
                            <td>{format(reserved)}</td>
                            <td>
                              {plan ? format(plan.limits[resource] ?? 0) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
          {(addressDirty || statusDirty) && (
            <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <h3 className="font-semibold">Xác nhận thay đổi quan trọng</h3>
              {addressDirty && (
                <p>
                  Cả bốn địa chỉ cũ sẽ ngừng truy cập sau khi lưu. Người dùng
                  cần mở địa chỉ mới và đăng nhập lại. Dữ liệu học tập được giữ
                  nguyên. Hệ thống sẽ tự thiết lập DNS và HTTPS nếu đã bật kết nối Cloudflare và Vercel. Địa chỉ mới cần đợi thiết lập hoàn tất.
                </p>
              )}
              {statusDirty && (
                <p>
                  {status === "SUSPENDED"
                    ? "Trường sẽ bị tạm khóa, người dùng không thể truy cập cho đến khi được mở lại."
                    : "Trường sẽ được mở lại quyền truy cập sau khi lưu."}
                </p>
              )}
              <label className="flex items-start gap-2 font-medium">
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1.5 h-4 w-4 shrink-0"
                />
                Tôi xác nhận thay đổi địa chỉ hoặc trạng thái trường
              </label>
            </section>
          )}
        </fieldset>
      </form>
      <DomainProvisionPanel key={`domains-${saved.profile.revision}`} id={id} disabled={busy || adminBusy || adminDirty || (dirty && !committed)} onChanged={reload} />
      <TenantAdminPasswordPanel
        key={adminPanelKey}
        id={id}
        disabled={busy}
        onDirtyChange={setAdminDirty}
        onBusyChange={setAdminBusy}
      />
    </Modal>,
    confirmReload && (
      <DiscardChangesDialog
        key="discard"
        cancel={() => setConfirmReload(false)}
        discard={() => {
          setConfirmReload(false);
          setAdminPanelKey((value) => value + 1);
          void reload();
        }}
      />
    ),
  ];
}
