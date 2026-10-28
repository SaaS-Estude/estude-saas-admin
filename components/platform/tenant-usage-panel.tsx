"use client";

import { useId } from "react";
import { HardDrive, Mail, Sparkles } from "lucide-react";
import type { Plan, Usage } from "@/lib/platform-api";
import {
  mib,
  parseQuotaValue,
  quotaLabels,
  quotaMaximum,
  quotaResources,
  type QuotaDraft,
  type QuotaResource,
} from "@/lib/tenant-quota";
import { amount, inputClass } from "./console-ui";

export function TenantUsagePanel({
  usage,
  currentLimits,
  plan,
  draft,
  onChange,
}: {
  usage: Usage[];
  currentLimits: Record<string, number>;
  plan?: Plan;
  draft: QuotaDraft;
  onChange: (resource: QuotaResource, value: string) => void;
}) {
  const id = useId();
  const resources = [
    ...new Set([
      ...quotaResources,
      ...Object.keys(plan?.limits ?? {}),
      ...usage.map((row) => row.resource),
    ]),
  ];
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`${id}-title`} className="font-bold">
            Mức sử dụng
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Theo dõi tài nguyên đã dùng và điều chỉnh hạn mức riêng cho trường.
          </p>
        </div>
        {plan && (
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            Gói đang chọn: {plan.name}
          </span>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {resources.map((resource) => {
          const editable = quotaResources.includes(resource as QuotaResource);
          const label = editable
            ? quotaLabels[resource as QuotaResource]
            : resource;
          const unit =
            resource === "storage_bytes"
              ? "MiB"
              : resource === "ai_tokens"
                ? "tokens"
                : resource === "email_messages"
                  ? "email"
                  : "";
          const Icon =
            resource === "storage_bytes"
              ? HardDrive
              : resource === "email_messages"
                ? Mail
                : Sparkles;
          const rows = usage.filter((row) => row.resource === resource);
          const used = rows.reduce((sum, row) => sum + row.used, 0);
          const reserved = rows.reduce((sum, row) => sum + row.reserved, 0);
          const currentLimit = currentLimits[resource];
          const base = plan?.limits[resource];
          const format = (value: number) =>
            amount(
              resource === "storage_bytes"
                ? Math.round((value / mib) * 100) / 100
                : value,
            );
          const withUnit = (value: number) =>
            `${format(value)}${unit ? ` ${unit}` : ""}`;
          let extra: number | null = 0;
          let invalid = "";
          if (editable) {
            try {
              extra = parseQuotaValue(
                resource as QuotaResource,
                draft[resource as QuotaResource],
              );
            } catch (error) {
              extra = null;
              invalid =
                error instanceof Error
                  ? error.message
                  : "Hạn mức bổ sung không hợp lệ.";
            }
          }
          const proposed =
            base !== undefined && extra !== null ? base + extra : null;
          const remaining =
            currentLimit === undefined
              ? null
              : Math.max(0, currentLimit - used - reserved);
          const exceeded =
            currentLimit !== undefined && used + reserved > currentLimit;
          const occupied =
            currentLimit > 0
              ? ((used + reserved) / currentLimit) * 100
              : used + reserved > 0
                ? 100
                : 0;
          const usedWidth =
            currentLimit > 0
              ? Math.min(100, (used / currentLimit) * 100)
              : used > 0
                ? 100
                : 0;
          const heldWidth = Math.min(
            100 - usedWidth,
            Math.max(0, occupied - usedWidth),
          );
          const inputId = `${id}-${resource}`;
          return (
            <article
              key={resource}
              className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
            >
              <div className="mb-5 flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold">{label}</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {resource === "storage_bytes"
                      ? "Tích lũy qua các kỳ"
                      : "Theo kỳ sử dụng"}
                  </p>
                </div>
                {exceeded && (
                  <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                    Vượt hạn mức
                  </span>
                )}
              </div>
              <div className="flex items-end justify-between gap-3 tabular-nums">
                <div>
                  <p className="text-xs text-slate-500">Đã dùng</p>
                  <p className="mt-1 text-xl font-bold tracking-tight">
                    {format(used)}{" "}
                    <span className="text-xs font-normal tracking-normal text-slate-500">
                      {unit}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Hạn mức hiện tại</p>
                  <p className="mt-1 text-sm font-semibold">
                    {currentLimit === undefined ? "—" : withUnit(currentLimit)}
                  </p>
                </div>
              </div>
              {currentLimit !== undefined && (
                <div
                  role="progressbar"
                  aria-label={`Mức sử dụng ${label}, gồm đã dùng và đang giữ`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(Math.min(100, occupied))}
                  aria-valuetext={`Đã dùng ${withUnit(used)}, đang giữ ${withUnit(reserved)}, hạn mức ${withUnit(currentLimit)}`}
                  className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100"
                >
                  <span
                    className={exceeded ? "bg-rose-500" : "bg-blue-500"}
                    style={{ width: `${usedWidth}%` }}
                  />
                  <span
                    className="bg-amber-400"
                    style={{ width: `${heldWidth}%` }}
                  />
                </div>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs tabular-nums">
                <div>
                  <dt className="flex items-center gap-1.5 text-slate-500">
                    <span
                      className="size-1.5 rounded-full bg-amber-400"
                      aria-hidden="true"
                    />
                    Đang giữ
                  </dt>
                  <dd className="mt-1.5 font-medium text-slate-700">
                    {withUnit(reserved)}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-slate-500">Còn khả dụng</dt>
                  <dd className="mt-1.5 font-medium text-slate-700">
                    {remaining === null ? "—" : withUnit(remaining)}
                  </dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-1 flex-col border-t border-slate-100 pt-4">
                {editable && base !== undefined && (
                  <div>
                    <label
                      htmlFor={inputId}
                      className="text-xs font-semibold text-slate-700"
                    >
                      Bổ sung hạn mức
                    </label>
                    <div className="relative mt-2">
                      <input
                        id={inputId}
                        type="number"
                        aria-label={`Bổ sung ${label}${resource === "storage_bytes" ? " (MiB)" : ""}`}
                        aria-invalid={!!invalid}
                        aria-describedby={`${inputId}-help${invalid ? ` ${inputId}-error` : ""}`}
                        required
                        min={0}
                        max={
                          quotaMaximum /
                          (resource === "storage_bytes" ? mib : 1)
                        }
                        step={resource === "storage_bytes" ? "any" : 1}
                        value={draft[resource as QuotaResource]}
                        className={`${inputClass} pr-16 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                        onChange={(event) =>
                          onChange(
                            resource as QuotaResource,
                            event.target.value,
                          )
                        }
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
                        {unit}
                      </span>
                    </div>
                    <p
                      id={`${inputId}-help`}
                      className="mt-2 text-xs leading-5 text-slate-500"
                    >
                      Nhập 0 để dùng hạn mức của gói.
                    </p>
                    {invalid && (
                      <p
                        id={`${inputId}-error`}
                        className="mt-1 text-xs leading-5 text-rose-700"
                      >
                        {invalid}
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-4 rounded-lg bg-blue-50/70 p-3 tabular-nums">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-slate-600">Hạn mức sau lưu</span>
                    <strong className="text-blue-700">
                      {proposed === null ? "—" : withUnit(proposed)}
                    </strong>
                  </div>
                  {base !== undefined && (
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      Gói: {withUnit(base)}
                      {editable && extra !== null
                        ? ` + bổ sung ${withUnit(extra)}`
                        : ""}
                    </p>
                  )}
                </div>
                {proposed !== null && proposed < used + reserved && (
                  <p className="mt-2 text-xs leading-5 text-amber-800">
                    Hạn mức sau lưu thấp hơn lượng đã dùng và đang giữ. Hãy tăng
                    bổ sung hoặc chọn gói phù hợp.
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-slate-500">
        “Đang giữ” là tài nguyên đã đặt trước cho tác vụ chưa hoàn tất. Phần bổ
        sung được giữ ở các kỳ tiếp theo. Bấm{" "}
        <span className="font-semibold text-slate-700">Lưu thay đổi</span> để áp
        dụng hạn mức mới.
      </p>
    </section>
  );
}
