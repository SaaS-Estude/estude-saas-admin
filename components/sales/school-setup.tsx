"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import {
  billingPublic, suggestSlug, validateSchoolSetup,
  type OrderStatus, type SchoolSetupValues, type SchoolSetupErrors,
} from "@/lib/billing-public";
import { Field, Notice, PasswordField, errorText, inputClass, primaryClass } from "@/components/platform/console-ui";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

export function SchoolSetup({ orderCode, token, completed }: {
  orderCode: number;
  token: string;
  completed: (order: OrderStatus) => void;
}) {
  const [values, setValues] = useState<SchoolSetupValues>({ schoolName: "", slug: "", adminAccount: "", adminPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<SchoolSetupErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugState, setSlugState] = useState<"idle" | "checking" | "free" | "taken">("idle");
  useUnsavedChanges(Object.values(values).some(Boolean) || busy);
  const set = <K extends keyof SchoolSetupValues>(key: K, value: SchoolSetupValues[K]) => setValues((old) => ({ ...old, [key]: value }));
  useEffect(() => {
    if (!values.slug || validateSchoolSetup({ ...values }).slug) { setSlugState("idle"); return; }
    let live = true;
    setSlugState("checking");
    const timer = setTimeout(() => {
      billingPublic.slugCheck(values.slug)
        .then((r) => { if (live) setSlugState(r.available ? "free" : "taken"); })
        .catch(() => { if (live) setSlugState("idle"); });
    }, 400);
    return () => { live = false; clearTimeout(timer); };
    // Only a slug change needs an availability check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.slug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const found = validateSchoolSetup(values);
    if (slugState === "taken") found.slug = "Địa chỉ đã được sử dụng. Hãy chọn địa chỉ khác.";
    setErrors(found);
    setError("");
    if (Object.keys(found).length) return;
    submitting.current = true;
    setBusy(true);
    try {
      const { confirmPassword: _confirm, ...school } = values;
      void _confirm;
      const order = await billingPublic.setup(orderCode, token, school);
      // Passwords stay only in memory and are cleared as soon as setup is saved.
      setValues({ schoolName: "", slug: "", adminAccount: "", adminPassword: "", confirmPassword: "" });
      completed(order);
    } catch (e) {
      setError(errorText(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const hint = (key: keyof SchoolSetupValues) => errors[key] && <p role="alert" className="mt-1 text-xs text-rose-600">{errors[key]}</p>;
  return (
    <form noValidate onSubmit={submit} className="space-y-5 text-left">
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <h2 className="border-t border-slate-200 pt-5 text-base font-semibold text-slate-900">Thông tin trường</h2>
        <div>
          <Field label="Tên trường / trung tâm">
            <input name="schoolName" className={inputClass} value={values.schoolName} maxLength={150} autoComplete="organization" onChange={(e) => {
              set("schoolName", e.target.value);
              if (!slugEdited) set("slug", suggestSlug(e.target.value));
            }} />
          </Field>
          {hint("schoolName")}
        </div>
        <div>
          <Field label="Địa chỉ trường (subdomain)">
            <input name="slug" className={inputClass} value={values.slug} maxLength={50} autoCapitalize="none" spellCheck={false} onChange={(e) => { setSlugEdited(true); set("slug", e.target.value.toLowerCase()); }} />
          </Field>
          <p className="mt-1 text-xs text-slate-500">
            Cổng đăng nhập: admin-{values.slug || "ten-truong"}.&lt;tên miền hệ thống&gt;.
            {slugState === "checking" && " Đang kiểm tra địa chỉ…"}
            {slugState === "free" && <span className="text-emerald-600"> Địa chỉ còn trống.</span>}
            {slugState === "taken" && <span className="text-rose-600"> Địa chỉ đã được sử dụng.</span>}
          </p>
          {hint("slug")}
        </div>
        <h2 className="border-t border-slate-200 pt-5 text-base font-semibold text-slate-900">Tài khoản quản trị đầu tiên</h2>
        <p className="text-sm text-slate-600">Dùng tài khoản này để đăng nhập cổng quản trị của trường sau khi khởi tạo.</p>
        <div>
          <Field label="Tên đăng nhập">
            <input name="adminAccount" className={inputClass} value={values.adminAccount} maxLength={50} autoComplete="username" autoCapitalize="none" onChange={(e) => set("adminAccount", e.target.value.toLowerCase())} />
          </Field>
          {hint("adminAccount")}
        </div>
        <div>
          <PasswordField name="adminPassword" label="Mật khẩu" autoComplete="new-password" maxLength={128} value={values.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} />
          {hint("adminPassword")}
        </div>
        <div>
          <PasswordField name="confirmPassword" label="Nhập lại mật khẩu" autoComplete="new-password" maxLength={128} value={values.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} />
          {hint("confirmPassword")}
        </div>
        {error && <Notice>{error}</Notice>}
        <button type="submit" disabled={busy} className={`${primaryClass} w-full`}>
          {busy && <LoaderCircle size={16} className="animate-spin" />}
          {busy ? "Đang lưu thông tin…" : "Tạo trường và kích hoạt gói"}
        </button>
      </fieldset>
    </form>
  );
}
