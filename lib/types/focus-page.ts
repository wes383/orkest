export type TimerMode = "countdown" | "stopwatch";

export type TimerState = "idle" | "running" | "paused";

export interface FocusSession {
  id: string;
  itemId?: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds: number;
  completed: boolean;
  tags?: string[];
  taskTitle?: string;
}

export interface FocusSettings {
  countdownMinutes: number;
  alarmEnabled: boolean;
}

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  countdownMinutes: 30,
  alarmEnabled: true,
};
