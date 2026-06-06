"use client";

import { Tag } from "lucide-react";
import type { FocusSession } from "@/lib/types/focus-page";
import { getTagStats, UNTAGGED_KEY } from "@/lib/focus-stats-utils";
import { formatMinutes } from "@/lib/focus-page-utils";
import { useI18n } from "@/lib/i18n";

export function TagStats({ sessions }: { sessions: FocusSession[] }) {
  const { t } = useI18n();
  const tagStats = getTagStats(sessions);

  if (tagStats.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-[#7d7880] dark:text-[#a9a4ae]">
        {t("focus.noSessionsToday")}
      </div>
    );
  }

  const maxMinutes = Math.max(...tagStats.map((t) => t.minutes), 1);

  return (
    <div className="space-y-2">
      {tagStats.map(({ tag, minutes, count }) => {
        const width = (minutes / maxMinutes) * 100;
        const displayTag = tag === UNTAGGED_KEY ? t("focus.untagged") as string : tag;
        return (
          <div key={tag} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Tag className="h-3 w-3 text-[#7d7880] dark:text-[#a9a4ae] shrink-0" />
                <span className="text-sm text-[#25242a] dark:text-[#e8e6ea] truncate">{displayTag}</span>
                <span className="text-xs text-[#8c8691] dark:text-[#a09ba5]">{count}x</span>
              </div>
              <span className="text-sm font-medium text-[#25242a] dark:text-[#e8e6ea] tabular-nums">
                {formatMinutes(minutes)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#25242a]/70 dark:bg-[#e8e6ea]/60 transition-all duration-300"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
