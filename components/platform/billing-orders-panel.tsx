"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { platformApi, type BillingOrder } from "@/lib/platform-api";
import { Badge, EmptyState, Notice, amount, dateText, errorText, secondaryClass } from "./console-ui";

const filters = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Đang chờ" },
  { value: "PAID", label: "Đã thanh toán" },
  { value: "FAILED", label: "Cần xử lý" },
  { value: "CANCELLED", label: "Đã huỷ" },
  { value: "EXPIRED", label: "Hết hạn" },
];
const kindLabel = { NEW: "Mua mới", RENEW: "Gia hạn", UPGRADE: "Nâng cấp" } as const;
const cycleText = { MONTH: "tháng", YEAR: "năm" } as const;

export function BillingOrdersPanel() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [selected, setSelected] = useState<BillingOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setOrders(await platformApi.billingOrders(status, page));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }, [status, page]);
  useEffect(() => {
    void load();
  }, [load]);

  async function open(code: number) {
    try {
      setSelected(await platformApi.billingOrder(code));
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function reconcile(code: number) {
    setBusy(true);
    try {
      setSelected((await platformApi.reconcileBillingOrder(code)).data);
      await load();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Đơn thanh toán</h2>
        <div className="flex items-center gap-2">
          <select
            aria-label="Lọc theo trạng thái"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            {filters.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <button type="button" className={secondaryClass} disabled={busy} onClick={() => void load()}>
            <RefreshCw size={16} aria-hidden="true" /> Làm mới
          </button>
        </div>
      </div>
      {error && <Notice>{error}</Notice>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3">Mã đơn</th>
              <th scope="col" className="px-4 py-3">Loại</th>
              <th scope="col" className="px-4 py-3">Trường / người mua</th>
              <th scope="col" className="px-4 py-3">Gói</th>
              <th scope="col" className="px-4 py-3 text-right">Số tiền</th>
              <th scope="col" className="px-4 py-3">Trạng thái</th>
              <th scope="col" className="px-4 py-3">Tạo lúc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => (
              <tr key={o.orderCode} className="cursor-pointer hover:bg-slate-50" onClick={() => void open(o.orderCode)}>
                <td className="px-4 py-3 font-mono text-xs">{o.orderCode}</td>
                <td className="px-4 py-3">{kindLabel[o.kind]}</td>
                <td className="px-4 py-3">{o.schoolName ?? o.slug ?? "—"}<span className="block text-xs text-slate-500">{o.contactEmail}</span></td>
                <td className="px-4 py-3">{o.planCode} / {cycleText[o.cycle]}</td>
                <td className="px-4 py-3 text-right font-semibold">{amount(o.amount)} ₫</td>
                <td className="px-4 py-3">
                  <Badge status={o.status === "PAID" ? "ACTIVE" : o.status} />
                  {o.fulfilmentStatus === "FAILED" && <span className="ml-2"><Badge status="FAILED" /></span>}
                  {o.status === "PAID" && o.kind === "NEW" && o.fulfilmentStatus === "NONE" && !o.slug && <span className="ml-2 text-xs text-blue-700">Chờ khách thiết lập trường</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{dateText(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && <EmptyState title={busy ? "Đang tải…" : "Chưa có đơn hàng"} description="Đơn xuất hiện ở đây ngay khi khách bắt đầu thanh toán." />}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryClass} disabled={page === 0 || busy} onClick={() => setPage((p) => p - 1)}>Trước</button>
        <button type="button" className={secondaryClass} disabled={orders.length < 20 || busy} onClick={() => setPage((p) => p + 1)}>Sau</button>
      </div>
      {selected && (
        <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm" aria-label={`Chi tiết đơn ${selected.orderCode}`}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold">Đơn {selected.orderCode}</h3>
            <div className="flex gap-2">
              <button type="button" className={secondaryClass} disabled={busy} onClick={() => void reconcile(selected.orderCode)}>Đối chiếu với PayOS</button>
              <button type="button" className={secondaryClass} onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div><dt className="text-slate-500">Giá niêm yết</dt><dd>{amount(selected.listAmount)} ₫</dd></div>
            <div><dt className="text-slate-500">Khấu trừ nâng cấp</dt><dd>{amount(selected.creditAmount)} ₫</dd></div>
            <div><dt className="text-slate-500">Người mua</dt><dd>{selected.contactName} · {selected.contactEmail}</dd></div>
            <div><dt className="text-slate-500">Kích hoạt</dt><dd>{selected.status === "PAID" && selected.kind === "NEW" && selected.fulfilmentStatus === "NONE" && !selected.slug ? "Chờ khách thiết lập trường" : selected.fulfilmentStatus}{selected.fulfilmentError ? ` — ${selected.fulfilmentError}` : ""}</dd></div>
            {selected.paidAt && <div><dt className="text-slate-500">Thanh toán lúc</dt><dd>{dateText(selected.paidAt)}</dd></div>}
            {selected.periodEnd && <div><dt className="text-slate-500">Hiệu lực đến</dt><dd>{dateText(selected.periodEnd)}</dd></div>}
          </dl>
          {selected.fulfilmentStatus === "FAILED" && (
            <Notice>Đã nhận tiền nhưng chưa kích hoạt tự động. Xử lý thủ công (tạo trường/đổi gói trong trang Trường học) hoặc hoàn tiền qua PayOS, rồi ghi chú lại.</Notice>
          )}
          {!!selected.payments?.length && (
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500"><tr><th scope="col">Nguồn</th><th scope="col">Tham chiếu</th><th scope="col">Số tiền</th><th scope="col">Kết quả</th></tr></thead>
              <tbody>
                {selected.payments.map((p) => (
                  <tr key={`${p.source}-${p.reference}`}><td>{p.source}</td><td className="font-mono">{p.reference}</td><td>{amount(p.amount)}</td><td>{p.outcome}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </aside>
      )}
    </section>
  );
}
