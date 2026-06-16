import type { UIMessage } from "ai";
import type { CandidateItem } from "@/lib/ai/candidate-search";
import type { ItemFormState } from "@/lib/types/all-page";
import type { Priority } from "@/lib/types/item";
import type { InferredFocusPreference } from "@/lib/ai/focus-preference-inference";
import type { AiUserMemory } from "@/lib/ai/memory";
import type { TranslationKey } from "@/lib/i18n";

type TranslateFn = (key: TranslationKey, values?: Record<string, string | number>) => string;
import { DAY_NAMES } from "@/lib/all-page-utils";
import { getTimeFormatHour12, getDateLocale } from "@/lib/stores/use-settings-store";
import type { Locale } from "@/lib/i18n/config";
import { dayjs } from "@/lib/dayjs";

// Minimal placeholder form state used for preview items that don't represent
// a real task (e.g. delete_project). The shape mirrors ItemFormState so the
// type stays consistent across preview kinds.
const EMPTY_FORM_PLACEHOLDER: ItemFormState = {
  title: "",
  description: "",
  hasTime: false,
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  allDay: false,
  hasDueDate: false,
  dueDate: "",
  timezone: "",
  recurrenceType: "none",
  recurrenceInterval: "1",
  daysOfWeek: [false, false, false, false, false, false, false],
  recurrenceEndType: "never",
  recurrenceEndDate: "",
  recurrenceCount: "10",
  monthlyPattern: "day_of_month",
  nthWeekdayPosition: "2",
  nthWeekdayDay: 2,
  priority: undefined,
  estimateMinutes: "",
  tags: [],
  subtasks: [],
  projectId: "",
  projectName: "",
  progressIds: [],
  status: undefined,
  reminders: [],
};

export type AiChatItemContext = {
  id: string;
  title: string;
  description?: string;
  hasTime?: boolean;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  allDay?: boolean;
  hasDueDate?: boolean;
  dueDate?: string;
  timezone?: string;
  recurrenceType?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceInterval?: string;
  daysOfWeek?: Array<boolean | number>;
  recurrenceEndType?: "never" | "on_date" | "after_count";
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  recurrenceBysetpos?: number;
  rrule?: string;
  exdates?: string[];
  completedOccurrences?: string[];
  reopenedOccurrences?: string[];
  priority?: Priority;
  estimateMinutes?: string;
  tags?: string[];
  subtasks?: string[];
  reminders?: Array<{
    minutesBefore: number;
    method: "push" | "email";
    triggerTime?: string;
    dayOffset?: number;
  }>;
  projectId?: string;
  projectName?: string;
  status?: "active" | "in_progress" | "completed" | "cancelled" | "skipped";
  createdAt?: string;
  updatedAt?: string;
};

export type AiChatProjectContext = {
  id: string;
  name: string;
  color?: string;
};

export type AiChatProgressContext = {
  id: string;
  name: string;
  goalValue: number;
  goalUnit: string;
  trackingMode: "count" | "percentage" | "manual";
  manualValue: number;
  status: "active" | "completed" | "archived";
  color?: string;
};

export type AiPageContext = "all" | "today" | "focus" | "projects" | "progress";

export type AiChatContext = {
  items: AiChatItemContext[];
  selectedItems: AiChatItemContext[];
  projects: AiChatProjectContext[];
  progresses?: AiChatProgressContext[];
  progressLinks?: Array<{ progressId: string; itemId: string }>;
  today: string; // YYYY-MM-DD in user's local timezone
  currentTime: string; // HH:mm in user's local timezone
  timezone: string; // IANA timezone identifier, e.g. "Asia/Shanghai"
  sleepStart: string; // HH:mm, default "23:00"
  sleepEnd: string; // HH:mm, default "06:00"
  bufferMinutes: number; // default 0
  focusPreference: InferredFocusPreference | null;
  pageContext?: AiPageContext;
  username?: string;
  locale?: Locale;
  language?: string;
  memories?: AiUserMemory[]; // injected server-side, not sent by client
  focusSessions?: Array<{
    itemId?: string;
    taskTitle?: string;
    startedAt: Date;
    durationSeconds: number;
    tags?: string[];
  }>;
  preferredTool?: string; // user explicitly requested a tool via /toolName prefix
  weekStartDay?: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
};

