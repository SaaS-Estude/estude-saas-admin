"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  UnlockKeyhole,
  UsersRound,
} from "lucide-react";
import {
  platformApi,
  type AdminDirectoryAccount,
  type Tenant,
} from "@/lib/platform-api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { TenantAdminPasswordPanel } from "./tenant-admin-password-panel";
import {
  Badge,
  DiscardChangesDialog,
  EmptyState,
  Field,
  Modal,
  Notice,
  PasswordField,
  SuccessNotice,
  dangerClass,
  errorText,
  inputClass,
  primaryClass,
  secondaryClass,
} from "./console-ui";

type Action =
  | { kind: "password" | "status"; account: AdminDirectoryAccount }
  | { kind: "create"; school: Tenant };
const emptyDraft = {
  fullName: "",
  accountName: "",
  newPassword: "",
  confirmNewPassword: "",
};

export function AdminAccountsPanel({
  onDirtyChange,
  onBusyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<AdminDirectoryAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [school, setSchool] = useState<Tenant | null>(null);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolPage, setSchoolPage] = useState(0);
  const [schools, setSchools] = useState<Tenant[]>([]);
  const [schoolTotal, setSchoolTotal] = useState(0);
  const [schoolError, setSchoolError] = useState("");
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState<Action | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const lock = useRef(false);
  const sequence = useRef(0);
  const dirty = passwordDirty || Object.values(draft).some(Boolean);
  useUnsavedChanges(dirty || busy);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(
    () => () => {
      onDirtyChange(false);
      onBusyChange(false);
    },
    [onDirtyChange, onBusyChange],
  );
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setLoadError("");
    try {
      const result = await platformApi.adminDirectory(
        query,
        school?.id ?? "",
        status,
        page,
      );
      if (current !== sequence.current) return;
      if (page > 0 && result.total <= page * 20) {
        setPage(Math.max(0, Math.ceil(result.total / 20) - 1));
        return;
      }
      setItems(result.items);
      setTotal(result.total);
    } catch (cause) {
      if (current === sequence.current) {
        setItems([]);
        setLoadError(errorText(cause));
      }
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [page, query, school?.id, status]);
  useEffect(() => {
    const guard = sequence;
    void load();
    return () => {
      ++guard.current;
    };
  }, [load, revision]);
  useEffect(() => {
    let live = true;
    setSchoolsLoading(true);
    setSchoolError("");
    const timer = setTimeout(() => {
      void platformApi
        .tenants(schoolSearch, "", schoolPage)
        .then((result) => {
          if (!live) return;
          setSchools(result.data);
          setSchoolTotal(result.total);
        })
        .catch((cause) => {
          if (live) {
            setSchools([]);
            setSchoolError(errorText(cause));
          }
        })
        .finally(() => {
          if (live) setSchoolsLoading(false);
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [schoolSearch, schoolPage, revision]);

  function open(next: Action) {
    setAction(next);
    setError("");
    setDraft(emptyDraft);
    setSuccess("");
  }
  function close() {
    if (busy || lock.current) return;
    if (dirty) {
      setDiscard(true);
      return;
    }
    setAction(null);
    setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!action || action.kind === "password" || lock.current) return;
    setError("");
    if (action.kind === "create") {
      if (draft.newPassword !== draft.confirmNewPassword) {
        setError("Mật khẩu xác nhận không khớp.");
        return;
      }
      const bytes = new TextEncoder().encode(draft.newPassword).length;
      if (
        bytes < 8 ||
        bytes > 128 ||
        /\s/u.test(draft.newPassword) ||
        !/[a-z]/.test(draft.newPassword) ||
        !/[A-Z]/.test(draft.newPassword) ||
        !/[0-9]/.test(draft.newPassword) ||
        !/[^a-zA-Z0-9]/u.test(draft.newPassword)
      ) {
        setError(
          "Mật khẩu cần 8–128 byte, có chữ hoa, chữ thường, số và ký tự đặc biệt; không chứa khoảng trắng.",
        );
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    try {
      if (action.kind === "create") {
        await platformApi.createTenantAdmin(action.school.id, draft);
        setSuccess(
          `Đã cấp tài khoản ${draft.accountName.trim().toLowerCase()} cho ${action.school.name}.`,
        );
      } else {
        const target = action.account;
        const next = target.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
        await platformApi.setTenantAdminStatus(
          target.tenantId,
          target.id,
          next,
          target.status,
        );
        setSuccess(
          `Đã ${next === "LOCKED" ? "khóa" : "mở khóa"} tài khoản ${target.accountName}.`,
        );
      }
      setDraft(emptyDraft);
      setAction(null);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const field = (key: keyof typeof draft) => ({
    value: draft[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((value) => ({ ...value, [key]: event.target.value })),
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <UsersRound size={21} />
            Tài khoản quản trị trường
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tối đa 3 tài khoản mỗi trường, bao gồm tài khoản đang khóa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={secondaryClass}
            disabled={loading || busy}
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw size={16} />
            Tải lại danh sách
          </button>
          <button
            className={primaryClass}
            disabled={!school || loading || busy || Boolean(loadError)}
            onClick={() => school && open({ kind: "create", school })}
          >
            <Plus size={16} />
            Cấp tài khoản
          </button>
        </div>
      </div>
      {success && (
        <SuccessNotice dismiss={() => setSuccess("")}>{success}</SuccessNotice>
      )}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:grid-cols-3">
        <div className="space-y-3">
          <Field label="Tìm trường">
            <input
              aria-label="Tìm trường quản trị"
              className={inputClass}
              placeholder="Tên hoặc mã trường…"
              value={schoolSearch}
              maxLength={150}
              onChange={(event) => {
                setSchoolSearch(event.target.value);
                setSchoolPage(0);
              }}
            />
          </Field>
          <Field label="Lọc theo trường">
            <select
              aria-label="Trường quản trị"
              className={inputClass}
              disabled={schoolsLoading || busy}
              value={school?.id ?? ""}
              onChange={(event) => {
                setSchool(
                  schools.find((item) => item.id === event.target.value) ??
                    null,
                );
                setPage(0);
              }}
            >
              <option value="">Tất cả trường</option>
              {school && !schools.some((item) => item.id === school.id) && (
                <option value={school.id}>{school.name}</option>
              )}
              {schools.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.slug})
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <button
              className="disabled:opacity-40"
              disabled={schoolPage === 0 || schoolsLoading}
              onClick={() => setSchoolPage((value) => value - 1)}
            >
              Trường trước
            </button>
            <span>
              {schoolsLoading ? "Đang tải trường…" : `${schoolTotal} trường`}
            </span>
            <button
              className="disabled:opacity-40"
              disabled={(schoolPage + 1) * 20 >= schoolTotal || schoolsLoading}
              onClick={() => setSchoolPage((value) => value + 1)}
            >
              Trường tiếp
            </button>
          </div>
          {schoolError && <Notice>{schoolError}</Notice>}
        </div>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setPage(0);
          }}
        >
          <Field label="Tìm tài khoản hoặc trường">
            <input
              aria-label="Tìm tài khoản quản trị"
              className={inputClass}
              value={search}
              maxLength={150}
              placeholder="Tên đăng nhập, họ tên hoặc trường…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <button className={secondaryClass}>
            <Search size={16} />
            Tìm kiếm
          </button>
        </form>
        <div className="space-y-3">
          <Field label="Trạng thái tài khoản">
            <select
              aria-label="Trạng thái quản trị"
              className={inputClass}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="LOCKED">Đã khóa</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
              <option value="PENDING">Chờ kích hoạt</option>
            </select>
          </Field>
          <p className="text-xs leading-5 text-slate-500">
            Chọn một trường để cấp tài khoản. Khóa tài khoản hoặc đổi mật khẩu
            sẽ thu hồi các phiên đăng nhập cũ.
          </p>
        </div>
      </div>
      {loadError && <Notice>{loadError}</Notice>}
      <div
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        aria-busy={loading}
      >
        {loading ? (
          <p role="status" className="p-6 text-sm text-slate-500">
            Đang tải tài khoản quản trị…
          </p>
        ) : items.length === 0 ? (
          <EmptyState
            title={
              loadError
                ? "Chưa tải được danh sách"
                : "Chưa có tài khoản phù hợp"
            }
            description="Tìm kiếm theo tên đăng nhập, trường hoặc thay đổi bộ lọc."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    "Trường học",
                    "Tên đăng nhập",
                    "Họ tên",
                    "Trạng thái",
                    "Thao tác",
                  ].map((label) => (
                    <th key={label} className="px-5 py-3 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr
                    key={`${item.tenantId}:${item.id}`}
                    className="hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold">{item.schoolName}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.slug}</p>
                    </td>
                    <td className="px-5 py-4 font-medium">
                      {item.accountName}
                    </td>
                    <td className="px-5 py-4">{item.fullName}</td>
                    <td className="px-5 py-4">
                      <Badge
                        status={item.status}
                        label={
                          item.status === "INACTIVE"
                            ? "Ngừng hoạt động"
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={secondaryClass}
                          onClick={() =>
                            open({ kind: "password", account: item })
                          }
                        >
                          <KeyRound size={15} />
                          Đổi mật khẩu
                        </button>
                        <button
                          className={secondaryClass}
                          onClick={() =>
                            open({ kind: "status", account: item })
                          }
                        >
                          {item.status === "ACTIVE" ? (
                            <LockKeyhole size={15} />
                          ) : (
                            <UnlockKeyhole size={15} />
                          )}
                          {item.status === "ACTIVE" ? "Khóa" : "Mở khóa"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
          <span>
            {loading ? "…" : `${total} tài khoản · Trang ${page + 1}`}
          </span>
          <div className="flex gap-2">
            <button
              className={secondaryClass}
              disabled={loading || page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              Trước
            </button>
            <button
              className={secondaryClass}
              disabled={loading || (page + 1) * 20 >= total}
              onClick={() => setPage((value) => value + 1)}
            >
              Tiếp
            </button>
          </div>
        </div>
      </div>
      {action && (
        <Modal
          title={
            action.kind === "create"
              ? "Cấp tài khoản quản trị"
              : action.kind === "password"
                ? "Đổi mật khẩu quản trị"
                : action.account.status === "ACTIVE"
                  ? "Khóa tài khoản quản trị"
                  : "Mở khóa tài khoản quản trị"
          }
          close={close}
          closeDisabled={busy}
        >
          <p className="mb-5 text-sm font-semibold text-slate-600">
            {action.kind === "create"
              ? action.school.name
              : `${action.account.schoolName} · ${action.account.accountName}`}
          </p>
          {action.kind === "password" ? (
            <TenantAdminPasswordPanel
              id={action.account.tenantId}
              account={action.account}
              onDirtyChange={setPasswordDirty}
              onBusyChange={setBusy}
            />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <Notice>{error}</Notice>}
              <fieldset disabled={busy} className="space-y-4">
                {action.kind === "create" ? (
                  <>
                    <p className="text-sm text-slate-500">
                      Mỗi trường tối đa 3 tài khoản, tính cả tài khoản đang
                      khóa.
                    </p>
                    <Field label="Họ tên">
                      <input
                        {...field("fullName")}
                        aria-label="Họ tên quản trị"
                        className={inputClass}
                        minLength={2}
                        maxLength={150}
                        required
                      />
                    </Field>
                    <Field label="Tên đăng nhập">
                      <input
                        {...field("accountName")}
                        aria-label="Tên đăng nhập quản trị"
                        className={inputClass}
                        minLength={3}
                        maxLength={50}
                        pattern="[a-z0-9._\-]{3,50}"
                        autoCapitalize="none"
                        autoComplete="off"
                        required
                      />
                    </Field>
                    <p className="text-xs text-slate-500">
                      3–50 ký tự: chữ thường, số, dấu chấm, gạch dưới hoặc gạch
                      ngang.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <PasswordField
                        {...field("newPassword")}
                        label="Mật khẩu mới"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={128}
                        disabled={busy}
                      />
                      <PasswordField
                        {...field("confirmNewPassword")}
                        label="Nhập lại mật khẩu mới"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={128}
                        disabled={busy}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      8–128 byte, có chữ hoa, chữ thường, số và ký tự đặc biệt;
                      không chứa khoảng trắng.
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-6 text-slate-600">
                    {action.account.status === "ACTIVE"
                      ? "Tài khoản sẽ không thể đăng nhập và các phiên hiện tại sẽ bị thu hồi. Các tài khoản khác của trường vẫn hoạt động."
                      : "Tài khoản sẽ được phép đăng nhập lại. Mật khẩu hiện tại được giữ nguyên."}
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className={secondaryClass}
                    onClick={close}
                    disabled={busy}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className={
                      action.kind === "status" &&
                      action.account.status === "ACTIVE"
                        ? dangerClass
                        : primaryClass
                    }
                    disabled={busy}
                  >
                    {busy
                      ? "Đang lưu…"
                      : action.kind === "create"
                        ? "Cấp tài khoản"
                        : action.account.status === "ACTIVE"
                          ? "Xác nhận khóa"
                          : "Xác nhận mở khóa"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </Modal>
      )}
      {discard && (
        <DiscardChangesDialog
          cancel={() => setDiscard(false)}
          discard={() => {
            setDiscard(false);
            setAction(null);
            setDraft(emptyDraft);
            setPasswordDirty(false);
            setError("");
          }}
        />
      )}
    </section>
  );
}
