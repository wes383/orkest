"use client";

import { Loader2, WifiOff, AlertCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n";

function getQueueStats() {
  if (typeof window === "undefined") return { pending: 0, syncing: 0, failed: 0 };
  try {
    const raw = localStorage.getItem("orkest-sync-queue");
    if (!raw) return { pending: 0, syncing: 0, failed: 0 };
    const queue = JSON.parse(raw) as Array<{ status: string }>;
    return {
      pending: queue.filter((op) => op.status === "pending").length,
      syncing: queue.filter((op) => op.status === "syncing").length,
      failed: queue.filter((op) => op.status === "failed").length,
    };
  } catch {
    return { pending: 0, syncing: 0, failed: 0 };
  }
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

/**
 * Performs a real connectivity check by pinging /api/health.
 * navigator.onLine only detects local network connection, not actual internet reachability.
 */
async function pingHealthCheck(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch(`/api/health?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

const CHECK_INTERVAL = 30_000;

function useRealConnectivity(navigatorOnline: boolean): boolean {
  const [realOnline, setRealOnline] = useState(true);
  const cancelledRef = useRef(false);

  const check = useCallback(async () => {
    const ok = await pingHealthCheck();
    if (!cancelledRef.current) setRealOnline(ok);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    if (!navigatorOnline) {
      return;
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL);

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [navigatorOnline, check]);

  return realOnline;
}

export function SyncStatusIndicator() {
  const { t } = useI18n();
  const navigatorOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot,
  );

  const realOnline = useRealConnectivity(navigatorOnline);
  const isOnline = navigatorOnline && realOnline;

  const [stats, setStats] = useState({ pending: 0, syncing: 0, failed: 0 });
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    const update = () => {
      setStats(getQueueStats());
    };
    update();
    const interval = setInterval(update, 1000);
    const handleStorageError = () => setStorageError(true);
    window.addEventListener("orkest:sync-storage-error", handleStorageError);
    return () => {
      clearInterval(interval);
      window.removeEventListener("orkest:sync-storage-error", handleStorageError);
    };
  }, []);

  if (storageError) {
    return (
      <div className="flex items-center gap-1.5 pl-0.5 text-[11px] font-medium text-amber-600" title="Local storage is full. Some changes may not persist across page refreshes.">
        <AlertCircle className="h-3 w-3" />
        <span>Storage full</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 pl-0.5 text-[11px] font-medium text-[#7d7880]">
        <WifiOff className="h-3 w-3" />
        <span>{t("common.offline")}{stats.pending > 0 ? ` · ${stats.pending} ${t("common.pending")}` : ""}</span>
      </div>
    );
  }

  if (stats.failed > 0) {
    return (
      <div className="flex items-center gap-1.5 pl-0.5 text-[11px] font-medium text-amber-600">
        <AlertCircle className="h-3 w-3" />
        <span>{t("common.syncFailed", { count: stats.failed })}</span>
      </div>
    );
  }

  if (stats.syncing > 0 || stats.pending > 0) {
    return (
      <div className="flex items-center gap-1.5 pl-0.5 text-[11px] font-medium text-[#7d7880]">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{stats.pending > 0 ? t("common.syncingCount", { count: stats.pending }) : t("common.syncing")}</span>
      </div>
    );
  }

  return null;
}
