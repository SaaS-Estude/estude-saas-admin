"use client";

import { useEffect } from "react";

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const target = window;
    target.addEventListener("beforeunload", warn);
    return () => target.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
