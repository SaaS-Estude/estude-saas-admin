"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart3, BookOpenCheck, Bot, Check, ClipboardCheck, LoaderCircle, Users, X } from "lucide-react";
import {
  cycleLabel,
  formatVnd,
  monthlyEquivalent,
  resourceRows,
  yearlySavings,
  type Cycle,
} from "@/lib/billing-public";
import { Notice, primaryClass, secondaryClass } from "@/components/platform/console-ui";
import { useBillingCatalog } from "@/lib/use-billing-catalog";
import { SalesShell } from "./sales-shell";

const features = [
  { icon: Users, title: "Quản lý trường học đa vai trò", text: "Quản trị, giáo viên, học sinh và phụ huynh với phân quyền linh hoạt." },
  { icon: BookOpenCheck, title: "Học vụ & nội dung", text: "Năm học, lớp, môn, tài liệu, bài tập và lịch học trong một nơi." },
  { icon: ClipboardCheck, title: "Bài thi & sổ điểm", text: "Ngân hàng câu hỏi, thi trực tuyến, chấm điểm và báo cáo học kỳ." },
  { icon: Bot, title: "Trợ lý AI", text: "Hỏi đáp tài liệu có trích dẫn, tạo câu hỏi, phân tích sau bài thi." },
  { icon: BarChart3, title: "Phân tích học tập", text: "Theo dõi tiến độ, điểm yếu và gợi ý kế hoạch cho từng học sinh." },
];

export function PricingPage() {
  const { catalog, error } = useBillingCatalog();
  const [cycle, setCycle] = useState<Cycle>("YEAR");
  const plans = catalog?.plans ?? [];
  const highlight = plans.length > 2 ? plans[Math.floor(plans.length / 2)].code : "";
  return (
    <SalesShell>
      <main>
        <section className="bg-[#102b66] text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-200">EStude Platform</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Số hoá trường học của bạn chỉ trong vài phút
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100/80">
              Chọn gói, thanh toán qua PayOS, sau đó thiết lập trường và tài khoản quản trị — không cần cài đặt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#bang-gia" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-900 hover:bg-blue-50">
                Xem bảng giá
              </a>
              <Link href="/buy" className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                Đăng ký trường
              </Link>
            </div>
          </div>
        </section>

        <section id="tinh-nang" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight">Mọi thứ trường cần, trong một nền tảng</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-slate-200 p-5">
                <span className="inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-600">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="bang-gia" className="scroll-mt-20 bg-slate-50 py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Bảng giá</h2>
                <p className="mt-1 text-sm text-slate-600">Gia hạn hoặc nâng cấp bất cứ lúc nào từ trang quản trị của trường.</p>
              </div>
              <div role="group" aria-label="Chu kỳ thanh toán" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm font-semibold">
                {(["MONTH", "YEAR"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={cycle === value}
                    onClick={() => setCycle(value)}
                    className={`rounded-lg px-4 py-2 transition ${cycle === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    {value === "MONTH" ? "Theo tháng" : "Theo năm"}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mt-6">
                <Notice>{error}</Notice>
              </div>
            )}
            {!catalog && !error && (
              <p className="mt-10 flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> Đang tải bảng giá…
              </p>
            )}
            {catalog && !catalog.paymentsEnabled && (
              <div className="mt-6">
                <Notice>Thanh toán trực tuyến chưa được bật. Vui lòng liên hệ để được hỗ trợ đăng ký.</Notice>
              </div>
            )}

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {plans.map((plan) => {
                const price = plan.prices[cycle];
                const savings = yearlySavings(plan);
                const popular = plan.code === highlight;
                return (
                  <article key={plan.code} className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${popular ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200"}`}>
                    {popular && <p className="mb-2 text-xs font-bold uppercase tracking-widest text-blue-600">Phổ biến nhất</p>}
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="mt-1 min-h-[3rem] text-sm text-slate-600">{plan.description}</p>
                    <p className="mt-4 text-3xl font-bold tracking-tight">
                      {price === undefined ? "—" : formatVnd(price)}
                      <span className="text-base font-medium text-slate-500"> / {cycleLabel(cycle)}</span>
                    </p>
                    <p className="mt-1 min-h-[1.25rem] text-sm text-slate-500">
                      {cycle === "YEAR" && price !== undefined && (
                        <>
                          ≈ {formatVnd(monthlyEquivalent(plan, "YEAR") ?? 0)} / tháng
                          {savings.percent > 0 && <span className="ml-2 font-semibold text-emerald-600">Tiết kiệm {savings.percent}%</span>}
                        </>
                      )}
                    </p>
                    <ul className="mt-5 flex-1 space-y-2 text-sm">
                      {resourceRows.map((row) => (
                        <li key={row.key} className="flex gap-2">
                          <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                          {plan.limits[row.key] === undefined ? "—" : row.format(plan.limits[row.key])} {row.label.toLowerCase()}
                        </li>
                      ))}
                      <li className="flex gap-2">
                        {plan.features.ai ? <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" /> : <X size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />}
                        Tính năng AI
                      </li>
                    </ul>
                    {price !== undefined && catalog?.paymentsEnabled ? <Link
                      href={`/buy?plan=${plan.code}&cycle=${cycle}`}
                      className={`${popular ? primaryClass : secondaryClass} mt-6 w-full`}
                    >
                      Chọn gói {plan.name}
                    </Link> : <span className={`${secondaryClass} mt-6 w-full opacity-60`} aria-disabled="true">{price === undefined ? "Không bán theo chu kỳ này" : "Thanh toán chưa được bật"}</span>}
                  </article>
                );
              })}
            </div>

            {plans.length > 0 && (
              <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <caption className="sr-only">So sánh các gói dịch vụ</caption>
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">So sánh</th>
                      {plans.map((plan) => (
                        <th scope="col" key={plan.code} className="px-4 py-3 font-semibold">{plan.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <th scope="row" className="px-4 py-3 font-medium">Giá / {cycleLabel(cycle)}</th>
                      {plans.map((plan) => (
                        <td key={plan.code} className="px-4 py-3 font-semibold">{plan.prices[cycle] === undefined ? "—" : formatVnd(plan.prices[cycle] as number)}</td>
                      ))}
                    </tr>
                    {resourceRows.map((row) => (
                      <tr key={row.key}>
                        <th scope="row" className="px-4 py-3 font-medium">{row.label}</th>
                        {plans.map((plan) => (
                          <td key={plan.code} className="px-4 py-3">{plan.limits[row.key] === undefined ? "—" : row.format(plan.limits[row.key])}</td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <th scope="row" className="px-4 py-3 font-medium">Tính năng AI</th>
                      {plans.map((plan) => (
                        <td key={plan.code} className="px-4 py-3">{plan.features.ai ? "Có" : "Không"}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <dl className="mt-10 grid gap-6 text-sm text-slate-600 md:grid-cols-3">
              <div>
                <dt className="font-semibold text-slate-900">Hạn mức tính thế nào?</dt>
                <dd className="mt-1 leading-6">AI và email được cấp mới mỗi tháng kể cả khi mua theo năm. Dung lượng lưu trữ là tổng cộng cho cả trường.</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Nâng cấp giữa kỳ</dt>
                <dd className="mt-1 leading-6">Phần giá trị chưa dùng của gói hiện tại được trừ vào gói mới; bạn chỉ trả phần chênh lệch.</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Hết hạn thì sao?</dt>
                <dd className="mt-1 leading-6">Dữ liệu được giữ nguyên. Các tính năng dùng hạn mức (AI, email, tải tệp) tạm dừng cho tới khi gia hạn.</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
    </SalesShell>
  );
}
