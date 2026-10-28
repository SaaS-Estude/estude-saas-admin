"use client";

// Aligned with estude-frontend/components/ui; bundled locally for this independent app.

import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
  label?: string;
  hint?: string;
  error?: string;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    icon: Icon,
    label,
    hint,
    error,
    showPasswordToggle = false,
    id,
    type,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const canTogglePassword = showPasswordToggle && type === "password";
  const nativeInput = (
    <input
      id={inputId}
      ref={ref}
      type={canTogglePassword && passwordVisible ? "text" : type}
      className={cn(
        "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
        Icon && "pl-9",
        canTogglePassword && "pr-11",
        error && "border-rose-300 focus:border-rose-400 focus:ring-rose-100",
        className,
      )}
      {...props}
    />
  );
  const control =
    Icon || canTogglePassword ? (
      <span className="relative block">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        ) : null}
        {nativeInput}
        {canTogglePassword ? (
          <button
            type="button"
            aria-label={passwordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            title={passwordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onClick={() => setPasswordVisible((current) => !current)}
            className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {passwordVisible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        ) : null}
      </span>
    ) : (
      nativeInput
    );

  if (!label && !hint && !error) return control;
  return (
    <div className="block">
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-bold text-slate-700"
        >
          {label}
        </label>
      ) : null}
      {control}
      {error || hint ? (
        <span
          className={cn(
            "mt-1.5 block text-xs leading-5",
            error ? "text-rose-600" : "text-slate-400",
          )}
        >
          {error ?? hint}
        </span>
      ) : null}
    </div>
  );
});

export {
  CustomSelect,
  type CustomSelectProps,
  type CustomSelectOption,
} from "./custom-select";
