"use client";

import { useState } from "react";
import { Plus, X, Bell, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { Reminder } from "@/lib/types/all-page";

const MAX_REMINDERS = 5;

const PRESET_OPTIONS_TIMED = [
  { labelKey: "reminder.5min", value: 5 },
  { labelKey: "reminder.10min", value: 10 },
  { labelKey: "reminder.15min", value: 15 },
  { labelKey: "reminder.30min", value: 30 },
  { labelKey: "reminder.1hour", value: 60 },
  { labelKey: "reminder.2hours", value: 120 },
  { labelKey: "reminder.1day", value: 1440 },
];

const CUSTOM_UNITS = [
  { labelKey: "reminder.unitMin", multiplier: 1 },
  { labelKey: "reminder.unitHour", multiplier: 60 },
  { labelKey: "reminder.unitDay", multiplier: 1440 },
  { labelKey: "reminder.unitWeek", multiplier: 10080 },
];

/** For all-day events: decompose minutesBefore back to day offset and time string (using default 9 AM base). */
function decomposeAllDayReminder(minutesBefore: number): { days: number; time: string } {
  const days = Math.floor(minutesBefore / 1440);
  const remainder = minutesBefore - days * 1440;
  // Default base is 9 AM (540 min from midnight). triggerMinutesFromMidnight = 540 - remainder
  const totalMinutes = ((540 - remainder) % 1440 + 1440) % 1440;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(Math.round(totalMinutes % 60)).padStart(2, "0");
  return { days, time: `${hh}:${mm}` };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFunc = (key: any, params?: Record<string, unknown>) => string;

function formatMinutes(minutes: number, t: TFunc): string {
  if (minutes < 60) return t("reminder.timeMin", { minutes });
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return t("reminder.timeHour", { hours });
  }
  if (minutes < 10080) {
    const days = Math.floor(minutes / 1440);
    return t("reminder.timeDay", { days });
  }
  const weeks = Math.floor(minutes / 10080);
  return t("reminder.timeWeek", { weeks });
}

interface ReminderSelectorProps {
  reminders: Reminder[];
  onChange: (reminders: Reminder[]) => void;
  isAllDay?: boolean;
}

export function ReminderSelector({ reminders, onChange, isAllDay = false }: ReminderSelectorProps) {
  const { t: _t } = useI18n();
  const t = _t as TFunc;
  const [showPanel, setShowPanel] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState(1);
  const [error, setError] = useState("");

  // All-day event state
  const [alldayCount, setAlldayCount] = useState("1");
  const [alldayUnit, setAlldayUnit] = useState<"day" | "week">("day");
  const [alldayTime, setAlldayTime] = useState("09:00");

  const addReminder = (
    minutesBefore: number,
    method: "push" | "email" = "push",
    extra?: { triggerTime?: string; dayOffset?: number },
  ) => {
    if (reminders.length >= MAX_REMINDERS) {
      setError(t("reminder.errorMaxCount", { max: MAX_REMINDERS }));
      return;
    }
    const newReminder: Reminder = {
      id: crypto.randomUUID(),
      minutesBefore,
      method,
      ...(extra?.triggerTime && { triggerTime: extra.triggerTime }),
      ...(extra?.dayOffset != null && { dayOffset: extra.dayOffset }),
    };
    onChange([...reminders, newReminder]);
    setShowPanel(false);
    setCustomValue("");
    setAlldayCount("1");
    setAlldayTime("09:00");
    setError("");
  };

  const removeReminder = (id: string) => {
    onChange(reminders.filter((r) => r.id !== id));
  };

  const toggleMethod = (id: string) => {
    onChange(
      reminders.map((r) =>
        r.id === id ? { ...r, method: r.method === "push" ? "email" : "push" } : r
      ),
    );
  };

  const handleCustomSubmit = () => {
    const value = parseInt(customValue, 10);
    if (value <= 0) {
      setError(t("reminder.errorInvalid"));
      return;
    }
    const minutes = value * customUnit;
    if (minutes > 43200) {
      setError(t("reminder.errorMaxDays"));
      return;
    }
    addReminder(minutes);
  };

  const handleAlldaySubmit = () => {
    const count = parseInt(alldayCount, 10);
    if (count < 0 || !alldayTime) {
      setError(t("reminder.errorInvalid"));
      return;
    }
    const dayOffset = alldayUnit === "week" ? count * 7 : count;
    if (dayOffset > 30) {
      setError(t("reminder.errorMaxDays"));
      return;
    }
    // minutesBefore is not meaningful for all-day events with explicit time;
    // set to 0 as placeholder. OneSignal service uses dayOffset + triggerTime.
    addReminder(0, "push", { triggerTime: alldayTime, dayOffset });
  };

  const formatAlldayReminder = (reminder: Reminder): string => {
    const time = reminder.triggerTime ?? decomposeAllDayReminder(reminder.minutesBefore).time;
    const days = reminder.dayOffset ?? decomposeAllDayReminder(reminder.minutesBefore).days;
    if (days === 0) {
      return t("reminder.sameDayAt", { time });
    }
    if (days >= 7 && days % 7 === 0) {
      return t("reminder.timeWeekAt", { weeks: days / 7, time });
    }
    return t("reminder.timeDayAt", { days, time });
  };

  return (
    <div className="space-y-2">
      {reminders.map((reminder) => (
        <div
          key={reminder.id}
          className="flex items-center gap-2 rounded-xl border border-black/8 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#202020]"
        >
          <Bell className="h-4 w-4 text-[#6d6770] dark:text-[#a3a3a3]" />
          <span className="flex-1 text-sm text-[#25242a] dark:text-[#f5f5f5]">
            {isAllDay
              ? formatAlldayReminder(reminder)
              : t("reminder.timeBefore", { time: formatMinutes(reminder.minutesBefore, t) })}
          </span>
          <button
            type="button"
            onClick={() => toggleMethod(reminder.id)}
            className="flex h-7 items-center gap-1 rounded-full border border-black/8 px-2 text-xs transition-colors hover:bg-black/4 dark:border-white/10 dark:hover:bg-white/8 cursor-pointer"
          >
            {reminder.method === "push" ? (
              <Bell className="h-3 w-3" />
            ) : (
              <Mail className="h-3 w-3" />
            )}
            <span className="text-[#6d6770] dark:text-[#a3a3a3]">
              {reminder.method === "push" ? t("reminder.methodPush") : t("reminder.methodEmail")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => removeReminder(reminder.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-red-100 dark:hover:bg-red-900/20 cursor-pointer"
          >
            <X className="h-4 w-4 text-red-500" />
          </button>
        </div>
      ))}

      {showPanel ? (
        <div className="rounded-xl border border-black/8 bg-white p-3 dark:border-white/10 dark:bg-[#202020]">
          {isAllDay ? (
            /* All-day event: simple direct input */
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold tracking-[0.1em] text-[#9f99a3] uppercase mb-1.5">
                    {t("reminder.count")}
                  </p>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={alldayCount}
                    onChange={(e) => {
                      setAlldayCount(e.target.value);
                      setError("");
                    }}
                    className="h-9 rounded-xl text-sm text-center"
                    onKeyDown={(e) => e.key === "Enter" && handleAlldaySubmit()}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold tracking-[0.1em] text-[#9f99a3] uppercase mb-1.5">
                    {t("reminder.unit")}
                  </p>
                  <div className="flex gap-1">
                    {(["day", "week"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setAlldayUnit(u)}
                        className={`flex-1 rounded-lg px-2 py-2 text-sm transition-colors cursor-pointer ${
                          alldayUnit === u
                            ? "bg-[#25242a] text-white dark:bg-[#f5f5f5] dark:text-[#111111]"
                            : "text-[#6d6770] hover:bg-black/4 dark:text-[#a3a3a3] dark:hover:bg-white/8"
                        }`}
                      >
                        {u === "day" ? t("reminder.unitDay") : t("reminder.unitWeek")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold tracking-[0.1em] text-[#9f99a3] uppercase mb-1.5">
                    {t("reminder.triggerTime")}
                  </p>
                  <Input
                    type="time"
                    value={alldayTime}
                    onChange={(e) => {
                      setAlldayTime(e.target.value);
                      setError("");
                    }}
                    className="h-9 rounded-xl text-sm text-center"
                    onKeyDown={(e) => e.key === "Enter" && handleAlldaySubmit()}
                  />
                </div>
              </div>
              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
              <Button
                size="sm"
                onClick={handleAlldaySubmit}
                disabled={!alldayCount || !alldayTime}
                className="w-full"
              >
                {t("reminder.add")}
              </Button>
            </div>
          ) : (
            /* Timed event: presets + custom */
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold tracking-[0.1em] text-[#9f99a3] uppercase mb-2">
                  {t("reminder.preset")}
                </p>
                {PRESET_OPTIONS_TIMED.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => addReminder(option.value)}
                    className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-[#25242a] transition-colors hover:bg-black/4 dark:text-[#f5f5f5] dark:hover:bg-white/8 cursor-pointer"
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold tracking-[0.1em] text-[#9f99a3] uppercase mb-2">
                  {t("reminder.custom")}
                </p>
                <Input
                  type="number"
                  min="1"
                  value={customValue}
                  onChange={(e) => {
                    setCustomValue(e.target.value);
                    setError("");
                  }}
                  placeholder={t("reminder.enterValue")}
                  className="h-9 rounded-xl text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                />
                <div className="flex gap-1">
                  {CUSTOM_UNITS.map((unit) => (
                    <button
                      key={unit.labelKey}
                      type="button"
                      onClick={() => {
                        setCustomUnit(unit.multiplier);
                        setError("");
                      }}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                        customUnit === unit.multiplier
                          ? "bg-[#25242a] text-white dark:bg-[#f5f5f5] dark:text-[#111111]"
                          : "text-[#6d6770] hover:bg-black/4 dark:text-[#a3a3a3] dark:hover:bg-white/8"
                      }`}
                    >
                      {t(unit.labelKey)}
                    </button>
                  ))}
                </div>
                {error && (
                  <p className="text-xs text-red-500">{error}</p>
                )}
                <Button
                  size="sm"
                  onClick={handleCustomSubmit}
                  disabled={!customValue}
                  className="w-full"
                >
                  {t("reminder.add")}
                </Button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowPanel(false)}
            className="mt-3 w-full text-center text-xs text-[#6d6770] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5] cursor-pointer"
          >
            {t("reminder.cancel")}
          </button>
        </div>
      ) : reminders.length < MAX_REMINDERS ? (
        <button
          type="button"
          onClick={() => setShowPanel(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed border-black/15 px-3 py-2 text-sm text-[#6d6770] transition-colors hover:border-black/25 hover:text-[#25242a] dark:border-white/15 dark:text-[#a3a3a3] dark:hover:border-white/25 dark:hover:text-[#f5f5f5] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          {t("reminder.addReminder")}
        </button>
      ) : (
        <p className="text-xs text-[#9f99a3] text-center">
          {t("reminder.maxReached", { max: MAX_REMINDERS })}
        </p>
      )}
    </div>
  );
}
