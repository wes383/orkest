"use client";

import { useMemo, useState } from "react";
import type { FocusSession } from "@/lib/types/focus-page";
import { useI18n } from "@/lib/i18n";
import { getWeekStartDate } from "@/lib/all-page-utils";
import { getDateLocale, useSettingsStore } from "@/lib/stores/use-settings-store";
import { getBrowserTimezone } from "@/lib/timezone";

interface DayCell {
  date: string;
  label: string;
  minutes: number;
  monthLabel?: string;
}

interface WeekColumn {
  days: DayCell[];
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getFormatTz(): string | undefined {
  return getBrowserTimezone() || undefined;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(getDateLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: getFormatTz(),
  }).format(date);
}

function getHeatmapData(sessions: FocusSession[]): WeekColumn[] {
  if (sessions.length === 0) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateMinutesMap = new Map<string, number>();
  for (const session of sessions) {
    const dateKey = getDateKey(new Date(session.startedAt));
    const minutes = Math.floor(session.durationSeconds / 60);
    dateMinutesMap.set(dateKey, (dateMinutesMap.get(dateKey) ?? 0) + minutes);
  }

  const earliestSession = sessions.reduce((earliest, s) => {
    const d = new Date(s.startedAt);
    return d < earliest ? d : earliest;
  }, new Date(sessions[0].startedAt));

  const startDate = new Date(earliestSession);
  startDate.setHours(0, 0, 0, 0);

  const calendarStart = getWeekStartDate(startDate);

  const thisWeekStart = getWeekStartDate(today);
  const calendarEnd = new Date(thisWeekStart);
  calendarEnd.setDate(thisWeekStart.getDate() + 6);

  const allDays: DayCell[] = [];
  const current = new Date(calendarStart);
  const shortMonthFormatter = new Intl.DateTimeFormat(getDateLocale(), { month: "short", timeZone: getFormatTz() });
  const startYear = calendarStart.getFullYear();
  const endYear = calendarEnd.getFullYear();
  const spansMultipleYears = startYear !== endYear;

  while (current <= calendarEnd) {
    const dateKey = getDateKey(current);
    const isFirstOfMonth = current.getDate() === 1;

    let monthLabel: string | undefined;
    if (isFirstOfMonth) {
      const label = shortMonthFormatter.format(current);
      monthLabel = spansMultipleYears ? `${label} ${current.getFullYear()}` : label;
    }

    allDays.push({
      date: dateKey,
      label: formatDate(current),
      minutes: dateMinutesMap.get(dateKey) ?? 0,
      monthLabel,
    });

    current.setDate(current.getDate() + 1);
  }

  const weeks: WeekColumn[] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    const weekDays = allDays.slice(i, i + 7);
    const firstDayWithMonthLabel = weekDays.find((d) => d.monthLabel);
    if (firstDayWithMonthLabel && firstDayWithMonthLabel !== weekDays[0]) {
      weekDays[0] = { ...weekDays[0], monthLabel: firstDayWithMonthLabel.monthLabel };
    }
    weeks.push({ days: weekDays });
  }

  return weeks;
}

function getIntensityLevel(minutes: number, maxMinutes: number): number {
  if (minutes === 0) return 0;
  if (maxMinutes === 0) return 1;
  const ratio = minutes / maxMinutes;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const INTENSITY_COLORS = [
  "bg-black/[0.06] dark:bg-white/[0.06]",
  "bg-[#25242a]/20 dark:bg-[#e8e6ea]/20",
  "bg-[#25242a]/40 dark:bg-[#e8e6ea]/35",
  "bg-[#25242a]/60 dark:bg-[#e8e6ea]/50",
  "bg-[#25242a]/85 dark:bg-[#e8e6ea]/75",
];

export function ContributionHeatmap({ sessions }: { sessions: FocusSession[] }) {
  const { t } = useI18n();
  useSettingsStore((s) => s.locale);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const weeks = useMemo(() => getHeatmapData(sessions), [sessions]);

  const startDay = useSettingsStore((s) => s.weekStartDay);
  const translatedDayKeys = ["calendar.daySun", "calendar.dayMon", "calendar.dayTue", "calendar.dayWed", "calendar.dayThu", "calendar.dayFri", "calendar.daySat"] as const;
  const orderedDayKeys = [...translatedDayKeys.slice(startDay), ...translatedDayKeys.slice(0, startDay)];
  const dayLabels = orderedDayKeys.map((key) => t(key) as string);

  const maxMinutes = useMemo(() => {
    let max = 0;
    for (const week of weeks) {
      for (const day of week.days) {
        if (day.minutes > max) max = day.minutes;
      }
    }
    return max;
  }, [weeks]);

  if (weeks.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-[#7d7880] dark:text-[#a9a4ae]">
        {t("focus.noFocusSessions")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1 pr-1">
        <div className="flex flex-col" style={{ gap: '4px', paddingTop: '20px' }}>
          {dayLabels.map((label) => (
            <div key={label} className="flex items-center justify-end" style={{ height: '12px' }}>
              <span className="text-[8px] text-[#8c8691] dark:text-[#a09ba5] w-8 text-right pr-1" style={{ lineHeight: '12px' }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex" style={{ gap: '4px', paddingTop: '20px' }}>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col relative" style={{ gap: '4px' }}>
              {week.days[0]?.monthLabel && (
                <span className="text-[8px] text-[#8c8691] dark:text-[#a09ba5] absolute whitespace-nowrap" style={{ top: '-16px', lineHeight: '12px' }}>
                  {week.days[0].monthLabel}
                </span>
              )}
              {week.days.map((day, dayIndex) => {
                const intensity = getIntensityLevel(day.minutes, maxMinutes);
                return (
                  <div
                    key={dayIndex}
                    className={`rounded-sm ${INTENSITY_COLORS[intensity]} cursor-pointer transition-all duration-150 hover:ring-1 hover:ring-[#25242a]/40 dark:hover:ring-[#e8e6ea]/40`}
                    style={{ width: '12px', height: '12px' }}
                    onMouseEnter={(e) => {
                      setTooltip({
                        text: `${day.label}: ${day.minutes} min`,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMouseMove={(e) => {
                      setTooltip({
                        text: `${day.label}: ${day.minutes} min`,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <span className="text-[10px] text-[#8c8691] dark:text-[#a09ba5]">Less</span>
        <div className="flex gap-0.5">
          {INTENSITY_COLORS.map((color, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${color}`} />
          ))}
        </div>
        <span className="text-[10px] text-[#8c8691] dark:text-[#a09ba5]">More</span>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 rounded-md bg-[#25242a] dark:bg-[#e8e6ea] text-white dark:text-[#25242a] text-xs pointer-events-none whitespace-nowrap"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 30,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
