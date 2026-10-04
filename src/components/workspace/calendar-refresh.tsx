"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const MIN_INTERVAL_MS = 15_000;

/**
 * Re-runs the server render for the current user when the tab regains focus, so
 * checkouts and cleaning updates made elsewhere show up without a manual reload.
 * Tenant scope is resolved server-side on every refresh; nothing is subscribed to here.
 */
export function CalendarRefresh() {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();

    const refresh = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      const now = Date.now();

      if (now - last < MIN_INTERVAL_MS) {
        return;
      }

      last = now;
      router.refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
