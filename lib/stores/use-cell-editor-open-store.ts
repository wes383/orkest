import { create } from "zustand";

/**
 * Tracks how many table cell editors are currently open across the entire
 * table. Table cell tooltips subscribe to this and suppress themselves
 * whenever any editor is open so they cannot leak through portal
 * boundaries while the user is editing.
 */
type CellEditorOpenState = {
  openCount: number;
  isOpen: () => boolean;
  increment: () => void;
  decrement: () => void;
};

export const useCellEditorOpenStore = create<CellEditorOpenState>((set, get) => ({
  openCount: 0,
  isOpen: () => get().openCount > 0,
  increment: () => set((state) => ({ openCount: state.openCount + 1 })),
  decrement: () =>
    set((state) => ({ openCount: Math.max(0, state.openCount - 1) })),
}));
