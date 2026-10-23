import type { Metadata } from "next";
import { Suspense } from "react";
import { BuyForm } from "@/components/sales/buy-form";

export const metadata: Metadata = { title: "EStude | Chọn gói & thanh toán" };
export default function Page() {
  return (
    <Suspense fallback={null}>
      <BuyForm />
    </Suspense>
  );
}
