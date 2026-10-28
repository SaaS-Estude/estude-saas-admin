"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { billingPublic, cycleLabel, formatVnd, lookupOrderAction, validateLookupContact, type LookupOrder } from "@/lib/billing-public";
import { Field, Notice, dateText, errorText, inputClass, primaryClass, secondaryClass } from "@/components/platform/console-ui";
import { SalesShell } from "./sales-shell";

const statusLabels: Record<LookupOrder["status"], string> = {
  PAID: "Đã thanh toán", PENDING: "Chờ xác nhận thanh toán", CANCELLED: "Đã huỷ", EXPIRED: "Đã hết hạn",
};

export function OrderLookup() {
  const [contact, setContact] = useState("");
  const [searchedContact, setSearchedContact] = useState("");
  const [orders, setOrders] = useState<LookupOrder[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy || opening !== null) return;
    const invalid = validateLookupContact(contact);
    setError(invalid);
    if (invalid) return;
    setBusy(true);
    setOrders(null);
    setHasMore(false);
    try {
      const value = contact.trim();
      const result = await billingPublic.lookup(value);
      setSearchedContact(value);
      setOrders(result.orders);
      setPage(0);
      setHasMore(result.hasMore);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    if (busy || opening !== null || !hasMore) return;
    setBusy(true);
    setError("");
    try {
      const result = await billingPublic.lookup(searchedContact, page + 1);
      setOrders((current) => [...(current ?? []), ...result.orders]);
      setPage(page + 1);
      setHasMore(result.hasMore);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function open(order: LookupOrder) {
    if (busy || opening !== null) return;
    setOpening(order.orderCode);
    setError("");
    try {
      const resumed = await billingPublic.resume(order.orderCode, searchedContact);
      let url = `/payment/result?orderCode=${resumed.orderCode}`;
      try {
        sessionStorage.setItem(`estude-order-${resumed.orderCode}`, resumed.accessToken);
      } catch {
        url += `&token=${encodeURIComponent(resumed.accessToken)}`;
      }
      window.location.assign(url);
    } catch (e) {
      setError(errorText(e));
      setOpening(null);
    }
  }

  return (
    <SalesShell>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Tra cứu đơn hàng</h1>
        <p className="mt-3 leading-7 text-slate-600">Đã thanh toán nhưng thoát trang trước khi tạo trường? Nhập email hoặc số điện thoại đã dùng khi đặt hàng để tiếp tục.</p>
        <form onSubmit={(event) => void search(event)} className="mt-7 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <Field label="Email hoặc số điện thoại đặt hàng">
            <input className={inputClass} name="contact" type="text" autoComplete="on" maxLength={254} required
              placeholder="Email hoặc số điện thoại" value={contact} disabled={busy || opening !== null}
              onChange={(event) => { setContact(event.target.value); setOrders(null); setHasMore(false); setError(""); }} />
          </Field>
          <button type="submit" className={primaryClass} disabled={busy || opening !== null}>
            {busy ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}
            {busy ? "Đang tra cứu…" : "Tra cứu đơn hàng"}
          </button>
        </form>
        {error && <div className="mt-5"><Notice>{error}</Notice></div>}
        <section aria-live="polite" aria-busy={busy} className="mt-7 space-y-4">
          {orders?.length === 0 && <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Không tìm thấy đơn hàng. Kiểm tra lại email hoặc số điện thoại đã nhập khi mua gói; bạn có thể thử thông tin còn lại.</p>}
          {orders && orders.length > 0 && <h2 className="text-lg font-semibold">Đơn hàng của bạn</h2>}
          {orders?.map((order) => (
            <article key={order.orderCode} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="font-semibold">Gói {order.planName} · Theo {cycleLabel(order.cycle)}</h3><p className="mt-1 text-sm text-slate-500">Đơn {order.orderCode} · {dateText(order.createdAt)}</p></div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.status === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{statusLabels[order.status]}</span>
              </div>
              <p className="text-lg font-bold">{formatVnd(order.amount)}</p>
              {order.status === "PAID" && order.fulfilmentStatus === "NONE" && <p className="text-sm text-slate-600">Khoản thanh toán đã được ghi nhận. Hoàn tất thông tin trường để kích hoạt gói.</p>}
              <button type="button" className={secondaryClass} disabled={busy || opening !== null} onClick={() => void open(order)}>
                {opening === order.orderCode && <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />}
                {opening === order.orderCode ? "Đang mở đơn hàng…" : lookupOrderAction(order)}
              </button>
            </article>
          ))}
          {hasMore && <button type="button" disabled={busy || opening !== null} className={secondaryClass} onClick={() => void loadMore()}>{busy ? "Đang tải…" : "Xem thêm đơn hàng"}</button>}
        </section>
      </main>
    </SalesShell>
  );
}
