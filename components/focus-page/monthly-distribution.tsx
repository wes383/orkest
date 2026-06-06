"use client";

import type { FocusSession } from "@/lib/types/focus-page";
import { useI18n } from "@/lib/i18n";

function getMonthlyData(sessions: FocusSession[], monthLabels: string[]): { month: string; label: string; minutes: number }[] {
  const result: { month: string; label: string; minutes: number }[] = [];
  const today = new Date();

  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = monthDate.getFullYear();
    const monthIndex = monthDate.getMonth();
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

    const monthSessions = sessions.filter((s) => {
      const d = new Date(s.startedAt);
      return d.getFullYear() === year && d.getMonth() === monthIndex;
    });
    const minutes = monthSessions.reduce((sum, s) => sum + Math.floor(s.durationSeconds / 60), 0);

    result.push({
      month: monthKey,
      label: monthLabels[monthIndex],
      minutes,
    });
  }

  return result;
}

export function MonthlyDistribution({ sessions }: { sessions: FocusSession[] }) {
  const { t } = useI18n();
  const monthLabels = [
    t("calendar.monthJan") as string,
    t("calendar.monthFeb") as string,
    t("calendar.monthMar") as string,
    t("calendar.monthApr") as string,
    t("calendar.monthMay") as string,
    t("calendar.monthJun") as string,
    t("calendar.monthJul") as string,
    t("calendar.monthAug") as string,
    t("calendar.monthSep") as string,
    t("calendar.monthOct") as string,
    t("calendar.monthNov") as string,
    t("calendar.monthDec") as string,
  ];
  const data = getMonthlyData(sessions, monthLabels);
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
          {data.map(({ month, minutes }) => {
            const heightPercent = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;
            return (
              <div key={month} className="flex-1 flex flex-col items-center justify-end h-full">
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
        {data.map(({ month, label }) => (
          <div key={month} className="flex-1 text-center">
            <span className="text-[9px] text-[#8c8691] dark:text-[#a09ba5] tabular-nums leading-none">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