export type AiActionConflict = {
  itemId: string;
  title: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
};

export type AiActionScheduleSuggestion = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

export type AiProposedAction =
  | {
      id: string;
      type: "create_item";
      title: string;
      formState: ItemFormState;
      reason?: string;
      conflicts?: AiActionConflict[];
      suggestions?: AiActionScheduleSuggestion[];
    }
  | {
      id: string;
      type: "update_item";
      title: string;
      targetItemId: string;
      patch: Partial<ItemFormState>;
      before: ItemFormState;
      after: ItemFormState;
      reason?: string;
      conflicts?: AiActionConflict[];
      suggestions?: AiActionScheduleSuggestion[];
    }
  | {
      id: string;
      type: "delete_item";
      title: string;
      targetItemId: string;
      before: ItemFormState;
      reason?: string;
    }
  | {
      id: string;
      type: "batch_update";
      title: string;
      updates: Array<{
        targetItemId: string;
        patch: Partial<ItemFormState>;
        before: ItemFormState;
        after: ItemFormState;
        conflicts?: AiActionConflict[];
        suggestions?: AiActionScheduleSuggestion[];
      }>;
      reason?: string;
    }
  | {
      id: string;
      type: "schedule_items";
      title: string;
      updates: Array<{
        targetItemId: string;
        before: ItemFormState;
        after: ItemFormState;
        conflicts?: AiActionConflict[];
        suggestions?: AiActionScheduleSuggestion[];
      }>;
      reason?: string;
    }
  | {
      id: string;
      type: "decompose_task";
      title: string;
      targetItemId: string;
      before: ItemFormState;
      after: ItemFormState;
      childItems?: ItemFormState[];
      reason?: string;
    }
  | {
      id: string;
      type: "delete_project";
      title: string;
      projectId: string;
      projectName: string;
      /** Number of tasks that would be unlinked as a result of this deletion. */
      unlinkedTaskCount: number;
      reason?: string;
    }
  | {
      id: string;
      type: "create_progress";
      title: string;
      progressId?: string;
      name: string;
      description?: string;
      goalValue: number;
      goalUnit: string;
      trackingMode: "count" | "percentage" | "manual";
      color?: string;
      reason?: string;
    }
  | {
      id: string;
      type: "update_progress";
      title: string;
      progressId: string;
      beforeName: string;
      patch: {
        name?: string;
        description?: string;
        goalValue?: number;
        goalUnit?: string;
        trackingMode?: "count" | "percentage" | "manual";
        color?: string;
      };
      reason?: string;
    }
  | {
      id: string;
      type: "delete_progress";
      title: string;
      progressId: string;
      progressName: string;
      /** Number of task links that would be removed as a result. */
      unlinkedTaskCount: number;
      reason?: string;
    }
  | {
      id: string;
      type: "bind_progress_tasks";
      title: string;
      progressId: string;
      progressName: string;
      itemIds: string[];
      itemTitles: string[];
      reason?: string;
    }
  | {
      id: string;
      type: "unbind_progress_tasks";
      title: string;
      progressId: string;
      progressName: string;
      itemIds: string[];
      itemTitles: string[];
      reason?: string;
    }
  | {
      id: string;
      type: "set_manual_value";
      title: string;
      progressId: string;
      progressName: string;
      value: number;
      reason?: string;
    }
  | {
      id: string;
      type: "generate_progress_tasks";
      title: string;
      progressId: string;
      progressName: string;
      tasks: Array<{ title: string; description?: string }>;
      reason?: string;
    };

export type AiToolResult = {
  message: string;
  proposedActions?: AiProposedAction[];
  items?: AiChatItemContext[];
  conflicts?: AiActionConflict[];
  suggestions?: AiActionScheduleSuggestion[];
  briefing?: Record<string, unknown>;
  review?: Record<string, unknown>;
};

export type OrkestAIMessage = UIMessage<
  never,
  {
    proposedActions: AiProposedAction[];
  }
> & {
  targetItems?: CandidateItem[];
  toolName?: string;
};

