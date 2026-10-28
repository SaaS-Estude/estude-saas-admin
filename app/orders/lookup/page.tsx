import type { Metadata } from "next";
import { OrderLookup } from "@/components/sales/order-lookup";

export const metadata: Metadata = {
  title: "EStude | Tra cứu đơn hàng",
  robots: { index: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <OrderLookup />;
}
