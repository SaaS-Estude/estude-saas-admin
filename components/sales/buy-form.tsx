"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, Lock } from "lucide-react";
import {
  billingPublic,
  cycleLabel,
  formatVnd,
  newIdempotencyKey,
  validateCheckout,
  yearlySavings,
  type CheckoutErrors,
  type CheckoutValues,
  type Cycle,
} from "@/lib/billing-public";
import { Field, Notice, errorText, inputClass, primaryClass } from "@/components/platform/console-ui";
import { SalesShell } from "./sales-shell";
import { useBillingCatalog } from "@/lib/use-billing-catalog";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="mt-1 text-xs font-medium text-rose-600">
      {message}
    </p>
  ) : null;
}

export function BuyForm() {
  const params = useSearchParams();
  const { catalog, error: loadError } = useBillingCatalog();
  const [values, setValues] = useState<CheckoutValues>({
    planCode: params.get("plan") ?? "",
    cycle: params.get("cycle") === "MONTH" ? "MONTH" : "YEAR",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    accepted: false,
  });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // The same key is reused when the form is retried unchanged (double click,
  // network error) so the server never opens two checkouts for one purchase.
  const key = useRef({ value: newIdempotencyKey(), signature: "" });

  useEffect(() => {
    if (!catalog) return;
    setValues((current) => {
      const selected = catalog.plans.find((plan) => plan.code === current.planCode) ?? catalog.plans[Math.floor(catalog.plans.length / 2)];
      const planCode = selected?.code ?? "";
      const cycle = selected && selected.prices[current.cycle] === undefined
        ? selected.prices.YEAR !== undefined ? "YEAR" : "MONTH"
        : current.cycle;
      return current.planCode === planCode && current.cycle === cycle ? current : { ...current, planCode, cycle };
    });
  }, [catalog, values.planCode]);

  const plan = catalog?.plans.find((item) => item.code === values.planCode);
  const price = plan?.prices[values.cycle];
  const set = <K extends keyof CheckoutValues>(name: K, value: CheckoutValues[K]) =>
    setValues((current) => ({ ...current, [name]: value }));

  const payable = useMemo(() => Boolean(catalog?.paymentsEnabled && plan && price !== undefined), [catalog, plan, price]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !payable) return;
    const found = validateCheckout(values);
    setErrors(found);
    setSubmitError("");
    if (Object.keys(found).length > 0) {
      return;
    }
    setBusy(true);
    try {
      const { accepted: _accepted, ...body } = values;
      void _accepted;
      const signature = JSON.stringify(body);
      if (key.current.signature && key.current.signature !== signature) key.current.value = newIdempotencyKey();
      key.current.signature = signature;
      const created = await billingPublic.createOrder({ ...body, idempotencyKey: key.current.value });
      if (created.accessToken) {
        try {
          sessionStorage.setItem(`estude-order-${created.orderCode}`, created.accessToken);
        } catch {
          /* the return URL carries the token as well */
        }
      }
      window.location.assign(created.checkoutUrl);
    } catch (e) {
      setSubmitError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <SalesShell>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Chọn gói &amp; thanh toán</h1>
        <p className="mt-2 text-slate-600">Thanh toán gói qua PayOS. Sau khi thanh toán thành công, bạn sẽ nhập thông tin trường và tạo tài khoản quản trị.</p>
        {loadError && (
          <div className="mt-6">
            <Notice>{loadError}</Notice>
          </div>
        )}
        {catalog && !catalog.paymentsEnabled && (
          <div className="mt-6">
            <Notice>Thanh toán trực tuyến chưa được bật. Vui lòng liên hệ quản trị nền tảng.</Notice>
          </div>
        )}
        <form noValidate onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
          <fieldset disabled={busy} className="space-y-8">
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="sec-plan">
              <h2 id="sec-plan" className="font-semibold">1. Gói dịch vụ</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Gói">
                  <select className={inputClass} value={values.planCode} onChange={(e) => set("planCode", e.target.value)}>
                    {catalog?.plans.map((item) => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Chu kỳ">
                  <select className={inputClass} value={values.cycle} onChange={(e) => set("cycle", e.target.value as Cycle)}>
                    <option value="MONTH" disabled={plan?.prices.MONTH === undefined}>Theo tháng</option>
                    <option value="YEAR" disabled={plan?.prices.YEAR === undefined}>Theo năm{plan && yearlySavings(plan).percent > 0 ? ` (tiết kiệm ${yearlySavings(plan).percent}%)` : ""}</option>
                  </select>
                </Field>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="sec-contact">
              <h2 id="sec-contact" className="font-semibold">2. Thông tin liên hệ &amp; hoá đơn</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Field label="Họ tên người liên hệ">
                    <input className={inputClass} value={values.contactName} maxLength={120} autoComplete="name" onChange={(e) => set("contactName", e.target.value)} />
                  </Field>
                  <FieldError message={errors.contactName} />
                </div>
                <div>
                  <Field label="Email">
                    <input className={inputClass} type="email" value={values.contactEmail} maxLength={254} autoComplete="email" onChange={(e) => set("contactEmail", e.target.value)} />
                  </Field>
                  <FieldError message={errors.contactEmail} />
                </div>
                <div>
                  <Field label="Số điện thoại (không bắt buộc)">
                    <input className={inputClass} type="tel" value={values.contactPhone} maxLength={20} autoComplete="tel" onChange={(e) => set("contactPhone", e.target.value)} />
                  </Field>
                  <FieldError message={errors.contactPhone} />
                </div>
              </div>
              <div>
                <label className="flex items-start gap-2.5 text-sm text-slate-700">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={values.accepted} onChange={(e) => set("accepted", e.target.checked)} />
                  <span>Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của EStude.</span>
                </label>
                <FieldError message={errors.accepted} />
              </div>
            </section>
          </fieldset>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="font-semibold">Tóm tắt đơn hàng</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Gói</dt><dd className="font-semibold">{plan?.name ?? "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Chu kỳ</dt><dd className="font-semibold">1 {cycleLabel(values.cycle)}</dd></div>
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-base"><dt className="font-semibold">Tổng cộng</dt><dd className="font-bold">{price === undefined ? "—" : formatVnd(price)}</dd></div>
              </dl>
              <p className="text-sm text-slate-600">Sau khi nhận được xác nhận thanh toán, bạn sẽ thiết lập tên trường, subdomain và tài khoản quản trị.</p>
              <p className="text-xs text-slate-500">Số tiền cuối cùng do máy chủ tính theo bảng giá và hiển thị lại trên trang PayOS.</p>
              {submitError && <Notice>{submitError}</Notice>}
              <button type="submit" disabled={busy || !payable} className={`${primaryClass} w-full`}>
                {busy ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
                {busy ? "Đang tạo đơn…" : "Thanh toán với PayOS"}
              </button>
            </div>
          </aside>
        </form>
      </main>
    </SalesShell>
  );
}