export type AiBatchPreviewItem = {
  id: string;
  kind:
    | "create"
    | "update"
    | "delete"
    | "delete_project"
    | "create_progress"
    | "update_progress"
    | "delete_progress"
    | "bind_progress_tasks"
    | "unbind_progress_tasks"
    | "set_manual_value"
    | "generate_progress_tasks";
  selected: boolean;
  formState: ItemFormState;
  targetItemId?: string;
  /** For delete_project: the project ID to remove. */
  projectId?: string;
  /** For delete_project: the project name, for display. */
  projectName?: string;
  /** For delete_project: number of tasks that will be unlinked. */
  unlinkedTaskCount?: number;
  /** For progress actions: the progress ID. */
  progressId?: string;
  /** For progress actions: the progress name, for display. */
  progressName?: string;
  /** For create_progress: goal value. */
  progressGoalValue?: number;
  /** For create_progress: goal unit. */
  progressGoalUnit?: string;
  /** For create_progress: tracking mode. */
  progressTrackingMode?: "count" | "percentage" | "manual";
  /** For create_progress: optional color. */
  progressColor?: string;
  /** For create_progress: optional description. */
  progressDescription?: string;
  /** For update_progress: fields to patch. */
  progressPatch?: {
    name?: string;
    description?: string;
    goalValue?: number;
    goalUnit?: string;
    trackingMode?: "count" | "percentage" | "manual";
    color?: string;
  };
  /** For bind/unbind: item IDs. */
  progressItemIds?: string[];
  /** For bind/unbind: item titles. */
  progressItemTitles?: string[];
  /** For set_manual_value: the new value. */
  progressManualValue?: number;
  /** For generate_progress_tasks: generated tasks to create and bind. */
  progressGeneratedTasks?: Array<{ title: string; description?: string }>;
  originalForm?: ItemFormState | null;
  autoSelected?: boolean;
  reason?: string;
  conflicts?: AiActionConflict[];
  suggestions?: AiActionScheduleSuggestion[];
};

export type SuspendedAiReviewState = {
  aiTargetItems: import("@/lib/ai/candidate-search").CandidateItem[];
  aiBatchPreview: AiBatchPreviewItem[];
  aiAnswer: string | null;
  aiError: string | null;
};

function getTz(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
}

function getReviewDateFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getDateLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: getTz(),
  });
}

function getReviewDateFormatterNoYear(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getDateLocale(), {
    month: "short",
    day: "numeric",
    timeZone: getTz(),
  });
}

function getReviewTimeFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: getTimeFormatHour12(),
    timeZone: getTz(),
  });
}

export function formatReviewDate(date: string) {
  if (!date) return null;

  const tz = getTz();
  const d = tz
    ? dayjs.tz(`${date}T00:00:00`, tz).toDate()
    : new Date(Number(date.split("-")[0]), Number(date.split("-")[1]) - 1, Number(date.split("-")[2]));
  const currentYear = tz ? dayjs().tz(tz).year() : new Date().getFullYear();

  if (d.getFullYear() === currentYear) {
    return getReviewDateFormatterNoYear().format(d);
  }
  return getReviewDateFormatter().format(d);
}

export function formatReviewTime(time: string) {
  if (!time) return null;

  const [hours, minutes] = time.split(":").map(Number);
  const tz = getTz();
  const value = tz
    ? dayjs.tz(`2000-01-01T${time}:00`, tz).toDate()
    : (() => { const d = new Date(); d.setHours(hours, minutes, 0, 0); return d; })();
  return getReviewTimeFormatter().format(value);
}

export function buildScheduleSummary(form: ItemFormState) {
  if (!form.hasTime || !form.startDate) {
    return null;
  }

  const startDate = formatReviewDate(form.startDate);
  const endDate = formatReviewDate(form.endDate);

  if (form.allDay) {
    return endDate && endDate !== startDate
      ? `${startDate} to ${endDate} · All day`
      : `${startDate} · All day`;
  }

  const startTime = formatReviewTime(form.startTime);
  const endTime = formatReviewTime(form.endTime);
  const endPart = endDate
    ? endTime
      ? `${endDate} ${endTime}`
      : endDate
    : endTime;

  return [startDate, startTime, endPart ? `to ${endPart}` : null]
    .filter(Boolean)
    .join(" ");
}

