"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { KeyRound, Plus, X } from "lucide-react";
import {
  platformApi,
  type AdminDirectoryAccount,
  type Tenant,
} from "@/lib/platform-api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { CustomSelect } from "@/components/ui/custom-select";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
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
    <section aria-label="Tài khoản quản trị trường" className="space-y-3">
      {success && (
        <SuccessNotice dismiss={() => setSuccess("")}>{success}</SuccessNotice>
      )}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
          <div className="grid min-w-0 flex-1 items-start gap-3 md:grid-cols-[minmax(200px,1.4fr)_minmax(200px,1fr)_180px]">
            <DebouncedSearchInput
              aria-label="Tìm tài khoản quản trị"
              value={search}
              onValueChange={setSearch}
              onSearch={(value) => {
                setQuery(value);
                setPage(0);
              }}
              maxLength={150}
              placeholder="Tìm theo họ tên, tên đăng nhập hoặc trường…"
              className="!h-[42px] !rounded-lg focus:!ring-0"
            />
            <CustomSelect
              ariaLabel="Trường quản trị"
              value={school?.id ?? ""}
              searchable
              searchPlaceholder="Tìm tên hoặc mã trường…"
              isSearching={schoolsLoading}
              disabled={busy}
              buttonClassName="!h-[42px] !rounded-lg !ring-0"
              options={[
                { value: "", label: "Tất cả trường" },
                ...(school && !schools.some((item) => item.id === school.id)
                  ? [{ value: school.id, label: school.name }]
                  : []),
                ...schools.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.slug})`,
                })),
              ]}
              onSearchChange={(value) => {
                if (value !== schoolSearch) {
                  setSchoolSearch(value);
                  setSchoolPage(0);
                }
              }}
              onValueChange={(value) => {
                setSchool(
                  value
                    ? (schools.find((item) => item.id === value) ??
                        (school?.id === value ? school : null))
                    : null,
                );
                setPage(0);
              }}
            />
            <CustomSelect
              ariaLabel="Trạng thái quản trị"
              value={status}
              buttonClassName="!h-[42px] !rounded-lg !ring-0"
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "ACTIVE", label: "Hoạt động" },
                { value: "LOCKED", label: "Đã khóa" },
                { value: "INACTIVE", label: "Ngừng hoạt động" },
                { value: "PENDING", label: "Chờ kích hoạt" },
              ]}
              onValueChange={(value) => {
                setStatus(value);
                setPage(0);
              }}
            />
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {(search || query || status || school) && (
              <button
                type="button"
                className={`${secondaryClass} h-[42px] !rounded-lg`}
                onClick={() => {
                  setSearch("");
                  setQuery("");
                  setStatus("");
                  setSchool(null);
                  setSchoolSearch("");
                  setSchoolPage(0);
                  setPage(0);
                }}
              >
                <X size={15} />
                Xóa bộ lọc
              </button>
            )}
            <button
              type="button"
              className={`${primaryClass} h-[42px] !rounded-lg`}
              disabled={!school || loading || busy || Boolean(loadError)}
              title={
                !school ? "Chọn trường trong bộ lọc để cấp tài khoản" : undefined
              }
              onClick={() => school && open({ kind: "create", school })}
            >
              <Plus size={16} />
              Cấp tài khoản
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <p>
            {school
              ? `Đang lọc tài khoản của ${school.name}.`
              : "Chọn trường trong bộ lọc để cấp tài khoản mới."}
          </p>
          {(schoolTotal > 20 || schoolPage > 0) && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="font-medium text-blue-600 disabled:text-slate-300"
                disabled={schoolPage === 0 || schoolsLoading}
                onClick={() => setSchoolPage((value) => value - 1)}
              >
                Trường trước
              </button>
              <span>
                {schoolTotal} trường · Trang {schoolPage + 1}
              </span>
              <button
                type="button"
                className="font-medium text-blue-600 disabled:text-slate-300"
                disabled={
                  (schoolPage + 1) * 20 >= schoolTotal || schoolsLoading
                }
                onClick={() => setSchoolPage((value) => value + 1)}
              >
                Trường tiếp
              </button>
            </div>
          )}
        </div>
        {schoolError && <Notice>{schoolError}</Notice>}
      </div>
      {loadError && (
        <Notice>
          {loadError}
          <button
            type="button"
            className="ml-3 font-semibold underline"
            onClick={() => setRevision((value) => value + 1)}
          >
            Thử lại
          </button>
        </Notice>
      )}
      <div
        className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
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
              <thead className="bg-blue-600 text-xs text-white">
                <tr>
                  {[
                    "#",
                    "Họ và tên",
                    "Tên đăng nhập",
                    "Trường học",
                    "Trạng thái",
                    "Thao tác",
                  ].map((label) => (
                    <th key={label} className="px-4 py-3 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <tr
                    key={`${item.tenantId}:${item.id}`}
                    className="hover:bg-slate-50/60"
                  >
                    <td className="w-14 px-4 py-3 text-center text-slate-400">
                      {page * 20 + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700"
                        >
                          {item.fullName
                            .trim()
                            .split(/\s+/)
                            .slice(-2)
                            .map((part) => part.charAt(0))
                            .join("")
                            .toUpperCase()}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {item.fullName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {item.accountName}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">
                        {item.schoolName}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{item.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        status={item.status}
                        label={
                          item.status === "INACTIVE"
                            ? "Ngừng hoạt động"
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          className={secondaryClass}
                          onClick={() =>
                            open({ kind: "password", account: item })
                          }
                        >
                          <KeyRound size={15} />
                          Đổi mật khẩu
                        </button>
                        <ToggleSwitch
                          checked={item.status === "ACTIVE"}
                          aria-label={`${item.status === "ACTIVE" ? "Khóa" : "Mở khóa"} tài khoản ${item.accountName} của ${item.schoolName}`}
                          title={item.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                          disabled={loading || busy || action !== null}
                          loading={busy && action?.kind === "status" && action.account.tenantId === item.tenantId && action.account.id === item.id}
                          onCheckedChange={() => open({ kind: "status", account: item })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>
            {loading
              ? "Đang tải…"
              : total
                ? `Hiển thị ${page * 20 + 1}–${Math.min((page + 1) * 20, total)} / ${total} tài khoản`
                : "0 tài khoản"}
          </span>
          <div className="flex items-center gap-2">
            <span className="mr-2 text-xs">
              Trang {page + 1} / {Math.max(1, Math.ceil(total / 20))}
            </span>
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
