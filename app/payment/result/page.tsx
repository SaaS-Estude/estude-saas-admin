import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentResult } from "@/components/sales/payment-result";

export const metadata: Metadata = {
  title: "EStude | Kết quả thanh toán",
  robots: { index: false },
  referrer: "no-referrer",
};
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PaymentResult />
    </Suspense>
  );
}
