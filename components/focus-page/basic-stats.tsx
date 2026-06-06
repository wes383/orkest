"use client";

import type { FocusSession } from "@/lib/types/focus-page";
import {
  calcAverageSessionDuration,
  calcFocusEfficiency,
  calcLongestSession,
  calcTotalMinutes,
  getStreakDays,
} from "@/lib/focus-stats-utils";
import { formatMinutes } from "@/lib/focus-page-utils";
import { useI18n } from "@/lib/i18n";

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs}s`;
  if (secs === 0) return `${minutes}m`;
  return `${minutes}m ${secs}s`;
}

export function BasicStats({ sessions, allSessions }: { sessions: FocusSession[]; allSessions: FocusSession[] }) {
  const { t } = useI18n();
  const totalMinutes = calcTotalMinutes(sessions);
  const avgDuration = calcAverageSessionDuration(sessions);
  const efficiency = calcFocusEfficiency(sessions);
  const longest = calcLongestSession(sessions);
  const completedCount = sessions.filter((s) => s.completed).length;
  const streak = getStreakDays(allSessions);

  const items = [
    { label: t("focus.totalFocus") as string, value: formatMinutes(totalMinutes) },
    { label: t("focus.sessions") as string, value: `${completedCount}/${sessions.length}` },
    { label: t("focus.average") as string, value: formatDuration(avgDuration) },
    { label: t("focus.efficiency") as string, value: `${efficiency}%` },
    { label: t("focus.longest") as string, value: formatDuration(longest) },
    { label: t("focus.streak") as string, value: `${streak}d` },
  ];

  return (
    <div className="grid grid-cols-6 gap-2">
      {items.map(({ label, value }) => (
        <div key={label} className="text-center">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
            {label}
          </p>
          <p className="mt-1 text-lg font-semibold text-[#25242a] dark:text-[#e8e6ea] tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}