export function buildRecurrenceSummary(form: ItemFormState, t?: TranslateFn) {
  if (form.recurrenceType === "none") {
    return null;
  }

  const interval = form.recurrenceInterval || "1";
  const endLabel =
    form.recurrenceEndType === "after_count" && form.recurrenceCount
      ? ` ${t ? t("recurrence.countTimes", { count: Number(form.recurrenceCount) }) : `for ${form.recurrenceCount} times`}`
      : form.recurrenceEndType === "on_date" && form.recurrenceEndDate
        ? ` ${t ? t("recurrence.until", { date: formatReviewDate(form.recurrenceEndDate) ?? form.recurrenceEndDate }) : `until ${formatReviewDate(form.recurrenceEndDate)}`}`
        : "";

  const DAY_NAME_KEYS = ["calendar.daySun", "calendar.dayMon", "calendar.dayTue", "calendar.dayWed", "calendar.dayThu", "calendar.dayFri", "calendar.daySat"] as const;

  if (form.recurrenceType === "daily") {
    const base = t
      ? (interval === "1" ? t("recurrence.daily") : t("recurrence.dailyInterval", { interval: Number(interval) }))
      : (interval === "1" ? "Daily" : `Every ${interval} days`);
    return `${base}${endLabel}`;
  }

  if (form.recurrenceType === "weekly") {
    const selectedDays = form.daysOfWeek
      .map((selected, index) => {
        if (!selected) return null;
        return t ? t(DAY_NAME_KEYS[index]) : DAY_NAMES[index];
      })
      .filter(Boolean)
      .join(", ");

    if (t) {
      const key = interval === "1" ? "recurrence.weeklyOn" : "recurrence.weeklyOnInterval";
      return t(key, { days: selectedDays, interval: Number(interval) }) + endLabel;
    }
    const base = interval === "1"
      ? `Weekly${selectedDays ? ` on ${selectedDays}` : ""}`
      : `Every ${interval} weeks${selectedDays ? ` on ${selectedDays}` : ""}`;
    return `${base}${endLabel}`;
  }

  if (form.recurrenceType === "monthly") {
    if (form.monthlyPattern === "nth_weekday") {
      const dayName = t
        ? t(DAY_NAME_KEYS[form.nthWeekdayDay ?? 2])
        : (DAY_NAMES[form.nthWeekdayDay ?? 2] ?? "");
      if (form.nthWeekdayPosition === "-1") {
        if (t) {
          const key = interval === "1" ? "recurrence.monthlyOnLast" : "recurrence.monthlyOnLastInterval";
          return t(key, { day: dayName, interval: Number(interval) }) + endLabel;
        }
        const base = interval === "1"
          ? `Monthly on the last ${dayName}`
          : `Every ${interval} months on the last ${dayName}`;
        return `${base}${endLabel}`;
      }
      const posKeys: Record<string, "recurrence.pos.1st" | "recurrence.pos.2nd" | "recurrence.pos.3rd" | "recurrence.pos.4th" | "recurrence.pos.5th"> = {
        "1": "recurrence.pos.1st", "2": "recurrence.pos.2nd", "3": "recurrence.pos.3rd", "4": "recurrence.pos.4th", "5": "recurrence.pos.5th",
      };
      const posLabels: Record<string, string> = {
        "1": "1st", "2": "2nd", "3": "3rd", "4": "4th", "5": "5th",
      };
      const posLabel = t
        ? t(posKeys[form.nthWeekdayPosition ?? "1"] ?? "recurrence.pos.1st")
        : (posLabels[form.nthWeekdayPosition ?? "1"] ?? `${form.nthWeekdayPosition}th`);
      if (t) {
        const key = interval === "1" ? "recurrence.monthlyOnNth" : "recurrence.monthlyOnNthInterval";
        return t(key, { position: posLabel, day: dayName, interval: Number(interval) }) + endLabel;
      }
      const base = interval === "1"
        ? `Monthly on the ${posLabel} ${dayName}`
        : `Every ${interval} months on the ${posLabel} ${dayName}`;
      return `${base}${endLabel}`;
    }
    if (t) {
      const key = interval === "1" ? "recurrence.monthly" : "recurrence.monthlyInterval";
      return t(key, { interval: Number(interval) }) + endLabel;
    }
    const base = interval === "1" ? "Monthly" : `Every ${interval} months`;
    return `${base}${endLabel}`;
  }

  if (form.recurrenceType === "yearly") {
    if (t) {
      const key = interval === "1" ? "recurrence.yearly" : "recurrence.yearlyInterval";
      return t(key, { interval: Number(interval) }) + endLabel;
    }
    const base = interval === "1" ? "Yearly" : `Every ${interval} years`;
    return `${base}${endLabel}`;
  }

  return null;
}

