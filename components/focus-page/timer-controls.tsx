"use client";

import { Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusStore } from "@/lib/stores/use-focus-store";
import { useI18n } from "@/lib/i18n";

export function TimerControls() {
  const { t } = useI18n();
  const timerState = useFocusStore((s) => s.timerState);
  const timerMode = useFocusStore((s) => s.timerMode);
  const timeRemainingSeconds = useFocusStore((s) => s.timeRemainingSeconds);
  const settings = useFocusStore((s) => s.settings);
  const updateSettings = useFocusStore((s) => s.updateSettings);
  const startTimer = useFocusStore((s) => s.startTimer);
  const pauseTimer = useFocusStore((s) => s.pauseTimer);
  const resumeTimer = useFocusStore((s) => s.resumeTimer);
  const resetTimer = useFocusStore((s) => s.resetTimer);

  const countdownEnded = timerMode === "countdown" && timerState === "idle" && timeRemainingSeconds === 0;

  return (
    <div className="relative flex items-center justify-center">
      <div className="flex items-center gap-3">
      {timerState === "idle" && !countdownEnded && (
        <button
          type="button"
          onClick={startTimer}
          className="cursor-pointer rounded-full bg-[#25242a] dark:bg-[#e8e6ea] px-8 py-2.5 text-sm font-medium text-white dark:text-[#25242a] transition-all hover:bg-[#25242a]/90 dark:hover:bg-[#e8e6ea]/90 active:scale-95"
        >
          {t("focus.start")}
        </button>
      )}

      {countdownEnded && (
        <button
          type="button"
          onClick={resetTimer}
          className="cursor-pointer rounded-full bg-[#25242a] dark:bg-[#e8e6ea] px-8 py-2.5 text-sm font-medium text-white dark:text-[#25242a] transition-all hover:bg-[#25242a]/90 dark:hover:bg-[#e8e6ea]/90 active:scale-95"
        >
          {t("focus.reset")}
        </button>
      )}

      {timerState === "running" && (
        <>
          <button
            type="button"
            onClick={resetTimer}
            className="cursor-pointer rounded-full border border-black/8 dark:border-white/15 px-6 py-2.5 text-sm font-medium text-[#7d7880] dark:text-[#a9a4ae] transition-all hover:bg-black/[0.035] dark:hover:bg-white/[0.06] hover:text-[#25242a] dark:hover:text-[#e8e6ea] active:scale-95"
          >
            {t("focus.reset")}
          </button>
          <button
            type="button"
            onClick={pauseTimer}
            className="cursor-pointer rounded-full bg-[#25242a] dark:bg-[#e8e6ea] px-8 py-2.5 text-sm font-medium text-white dark:text-[#25242a] transition-all hover:bg-[#25242a]/90 dark:hover:bg-[#e8e6ea]/90 active:scale-95"
          >
            {t("focus.pause")}
          </button>
        </>
      )}

      {timerState === "paused" && (
        <>
          <button
            type="button"
            onClick={resetTimer}
            className="cursor-pointer rounded-full border border-black/8 dark:border-white/15 px-6 py-2.5 text-sm font-medium text-[#7d7880] dark:text-[#a9a4ae] transition-all hover:bg-black/[0.035] dark:hover:bg-white/[0.06] hover:text-[#25242a] dark:hover:text-[#e8e6ea] active:scale-95"
          >
            {t("focus.reset")}
          </button>
          <button
            type="button"
            onClick={resumeTimer}
            className="cursor-pointer rounded-full bg-[#25242a] dark:bg-[#e8e6ea] px-8 py-2.5 text-sm font-medium text-white dark:text-[#25242a] transition-all hover:bg-[#25242a]/90 dark:hover:bg-[#e8e6ea]/90 active:scale-95"
          >
            {t("focus.resume")}
          </button>
        </>
      )}
      </div>

      {timerMode === "countdown" && (
        <button
          type="button"
          onClick={() => updateSettings({ alarmEnabled: !settings.alarmEnabled })}
          title={t("focus.alarm")}
          className={cn(
            "absolute -right-10 cursor-pointer rounded-full p-2 transition-all active:scale-90",
            settings.alarmEnabled
              ? "text-[#25242a] dark:text-[#e8e6ea] hover:bg-black/[0.035] dark:hover:bg-white/[0.06]"
              : "text-[#7d7880]/50 dark:text-[#a9a4ae]/50 hover:bg-black/[0.035] dark:hover:bg-white/[0.06]",
          )}
        >
          {settings.alarmEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
