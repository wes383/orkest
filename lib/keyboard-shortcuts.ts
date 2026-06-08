import type { TranslationKey } from "./i18n";

export interface ShortcutEntry {
  keys: string[];
  actionKey: TranslationKey;
}

export const SHORTCUTS: ShortcutEntry[] = [
  { keys: ["Alt", "1"], actionKey: "shortcuts.goToday" },
  { keys: ["Alt", "2"], actionKey: "shortcuts.goAll" },
  { keys: ["Alt", "3"], actionKey: "shortcuts.goFocus" },
  { keys: ["Alt", "4"], actionKey: "shortcuts.goTrash" },
  { keys: ["Alt", ","], actionKey: "shortcuts.openSettings" },
  { keys: ["Alt", "B"], actionKey: "shortcuts.toggleSidebar" },
  { keys: ["Alt", "N"], actionKey: "shortcuts.newItem" },
  { keys: ["Alt", "Enter"], actionKey: "shortcuts.quickAdd" },
  { keys: ["Alt", "I"], actionKey: "shortcuts.toggleAi" },
  { keys: ["Ctrl", "K"], actionKey: "shortcuts.commandPalette" },
  { keys: ["V"], actionKey: "shortcuts.cycleViews" },
  { keys: ["Left", "Right"], actionKey: "shortcuts.calendarPrevNext" },
  { keys: ["Space"], actionKey: "shortcuts.timer" },
  { keys: ["Alt", "R"], actionKey: "shortcuts.resetTimer" },
  { keys: ["Esc"], actionKey: "shortcuts.closeForm" },
  { keys: ["?"], actionKey: "shortcuts.toggleHelp" },
];
