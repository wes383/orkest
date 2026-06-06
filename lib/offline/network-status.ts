"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getQueueStats } from "./sync-queue";
import type { NetworkState } from "./types";

export function getInitialNetworkState(): NetworkState {
  return {
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
  };
}

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

export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>(getInitialNetworkState);
  const cancelledRef = useRef(false);

  const check = useCallback(async (navigatorOnline: boolean) => {
    if (!navigatorOnline) {
      setState((prev) => prev.isOnline ? { ...prev, isOnline: false } : prev);
      return;
    }
    const ok = await pingHealthCheck();
    if (!cancelledRef.current) {
      setState((prev) => prev.isOnline !== ok ? { ...prev, isOnline: ok } : prev);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    const updateStats = () => {
      const stats = getQueueStats();
      setState((prev) => ({
        ...prev,
        isSyncing: stats.syncing > 0,
        pendingCount: stats.pending,
        failedCount: stats.failed,
      }));
    };

    // Initial real connectivity check
    queueMicrotask(() => void check(navigator.onLine));

    const handleOnline = () => {
      void check(true);
      updateStats();
    };
    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
      updateStats();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const statsInterval = setInterval(updateStats, 2000);
    const checkInterval = setInterval(() => void check(navigator.onLine), CHECK_INTERVAL);

    return () => {
      cancelledRef.current = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(statsInterval);
      clearInterval(checkInterval);
    };
  }, [check]);

  return state;
}
