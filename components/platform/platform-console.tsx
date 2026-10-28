"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Building2,
  UsersRound,
  Layers3,
  ListChecks,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  ArrowUpRight,
  ChevronRight,
  Globe,
  LayoutDashboard,
  ArrowRight,
  LoaderCircle,
  Check,
  LockKeyhole,
  CircleHelp,
  Activity,
} from "lucide-react";
import {
  platformApi,
  onPlatformSessionExpired,
  PlatformError,
  type Operator,
  type Overview,
  type Plan,
  type Tenant,
} from "@/lib/platform-api";
import { tenantPage } from "@/lib/console-rules";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { TenantPanel } from "./tenant-panel";
import { DomainSettingsPanel } from "./domain-settings-panel";
import { AdminAccountsPanel } from "./admin-accounts-panel";
import { BillingOrdersPanel } from "./billing-orders-panel";
import { previewTenantDomains } from "@/lib/tenant-domains";
import {
  Badge,
  EmptyState,
  DiscardChangesDialog,
  PasswordField,
  SuccessNotice,
  Field,
  Modal,
  Notice,
  amount,
  dateText,
  errorText,
  inputClass,
  primaryClass,
  secondaryClass,
} from "./console-ui";

function Login({
  onLogin,
  initialError,
}: {
  onLogin: (operator: Operator) => void;
  initialError: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      onLogin(
        await platformApi.login(
          String(data.get("account")),
          String(data.get("password")),
        ),
      );
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#102b66] p-12 text-white lg:flex lg:flex-col xl:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 top-24 h-[600px] w-[600px] rounded-full border border-white/10 shadow-[0_0_0_80px_#ffffff04,0_0_0_160px_#ffffff03]"
        />
        <div className="relative flex items-center gap-3">
          <span className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/20">
            <ShieldCheck size={25} />
          </span>
          <span className="text-2xl font-bold tracking-tight">
            EStude
            <span className="ml-3 text-xs font-medium uppercase tracking-[0.2em] text-blue-200">
              Platform
            </span>
          </span>
        </div>
        <div className="relative my-auto max-w-lg py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-300/10 px-3 py-1.5 text-xs text-blue-100">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
            Không gian quản trị SaaS
          </span>
          <h2 className="mt-7 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Một nền tảng.
            <br />
            <span className="text-blue-300">Kết nối mọi trường học.</span>
          </h2>
          <p className="mt-6 max-w-sm text-base leading-7 text-blue-100/75">
            Quản lý trường học, gói dịch vụ và vận hành hệ thống từ một không
            gian thống nhất.
          </p>
          <div className="mt-10 space-y-5">
            {[
              "Không gian dữ liệu riêng cho từng trường",
              "Quản lý dịch vụ và hạn mức sử dụng",
              "Theo dõi tác vụ và lịch sử quản trị",
            ].map((text) => (
              <div
                key={text}
                className="flex items-center gap-3 text-sm text-blue-50"
              >
                <span className="rounded-full bg-blue-400/15 p-1 text-blue-200">
                  <Check size={14} />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-blue-200/60">
          EStude · Nền tảng quản lý học tập
        </p>
      </section>
      <section className="flex min-w-0 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5 font-bold text-blue-700 lg:hidden">
            <ShieldCheck size={26} />
            <span className="text-xl">EStude Platform</span>
          </div>
          <div className="mb-6 inline-flex rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-600">
            <LockKeyhole size={24} />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
            Chào mừng trở lại
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Quản trị hệ thống
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Đăng nhập tài khoản SaaS để quản lý và vận hành các trường học trên
            EStude.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <Field label="Tài khoản SaaS">
              <input
                name="account"
                autoComplete="username"
                required
                maxLength={50}
                className={inputClass}
                placeholder="Nhập tên tài khoản"
                autoFocus
                disabled={busy}
              />
            </Field>
            <PasswordField
              label="Mật khẩu"
              name="password"
              autoComplete="current-password"
              required
              maxLength={128}
              placeholder="Nhập mật khẩu"
              disabled={busy}
            />
            {(error || initialError) && (
              <Notice>{error || initialError}</Notice>
            )}
            <button
              disabled={busy}
              className={`${primaryClass} w-full py-3`}
              type="submit"
            >
              {busy ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : null}
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>
          <div className="mt-8 flex items-start gap-2 border-t border-slate-100 pt-6 text-xs leading-5 text-slate-400">
            <CircleHelp size={16} className="mt-0.5 shrink-0" />
            <p>
              Dành cho quản trị viên nền tảng. Giáo viên, học sinh và quản trị
              trường đăng nhập tại cổng riêng của trường.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function NewTenant({ done, close }: { done: () => void; close: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("admin");
  const [password, setPassword] = useState("");
  const [baseDomain, setBaseDomain] = useState("");
  const [initialDomain, setInitialDomain] = useState("");
  const [domainReady, setDomainReady] = useState(false);
  const dirty =
    name !== "" ||
    slug !== "" ||
    account !== "admin" ||
    password !== "" ||
    baseDomain !== initialDomain;
  useUnsavedChanges(dirty || busy);
  const loadDomain = useCallback(async () => {
    setError("");
    setDomainReady(false);
    try {
      const settings = await platformApi.domainSettings();
      setBaseDomain(settings.baseDomain);
      setInitialDomain(settings.baseDomain);
      setDomainReady(true);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void loadDomain();
  }, [loadDomain]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await platformApi.createTenant({
        name: String(data.get("name")),
        slug: String(data.get("slug")),
        baseDomain,
        adminAccount: String(data.get("account")),
        adminPassword: String(data.get("password")),
      });
      form.reset();
      done();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Tạo trường"
      close={close}
      confirmDiscard={dirty}
      closeDisabled={busy}
    >
      {(requestClose) => (
        <>
          <p className="text-sm leading-6 text-slate-500">
            Hệ thống sẽ tạo không gian dữ liệu riêng và tài khoản admin cho
            trường. Trường mới bắt đầu với gói Starter dùng thử 30 ngày.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Tên trường">
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                required
                minLength={2}
                maxLength={150}
                className={inputClass}
                placeholder="Trường THPT…"
                autoFocus
              />
            </Field>
            <Field label="Subdomain của trường">
              <input
                name="slug"
                required
                pattern={"[a-z][a-z0-9\\-]{1,48}[a-z0-9]"}
                minLength={3}
                maxLength={50}
                className={inputClass}
                placeholder="demo-school"
                value={slug}
                disabled={busy}
                onChange={(e) => setSlug(e.target.value)}
              />
            </Field>
            <p className="text-xs text-slate-500">
              3–50 ký tự thường, số hoặc dấu gạch ngang; bắt đầu bằng chữ, kết
              thúc bằng chữ hoặc số. Mã này xuất hiện trong địa chỉ của trường.
            </p>
            <Field label="Tên miền gốc">
              <input
                name="baseDomain"
                value={baseDomain}
                onChange={(e) => setBaseDomain(e.target.value)}
                required
                maxLength={253}
                placeholder="estude.vn"
                disabled={busy || !domainReady}
                autoCapitalize="none"
                spellCheck={false}
                className={inputClass}
              />
            </Field>
            {!domainReady && (
              <button
                type="button"
                onClick={() => void loadDomain()}
                className={secondaryClass}
              >
                Tải lại tên miền mặc định
              </button>
            )}
            <div className="rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">
              <p className="font-medium">Địa chỉ các portal sẽ được đăng ký</p>
              {previewTenantDomains(slug, baseDomain).map((domain) => (
                <p key={domain.id} className="break-all">
                  {domain.hostname}
                </p>
              ))}
              <p>
                DNS và HTTPS được tự thiết lập nếu máy chủ đã bật kết nối Cloudflare và Vercel.
              </p>
            </div>
            <Field label="Tài khoản admin của trường">
              <input
                name="account"
                required
                pattern={"[a-zA-Z0-9._\\-]{3,50}"}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                disabled={busy}
                autoComplete="off"
                className={inputClass}
              />
            </Field>
            <PasswordField
              label="Mật khẩu admin của trường"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
            <p className="text-xs text-slate-500">
              8–128 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt; không
              chứa khoảng trắng. Lưu mật khẩu trước khi tạo.
            </p>
            {error && <Notice>{error}</Notice>}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className={secondaryClass}
                onClick={requestClose}
                disabled={busy}
              >
                Hủy
              </button>
              <button
                type="submit"
                className={primaryClass}
                disabled={busy || !domainReady}
              >
                {busy ? "Đang gửi…" : "Tạo trường"}
              </button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}

function NewPlan({ done, close, plan }: { done: () => void; close: () => void; plan?: Plan }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [publicSale, setPublicSale] = useState(plan?.publicSale ?? true);
  useUnsavedChanges(dirty || busy);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const gib = Number(data.get("storage")),
        tokens = Number(data.get("tokens")),
        emails = Number(data.get("emails"));
      if (
        ![gib, tokens, emails].every((n) => Number.isSafeInteger(n) && n >= 0)
      )
        throw new Error("Hạn mức phải là số nguyên không âm.");
      const prices: Partial<Record<"MONTH" | "YEAR", number>> = {};
      for (const cycle of ["MONTH", "YEAR"] as const) {
        const raw = String(data.get(cycle) ?? "").trim();
        if (!raw) continue;
        const price = Number(raw);
        if (!Number.isSafeInteger(price) || price < 2000 || price > 1000000000)
          throw new Error("Giá phải là số nguyên từ 2.000 đến 1.000.000.000 đồng.");
        prices[cycle] = price;
      }
      const sale = {
        name: String(data.get("name")),
        description: String(data.get("description") ?? ""),
        tier: Number(data.get("tier") ?? 1),
        sortOrder: Number(data.get("sortOrder") ?? 0),
        publicSale: data.get("publicSale") === "on",
        prices,
      };
      if (sale.publicSale && (!Object.keys(prices).length || sale.tier < 1))
        throw new Error("Gói mở bán cần ít nhất một giá tháng/năm và cấp bậc từ 1 trở lên.");
      if (plan) await platformApi.updatePlanSale(plan.id, {
        ...sale, active: data.get("active") === "on", expectedRevision: plan.revision,
      });
      else await platformApi.createPlan({
        ...sale,
        code: String(data.get("code")),
        limits: {
          storage_bytes: gib * 1024 ** 3,
          ai_tokens: tokens,
          email_messages: emails,
        },
        features: { ai: data.get("ai") === "on" },
      });
      done();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={plan ? "Chỉnh sửa gói & giá bán" : "Tạo gói dịch vụ"}
      close={close}
      confirmDiscard={dirty}
      closeDisabled={busy}
    >
      {(requestClose) => (
        <form
          onSubmit={submit}
          onChange={() => setDirty(true)}
          className="space-y-4"
        >
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <Field label="Tên gói">
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={plan?.name}
                className={inputClass}
              />
            </Field>
            <Field label="Mã gói">
              <input
                name="code"
                required
                pattern="[a-z][a-z0-9_]{1,63}"
                placeholder="school_pro"
                defaultValue={plan?.code}
                disabled={!!plan}
                className={inputClass}
              />
            </Field>
            <Field label="Mô tả hiển thị trên bảng giá">
              <textarea name="description" maxLength={500} rows={3} defaultValue={plan?.description} className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Giá tháng (VND)">
                <input name="MONTH" type="number" min={2000} max={1000000000} step={1} defaultValue={plan?.prices?.MONTH} placeholder="299000" className={inputClass} />
              </Field>
              <Field label="Giá năm (VND)">
                <input name="YEAR" type="number" min={2000} max={1000000000} step={1} defaultValue={plan?.prices?.YEAR} placeholder="2990000" className={inputClass} />
              </Field>
            </div>
            <p className="text-xs text-slate-500">Để trống một giá nếu không bán theo chu kỳ đó. Giá đã bao gồm thuế.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cấp bậc gói">
                <input name="tier" type="number" required min={publicSale ? 1 : 0} max={100} step={1} defaultValue={plan?.tier ?? 1} className={inputClass} />
              </Field>
              <Field label="Thứ tự hiển thị">
                <input name="sortOrder" type="number" required min={0} max={10000} step={1} defaultValue={plan?.sortOrder ?? 0} className={inputClass} />
              </Field>
            </div>
            <p className="text-xs text-slate-500">Cấp bậc lớn hơn là gói nâng cấp. Thứ tự nhỏ hơn được hiển thị trước.</p>
            <label className="flex items-center gap-2 text-sm">
              <input name="publicSale" type="checkbox" checked={publicSale} disabled={plan?.code === "starter"} onChange={(e) => setPublicSale(e.target.checked)} />
              Hiển thị trên bảng giá và cho phép mua
            </label>
            {plan && <label className="flex items-center gap-2 text-sm">
              <input name="active" type="checkbox" defaultChecked={plan.active} /> Gói đang hoạt động
            </label>}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Dung lượng (GiB)">
                <input
                  type="number"
                  name="storage"
                  min={0}
                  max={931}
                  step={1}
                  required
                  defaultValue={plan ? (plan.limits?.storage_bytes ?? 0) / 1024 ** 3 : 5}
                  disabled={!!plan}
                  className={inputClass}
                />
              </Field>
              <Field label="AI tokens / tháng">
                <input
                  type="number"
                  name="tokens"
                  min={0}
                  max={1000000000000}
                  step={1}
                  required
                  defaultValue={plan ? plan.limits?.ai_tokens ?? 0 : 100000}
                  disabled={!!plan}
                  className={inputClass}
                />
              </Field>
              <Field label="Email / tháng">
                <input
                  type="number"
                  name="emails"
                  min={0}
                  max={1000000000000}
                  step={1}
                  required
                  defaultValue={plan ? plan.limits?.email_messages ?? 0 : 1000}
                  disabled={!!plan}
                  className={inputClass}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ai" defaultChecked={plan ? plan.features?.ai : true} disabled={!!plan} /> Cho phép tính
              năng AI
            </label>
            <p className="text-xs leading-5 text-slate-500">
              {plan ? "Giá mới áp dụng cho đơn tạo sau khi lưu. Đơn đã tạo giữ nguyên số tiền. Hạn mức được giữ để bảo toàn quyền lợi các trường đang dùng gói." : "Gói được mở bán sẽ xuất hiện trên trang quảng cáo để khách chọn mua và thanh toán qua PayOS."}
            </p>
            {error && <Notice>{error}</Notice>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={requestClose}
                className={secondaryClass}
                disabled={busy}
              >
                Hủy
              </button>
              <button type="submit" disabled={busy} className={primaryClass}>
                {busy ? "Đang lưu…" : plan ? "Lưu thay đổi" : "Tạo gói"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}

const tabs = [
  { id: "overview", name: "Tổng quan", icon: LayoutDashboard },
  { id: "tenants", name: "Trường học", icon: Building2 },
  { id: "admins", name: "Quản trị trường", icon: UsersRound },
  { id: "domains", name: "Tên miền", icon: Globe },
  { id: "plans", name: "Gói dịch vụ", icon: Layers3 },
  { id: "orders", name: "Đơn thanh toán", icon: ListChecks },
] as const;
type Tab = (typeof tabs)[number]["id"];
const expiredSessionMessage =
  "Phiên quản trị đã hết hạn hoặc không còn hiệu lực. Vui lòng đăng nhập lại.";

export function PlatformConsole() {
  const [operator, setOperator] = useState<Operator | null>(null),
    [initializing, setInitializing] = useState(true);
  const [tab, setTab] = useState<Tab>("overview"),
    [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]),
    [total, setTotal] = useState(0),
    [plans, setPlans] = useState<Plan[]>([]);
  const [draft, setDraft] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(0);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [plansError, setPlansError] = useState("");
  const [domainDirty, setDomainDirty] = useState(false);
  const [domainBusy, setDomainBusy] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    Tab | "logout" | null
  >(null);
  function changeTab(next: Tab) {
    if (next === tab || domainBusy) return;
    if (domainDirty) setPendingNavigation(next);
    else setTab(next);
  }
  const loadSequence = useRef(0);
  const [modal, setModal] = useState<"tenant" | "plan" | null>(null),
    [selected, setSelected] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const clearSession = useCallback((message = "") => {
    ++loadSequence.current;
    setOperator(null);
    setDomainDirty(false);
    setDomainBusy(false);
    setDirectoryError("");
    setPlansError("");
    setPendingNavigation(null);
    setSelected(null);
    setModal(null);
    setEditingPlan(null);
    setOverview(null);
    setTenants([]);
    setTotal(0);
    setPlans([]);
    setNotice("");
    setError(message);
    setBusy(false);
    setTab("overview");
    setDraft("");
    setQuery("");
    setStatus("");
    setPage(0);
  }, []);
  useEffect(() => {
    if (!operator) return;
    return onPlatformSessionExpired(() => clearSession(expiredSessionMessage));
  }, [operator, clearSession]);
  useEffect(() => {
    let live = true;
    platformApi
      .me()
      .then((op) => {
        if (live) setOperator(op);
      })
      .catch((error) => {
        if (live && (!(error instanceof PlatformError) || error.status !== 401))
          setError(errorText(error));
      })
      .finally(() => {
        if (live) setInitializing(false);
      });
    return () => {
      live = false;
    };
  }, []);
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setBusy(true);
    try {
      const [summary, directory, packages] = await Promise.allSettled([
        platformApi.overview(),
        platformApi.tenants(query, status, page),
        platformApi.plans(),
      ]);
      if (sequence !== loadSequence.current) return;
      const failures = [summary, directory, packages].filter(
        (result) => result.status === "rejected",
      );
      if (
        failures.some(
          (result) =>
            result.reason instanceof PlatformError &&
            result.reason.status === 401,
        )
      ) {
        clearSession(expiredSessionMessage);
        return;
      }
      if (summary.status === "fulfilled") setOverview(summary.value);
      if (packages.status === "fulfilled") {
        setPlans(packages.value);
        setPlansError("");
      } else setPlansError(errorText(packages.reason));
      if (directory.status === "fulfilled") {
        setDirectoryError("");
        const validPage = tenantPage(directory.value.total, page);
        if (validPage !== page) {
          setPage(validPage);
          return;
        }
        setTenants(directory.value.data);
        setTotal(directory.value.total);
      } else {
        // Do not label the previous search's rows as results of the new filter.
        setTenants([]);
        setTotal(0);
        setDirectoryError(errorText(directory.reason));
      }
      setError(failures.map((result) => errorText(result.reason)).join(" "));
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      if (error instanceof PlatformError && error.status === 401) {
        clearSession(expiredSessionMessage);
        return;
      }
      setError(errorText(error));
    } finally {
      if (sequence === loadSequence.current) setBusy(false);
    }
  }, [query, status, page, clearSession]);
  useEffect(() => {
    if (operator) void load();
  }, [operator, load]);
  useEffect(() => {
    if (!operator || !overview?.pending) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await load();
      if (!stopped) timer = setTimeout(poll, 5000);
    };
    timer = setTimeout(poll, 5000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [operator, overview?.pending, load]);
  function logout() {
    if (domainBusy) return;
    if (domainDirty) setPendingNavigation("logout");
    else void executeLogout();
  }
  async function executeLogout() {
    setBusy(true);
    try {
      await platformApi.logout();
      clearSession();
    } catch (error) {
      if (error instanceof PlatformError && error.status === 401) {
        clearSession(expiredSessionMessage);
      } else {
        setError(errorText(error));
      }
    } finally {
      setBusy(false);
    }
  }
  if (initializing)
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-4 text-sm text-slate-500"
        role="status"
      >
        <span className="rounded-2xl bg-blue-50 p-4 text-blue-600">
          <ShieldCheck size={28} />
        </span>
        <span className="inline-flex items-center gap-2">
          <LoaderCircle size={16} className="animate-spin" />
          Đang kiểm tra phiên quản trị…
        </span>
      </main>
    );
  if (!operator)
    return (
      <Login
        initialError={error}
        onLogin={(op) => {
          setOperator(op);
          setError("");
        }}
      />
    );
  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <a
        href="#console-content"
        className="sr-only z-50 rounded-lg bg-blue-600 p-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Đến nội dung chính
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200/80 bg-white px-4 py-7 lg:flex">
        <div className="flex items-center gap-3 px-3">
          <div className="rounded-xl bg-blue-600 p-2.5 text-white shadow-md shadow-blue-600/20">
            <ShieldCheck size={24} />
          </div>
          <div className="text-xl font-bold tracking-tight">
            EStude
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              SaaS Console
            </span>
          </div>
        </div>
        <p className="mb-3 mt-8 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Không gian làm việc
        </p>
        <nav className="space-y-1.5" aria-label="Điều hướng quản trị">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => changeTab(item.id)}
              disabled={domainBusy}
              aria-pressed={tab === item.id}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${tab === item.id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <item.icon size={18} />
              {item.name}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <button
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            onClick={logout}
            disabled={busy}
          >
            <LogOut size={17} />
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="min-w-0 lg:ml-64">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/95 px-5 py-4 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-400 sm:text-sm">
            <ShieldCheck size={17} className="shrink-0 text-blue-600" />
            <span className="hidden whitespace-nowrap sm:inline">Quản trị SaaS</span>
            <ChevronRight size={14} className="hidden shrink-0 sm:block" />
            <span className="truncate font-medium text-slate-700">
              {tabs.find((item) => item.id === tab)?.name}
            </span>
          </div>
          <div className="ml-auto flex min-w-0 max-w-[65%] shrink-0 items-center gap-2.5 sm:max-w-xs sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold uppercase text-slate-600">
              {operator.accountName.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" title={operator.accountName}>
                {operator.accountName}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-slate-400 sm:text-[11px]">
                Quản trị viên nền tảng
              </p>
            </div>
          </div>
        </header>
        <main
          id="console-content"
          className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">
                EStude Platform
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {tab === "admins" ? "Tài khoản quản trị trường" : "Quản lý hệ thống"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {tab === "overview"
                  ? "Tổng quan trường học và hoạt động trên nền tảng của bạn."
                  : tab === "tenants"
                    ? "Quản lý không gian học tập và trạng thái của từng trường."
                    : tab === "admins"
                      ? "Cấp tài khoản, khóa hoặc mở khóa và đặt lại mật khẩu quản trị theo từng trường."
                    : tab === "domains"
                      ? "Thiết lập địa chỉ truy cập mặc định cho trường mới."
                      : "Quản lý gói dịch vụ, tính năng và hạn mức sử dụng."}
              </p>
            </div>
            {tab !== "admins" && <div className="flex gap-2">
              <button
                className={secondaryClass}
                onClick={() => void load()}
                disabled={busy}
              >
                <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
                Làm mới
              </button>
              <button
                className={primaryClass}
                onClick={() => setModal("tenant")}
              >
                <Plus size={17} />
                Tạo trường
              </button>
            </div>}
          </div>
          <nav
            className="-mx-4 flex gap-1 overflow-x-auto border-y border-slate-200/70 bg-white px-4 py-2 lg:hidden"
            aria-label="Điều hướng mobile"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => changeTab(item.id)}
                disabled={domainBusy}
                aria-pressed={tab === item.id}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-medium ${tab === item.id ? "bg-blue-50 text-blue-700" : "text-slate-500"}`}
              >
                <item.icon size={15} />
                {item.name}
              </button>
            ))}
            <button
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              onClick={logout}
              disabled={busy}
            >
              <LogOut size={15} />
              Đăng xuất
            </button>
          </nav>
          {error && <Notice>{error}</Notice>}
          {notice && (
            <SuccessNotice dismiss={() => setNotice("")}>
              {notice}
            </SuccessNotice>
          )}
          {tab !== "admins" && <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {[
              {
                label: "Tổng trường học",
                value: overview?.total,
                icon: Building2,
                color: "text-blue-600 bg-blue-50",
              },
              {
                label: "Đang hoạt động",
                value: overview?.active,
                icon: ShieldCheck,
                color: "text-emerald-600 bg-emerald-50",
              },
              {
                label: "Đang tạm khóa",
                value: overview?.suspended,
                icon: Layers3,
                color: "text-rose-600 bg-rose-50",
              },
              {
                label: "Chờ tạo trường",
                value: overview?.pending,
                icon: ListChecks,
                color: "text-amber-600 bg-amber-50",
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="flex min-w-0 items-start justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/30 sm:p-5"
              >
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {metric.label}
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tight">
                    {metric.value === undefined ? "—" : amount(metric.value)}
                  </p>
                </div>
                <div className={`rounded-xl p-2.5 ${metric.color}`}>
                  <metric.icon size={21} />
                </div>
              </div>
            ))}
          </div>}
          {tab === "overview" && (
            <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
              <section className="relative overflow-hidden rounded-2xl bg-[#163b80] p-6 text-white sm:p-7">
                <div
                  aria-hidden="true"
                  className="absolute -right-12 -top-16 h-64 w-64 rounded-full border-[32px] border-white/5"
                />
                <div className="relative">
                  <p className="text-xs font-medium text-blue-200">
                    KHÔNG GIAN LÀM VIỆC
                  </p>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight">
                    Sẵn sàng đồng hành cùng các trường
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-blue-100/80">
                    Thiết lập trường học, quản lý dịch vụ và theo dõi hoạt động
                    hằng ngày ngay tại đây.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => changeTab("domains")}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-blue-800 shadow-sm hover:bg-blue-50"
                    >
                      <Globe size={15} />
                      Cấu hình tên miền
                      <ArrowRight size={14} />
                    </button>
                    <button
                      onClick={() => changeTab("plans")}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-xs font-medium text-white hover:bg-white/10"
                    >
                      Xem gói dịch vụ
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/20">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Activity size={17} className="text-blue-600" />
                  <h2>Hoạt động cần chú ý</h2>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Tiến trình khởi tạo không gian cho các trường.
                </p>
                <div className="mt-5 flex w-full items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <span className="flex items-center gap-2">
                    <ListChecks size={17} />
                    Yêu cầu đang chờ
                  </span>
                  <span className="font-bold">
                    {overview ? amount(overview.pending) : "—"}
                  </span>
                </div>
                <div className="mt-2 flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span>Tạo trường thất bại</span>
                  <span
                    className={
                      overview?.failed
                        ? "font-bold text-rose-600"
                        : "font-semibold"
                    }
                  >
                    {overview ? amount(overview.failed) : "—"}
                  </span>
                </div>
              </section>
            </div>
          )}
          {tab === "domains" && (
            <DomainSettingsPanel
              onSaved={() => void load()}
              onDirtyChange={setDomainDirty}
              onBusyChange={setDomainBusy}
            />
          )}
          {(tab === "tenants" || tab === "overview") && (
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/20">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
                <h2 className="font-bold">
                  Danh sách trường{" "}
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                    {total}
                  </span>
                </h2>
                <div className="flex w-full flex-wrap gap-2 md:w-auto">
                  <form
                    className="flex w-full min-w-0 gap-2 sm:w-auto sm:flex-1 md:flex-none"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setQuery(draft.trim());
                      setPage(0);
                    }}
                  >
                    <input
                      aria-label="Tìm trường"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={150}
                      placeholder="Tên hoặc mã trường…"
                      className={inputClass}
                    />
                    <button className={secondaryClass} aria-label="Tìm kiếm">
                      <Search size={17} />
                    </button>
                  </form>
                  <select
                    aria-label="Lọc trạng thái"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(0);
                    }}
                    className={`${inputClass} !w-auto`}
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="SUSPENDED">Tạm khóa</option>
                  </select>
                  {(query || status) && (
                    <button
                      type="button"
                      className={secondaryClass}
                      onClick={() => {
                        setDraft("");
                        setQuery("");
                        setStatus("");
                        setPage(0);
                      }}
                    >
                      <X size={14} />
                      Xóa bộ lọc
                    </button>
                  )}
                </div>
              </div>
              <div aria-busy={busy}>
                <div className="divide-y divide-slate-100 sm:hidden">
                  {tenants.map((tenant) => (
                    <article key={tenant.id} className="space-y-4 p-5">
                      <div className="flex items-start gap-3">
                        <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                          <Building2 size={19} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-sm font-semibold leading-6">
                            {tenant.name}
                          </h3>
                          <p className="mt-1 break-all font-mono text-xs text-slate-400">
                            {tenant.slug}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <Badge status={tenant.status} />
                        <button
                          onClick={() => setSelected(tenant.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
                          aria-label={`Quản lý ${tenant.name}`}
                        >
                          Quản lý
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Ngày tạo: {dateText(tenant.createdAt)}
                      </p>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Trường học</th>
                        <th className="px-5 py-3 font-medium">Mã trường</th>
                        <th className="px-5 py-3 font-medium">Trạng thái</th>
                        <th className="px-5 py-3 font-medium">Ngày tạo</th>
                        <th className="px-5 py-3 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tenants.map((tenant) => (
                        <tr key={tenant.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-4 font-semibold">
                            <div className="flex items-center gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <Building2 size={19} />
                              </span>
                              <span>{tenant.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-500">
                            <span className="rounded-md bg-slate-50 px-2 py-1 font-mono text-xs">
                              {tenant.slug}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <Badge status={tenant.status} />
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                            {dateText(tenant.createdAt)}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              onClick={() => setSelected(tenant.id)}
                              className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                              aria-label={`Quản lý ${tenant.name}`}
                            >
                              Quản lý <ArrowUpRight size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!tenants.length &&
                  (busy ? (
                    <div role="status" className="space-y-4 p-6">
                      <span className="sr-only">
                        Đang tải danh sách trường…
                      </span>
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-10 animate-pulse rounded-lg bg-slate-100"
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title={
                        directoryError
                          ? "Chưa tải được danh sách trường"
                          : query || status
                            ? "Không tìm thấy trường phù hợp"
                            : "Bắt đầu với trường học đầu tiên"
                      }
                      description={
                        directoryError
                          ? "Thử làm mới để tải lại dữ liệu."
                          : query || status
                            ? "Thử một tên trường khác hoặc xóa bộ lọc hiện tại."
                            : "Tạo trường để thiết lập không gian học tập và tài khoản quản trị riêng."
                      }
                    >
                      {!directoryError && !query && !status && (
                        <button
                          className={primaryClass}
                          onClick={() => setModal("tenant")}
                        >
                          <Plus size={16} />
                          Tạo trường
                        </button>
                      )}
                    </EmptyState>
                  ))}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                <span>
                  {total > 0
                    ? `${page * 20 + 1}–${Math.min((page + 1) * 20, total)} / ${amount(total)} trường`
                    : "0 trường"}
                  <span className="ml-3 hidden sm:inline">
                    Trang {page + 1} / {Math.max(1, Math.ceil(total / 20))}
                  </span>
                </span>
                <div className="flex gap-2">
                  <button
                    className={secondaryClass}
                    disabled={page === 0 || busy}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Trước
                  </button>
                  <button
                    className={secondaryClass}
                    disabled={(page + 1) * 20 >= total || busy}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sau
                  </button>
                </div>
              </div>
            </section>
          )}
          {tab === "plans" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Gói dịch vụ</h2>
                <button
                  onClick={() => { setEditingPlan(null); setModal("plan"); }}
                  className={primaryClass}
                >
                  <Plus size={16} />
                  Tạo gói
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((plan) => (
                  <article
                    key={plan.id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-widest text-blue-600">
                        {plan.code}
                      </p>
                      {!plan.active && <Badge status="INACTIVE" />}
                    </div>
                    <h3 className="mt-2 text-xl font-bold">{plan.name}</h3>
                    <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
                    <p className="mt-3 text-sm font-semibold text-blue-700">{plan.active && plan.publicSale ? "Đang mở bán" : "Ẩn khỏi bảng giá"}</p>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between"><dt>Giá tháng</dt><dd className="font-semibold">{plan.prices?.MONTH === undefined ? "Không bán" : `${amount(plan.prices.MONTH)} ₫`}</dd></div>
                      <div className="flex justify-between"><dt>Giá năm</dt><dd className="font-semibold">{plan.prices?.YEAR === undefined ? "Không bán" : `${amount(plan.prices.YEAR)} ₫`}</dd></div>
                      <div className="flex justify-between text-slate-500"><dt>Cấp bậc / thứ tự</dt><dd>{plan.tier} / {plan.sortOrder}</dd></div>
                    </dl>
                    <dl className="mt-5 space-y-3 text-sm">
                      {Object.entries(plan.limits ?? {}).map(
                        ([resource, value]) => (
                          <div
                            className="flex justify-between gap-3"
                            key={resource}
                          >
                            <dt className="text-slate-500">
                              {resource === "storage_bytes"
                                ? "Dung lượng"
                                : resource === "ai_tokens"
                                  ? "AI tokens / tháng"
                                  : resource === "email_messages"
                                    ? "Email / tháng"
                                    : resource}
                            </dt>
                            <dd className="font-semibold">
                              {resource === "storage_bytes"
                                ? `${amount(value / 1024 ** 3)} GiB`
                                : amount(value)}
                            </dd>
                          </div>
                        ),
                      )}
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Tính năng AI</dt>
                        <dd>{plan.features?.ai ? "Cho phép" : "Tắt"}</dd>
                      </div>
                    </dl>
                    <button type="button" className={`${secondaryClass} mt-5 w-full`} onClick={() => { setEditingPlan(plan); setModal("plan"); }}>Chỉnh sửa gói & giá</button>
                  </article>
                ))}
              </div>
              {!plans.length && (
                <EmptyState
                  title={
                    busy
                      ? "Đang tải gói dịch vụ…"
                      : plansError
                        ? "Chưa tải được gói dịch vụ"
                        : "Chưa có gói dịch vụ"
                  }
                  description={
                    plansError
                      ? "Thử làm mới để tải lại danh sách gói."
                      : "Tạo gói để quản lý tính năng và hạn mức sử dụng cho từng trường."
                  }
                />
              )}
              <p className="text-xs text-slate-500">
                Gói đang hoạt động, có giá và được mở bán sẽ hiển thị tại <a href="/" target="_blank" rel="noreferrer" className="font-semibold text-blue-600 underline">trang bảng giá</a>. Đơn hàng PayOS nằm ở thẻ “Đơn thanh toán”.
              </p>
            </section>
          )}
          {tab === "admins" && <AdminAccountsPanel onDirtyChange={setDomainDirty} onBusyChange={setDomainBusy} />}
          {tab === "orders" && <BillingOrdersPanel />}
        </main>
      </div>
      {pendingNavigation && (
        <DiscardChangesDialog
          cancel={() => setPendingNavigation(null)}
          discard={() => {
            const next = pendingNavigation;
            setPendingNavigation(null);
            if (next === "logout") void executeLogout();
            else {
              setDomainDirty(false);
              setTab(next);
            }
          }}
        />
      )}
      {modal === "tenant" && (
        <NewTenant
          close={() => setModal(null)}
          done={() => {
            setModal(null);
            setTab("tenants");
            setDraft("");
            setQuery("");
            setStatus("");
            setPage(0);
            setNotice(
              "Đã nhận yêu cầu tạo trường. Trường sẽ xuất hiện trong danh sách khi khởi tạo hoàn tất.",
            );
            void load();
          }}
        />
      )}
      {modal === "plan" && (
        <NewPlan
          plan={editingPlan ?? undefined}
          close={() => setModal(null)}
          done={() => {
            setModal(null);
            setNotice(editingPlan ? "Đã cập nhật gói và giá bán." : "Đã tạo gói dịch vụ.");
            setEditingPlan(null);
            void load();
          }}
        />
      )}
      {selected && (
        <TenantPanel
          key={selected}
          id={selected}
          plans={plans}
          close={() => setSelected(null)}
          updated={() => void load()}
        />
      )}
    </div>
  );
}
