"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { platformApi, type TenantAdminAccount } from "@/lib/platform-api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import {
  Field,
  Notice,
  PasswordField,
  SuccessNotice,
  errorText,
  inputClass,
  primaryClass,
  secondaryClass,
} from "./console-ui";

export function TenantAdminPasswordPanel({
  id,
  account,
  disabled = false,
  onDirtyChange,
  onBusyChange,
}: {
  id: string;
  account?: TenantAdminAccount;
  disabled?: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [accounts, setAccounts] = useState<TenantAdminAccount[]>([]);
  const [selected, setSelected] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const dirty = Boolean(password || confirmation);
  useUnsavedChanges(dirty || busy);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const rows = account ? [account] : await platformApi.tenantAdminAccounts(id);
      setAccounts(rows);
      setSelected(rows[0]?.id ?? "");
    } catch (cause) {
      setLoadError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [id, account]);
  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || disabled || !selected) return;
    setError("");
    setSuccess("");
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    const bytes = new TextEncoder().encode(password).length;
    if (
      bytes < 8 ||
      bytes > 128 ||
      /\s/u.test(password) ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^a-zA-Z0-9]/u.test(password)
    ) {
      setError(
        "Mật khẩu cần 8–128 byte, có chữ hoa, chữ thường, số và ký tự đặc biệt; không chứa khoảng trắng.",
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      await platformApi.resetTenantAdminPassword(
        id,
        selected,
        password,
        confirmation,
      );
      setPassword("");
      setConfirmation("");
      setSuccess(
        `Đã đặt lại mật khẩu tài khoản ${accounts.find((account) => account.id === selected)?.accountName ?? "quản trị trường"}. Các phiên đăng nhập cũ đã được thu hồi.`,
      );
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div>
        <h3 className="flex items-center gap-2 font-bold">
          <KeyRound size={17} />
          Tài khoản quản trị trường
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Mỗi trường được cấp tối đa 3 tài khoản quản trị. Quản trị viên SaaS có thể đặt lại mật khẩu khi nhà trường cần hỗ trợ.
          Tài khoản phải đăng nhập lại trên tất cả thiết bị sau khi đặt lại.
        </p>
      </div>
      {loading ? (
        <p role="status" className="text-sm text-slate-500">
          Đang tải tài khoản quản trị…
        </p>
      ) : loadError ? (
        <div className="space-y-3">
          <Notice>{loadError}</Notice>
          <button
            type="button"
            className={secondaryClass}
            disabled={disabled}
            onClick={() => void load()}
          >
            Tải lại tài khoản quản trị
          </button>
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-slate-500">
          Trường chưa có tài khoản quản trị.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Notice>{error}</Notice>}
          {success && <SuccessNotice>{success}</SuccessNotice>}
          <fieldset disabled={disabled || busy} className="space-y-4">
            {!account && <Field label="Tài khoản quản trị">
              <select
                value={selected}
                className={inputClass}
                onChange={(event) => {
                  setSelected(event.target.value);
                  setPassword("");
                  setConfirmation("");
                  setError("");
                  setSuccess("");
                }}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountName} — {account.fullName}
                    {account.status === "ACTIVE" ? "" : " (Đang khóa)"}
                  </option>
                ))}
              </select>
            </Field>}
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField
                label="Mật khẩu mới"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setSuccess("");
                }}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                disabled={disabled || busy}
              />
              <PasswordField
                label="Nhập lại mật khẩu mới"
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setSuccess("");
                }}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                disabled={disabled || busy}
              />
            </div>
            <p className="text-xs leading-5 text-slate-500">
              8–128 byte, có chữ hoa, chữ thường, số và ký tự đặc biệt; không
              chứa khoảng trắng. Mật khẩu được lưu riêng bằng nút bên dưới.
            </p>
            <button
              type="submit"
              className={primaryClass}
              disabled={disabled || busy || !password || !confirmation}
            >
              {busy ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <KeyRound size={16} />
              )}
              {busy
                ? "Đang đặt lại mật khẩu…"
                : "Đặt lại mật khẩu quản trị trường"}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
