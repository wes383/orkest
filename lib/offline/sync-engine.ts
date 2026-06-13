"use client";

import { createClient } from "../supabase/client";
import { manualItemRecordToDbRow } from "../supabase/mapping";
import type { ManualItemRecord } from "../types/all-page";
import type { Database } from "../supabase/database.types";
import { resolveConflict } from "./conflict-resolver";
import {
  enqueue,
  getPendingOperations,
  getQueue,
  mergeConsecutiveUpdates,
  removeOperation,
  setQueue,
  updateOperationStatus,
} from "./sync-queue";
import type { SyncOperation } from "./types";

let isProcessing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

// Google Calendar push debounce state
const googlePushTimers = new Map<string, ReturnType<typeof setTimeout>>();
let hasGoogleConnection: boolean | null = null; // null = not checked yet
let googleConnectionLastCheck = 0;
const GOOGLE_CONNECTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const GOOGLE_PUSH_MAX_RETRIES = 5;

async function checkGoogleConnection(): Promise<boolean> {
  const now = Date.now();
  if (hasGoogleConnection !== null && now - googleConnectionLastCheck < GOOGLE_CONNECTION_CACHE_TTL) {
    return hasGoogleConnection;
  }
  try {
    googleConnectionLastCheck = now;
    const res = await fetch("/api/google-calendar/connection");
    if (!res.ok) { hasGoogleConnection = false; return false; }
    const data = await res.json();
    hasGoogleConnection = data.connected === true;
    return hasGoogleConnection;
  } catch {
    hasGoogleConnection = false;
    return false;
  }
}

function scheduleGooglePush(
  recordId: string,
  operation: "create" | "update" | "delete",
  retryCount = 0,
): void {
  // Debounce: wait 1500ms after last change to same item
  const existing = googlePushTimers.get(recordId);
  if (existing) clearTimeout(existing);

  googlePushTimers.set(recordId, setTimeout(() => {
    googlePushTimers.delete(recordId);
    void fireGooglePush(recordId, operation, retryCount);
  }, retryCount === 0 ? 1500 : getBackoffMs(retryCount)));
}

async function fireGooglePush(
  recordId: string,
  operation: "create" | "update" | "delete",
  retryCount: number,
): Promise<void> {
  const connected = await checkGoogleConnection();
  if (!connected) return;

  try {
    const res = await fetch("/api/google-calendar/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: recordId, operation }),
      keepalive: true,
    });

    if (!res.ok) {
      const details = await res.text().catch(() => "");
      console.warn("[SyncEngine] Google push failed:", res.status, details);
      if (res.status === 401 || res.status === 404) {
        hasGoogleConnection = null;
      }
      if (retryCount < GOOGLE_PUSH_MAX_RETRIES) {
        scheduleGooglePush(recordId, operation, retryCount + 1);
      }
    }
  } catch (error) {
    console.warn("[SyncEngine] Google push failed:", error);
    if (retryCount < GOOGLE_PUSH_MAX_RETRIES) {
      scheduleGooglePush(recordId, operation, retryCount + 1);
    }
  }
}

function getBackoffMs(retryCount: number): number {
  return Math.min(1000 * Math.pow(3, retryCount), 30000);
}

