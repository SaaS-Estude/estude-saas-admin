"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, Inbox, X } from "lucide-react";

export const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:opacity-60";
export const primaryClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/10 transition hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50";
export const secondaryClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50";
export const dateText = (value: string) =>
  new Date(value).toLocaleString("vi-VN");
export const amount = (value: number) => value.toLocaleString("vi-VN");
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Không thể xử lý yêu cầu.";
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="block space-y-1.5 text-sm font-medium text-slate-700">
      <label htmlFor={id} className="block">
        {label}
      </label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id })
        : children}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  const label: Record<string, string> = {
    ACTIVE: "Hoạt động",
    SUSPENDED: "Tạm khóa",
    PROVISIONING: "Đang tạo",
    PENDING: "Đang chờ",
    SUCCEEDED: "Hoàn tất",
    FAILED: "Thất bại",
    TRIAL: "Dùng thử",
    EXPIRED: "Hết hạn",
  };
  const color = ["ACTIVE", "SUCCEEDED"].includes(status)
    ? "bg-emerald-50 text-emerald-700"
    : ["FAILED", "SUSPENDED", "EXPIRED"].includes(status)
      ? "bg-rose-50 text-rose-700"
      : "bg-amber-50 text-amber-700";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-black/5 ${color}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden="true"
      />
      {label[status] ?? status}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-slate-400">
        <Inbox size={25} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
export function Modal({
  title,
  titleBadge,
  close,
  children,
  confirmDiscard = false,
  closeDisabled = false,
  footer,
  size = "default",
}: {
  title: string;
  titleBadge?: ReactNode;
  close: () => void;
  children: ReactNode | ((requestClose: () => void) => ReactNode);
  confirmDiscard?: boolean;
  closeDisabled?: boolean;
  footer?: ReactNode | ((requestClose: () => void) => ReactNode);
  size?: "default" | "wide";
}) {
  const [confirming, setConfirming] = useState(false);
  const continueButton = useRef<HTMLButtonElement>(null);
  const requestClose = () => {
    if (closeDisabled) return;
    if (confirming) setConfirming(false);
    else if (confirmDiscard) setConfirming(true);
    else close();
  };
  const dialog = useRef<HTMLElement>(null);
  const closeRef = useRef(requestClose);
  useEffect(() => {
    closeRef.current = requestClose;
  });
  useEffect(() => {
    if (!confirming) return;
    const previous = document.activeElement;
    continueButton.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [confirming]);
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],textarea:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const elements = focusable(),
          first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-3 backdrop-blur-sm sm:p-6"
      onClick={requestClose}
    >
      <section
        ref={dialog}
        role={confirming ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-label={confirming ? "Hủy bỏ thay đổi?" : title}
        className={`my-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${confirming ? "max-w-lg" : size === "wide" ? "max-w-6xl" : "max-w-2xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="min-w-0 break-words text-lg font-bold">
              {confirming ? "Hủy bỏ thay đổi?" : title}
            </h2>
            {!confirming && titleBadge}
          </div>
          <button
            onClick={requestClose}
            disabled={closeDisabled}
            aria-label="Đóng"
            className="shrink-0 rounded-lg p-2 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>
        <div
          hidden={confirming}
          className="min-h-0 space-y-5 overflow-y-auto p-6"
        >
          {typeof children === "function" ? children(requestClose) : children}
        </div>
        {!confirming && footer && (
          <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
            {typeof footer === "function" ? footer(requestClose) : footer}
          </div>
        )}
        {confirming && (
          <div className="space-y-6 p-6">
            <p className="text-sm leading-6 text-slate-600">
              Bạn có muốn hủy bỏ thay đổi? Dữ liệu đã nhập sẽ không được lưu.
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                ref={continueButton}
                type="button"
                className={secondaryClass}
                onClick={() => setConfirming(false)}
              >
                Tiếp tục nhập
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
                onClick={close}
              >
                Hủy bỏ thay đổi
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
