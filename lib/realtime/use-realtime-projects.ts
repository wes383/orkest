"use client";

import { useEffect, useRef } from "react";
import { createClient } from "../supabase/client";
import { useProjectStore } from "../stores/use-project-store";

const LOCAL_SYNC_WINDOW_MS = 3000;

export function useRealtimeProjects(userId: string | undefined) {
  const lastLocalSyncIds = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    const channel = supabase
      .channel("projects-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const now = Date.now();

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
              useProjectStore.getState().applyRemoteDelete(oldId);
            }
            return;
          }

          const newRow = payload.new as { id: string; user_id: string; name: string; color: string | null; created_at: string; updated_at: string } | null;
          if (!newRow) return;

          useProjectStore.getState().applyRemoteProjectChange({
            id: newRow.id,
            userId: newRow.user_id,
            name: newRow.name,
            color: newRow.color ?? undefined,
            createdAt: new Date(newRow.created_at),
            updatedAt: new Date(newRow.updated_at),
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] Projects channel error");
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
      channel.unsubscribe();
      window.removeEventListener("orkest:local-sync", handleLocalSync);
    };
  }, [userId]);
}