export function buildOriginalSummary(form: ItemFormState, t?: TranslateFn) {
  const parts: string[] = [];

  if (form.priority) {
    if (t) {
      parts.push(t(`priority.${form.priority}` as "priority.low"));
    } else {
      const priorityLabels: Record<string, string> = {
        low: "Low",
        medium: "Medium",
        high: "High",
        urgent: "Urgent",
      };
      parts.push(priorityLabels[form.priority] || form.priority);
    }
  }

  if (form.hasDueDate && form.dueDate) {
    parts.push(`Due ${formatReviewDate(form.dueDate)}`);
  }

  if (form.recurrenceType !== "none") {
    const summary = buildRecurrenceSummary(form, t);
    if (summary) {
      parts.push(summary);
    }
  }

  if (form.reminders && form.reminders.length > 0) {
    const count = form.reminders.length;
    parts.push(t ? t("reminder.heading") + ` (${count})` : `Reminder (${count})`);
  }

  return parts.length > 0 ? parts.join(" · ") : "";
}

export function buildOriginalSchedule(form: ItemFormState): string | null {
  if (!form.hasTime || !form.startDate) {
    return null;
  }

  const startDate = formatReviewDate(form.startDate);
  const endDate = formatReviewDate(form.endDate);

  if (form.allDay) {
    return endDate && endDate !== startDate
      ? `${startDate} to ${endDate} · All day`
      : `${startDate} · All day`;
  }

  const startTime = formatReviewTime(form.startTime);
  const endTime = formatReviewTime(form.endTime);
  const endPart = endDate
    ? endTime
      ? `${endDate} ${endTime}`
      : endDate
    : endTime;

  return [startDate, startTime, endPart ? `to ${endPart}` : null]
    .filter(Boolean)
    .join(" ");
}

