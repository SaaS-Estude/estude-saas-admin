"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, LoaderCircle, TriangleAlert, XCircle } from "lucide-react";
import {
  billingPublic,
  formatVnd,
  isFinalStatus,
  maxPollAttempts,
  pollDelay,
  resultView,
  type OrderStatus,
} from "@/lib/billing-public";
import { Notice, dateText, errorText, primaryClass, secondaryClass } from "@/components/platform/console-ui";
import { SalesShell } from "./sales-shell";
import { SchoolSetup } from "./school-setup";

function Panel({ tone, icon, title, children }: { tone: "ok" | "wait" | "bad"; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const color = tone === "ok" ? "text-emerald-600 bg-emerald-50" : tone === "wait" ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50";
  return (
    <section aria-live="polite" className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className={`mx-auto inline-flex rounded-full p-3 ${color}`}>{icon}</span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}

export function PaymentResult() {
  const params = useSearchParams();
  const code = Number(params.get("orderCode"));
  const urlToken = params.get("token") ?? "";
  const tokenRef = useRef("");
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState("");
  const [exhausted, setExhausted] = useState(false);
  const [busy, setBusy] = useState(false);
  const attempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep the access token out of the address bar and browser history after the
  // first load; it stays in this tab's session storage for refreshes.
  useEffect(() => {
    const storageKey = `estude-order-${code}`;
    let token = urlToken;
    try {
      if (token) sessionStorage.setItem(storageKey, token);
      else token = sessionStorage.getItem(storageKey) ?? "";
    } catch {
      /* storage unavailable: fall back to the URL token */
    }
    tokenRef.current = token;
    if (urlToken && typeof window !== "undefined") {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("token");
      window.history.replaceState(null, "", clean.pathname + clean.search);
    }
  }, [code, urlToken]);

  const check = useCallback(async () => {
    if (!Number.isSafeInteger(code) || code <= 0) {
      setError("Liên kết không hợp lệ.");
      return;
    }
    // The token effect runs first; wait one tick if it has not been set yet.
    const token = tokenRef.current || urlToken;
    if (!token) {
      setError("Không tìm thấy mã truy cập đơn hàng. Bạn có thể tra cứu lại bằng email hoặc số điện thoại đặt hàng.");
      return;
    }
    try {
      const next = await billingPublic.status(code, token);
      setOrder(next);
      setError("");
      if (isFinalStatus(next)) return;
    } catch (e) {
      setError(errorText(e));
    }
    if (attempt.current >= maxPollAttempts) {
      setExhausted(true);
      return;
    }
    timer.current = setTimeout(() => void check(), pollDelay(attempt.current++));
  }, [code, urlToken]);

  useEffect(() => {
    void check();
    return () => clearTimeout(timer.current);
  }, [check]);

  async function recheck() {
    clearTimeout(timer.current);
    attempt.current = 0;
    setExhausted(false);
    await check();
  }
  async function cancel() {
    setBusy(true);
    try {
      setOrder(await billingPublic.cancel(code, tokenRef.current || urlToken));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const view = order ? resultView(order) : null;
  return (
    <SalesShell>
      <main className="px-4 py-14 sm:px-6">
        {!order && !error && (
          <Panel tone="wait" icon={<LoaderCircle className="animate-spin" size={28} />} title="Đang kiểm tra thanh toán…">
            <p>Vui lòng đợi trong giây lát.</p>
          </Panel>
        )}
        {!order && error && (
          <Panel tone="bad" icon={<TriangleAlert size={28} />} title="Không xem được đơn hàng">
            <p>{error}</p>
            <Link href="/orders/lookup" className={primaryClass}>Tra cứu đơn hàng</Link>
            <Link href="/" className={secondaryClass}>Về trang chủ</Link>
          </Panel>
        )}
        {order && view === "success" && (
          <Panel tone="ok" icon={<CheckCircle2 size={28} />} title="Thanh toán thành công">
            <p>
              Trường <strong>{order.schoolName}</strong> đã được tạo với gói <strong>{order.planName}</strong>
              {order.periodEnd && <> — có hiệu lực đến {dateText(order.periodEnd)}</>}.
            </p>
            <p>Đăng nhập bằng tên đăng nhập và mật khẩu bạn đã đặt khi đăng ký.</p>
            {order.portalUrl && (
              <a href={order.portalUrl} className={primaryClass}>Đăng nhập trang quản trị</a>
            )}
            <p className="text-xs text-slate-500">Mã đơn hàng: {order.orderCode} · {formatVnd(order.amount)}</p>
          </Panel>
        )}
        {order && view === "setup" && (
          <Panel tone="ok" icon={<CheckCircle2 size={28} />} title="Thanh toán thành công — thiết lập trường">
            <p>Đã nhận {formatVnd(order.amount)} cho gói <strong>{order.planName}</strong>. Hoàn tất thông tin dưới đây để tạo trường và kích hoạt gói.</p>
            <p className="text-xs text-slate-500">Mã đơn hàng: {order.orderCode}. Thời hạn gói bắt đầu khi trường được tạo thành công.</p>
            <SchoolSetup orderCode={order.orderCode} token={tokenRef.current || urlToken} completed={(next) => {
              setOrder(next);
              attempt.current = 0;
              setExhausted(false);
              void check();
            }} />
          </Panel>
        )}
        {order && view === "provisioning" && (
          <Panel tone="wait" icon={<LoaderCircle className="animate-spin" size={28} />} title={order.fulfilmentStatus === "DONE" ? "Đã tạo trường — đang thiết lập địa chỉ" : "Đã nhận thanh toán — đang tạo trường"}>
            <p>Hệ thống đang hoàn tất trường và địa chỉ truy cập an toàn. Việc cấp DNS và HTTPS có thể cần vài phút. Trang sẽ tự cập nhật.</p>
            {exhausted && (
              <>
                <Notice>Việc tạo trường lâu hơn dự kiến. Đơn hàng của bạn đã được ghi nhận, vui lòng kiểm tra lại sau ít phút.</Notice>
                <button type="button" onClick={() => void recheck()} className={secondaryClass}>Kiểm tra lại</button>
                <Link href="/orders/lookup" className={secondaryClass}>Tra cứu lại sau</Link>
              </>
            )}
            <p className="text-xs text-slate-500">Mã đơn hàng: {order.orderCode}</p>
          </Panel>
        )}
        {order && view === "unpaid" && (
          <Panel tone="wait" icon={<Clock3 size={28} />} title="Chưa nhận được thanh toán">
            <p>
              Đơn {order.orderCode} ({formatVnd(order.amount)}) đang chờ thanh toán đến {dateText(order.expiresAt)}. Nếu bạn
              đã chuyển khoản, hệ thống sẽ cập nhật trong giây lát.
            </p>
            {error && <Notice>{error}</Notice>}
            <div className="flex flex-wrap justify-center gap-3">
              {order.checkoutUrl && <a href={order.checkoutUrl} className={primaryClass}>Tiếp tục thanh toán</a>}
              <button type="button" onClick={() => void recheck()} className={secondaryClass}>Kiểm tra lại</button>
              <button type="button" disabled={busy} onClick={() => void cancel()} className={secondaryClass}>Huỷ đơn</button>
            </div>
          </Panel>
        )}
        {order && view === "cancelled" && (
          <Panel tone="bad" icon={<XCircle size={28} />} title="Đơn hàng đã bị huỷ">
            <p>Chưa có khoản tiền nào bị trừ cho đơn này. Bạn có thể đặt lại bất cứ lúc nào.</p>
            <Link href="/buy" className={primaryClass}>Đặt đơn mới</Link>
          </Panel>
        )}
        {order && view === "expired" && (
          <Panel tone="bad" icon={<XCircle size={28} />} title="Đơn hàng đã hết hạn">
            <p>Liên kết thanh toán đã hết hạn. Nếu bạn đã chuyển khoản, hãy liên hệ hỗ trợ kèm mã đơn {order.orderCode}.</p>
            <Link href="/buy" className={primaryClass}>Đặt đơn mới</Link>
          </Panel>
        )}
        {order && view === "needs-support" && (
          <Panel tone="bad" icon={<TriangleAlert size={28} />} title="Đã nhận thanh toán nhưng cần hỗ trợ">
            <p>
              Chúng tôi đã nhận thanh toán nhưng chưa thể tạo trường tự động (ví dụ địa chỉ đã bị sử dụng). Vui lòng liên
              hệ hỗ trợ và cung cấp mã đơn <strong>{order.orderCode}</strong>; khoản thanh toán của bạn được bảo toàn.
            </p>
          </Panel>
        )}
      </main>
    </SalesShell>
  );
}
