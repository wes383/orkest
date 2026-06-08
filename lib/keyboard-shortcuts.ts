import type { TranslationKey } from "./i18n";

export interface ShortcutEntry {
  keys: string[];
  actionKey: TranslationKey;
  /** Optional macOS-specific variant. When provided, both variants are shown in the settings list. */
  macosKeys?: string[];
}

export const SHORTCUTS: ShortcutEntry[] = [
  { keys: ["Alt", "1"], actionKey: "shortcuts.goToday" },
  { keys: ["Alt", "2"], actionKey: "shortcuts.goAll" },
  { keys: ["Alt", "3"], actionKey: "shortcuts.goFocus" },
  { keys: ["Alt", "4"], actionKey: "shortcuts.goTrash" },
  { keys: ["Alt", ","], actionKey: "shortcuts.openSettings" },
  { keys: ["Alt", "B"], actionKey: "shortcuts.toggleSidebar", macosKeys: ["⌥", "B"] },
  { keys: ["Alt", "N"], actionKey: "shortcuts.newItem", macosKeys: ["⌥", "N"] },
  { keys: ["Alt", "Enter"], actionKey: "shortcuts.quickAdd", macosKeys: ["⌥", "↵"] },
  { keys: ["Alt", "I"], actionKey: "shortcuts.toggleAi", macosKeys: ["⌥", "I"] },
  { keys: ["Ctrl", "K"], actionKey: "shortcuts.commandPalette", macosKeys: ["⌘", "K"] },
  { keys: ["V"], actionKey: "shortcuts.cycleViews" },
  { keys: ["Left", "Right"], actionKey: "shortcuts.calendarPrevNext" },
  { keys: ["Space"], actionKey: "shortcuts.timer" },
  { keys: ["Alt", "R"], actionKey: "shortcuts.resetTimer", macosKeys: ["⌥", "R"] },
  { keys: ["Esc"], actionKey: "shortcuts.closeForm" },
  { keys: ["?"], actionKey: "shortcuts.toggleHelp" },
];