export function getMessageText(message: OrkestAIMessage) {
  return (message.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("");
}

export type AiInlineScheduleItem = {
  title: string;
  description?: string;
  hasTime?: boolean;
  startTime?: string;
  endTime?: string;
  startDate?: string;
  endDate?: string;
  allDay?: boolean;
  hasDueDate?: boolean;
  dueDate?: string;
  priority?: Priority;
  tags?: string[];
  projectId?: string;
  projectName?: string;
  estimateMinutes?: number;
  recurrenceType?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceInterval?: number;
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  recurrenceBysetpos?: number;
  daysOfWeek?: number[];
  subtasks?: string[];
  reminders?: Array<{
    minutesBefore: number;
    method: "push" | "email";
    triggerTime?: string;
    dayOffset?: number;
  }>;
  completed?: boolean;
};

export type AiInlineTimelineEntry = {
  time: string;
  title: string;
  endTime?: string;
  completed?: boolean;
  priority?: Priority;
};

export function isAiToolResult(value: unknown): value is AiToolResult {
  return Boolean(value && typeof value === "object" && "message" in value);
}

export function getLatestProposedActions(messages: OrkestAIMessage[]) {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return [];

  const actions: AiProposedAction[] = [];
  for (const part of lastAssistant.parts ?? []) {
    if (!part.type.startsWith("tool-")) continue;
    if (!("state" in part) || part.state !== "output-available") continue;
    const output = "output" in part ? part.output : undefined;
    if (isAiToolResult(output) && output.proposedActions?.length) {
      actions.push(...output.proposedActions);
    }
  }
  return actions;
}

export function convertProposedActionsToBatchPreview(actions: AiProposedAction[]): AiBatchPreviewItem[] {
  const nextBatch: AiBatchPreviewItem[] = [];

  for (const action of actions) {
    if (action.type === "create_item") {
      nextBatch.push({
        id: action.id,
        kind: "create",
        selected: true,
        formState: action.formState,
        reason: action.reason,
        conflicts: action.conflicts,
        suggestions: action.suggestions,
      });
    } else if (action.type === "update_item") {
      nextBatch.push({
        id: action.id,
        kind: "update",
        selected: true,
        formState: action.after,
        targetItemId: action.targetItemId,
        originalForm: action.before,
        reason: action.reason,
        conflicts: action.conflicts,
        suggestions: action.suggestions,
      });
    } else if (action.type === "delete_item") {
      nextBatch.push({
        id: action.id,
        kind: "delete",
        selected: true,
        formState: action.before,
        targetItemId: action.targetItemId,
        originalForm: action.before,
        reason: action.reason,
      });
    } else if (action.type === "batch_update" || action.type === "schedule_items") {
      action.updates.forEach((update, index) => {
        nextBatch.push({
          id: `${action.id}-${index}`,
          kind: "update",
          selected: true,
          formState: update.after,
          targetItemId: update.targetItemId,
          originalForm: update.before,
          reason: action.reason,
          conflicts: update.conflicts,
          suggestions: update.suggestions,
          autoSelected: true,
        });
      });
    } else if (action.type === "decompose_task") {
      nextBatch.push({
        id: action.id,
        kind: "update",
        selected: true,
        formState: action.after,
        targetItemId: action.targetItemId,
        originalForm: action.before,
        reason: action.reason,
      });

      for (const [index, childItem] of (action.childItems ?? []).entries()) {
        nextBatch.push({
          id: `${action.id}-child-${index}`,
          kind: "create",
          selected: true,
          formState: childItem,
          reason: action.reason,
        });
      }
    } else if (action.type === "delete_project") {
      nextBatch.push({
        id: action.id,
        kind: "delete_project",
        selected: true,
        formState: EMPTY_FORM_PLACEHOLDER,
        projectId: action.projectId,
        projectName: action.projectName,
        unlinkedTaskCount: action.unlinkedTaskCount,
        reason: action.reason,
      });
    } else if (action.type === "create_progress") {
      nextBatch.push({
        id: action.id,
        kind: "create_progress",
        selected: true,
        formState: EMPTY_FORM_PLACEHOLDER,
        progressName: action.name,
        progressGoalValue: action.goalValue,
        progressGoalUnit: action.goalUnit,
        progressTrackingMode: action.trackingMode,
        progressColor: action.color,
        progressDescription: action.description,
        reason: action.reason,
      });
    } else if (action.type === "update_progress") {
      nextBatch.push({
        id: action.id,
        kind: "update_progress",
        selected: true,
        formState: EMPTY_FORM_PLACEHOLDER,
        progressId: action.progressId,
        progressName: action.beforeName,
        progressPatch: action.patch,
        reason: action.reason,
      });
    } else if (action.type === "delete_progress") {
      nextBatch.push({
        id: action.id,
        kind: "delete_progress",
        selected: true,
        formState: EMPTY_FORM_PLACEHOLDER,
        progressId: action.progressId,
        progressName: action.progressName,
        unlinkedTaskCount: action.unlinkedTaskCount,
        reason: action.reason,
      });
    } else if (action.type === "bind_progress_tasks") {
      nextBatch.push({
        id: action.id,
        kind: "bind_progress_tasks",
        selected: true,
        formState: EMPTY_FORM_PLACEHOLDER,
        progressId: action.progressId,
        progressName: action.progressName,
        progressItemIds: action.itemIds,
        progressItemTitles: action.itemTitles,
        reason: action.reason,
      });
    } else if (action.type === "unbind_progress_tasks") {
      nextBatch.push({
        id: action.id,
        kind: "unbind_progress_tasks",
        selected: true,
        formState: EMPTY_FORM_PLACEHOLDER,
        progressId: action.progressId,
        progressName: action.progressName,
        progressItemIds: action.itemIds,
        progressItemTitles: action.itemTitles,
        reason: action.reason,
      });
    } else if (action.type === "set_manual_value") {
      nextBatch.push({
        id: action.id,
        kind: "set_manual_value",
        selected: true,
        formState: EMPTY_FORM_PLACEHOLDER,
        progressId: action.progressId,
        progressName: action.progressName,
        progressManualValue: action.value,
        reason: action.reason,
      });
    } else if (action.type === "generate_progress_tasks") {
      nextBatch.push({
        id: action.id,
        kind: "generate_progress_tasks",
        selected: true,
        formState: EMPTY_FORM_PLACEHOLDER,
        progressId: action.progressId,
        progressName: action.progressName,
        progressGeneratedTasks: action.tasks,
        reason: action.reason,
      });
    }
  }

  return nextBatch;
}