async function syncItemOperation(op: SyncOperation, userId: string): Promise<boolean> {
  const supabase = createClient();

  if (op.table === "items") {
    const record = op.payload as unknown as ManualItemRecord;
    const dbRow = manualItemRecordToDbRow(record, userId);

    if (op.type === "delete") {
      // Cancel reminders before deleting
      const { data: item } = await supabase
        .from("items")
        .select("reminders")
        .eq("id", op.recordId)
        .single();
      if (item?.reminders?.length) {
        void fetch("/api/reminders", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reminders: item.reminders }),
        }).catch((err) => console.error("[SyncEngine] cancel reminders on delete failed:", err));
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("items")
        .update({ deleted_at: now, updated_at: now })
        .eq("id", op.recordId);
      if (error) {
        console.error("[SyncEngine] delete item failed:", error);
        return false;
      }
      // Invalidate daily digest cache so deleted items don't appear
      const todayKey = new Date().toISOString().slice(0, 10);
      void supabase.from("daily_digests").delete().eq("user_id", userId).gte("digest_date", todayKey).then();
      return true;
    }

    // For create/update: check conflict first
    if (op.type === "update") {
      const { data: remoteRow, error: fetchError } = await supabase
        .from("items")
        .select("*")
        .eq("id", op.recordId)
        .single();

      if (!fetchError && remoteRow) {
        const remoteUpdatedAt = new Date(remoteRow.updated_at).getTime();
        if (remoteUpdatedAt > op.timestamp) {
          // Conflict detected
          const { dbRowToManualItemRecord } = await import("../supabase/mapping");
          const remoteRecord = dbRowToManualItemRecord(remoteRow);
          const resolved = resolveConflict(record, remoteRecord);
          const resolvedDbRow = manualItemRecordToDbRow(resolved, userId);
          const { error } = await supabase.from("items").upsert(resolvedDbRow, { onConflict: "id" });
          if (error) {
            console.error("[SyncEngine] conflict resolve upsert failed:", error);
            return false;
          }
          return true;
        }
      }
    }

    // Read existing reminders BEFORE upsert so we can cancel stale ones
    const { data: existingItem } = await supabase
      .from("items")
      .select("reminders")
      .eq("id", op.recordId)
      .single();
    const oldReminders = (existingItem?.reminders as Array<Record<string, unknown>> | null) ?? [];

    const { error } = await supabase.from("items").upsert(dbRow, { onConflict: "id" });
    if (error) {
      console.error("[SyncEngine] upsert item failed:", error);
      return false;
    }

    // Cancel old reminders if they existed
    if (oldReminders.length > 0) {
      void fetch("/api/reminders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminders: oldReminders, itemId: op.recordId }),
      }).catch((err) => console.error("[SyncEngine] cancel existing reminders failed:", err));
    }

    // Schedule new reminders if the updated record has them (skip deleted items)
    if (record.reminders?.length && record.startDate && !record.deletedAt) {
      void fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: op.recordId,
          reminders: record.reminders,
          title: record.title,
          startDate: record.startDate,
          startTime: record.startTime,
          timezone: record.timezone,
          allDay: record.allDay,
          rrule: record.rrule,
          completedOccurrences: record.completedOccurrences,
          exdates: record.exdates,
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data.reminders?.length) {
              await supabase
                .from("items")
                .update({ reminders: data.reminders })
                .eq("id", op.recordId);
            }
          } else {
            console.error("[SyncEngine] schedule reminders failed:", res.status, await res.text());
          }
        })
        .catch((err) => console.error("[SyncEngine] schedule reminders request failed:", err));
    }

    // Invalidate daily digest cache so changes are reflected
    const todayKey = new Date().toISOString().slice(0, 10);
    void supabase.from("daily_digests").delete().eq("user_id", userId).gte("digest_date", todayKey).then();

    return true;
  }

  if (op.table === "projects") {
    // Shallow copy to avoid mutating the queued object (payload.id would be lost on retry)
    const payload = { ...(op.payload as Record<string, unknown>) };
    delete payload.id;

    if (op.type === "delete") {
      const { error } = await supabase.from("projects").delete().eq("id", op.recordId);
      if (error) {
        console.error("[SyncEngine] delete project failed:", error);
        return false;
      }
      return true;
    }

    if (op.type === "create") {
      const insertPayload = {
        user_id: payload.user_id as string,
        name: payload.name as string,
        color: payload.color as string | null,
        sort_order: payload.sort_order as number | null,
        created_at: payload.created_at as string,
        updated_at: payload.updated_at as string,
      };
      const { error } = await supabase.from("projects").insert({ id: op.recordId, ...insertPayload });
      if (error) {
        console.error("[SyncEngine] create project failed:", error);
        return false;
      }
      return true;
    }

    const updatePayload: Database["public"]["Tables"]["projects"]["Update"] = {};
    for (const key of Object.keys(payload)) {
      const value = payload[key];
      if (value !== undefined) {
        (updatePayload as Record<string, unknown>)[key] = value;
      }
    }

    // Conflict detection: check if remote was updated after this operation was queued
    const { data: remoteProject, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", op.recordId)
      .single();

    if (!fetchError && remoteProject) {
      const remoteUpdatedAt = new Date(remoteProject.updated_at).getTime();
      if (remoteUpdatedAt > op.timestamp) {
        // Merge: prefer local for fields in updatePayload, keep remote for fields not touched locally
        const mergedPayload: Database["public"]["Tables"]["projects"]["Update"] = {
          ...updatePayload,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from("projects").update(mergedPayload).eq("id", op.recordId);
        if (error) {
          console.error("[SyncEngine] conflict resolve project update failed:", error);
          return false;
        }
        return true;
      }
    }

    const { error } = await supabase.from("projects").update(updatePayload).eq("id", op.recordId);
    if (error) {
      console.error("[SyncEngine] update project failed:", error);
      return false;
    }
    return true;
  }

  return false;
}

function resetStaleSyncingOps(): void {
  const queue = getQueue();
  let changed = false;
  for (let i = 0; i < queue.length; i++) {
    if (queue[i].status === "syncing") {
      queue[i] = { ...queue[i], status: "pending" };
      changed = true;
    }
  }
  if (changed) setQueue(queue);
}

export async function processQueue(): Promise<void> {
  if (isProcessing) {
    // A previous run is still in progress (e.g. a Supabase call is pending).
    // Schedule a retry so we don't silently drop this invocation.
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void processQueue(), 1000);
    return;
  }

  // Reset stale "syncing" operations back to "pending" so they get retried.
  // These are left over from a previous run that crashed or was interrupted.
  resetStaleSyncingOps();

  isProcessing = true;

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      isProcessing = false;
      return;
    }

    const pending = getPendingOperations();
    if (pending.length === 0) {
      isProcessing = false;
      return;
    }

    for (const op of pending) {
      if (op.status === "syncing") continue;

      updateOperationStatus(op.id, "syncing");

      const success = await syncItemOperation(op, user.id);

      if (success) {
        removeOperation(op.id);
        // Notify realtime hooks to suppress echo for this record
        window.dispatchEvent(
          new CustomEvent("orkest:local-sync", {
            detail: { recordId: op.recordId },
          }),
        );
        // Trigger Google Calendar push for items
        if (op.table === "items") {
          scheduleGooglePush(op.recordId, op.type);
        }
      } else {
        const newRetryCount = op.retryCount + 1;
        if (newRetryCount >= 5) {
          updateOperationStatus(op.id, "failed", newRetryCount);
        } else {
          updateOperationStatus(op.id, "pending", newRetryCount);
        }
      }
    }
  } finally {
    isProcessing = false;
  }

  // Schedule retry for failed items
  const stillPending = getPendingOperations();
  if (stillPending.length > 0) {
    const maxRetry = Math.max(...stillPending.map((op) => op.retryCount));
    const delay = getBackoffMs(maxRetry);
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      void processQueue();
    }, delay);
  }
}

