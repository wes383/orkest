"use client";

import type { FocusSession } from "@/lib/types/focus-page";
import { useI18n } from "@/lib/i18n";

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDailyData(sessions: FocusSession[], dayLabels: string[]): { date: string; label: string; minutes: number }[] {
  const result: { date: string; label: string; minutes: number }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateKey = getDateKey(date);

    const daySessions = sessions.filter((s) => getDateKey(new Date(s.startedAt)) === dateKey);
    const minutes = daySessions.reduce((sum, s) => sum + Math.floor(s.durationSeconds / 60), 0);

    result.push({
      date: dateKey,
      label: dayLabels[date.getDay()],
      minutes,
    });
  }

  return result;
}

export function DailyDistribution({ sessions }: { sessions: FocusSession[] }) {
  const { t } = useI18n();
  const dayLabels = [
    t("calendar.daySun") as string,
    t("calendar.dayMon") as string,
    t("calendar.dayTue") as string,
    t("calendar.dayWed") as string,
    t("calendar.dayThu") as string,
    t("calendar.dayFri") as string,
    t("calendar.daySat") as string,
  ];
  const data = getDailyData(sessions, dayLabels);
  const maxMinutes = Math.max(...data.map((d) => d.minutes), 1);
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="space-y-1">
      <div className="relative" style={{ height: "80px" }}>
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {ticks.map((tick) => (
            <div key={tick} className="w-full border-t border-black/6 dark:border-white/10" />
          ))}
        </div>
        <div className="relative flex items-end gap-1 h-full">
          {data.map(({ date, minutes }) => {
            const heightPercent = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;
            return (
              <div key={date} className="flex-1 flex flex-col items-center justify-end h-full">
                {minutes > 0 && (
                  <span className="text-[9px] text-[#7d7880] dark:text-[#a9a4ae] tabular-nums mb-0.5">{minutes}</span>
                )}
                <div
                  className="w-full rounded-t-sm bg-[#25242a]/80 dark:bg-[#e8e6ea]/70"
                  style={{ height: `${Math.max(heightPercent, minutes > 0 ? 8 : 0)}%`, minHeight: minutes > 0 ? "2px" : "0" }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-1">
        {data.map(({ date, label }) => (
          <div key={date} className="flex-1 text-center">
            <span className="text-[11px] text-[#8c8691] dark:text-[#a09ba5] font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
