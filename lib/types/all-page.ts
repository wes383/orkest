import type { Item, ItemStatus, Priority, Reminder, OccurrenceNotification } from "./item";
export type { Reminder, OccurrenceNotification } from "./item";

export type ViewMode = "timeline" | "list" | "calendar" | "kanban";

export type KanbanColumnId = "backlog" | "today" | "done";

export type KanbanColumn = {
  id: KanbanColumnId;
  titleKey: string;
  items: DisplayItem[];
  count: number;
  isCollapsible: boolean;
};

export type BuildKanbanOptions = {
  doneLookbackDays?: number;
  enabledColumns?: KanbanColumnId[];
  sortConfig?: ListSortConfig;
};

export type ManualItemRecord = {
  id: string;
  uid: string;
  title: string;
  description?: string;
  hasTime: boolean;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  allDay: boolean;
  dueDate?: string;
  timezone?: string;
  recurrenceType: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceInterval: number;
  daysOfWeek: number[];
  recurrenceEndType: "never" | "on_date" | "after_count";
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  recurrenceBysetpos?: number;
  priority?: Priority;
  estimateMinutes?: number;
  actualMinutes?: number;
  focusSessions?: number;
  tags?: string[];
  rrule?: string;
  exdates?: string[];
  completedOccurrences?: string[];
  reopenedOccurrences?: string[];
  deferredUntil?: string;
  dismissedTodayDates?: string[];
  plannedTodayDates?: string[];
  nowOverrideDate?: string;
  status?: ItemStatus;
  deletedAt?: string;
  parentId?: string;
  projectId?: string;
  completedOccurrenceKeys?: string[];
  googleEventId?: string;
  reminders?: Reminder[];
  createdAt: string;
  updatedAt: string;
};

export type DisplayItem = Item & {
  isRecurringInstance?: boolean;
  occurrenceDate?: Date;
  occurrenceKey?: string;
  seriesSource?: Item;
};

export type AiTargetItem = {
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
  recurrenceType?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceInterval?: string;
  daysOfWeek?: number[];
  recurrenceEndType?: "never" | "on_date";
  recurrenceEndDate?: string;
  priority?: Priority;
  estimateMinutes?: string;
  tags?: string[];
  projectId?: string;
  projectName?: string;
  status?: ItemStatus;
};

export type SubtaskFormItem = {
  id: string;
  title: string;
};

export type ItemFormState = {
  title: string;
  description: string;
  hasTime: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  hasDueDate: boolean;
  dueDate: string;
  timezone: string;
  recurrenceType: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceInterval: string;
  daysOfWeek: boolean[];
  recurrenceEndType: "never" | "on_date" | "after_count";
  recurrenceEndDate: string;
  recurrenceCount: string;
  monthlyPattern: "day_of_month" | "nth_weekday";
  nthWeekdayPosition: string;
  nthWeekdayDay: number;
  priority: Priority | undefined;
  estimateMinutes: string;
  tags: string[];
  subtasks: SubtaskFormItem[];
  projectId: string;
  projectName: string;
  status: ItemStatus | undefined;
  reminders: Reminder[];
};

export type AiMode = "create" | "update" | "query";

export type AiIntent = {
  type: AiMode;
  confidence: number;
  description: string;
  targetHint?: string;
};

export type AiResultGroup = {
  type: AiMode;
  items?: Array<{
    formState?: ItemFormState;
    targetItemId?: string;
    updateFields?: Partial<ItemFormState>;
    autoSelected?: boolean;
  }>;
  answer?: string;
};

export type DayGroup = {
  date: Date;
  items: DisplayItem[];
};

export type Section = {
  id: string;
  title: string;
  groups: DayGroup[];
};

export type SortMode = "time" | "created" | "priority";

export type SortDirection = "asc" | "desc";

export type AllDayPreference = "allDayFirst" | "timedFirst" | "none";

export type UnscheduledSort = "newest" | "oldest" | "priority";

export type PrioritySortSubField = "startTime" | "createdAt";

export type PrioritySchedulePreference = "unscheduledFirst" | "scheduledFirst";

export type ListTimeFilterPreset =
  | "none"
  | "today"
  | "tomorrow"
  | "week"
  | "month"
  | "custom";

export type ListStatusFilter = "all" | "active" | "completed";

export type TagMatchMode = "or" | "and";

export type PriorityFilterValue = Priority | "none";

export type ListSortConfig = {
  mode: SortMode;
  // Time mode
  timeDirection: SortDirection;
  allDayPreference: AllDayPreference;
  unscheduledSort: UnscheduledSort;
  // Created mode
  createdDirection: SortDirection;
  // Priority mode
  prioritySubField: PrioritySortSubField;
  prioritySubDirection: SortDirection;
  prioritySchedulePreference: PrioritySchedulePreference;
};

export type ListFilterConfig = {
  timePreset: ListTimeFilterPreset;
  customStartDate: string;
  customEndDate: string;
  status: ListStatusFilter;
  selectedTags: string[];
  tagMatchMode: TagMatchMode;
  selectedPriorities: PriorityFilterValue[];
  searchQuery: string;
};

export type CalendarRescheduleTarget = {
  date: string;
  time?: string;
};
