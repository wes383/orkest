"use client";

import { useEffect, useRef } from "react";
import { createClient } from "../supabase/client";
import { dbRowToManualItemRecord } from "../supabase/mapping";
import { useAllPageStore } from "../stores/use-all-page-store";

const LOCAL_SYNC_WINDOW_MS = 3000;

export function useRealtimeItems(userId: string | undefined) {
  const lastLocalSyncIds = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    const channel = supabase
      .channel("items-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const now = Date.now();

          // Echo suppression: ignore changes we just synced locally
          const recordId = (payload.new as { id?: string } | null)?.id ?? (payload.old as { id?: string } | null)?.id;
          if (recordId) {
            const lastSync = lastLocalSyncIds.current.get(recordId);
            if (lastSync && now - lastSync < LOCAL_SYNC_WINDOW_MS) {
              return;
            }
          }

          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) {
              useAllPageStore.getState().applyRemoteDelete(oldId);
            }
            return;
          }

          const newRow = payload.new as Record<string, unknown> | null;
          if (!newRow) return;

          try {
            const record = dbRowToManualItemRecord(newRow as Parameters<typeof dbRowToManualItemRecord>[0]);
            useAllPageStore.getState().applyRemoteItemChange(record);
          } catch (err) {
            console.error("[Realtime] Failed to process item change:", err);
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] Items channel error");
        }
      });

    // Listen for local sync events from broadcast channel / sync engine
    const handleLocalSync = (e: Event) => {
      const detail = (e as CustomEvent<{ recordId: string }>).detail;
      if (detail?.recordId) {
        lastLocalSyncIds.current.set(detail.recordId, Date.now());
      }
    };
    window.addEventListener("orkest:local-sync", handleLocalSync);

    return () => {
      channel.unsubscribe();
      window.removeEventListener("orkest:local-sync", handleLocalSync);
    };
  }, [userId]);
}
