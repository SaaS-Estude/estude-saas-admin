import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export function SalesShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <span className="rounded-xl bg-blue-600 p-2 text-white">
              <ShieldCheck size={18} aria-hidden="true" />
            </span>
            EStude
          </Link>
          <nav aria-label="Điều hướng chính" className="flex items-center gap-1 text-sm font-medium text-slate-600">
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" href="/#bang-gia">
              Bảng giá
            </Link>
            <Link className="hidden rounded-lg px-3 py-2 hover:bg-slate-100 sm:block" href="/#tinh-nang">
              Tính năng
            </Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" href="/platform">
              Quản trị
            </Link>
            <Link className="ml-1 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700" href="/buy">
              Đăng ký
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-sm text-slate-500 sm:px-6">
          <p className="font-semibold text-slate-700">EStude — nền tảng quản lý trường học</p>
          <p>
            Thanh toán an toàn qua PayOS (chuyển khoản/QR ngân hàng). Giá đã bao gồm thuế. Sau khi thanh toán thành công,
            hoàn tất thông tin trường để kích hoạt gói.
          </p>
        </div>
      </footer>
    </div>
  );
}
