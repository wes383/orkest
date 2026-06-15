import { create } from "zustand";
import type {
  Progress,
  ProgressInput,
  ProgressTaskLink,
  ProgressUpdate,
} from "../types/progress";
import type { ProgressSortMode } from "../progress/progress-stats";
import { createClient } from "../supabase/client";
import { makeUid } from "../all-page-utils";
import { syncRecord } from "../offline/sync-engine";

function progressUpdateToRow(updates: ProgressUpdate): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.goalValue !== undefined) row.goal_value = updates.goalValue;
  if (updates.goalUnit !== undefined) row.goal_unit = updates.goalUnit;
  if (updates.trackingMode !== undefined) row.tracking_mode = updates.trackingMode;
  if (updates.manualValue !== undefined) row.manual_value = updates.manualValue;
  if (updates.color !== undefined) row.color = updates.color;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.targetDate !== undefined) row.target_date = updates.targetDate;
  if (updates.sortOrder !== undefined) row.sort_order = updates.sortOrder;
  if (updates.aiContext !== undefined) row.ai_context = updates.aiContext;
  return row;
}

interface ProgressStoreState {
  progresses: Progress[];
  links: ProgressTaskLink[];
  isLoaded: boolean;
  sortMode: ProgressSortMode;

  // Loaders
  loadProgresses: (userId: string) => Promise<void>;
  loadLinks: (userId: string) => Promise<void>;

  // CRUD
  createProgress: (userId: string, input: ProgressInput) => Promise<Progress>;
  updateProgress: (userId: string, progressId: string, updates: ProgressUpdate) => Promise<boolean>;
  deleteProgress: (userId: string, progressId: string) => Promise<boolean>;
  reorderProgresses: (userId: string, orderedIds: string[]) => Promise<boolean>;
  setManualValue: (userId: string, progressId: string, value: number) => Promise<boolean>;
  setSortMode: (mode: ProgressSortMode) => void;
  resetStore: () => void;

  // Link management
  bindTasks: (userId: string, progressId: string, itemIds: string[]) => Promise<number>;
  unbindTask: (userId: string, progressId: string, itemId: string) => Promise<boolean>;
  unbindAllForItem: (userId: string, itemId: string) => Promise<number>;

  // Helpers
  findProgressByName: (name: string) => Progress | undefined;

  // Realtime
  applyRemoteProgressChange: (progress: Progress) => void;
  applyRemoteProgressDelete: (progressId: string) => void;
  applyRemoteLinkChange: (link: ProgressTaskLink) => void;
  applyRemoteLinkDelete: (linkId: string) => void;
}

