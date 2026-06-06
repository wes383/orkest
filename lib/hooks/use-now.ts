"use client";

import { useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Returns a Date that refreshes every 60 seconds and on visibility change,
 * so date-bound UI (e.g. kanban columns, overdue badges) auto-updates
 * without a full reload — including across midnight.
 */
export function useNow(): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());

    const interval = window.setInterval(tick, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return now;
}
