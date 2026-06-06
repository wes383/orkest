import type { DisplayItem } from "./all-page";

export interface TodaySummary {
  totalToday: number;
  completedToday: number;
  remainingToday: number;
  overdueCount: number;
}

export interface TodayViewModel {
  dateLabel: string;
  summary: TodaySummary;
  scheduledItems: DisplayItem[];
}
