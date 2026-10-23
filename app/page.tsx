import type { Metadata } from "next";
import { PricingPage } from "@/components/sales/pricing-page";

export const metadata: Metadata = {
  title: "EStude | Bảng giá & đăng ký trường",
  description: "Chọn gói EStude, thanh toán qua PayOS và nhận cổng quản trị riêng cho trường của bạn.",
};
export default function Page() {
  return <PricingPage />;
}
