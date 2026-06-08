import { create } from "zustand";
import { persist } from "zustand/middleware";

export const RECENTS_MAX = 8;

export type RecentEntry = {
  itemId: string;
  viewedAt: number;
};

type RecentsState = {
  recents: RecentEntry[];
  recordView: (itemId: string) => void;
  clear: () => void;
};

export const useRecentsStore = create<RecentsState>()(
  persist(
    (set) => ({
      recents: [],
      recordView: (itemId) =>
        set((state) => {
          const filtered = state.recents.filter((r) => r.itemId !== itemId);
          const next: RecentEntry[] = [{ itemId, viewedAt: Date.now() }, ...filtered].slice(0, RECENTS_MAX);
          return { recents: next };
        }),
      clear: () => set({ recents: [] }),
    }),
    {
      name: "orkest:command-palette-recents",
      version: 1,
    },
  ),
);
