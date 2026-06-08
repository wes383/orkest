"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { useI18n, type TranslationKey } from "@/lib/i18n";

interface ShortcutEntry {
  keys: string[];
  actionKey: TranslationKey;
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: ["Alt", "1"], actionKey: "shortcuts.goToday" },
  { keys: ["Alt", "2"], actionKey: "shortcuts.goAll" },
  { keys: ["Alt", "3"], actionKey: "shortcuts.goFocus" },
  { keys: ["Alt", "4"], actionKey: "shortcuts.goTrash" },
  { keys: ["Alt", ","], actionKey: "shortcuts.openSettings" },
  { keys: ["Alt", "B"], actionKey: "shortcuts.toggleSidebar" },
  { keys: ["Alt", "N"], actionKey: "shortcuts.newItem" },
  { keys: ["Alt", "I"], actionKey: "shortcuts.toggleAi" },
  { keys: ["Ctrl", "K"], actionKey: "shortcuts.commandPalette" },
  { keys: ["V"], actionKey: "shortcuts.cycleViews" },
  { keys: ["Left", "Right"], actionKey: "shortcuts.calendarPrevNext" },
  { keys: ["Space"], actionKey: "shortcuts.timer" },
  { keys: ["Alt", "R"], actionKey: "shortcuts.resetTimer" },
  { keys: ["Esc"], actionKey: "shortcuts.closeForm" },
  { keys: ["?"], actionKey: "shortcuts.toggleHelp" },
];

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

function formatKey(key: string) {
  if (key === "Alt") return isMac() ? "Option" : "Alt";
  if (key === "Ctrl") return isMac() ? "⌘" : "Ctrl";
  return key;
}

export function KeyboardShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[4px]">
      <div
        ref={panelRef}
        className="w-full max-w-sm rounded-2xl border border-black/8 bg-white p-6 shadow-[0_18px_55px_rgba(0,0,0,0.16)] dark:border-white/10 dark:bg-[#1e1e1e]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">
            {t("shortcuts.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.035] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.actionKey} className="flex items-center justify-between text-sm">
              <span className="text-[#2b2a30] dark:text-[#d4d4d4]">{t(shortcut.actionKey)}</span>
              <span className="flex items-center gap-1">
                {shortcut.keys.map((key, index) => {
                  const separator = shortcut.actionKey === "shortcuts.calendarPrevNext" ? "/" : "+";
                  return (
                    <span key={`${shortcut.actionKey}-${key}`} className="flex items-center gap-1">
                      <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-black/10 bg-[#f4f0ec]/60 px-1.5 py-0.5 text-xs font-medium text-[#5f5a63] dark:border-white/10 dark:bg-[#2a2a2a] dark:text-[#a3a3a3]">
                        {formatKey(key)}
                      </kbd>
                      {index < shortcut.keys.length - 1 ? <span className="text-[#9f99a3]">{separator}</span> : null}
                    </span>
                  );
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
