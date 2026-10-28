"use client";

// Matches the school admin switch; SaaS operator permissions stay server-enforced.

import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ToggleSwitchProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "aria-checked" | "onChange" | "role"
  > {
  checked: boolean;
  loading?: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-label": string;
}

export function ToggleSwitch({
  checked,
  loading = false,
  disabled,
  className,
  onCheckedChange,
  ...props
}: ToggleSwitchProps) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || loading}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-blue-600" : "bg-slate-300",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-4 place-items-center rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      >
        {loading ? (
          <LoaderCircle className="size-3 animate-spin text-blue-600" />
        ) : null}
      </span>
    </button>
  );
}