export const useProgressStore = create<ProgressStoreState>((set, get) => ({
  progresses: [],
  links: [],
  isLoaded: false,
  sortMode: "default",

  async loadProgresses(userId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("progresses")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("Failed to load progresses:", error);
      return;
    }
    const progresses: Progress[] = (data ?? []).map((row) => ({
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
      aiContext: (row.ai_context as Record<string, unknown> | null) ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
    set({ progresses, isLoaded: true });
  },

  async loadLinks(_userId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("progress_tasks")
      .select("*");
    if (error) {
      console.error("Failed to load progress_tasks:", error);
      return;
    }
    const links: ProgressTaskLink[] = (data ?? []).map((row) => ({
      id: row.id,
      progressId: row.progress_id,
      itemId: row.item_id,
      weight: Number(row.weight),
      addedAt: new Date(row.added_at),
    }));
    set({ links });
  },

  async createProgress(userId, input) {
    const id = makeUid();
    const now = new Date();
    const maxSort = get().progresses.reduce(
      (m, p) => Math.max(m, p.sortOrder ?? 0),
      0,
    );
    const progress: Progress = {
      id,
      userId,
      name: input.name,
      description: input.description,
      goalValue: input.goalValue,
      goalUnit: input.goalUnit,
      trackingMode: input.trackingMode,
      manualValue: input.manualValue ?? 0,
      color: input.color,
      status: input.status ?? "active",
      targetDate: input.targetDate,
      aiContext: input.aiContext,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ progresses: [...state.progresses, progress] }));

    syncRecord("create", "progresses", id, {
      id,
      user_id: userId,
      name: progress.name,
      description: progress.description ?? null,
      goal_value: progress.goalValue,
      goal_unit: progress.goalUnit,
      tracking_mode: progress.trackingMode,
      manual_value: progress.manualValue,
      color: progress.color ?? null,
      status: progress.status,
      target_date: progress.targetDate ?? null,
      sort_order: progress.sortOrder,
      ai_context: progress.aiContext ?? null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    return progress;
  },

  async updateProgress(userId, progressId, updates) {
    set((state) => ({
      progresses: state.progresses.map((p) =>
        p.id === progressId ? { ...p, ...updates, updatedAt: new Date() } : p,
      ),
    }));
    syncRecord("update", "progresses", progressId, {
      ...progressUpdateToRow(updates),
      user_id: userId,
      updated_at: new Date().toISOString(),
    });
    return true;
  },

  async deleteProgress(userId, progressId) {
    set((state) => ({
      progresses: state.progresses.filter((p) => p.id !== progressId),
      links: state.links.filter((l) => l.progressId !== progressId),
    }));
    syncRecord("delete", "progresses", progressId, { user_id: userId });
    return true;
  },

  async reorderProgresses(userId, orderedIds) {
    const orderMap = new Map<string, number>();
    orderedIds.forEach((id, index) => orderMap.set(id, index + 1));
    const current = get().progresses;
    const updated = current.map((p) => {
      const newOrder = orderMap.get(p.id);
      if (newOrder !== undefined && newOrder !== p.sortOrder) {
        return { ...p, sortOrder: newOrder, updatedAt: new Date() };
      }
      return p;
    });
    for (const [id, newOrder] of orderMap) {
      const p = current.find((x) => x.id === id);
      if (p && p.sortOrder !== newOrder) {
        syncRecord("update", "progresses", id, {
          sort_order: newOrder,
          user_id: userId,
        });
      }
    }
    set({ progresses: updated });
    return true;
  },

  async setManualValue(userId, progressId, value) {
    if (value < 0) return false;
    set((state) => ({
      progresses: state.progresses.map((p) =>
        p.id === progressId ? { ...p, manualValue: value, updatedAt: new Date() } : p,
      ),
    }));
    syncRecord("update", "progresses", progressId, {
      manual_value: value,
      user_id: userId,
      updated_at: new Date().toISOString(),
    });
    return true;
  },

  setSortMode(mode) {
    set({ sortMode: mode });
  },

  resetStore() {
    set({ progresses: [], links: [], isLoaded: false, sortMode: "default" });
  },

  async bindTasks(userId, progressId, itemIds) {
    const now = new Date();
    const newLinks: ProgressTaskLink[] = [];
    const existing = new Set(
      get()
        .links.filter((l) => l.progressId === progressId)
        .map((l) => l.itemId),
    );
    let count = 0;
    for (const itemId of itemIds) {
      if (existing.has(itemId)) continue;
      const id = makeUid();
      const link: ProgressTaskLink = {
        id,
        progressId,
        itemId,
        weight: 1,
        addedAt: now,
      };
      newLinks.push(link);
      syncRecord("create", "progress_tasks", id, {
        id,
        progress_id: progressId,
        item_id: itemId,
        weight: 1,
        added_at: now.toISOString(),
      });
      count += 1;
    }
    if (count > 0) {
      set((state) => ({ links: [...state.links, ...newLinks] }));
    }
    return count;
  },

  async unbindTask(userId, progressId, itemId) {
    const link = get().links.find(
      (l) => l.progressId === progressId && l.itemId === itemId,
    );
    if (!link) return false;
    set((state) => ({ links: state.links.filter((l) => l.id !== link.id) }));
    syncRecord("delete", "progress_tasks", link.id, { user_id: userId });
    return true;
  },

  async unbindAllForItem(userId, itemId) {
    const matches = get().links.filter((l) => l.itemId === itemId);
    if (matches.length === 0) return 0;
    set((state) => ({ links: state.links.filter((l) => l.itemId !== itemId) }));
    for (const link of matches) {
      syncRecord("delete", "progress_tasks", link.id, { user_id: userId });
    }
    return matches.length;
  },

  findProgressByName(name) {
    const normalized = name.toLowerCase().trim();
    return get().progresses.find((p) => p.name.toLowerCase() === normalized);
  },

  applyRemoteProgressChange(progress) {
    set((state) => {
      const exists = state.progresses.some((p) => p.id === progress.id);
      if (exists) {
        return {
          progresses: state.progresses.map((p) =>
            p.id === progress.id ? { ...p, ...progress } : p,
          ),
        };
      }
      return { progresses: [...state.progresses, progress] };
    });
  },

  applyRemoteProgressDelete(progressId) {
    set((state) => ({
      progresses: state.progresses.filter((p) => p.id !== progressId),
      links: state.links.filter((l) => l.progressId !== progressId),
    }));
  },

  applyRemoteLinkChange(link) {
    set((state) => {
      const exists = state.links.some((l) => l.id === link.id);
      if (exists) {
        return {
          links: state.links.map((l) => (l.id === link.id ? { ...l, ...link } : l)),
        };
      }
      return { links: [...state.links, link] };
    });
  },

  applyRemoteLinkDelete(linkId) {
    set((state) => ({ links: state.links.filter((l) => l.id !== linkId) }));
  },
}));
