"use client";

import type { FocusSession } from "@/lib/types/focus-page";
import { getHourlyDistribution } from "@/lib/focus-stats-utils";
import { useSettingsStore } from "@/lib/stores/use-settings-store";

function formatHour(hour: number, is12h: boolean): string {
  if (is12h) {
    if (hour === 0) return "12a";
    if (hour < 12) return `${hour}a`;
    if (hour === 12) return "12p";
    return `${hour - 12}p`;
  }
  return `${String(hour).padStart(2, "0")}:00`;
}

export function HourlyDistribution({ sessions }: { sessions: FocusSession[] }) {
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const is12h = timeFormat === "12h";
  const data = getHourlyDistribution(sessions);
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
        <div className="relative flex items-end gap-px h-full">
          {data.map(({ hour, minutes }) => {
            const heightPercent = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;
            return (
              <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full">
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
      <div className="flex gap-px">
        {data.map(({ hour }) => (
          <div key={hour} className="flex-1 text-center">
            <span className="text-[8px] text-[#8c8691] dark:text-[#a09ba5] tabular-nums leading-none">
              {hour % 3 === 0 ? formatHour(hour, is12h) : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
