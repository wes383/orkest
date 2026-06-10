"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AiInlineItemCard } from "@/components/ai/ai-inline-item-card";
import { AiInlineTimeline } from "@/components/ai/ai-inline-timeline";
import { AiDailyBriefingCard, type AiDailyBriefingData } from "@/components/ai/ai-daily-briefing-card";
import { AiWeeklyReviewCard, type AiWeeklyReviewData } from "@/components/ai/ai-weekly-review-card";
import type { AiInlineScheduleItem, AiInlineTimelineEntry } from "@/lib/ai/chat-types";

function parseScheduleCard(content: string): AiInlineScheduleItem | null {
  try {
    const data = JSON.parse(content);
    if (!data.title) return null;
    return {
      title: data.title,
      description: data.description,
      hasTime: data.hasTime,
      startTime: data.startTime,
      endTime: data.endTime,
      startDate: data.startDate,
      endDate: data.endDate,
      allDay: data.allDay,
      hasDueDate: data.hasDueDate,
      dueDate: data.dueDate,
      priority: data.priority,
      tags: data.tags,
      estimateMinutes: data.estimateMinutes,
      recurrenceType: data.recurrenceType,
      recurrenceInterval: data.recurrenceInterval,
      recurrenceEndDate: data.recurrenceEndDate,
      recurrenceCount: data.recurrenceCount,
      recurrenceBysetpos: data.recurrenceBysetpos,
      daysOfWeek: data.daysOfWeek,
      subtasks: data.subtasks,
      reminders: data.reminders,
      completed: data.completed,
    };
  } catch {
    return null;
  }
}

function parseTimeline(content: string): { dateLabel?: string; entries: AiInlineTimelineEntry[] } | null {
  try {
    const data = JSON.parse(content);
    if (!Array.isArray(data.entries)) return null;
    return {
      dateLabel: data.dateLabel,
      entries: data.entries.map((e: Record<string, unknown>) => ({
        time: e.time ?? "",
        title: e.title ?? "",
        endTime: e.endTime,
        completed: e.completed,
        priority: e.priority,
      })),
    };
  } catch {
    return null;
  }
}

function parseDailyBriefing(content: string): AiDailyBriefingData | null {
  try {
    const data = JSON.parse(content);
    if (!data.date || typeof data.totalTasks !== "number") return null;
    return {
      date: data.date,
      totalTasks: data.totalTasks,
      completedTasks: data.completedTasks ?? 0,
      remainingTasks: data.remainingTasks ?? 0,
      allDayEvents: Array.isArray(data.allDayEvents) ? data.allDayEvents : [],
      totalEstimatedMinutes: data.totalEstimatedMinutes ?? 0,
      topPriorities: Array.isArray(data.topPriorities) ? data.topPriorities : [],
      conflicts: Array.isArray(data.conflicts) ? data.conflicts : [],
    };
  } catch {
    return null;
  }
}

function parseWeeklyReview(content: string): AiWeeklyReviewData | null {
  try {
    const data = JSON.parse(content);
    if (!data.weekStart || !data.weekEnd) return null;
    return {
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      taskStats: data.taskStats ?? { total: 0, completed: 0, completedMinutes: 0 },
      focusStats: data.focusStats ?? { totalMinutes: 0, sessionCount: 0, averageMinutes: 0, longestMinutes: 0 },
      comparison: data.comparison ?? { currentWeek: 0, previousWeek: 0, change: 0, trend: "same" },
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      projectStats: Array.isArray(data.projectStats) ? data.projectStats : undefined,
    };
  } catch {
    return null;
  }
}

export function MarkdownText({ children, isFullscreen }: { children: string; isFullscreen?: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-semibold mt-3 mb-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-semibold mt-3 mb-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
        ),
        p: ({ children }) => <p className="mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code
                className="rounded bg-black/5 px-1 py-0.5 text-[13px] dark:bg-white/10"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => {
          // Check if this is a custom code block (schedule-card or timeline)
          const child = React.Children.toArray(children)[0];
          if (React.isValidElement(child) && child.props) {
            const childProps = child.props as { className?: string; children?: React.ReactNode };
            const lang = childProps.className?.replace("language-", "") ?? "";
            const rawContent = typeof childProps.children === "string" ? childProps.children : "";

            if (lang === "schedule-card") {
              const item = parseScheduleCard(rawContent);
              if (item) return <AiInlineItemCard item={item} isFullscreen={isFullscreen} />;
            }

            if (lang === "timeline") {
              const timeline = parseTimeline(rawContent);
              if (timeline) return <AiInlineTimeline entries={timeline.entries} dateLabel={timeline.dateLabel} isFullscreen={isFullscreen} />;
            }

            if (lang === "daily-briefing") {
              const briefing = parseDailyBriefing(rawContent);
              if (briefing) return <AiDailyBriefingCard data={briefing} isFullscreen={isFullscreen} />;
            }

            if (lang === "weekly-review") {
              const review = parseWeeklyReview(rawContent);
              if (review) return <AiWeeklyReviewCard data={review} isFullscreen={isFullscreen} />;
            }
          }

          return (
            <pre className="my-1.5 overflow-x-auto rounded-lg bg-black/5 p-2.5 text-[13px] dark:bg-white/10">
              {children}
            </pre>
          );
        },
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        hr: () => <hr className="my-2 border-black/8 dark:border-white/10" />,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b-2 border-black/10 dark:border-white/15">{children}</thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-b border-black/6 last:border-0 dark:border-white/10">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold text-[#25242a] dark:text-[#f5f5f5]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-[#3c3841] dark:text-[#d4d4d4]">{children}</td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
