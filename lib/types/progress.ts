// Domain types for the Progress system.
// See docs/plans/2026-06-15-progress-system.md for the data model.

export type ProgressTrackingMode = "count" | "percentage" | "manual";
export type ProgressStatus = "active" | "completed" | "archived";

export interface Progress {
  id: string;
  userId: string;
  name: string;
  description?: string;
  goalValue: number;
  goalUnit: string;
  trackingMode: ProgressTrackingMode;
  manualValue: number;
  color?: string;
  status: ProgressStatus;
  targetDate?: string;
  sortOrder?: number;
  aiContext?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgressTaskLink {
  id: string;
  progressId: string;
  itemId: string;
  weight: number;
  addedAt: Date;
}

export interface ProgressInput {
  name: string;
  description?: string;
  goalValue: number;
  goalUnit: string;
  trackingMode: ProgressTrackingMode;
  manualValue?: number;
  color?: string;
  status?: ProgressStatus;
  targetDate?: string;
  aiContext?: Record<string, unknown>;
}

export interface ProgressUpdate {
  name?: string;
  description?: string;
  goalValue?: number;
  goalUnit?: string;
  trackingMode?: ProgressTrackingMode;
  manualValue?: number;
  color?: string;
  status?: ProgressStatus;
  targetDate?: string;
  sortOrder?: number;
  aiContext?: Record<string, unknown>;
}
