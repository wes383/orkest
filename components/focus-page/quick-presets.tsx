"use client";

import { cn } from "@/lib/utils";
import { useFocusStore } from "@/lib/stores/use-focus-store";

const PRESETS = [15, 25, 45, 60];

export function QuickPresets() {
  const timerMode = useFocusStore((s) => s.timerMode);
  const timerState = useFocusStore((s) => s.timerState);
  const settings = useFocusStore((s) => s.settings);
  const updateSettings = useFocusStore((s) => s.updateSettings);

  if (timerMode !== "countdown") return null;
  if (timerState !== "idle") return null;

  return (
    <div className="flex items-center gap-2">
      {PRESETS.map((minutes) => {
        const isActive = settings.countdownMinutes === minutes;
        return (
          <button
            key={minutes}
            type="button"
            onClick={() => updateSettings({ countdownMinutes: minutes })}
            className={cn(
              "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-[#25242a] text-white dark:bg-[#e8e6ea] dark:text-[#25242a]"
                : "border border-black/8 dark:border-white/15 text-[#7d7880] dark:text-[#a9a4ae] hover:bg-black/[0.035] dark:hover:bg-white/[0.06] hover:text-[#25242a] dark:hover:text-[#e8e6ea]",
            )}
          >
            {minutes}m
          </button>
        );
      })}
    </div>
  );
}
