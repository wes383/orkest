"use client";

import { Circle } from "lucide-react";

import type { AiInlineTimelineEntry } from "@/lib/ai/chat-types";
import { PRIORITY_CONFIG, getPriorityLabel } from "@/lib/all-page-utils";

type AiInlineTimelineProps = {
  entries: AiInlineTimelineEntry[];
  dateLabel?: string;
  isFullscreen?: boolean;
};

export function AiInlineTimeline({ entries, dateLabel, isFullscreen }: AiInlineTimelineProps) {
  return (
    <div className={`my-2.5 rounded-2xl border border-black/8 bg-white/80 p-4 dark:border-white/10 dark:bg-white/6 ${isFullscreen ? "max-w-2xl" : ""}`}>
      {dateLabel && (
        <p className="mb-3 text-xs font-semibold tracking-[0.15em] text-[#8c8691] uppercase dark:text-[#737373]">
          {dateLabel}
        </p>
      )}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute top-1.5 bottom-1.5 left-[10.5px] w-px bg-black/8 dark:bg-white/10" />
        <div className="space-y-3">
          {entries.map((entry, index) => {
            const priorityConfig = entry.priority ? PRIORITY_CONFIG[entry.priority] : null;
            return (
              <div key={index} className="relative flex items-start gap-3 pl-1">
                {/* Dot on timeline */}
                <span
                  className={`relative z-10 mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${
                    entry.completed
                      ? "bg-green-500 text-white"
                      : "border-2 border-black/15 bg-white dark:border-white/20 dark:bg-[#1a1a1a]"
                  }`}
                >
                  {entry.completed && (
                    <svg className="h-2 w-2" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium tabular-nums text-[#7e7982] dark:text-[#a3a3a3]">
                      {entry.time}
                      {entry.endTime ? ` - ${entry.endTime}` : ""}
                    </span>
                    {priorityConfig && (
                      <span className={`rounded-full border px-1.5 py-px text-[10px] font-semibold ${priorityConfig.color}`}>
                        {entry.priority ? getPriorityLabel(entry.priority) : ""}
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-0.5 text-sm font-medium leading-5 ${
                      entry.completed
                        ? "text-[#b0a9b2] line-through dark:text-[#737373]"
                        : "text-[#333139] dark:text-[#f5f5f5]"
                    }`}
                  >
                    {entry.title}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
