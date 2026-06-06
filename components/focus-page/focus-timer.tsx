"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useFocusStore } from "@/lib/stores/use-focus-store";
import { unlockAlarm, playAlarm } from "@/lib/stores/use-focus-store";
import { formatCountdown, formatStopwatch } from "@/lib/focus-page-utils";

export function FocusTimer() {
  const timerState = useFocusStore((s) => s.timerState);
  const timerMode = useFocusStore((s) => s.timerMode);
  const timeRemainingSeconds = useFocusStore((s) => s.timeRemainingSeconds);
  const elapsedSeconds = useFocusStore((s) => s.elapsedSeconds);
  const settings = useFocusStore((s) => s.settings);
  const updateSettings = useFocusStore((s) => s.updateSettings);
  const tick = useFocusStore((s) => s.tick);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTimerStateRef = useRef(timerState);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (timerState === "running") {
      tick();
      intervalRef.current = setInterval(() => {
        tick();
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState, tick]);

  useEffect(() => {
    const prevState = prevTimerStateRef.current;
    prevTimerStateRef.current = timerState;

    if (
      prevState === "running" &&
      timerState === "idle" &&
      timerMode === "countdown" &&
      timeRemainingSeconds === 0 &&
      settings.alarmEnabled
    ) {
      playAlarm();
    }
  }, [timerState, timerMode, timeRemainingSeconds, settings.alarmEnabled]);

  useEffect(() => {
    function handleUserInteraction() {
      if (settings.alarmEnabled) {
        unlockAlarm();
      }
    }
    window.addEventListener("click", handleUserInteraction, { once: true });
    window.addEventListener("touchstart", handleUserInteraction, { once: true });
    return () => {
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
    };
  }, [settings.alarmEnabled]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && useFocusStore.getState().timerState === "running") {
        useFocusStore.getState().tick();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const displayValue =
    timerMode === "stopwatch"
      ? formatStopwatch(elapsedSeconds)
      : formatCountdown(timeRemainingSeconds);

  const canEdit = timerMode === "countdown" && timerState === "idle";

  const countdownEnded = timerMode === "countdown" && timerState === "idle" && timeRemainingSeconds === 0;

  const showProgress =
    timerMode === "countdown" && settings.countdownMinutes > 0 && (timerState !== "idle" || countdownEnded);

  const progressPercent = countdownEnded
    ? 100
    : showProgress
      ? Math.min((elapsedSeconds / (settings.countdownMinutes * 60)) * 100, 100)
      : 0;

  function handleClick() {
    if (!canEdit) return;
    setEditValue(String(settings.countdownMinutes));
    setIsEditing(true);
  }

  function handleConfirm() {
    const minutes = parseInt(editValue, 10);
    if (!isNaN(minutes) && minutes > 0 && minutes <= 360) {
      updateSettings({ countdownMinutes: minutes });
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleConfirm();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  }

  return (
    <div
      className={cn(
        "relative flex h-48 w-112 items-center justify-center overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/10",
        canEdit && "cursor-pointer",
      )}
      onClick={handleClick}
    >
      <div
        className="absolute inset-y-0 left-0 bg-emerald-100 dark:bg-emerald-900/40 transition-[width] duration-1000 ease-linear"
        style={{ width: `${progressPercent}%` }}
      />
      <div className="absolute inset-0 bg-white/75 dark:bg-black/60" />

      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          min={1}
          max={360}
          value={editValue}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") {
              setEditValue(val);
            } else {
              const num = parseInt(val, 10);
              setEditValue(String(Math.min(num, 360)));
            }
          }}
          onBlur={handleConfirm}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-48 bg-transparent p-0 text-center font-sans text-8xl font-light leading-none tracking-tight tabular-nums text-[#25242a] dark:text-[#e8e6ea] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      ) : (
        <span
          className={cn(
            "relative z-10 font-sans text-8xl font-light tracking-tight tabular-nums",
            timerState === "running" ? "text-[#25242a] dark:text-[#e8e6ea]" : "text-[#25242a]/60 dark:text-[#e8e6ea]/60",
          )}
        >
          {displayValue}
        </span>
      )}
    </div>
  );
}
