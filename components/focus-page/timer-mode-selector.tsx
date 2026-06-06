"use client";

import { cn } from "@/lib/utils";
import { useFocusStore } from "@/lib/stores/use-focus-store";
import { useI18n } from "@/lib/i18n";
import type { TimerMode } from "@/lib/types/focus-page";

export function TimerModeSelector() {
  const { t } = useI18n();
  const timerMode = useFocusStore((s) => s.timerMode);
  const timerState = useFocusStore((s) => s.timerState);
  const setTimerMode = useFocusStore((s) => s.setTimerMode);

  const isDisabled = timerState === "running" || timerState === "paused";

  const modes = [
    { value: "countdown" as TimerMode, label: t("focus.countdown") },
    { value: "stopwatch" as TimerMode, label: t("focus.stopwatch") },
  ];

  return (
    <div className="relative grid grid-cols-2 rounded-full border border-black/8 dark:border-white/10 bg-[#f4f0ec]/[0.5] dark:bg-[#2a2a2a] p-0.5">
      {/* Sliding background */}
      <div
        className="absolute top-0.5 bottom-0.5 rounded-full bg-[#ffffff] shadow-sm transition-all duration-300 ease-in-out dark:bg-[#d4d4d4]"
        style={{
          left: timerMode === "countdown" ? "2px" : "50%",
          width: "calc(50% - 2px)",
        }}
      />
      {modes.map(({ value, label }) => {
        const isActive = timerMode === value;
        return (
          <button
            key={value}
            type="button"
            disabled={isDisabled}
            onClick={() => setTimerMode(value)}
            className={cn(
              "relative z-10 flex cursor-pointer items-center justify-center rounded-full px-5 py-1.5 text-xs font-medium tracking-wide transition-colors",
              isActive
                ? "text-[#1a1a1a] dark:text-[#000000]"
                : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a9a4ae] dark:hover:text-[#c9c4cd]",
              isDisabled && "pointer-events-none opacity-50",
            )}
          >
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
