"use client";

import { useEffect } from "react";
import { initSyncEngine } from "./sync-engine";

export function SyncEngineProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const cleanup = initSyncEngine();
    return cleanup;
  }, []);

  return <>{children}</>;
}
