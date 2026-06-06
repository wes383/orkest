export type DigestTopic =
  | "task_summary"
  | "daily_quote"
  | "today_in_history"
  | "daily_book"
  | "daily_movie";

export interface TaskSummaryDigest {
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  overdueTasks: number;
  highPriorityTitles: string[];
  nextUpTitle: string | null;
  nextUpTime: string | null;
  nextUpEndTime: string | null;
  todayTaskTitles: string[];
  inProgressTasks: Array<{ title: string; startTime?: string; endTime?: string }>;
}

export interface DailyDigestContent {
  date: string;
  motivationalMessage: string | null;
  generatedAt: string;
}
