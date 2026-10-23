"use client";

import { useEffect, useState } from "react";
import { billingPublic, type Catalog } from "./billing-public";

// Refresh a visible sales page after a catalogue change, including when a buyer
// returns from another tab. The backend remains authoritative at checkout.
export function useBillingCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    let busy = false;
    let lastStarted = 0;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || busy || Date.now() - lastStarted < 2000) return;
      busy = true;
      lastStarted = Date.now();
      try {
        const next = await billingPublic.plans();
        if (live) { setCatalog(next); setError(""); }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Không tải được bảng giá.");
      } finally { busy = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return { catalog, error };
}
