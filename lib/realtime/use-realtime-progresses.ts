"use client";

import { useEffect, useRef } from "react";
import { createClient } from "../supabase/client";
import { useProgressStore } from "../stores/use-progress-store";

const LOCAL_SYNC_WINDOW_MS = 3000;

export function useRealtimeProgresses(userId: string | undefined) {
  const lastLocalSyncIds = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    const progressChannel = supabase
      .channel("progresses-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "progresses",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const now = Date.now();
          const recordId =
            (payload.new as { id?: string } | null)?.id ??
            (payload.old as { id?: string } | null)?.id;
          if (recordId) {
            const lastSync = lastLocalSyncIds.current.get(recordId);
            if (lastSync && now - lastSync < LOCAL_SYNC_WINDOW_MS) return;
          }

          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) useProgressStore.getState().applyRemoteProgressDelete(oldId);
            return;
          }

          const row = payload.new as {
            id: string;
            user_id: string;
            name: string;
            description: string | null;
            goal_value: number;
            goal_unit: string;
            tracking_mode: "count" | "percentage" | "manual";
            manual_value: number;
            color: string | null;
            status: "active" | "completed" | "archived";
            target_date: string | null;
            sort_order: number | null;
            created_at: string;
            updated_at: string;
          } | null;
          if (!row) return;
          useProgressStore.getState().applyRemoteProgressChange({
            id: row.id,
            userId: row.user_id,
            name: row.name,
            description: row.description ?? undefined,
            goalValue: Number(row.goal_value),
            goalUnit: row.goal_unit,
            trackingMode: row.tracking_mode,
            manualValue: Number(row.manual_value),
            color: row.color ?? undefined,
            status: row.status,
            targetDate: row.target_date ?? undefined,
            sortOrder: row.sort_order ?? undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] Progresses channel error");
        }
      });

    const linkChannel = supabase
      .channel("progress_tasks-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "progress_tasks",
        },
        (payload) => {
          const now = Date.now();
          const recordId =
            (payload.new as { id?: string } | null)?.id ??
            (payload.old as { id?: string } | null)?.id;
          if (recordId) {
            const lastSync = lastLocalSyncIds.current.get(recordId);
            if (lastSync && now - lastSync < LOCAL_SYNC_WINDOW_MS) return;
          }

          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) useProgressStore.getState().applyRemoteLinkDelete(oldId);
            return;
          }

          const row = payload.new as {
            id: string;
            progress_id: string;
            item_id: string;
            weight: number;
            added_at: string;
          } | null;
          if (!row) return;
          useProgressStore.getState().applyRemoteLinkChange({
            id: row.id,
            progressId: row.progress_id,
            itemId: row.item_id,
            weight: Number(row.weight),
            addedAt: new Date(row.added_at),
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] Progress_tasks channel error");
        }
      });

    const handleLocalSync = (e: Event) => {
      const detail = (e as CustomEvent<{ recordId: string }>).detail;
      if (detail?.recordId) {
        lastLocalSyncIds.current.set(detail.recordId, Date.now());
      }
    };
    window.addEventListener("orkest:local-sync", handleLocalSync);

    return () => {
      progressChannel.unsubscribe();
      linkChannel.unsubscribe();
      window.removeEventListener("orkest:local-sync", handleLocalSync);
    };
  }, [userId]);
}