export function scheduleSync(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    void processQueue();
  }, 100);
}

export function syncRecord(
  type: SyncOperation["type"],
  table: "items" | "projects",
  recordId: string,
  payload: Record<string, unknown>,
): void {
  enqueue(type, table, recordId, payload);
  mergeConsecutiveUpdates(recordId);
  scheduleSync();
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

const HEALTH_CHECK_INTERVAL = 30_000;

export function initSyncEngine(): () => void {
  let lastKnownOnline = navigator.onLine;
  let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  let cancelled = false;

  const handleOnline = () => {
    lastKnownOnline = true;
    void processQueue();
  };

  const handleOffline = () => {
    lastKnownOnline = false;
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Periodic real connectivity check.
  // When navigator.onLine is true but internet is unreachable (e.g. WiFi connected
  // but router has no WAN), the "online" event never fires when internet returns.
  // This check detects that transition and triggers sync.
  if (navigator.onLine) {
    healthCheckInterval = setInterval(async () => {
      if (cancelled) return;
      if (!lastKnownOnline) return;

      // We already know navigator.onLine is true; verify actual reachability
      const reachable = await pingHealthCheck();
      if (reachable) {
        // Internet is working — try to flush any pending operations
        void processQueue();
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  // Initial sync
  void processQueue();

  return () => {
    cancelled = true;
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    if (retryTimer) clearTimeout(retryTimer);
  };
}
