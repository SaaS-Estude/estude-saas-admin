import type { Metadata } from "next";
import { PlatformConsole } from "@/components/platform/platform-console";

export const metadata: Metadata = { title: "EStude | Quản trị SaaS" };
export default function PlatformPage() {
  return <PlatformConsole />;
}
