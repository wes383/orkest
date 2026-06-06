import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "../supabase/client";

import type { TimerMode, TimerState, FocusSettings, FocusSession } from "../types/focus-page";
import { DEFAULT_FOCUS_SETTINGS } from "../types/focus-page";

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sessionToDbRow(session: FocusSession, userId: string) {
  return {
    id: session.id,
    user_id: userId,
    item_id: session.itemId ?? null,
    started_at: session.startedAt instanceof Date ? session.startedAt.toISOString() : session.startedAt,
    ended_at: session.endedAt instanceof Date ? session.endedAt.toISOString() : (session.endedAt ?? null),
    duration_seconds: session.durationSeconds,
    completed: session.completed,
    tags: session.tags ?? null,
    task_title: session.taskTitle ?? null,
  };
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

let audioCtx: AudioContext | null = null;
let alarmBuffer: AudioBuffer | null = null;
let alarmBufferPromise: Promise<AudioBuffer> | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

async function loadAlarmBuffer(): Promise<AudioBuffer> {
  if (alarmBuffer) return alarmBuffer;
  if (alarmBufferPromise) return alarmBufferPromise;

  alarmBufferPromise = (async () => {
    const res = await fetch("/sounds/alarm.mp3");
    if (!res.ok) throw new Error(`Failed to load alarm sound: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const ctx = getAudioContext();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    alarmBuffer = decoded;
    return decoded;
  })();

  return alarmBufferPromise;
}

export async function unlockAlarm() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  await loadAlarmBuffer();
}

export async function playAlarm() {
  const ctx = getAudioContext();

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  try {
    const buffer = await loadAlarmBuffer();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
  }
}

function syncNewSession(session: FocusSession) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("focus_sessions").upsert(
      sessionToDbRow(session, user.id),
      { onConflict: "id" },
    );
  }, 300);
}

interface FocusState {
  timerMode: TimerMode;
  timerState: TimerState;
  timeRemainingSeconds: number;
  elapsedSeconds: number;
  startedAtTimestamp: number | null;
  pausedElapsedSeconds: number;

  selectedItemId: string | null;
  taskTags: string[];
  taskTitle: string;

  settings: FocusSettings;
  sessions: FocusSession[];
  sessionsDate: string;
  loadedFromCloud: boolean;

  setTimerMode: (mode: TimerMode) => void;
  setSelectedItemId: (id: string | null, tags?: string[], title?: string) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
  completeSession: () => void;
  updateSettings: (settings: Partial<FocusSettings>) => void;
  loadFromCloud: (userId: string) => Promise<void>;
  clearSessions: () => Promise<void>;
}

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      timerMode: "countdown",
      timerState: "idle",
      timeRemainingSeconds: DEFAULT_FOCUS_SETTINGS.countdownMinutes * 60,
      elapsedSeconds: 0,
      startedAtTimestamp: null,
      pausedElapsedSeconds: 0,
      selectedItemId: null,
      taskTags: [],
      taskTitle: "",
      settings: DEFAULT_FOCUS_SETTINGS,
      sessions: [],
      sessionsDate: getTodayKey(),
      loadedFromCloud: false,

      setTimerMode: (mode) => {
        const { settings } = get();
        const timeRemaining = mode === "countdown" ? settings.countdownMinutes * 60 : 0;
        set({
          timerMode: mode,
          timerState: "idle",
          timeRemainingSeconds: timeRemaining,
          elapsedSeconds: 0,
          startedAtTimestamp: null,
          pausedElapsedSeconds: 0,
        });
      },

      setSelectedItemId: (id, tags = [], title = "") => set({ selectedItemId: id, taskTags: tags, taskTitle: title }),

      startTimer: () => {
        const { timerMode, settings } = get();
        const timeRemaining = timerMode === "countdown" ? settings.countdownMinutes * 60 : 0;
        if (settings.alarmEnabled) unlockAlarm();
        set({
          timerState: "running",
          timeRemainingSeconds: timeRemaining,
          elapsedSeconds: 0,
          startedAtTimestamp: Date.now(),
          pausedElapsedSeconds: 0,
        });
      },

      pauseTimer: () => {
        const { startedAtTimestamp, pausedElapsedSeconds } = get();
        const currentElapsed = startedAtTimestamp
          ? pausedElapsedSeconds + Math.floor((Date.now() - startedAtTimestamp) / 1000)
          : pausedElapsedSeconds;
        set({
          timerState: "paused",
          pausedElapsedSeconds: currentElapsed,
          startedAtTimestamp: null,
        });
      },

      resumeTimer: () => {
        const { settings } = get();
        if (settings.alarmEnabled) unlockAlarm();
        set({ timerState: "running", startedAtTimestamp: Date.now() });
      },

      resetTimer: () => {
        const { selectedItemId, taskTags, taskTitle, sessions, sessionsDate, timerMode, settings } = get();
        const { elapsedSeconds } = get();
        const today = getTodayKey();

        if (elapsedSeconds > 60) {
          const newSession: FocusSession = {
            id: crypto.randomUUID(),
            itemId: selectedItemId ?? undefined,
            startedAt: new Date(Date.now() - elapsedSeconds * 1000),
            endedAt: new Date(),
            durationSeconds: elapsedSeconds,
            completed: false,
            tags: taskTags.length > 0 ? taskTags : undefined,
            taskTitle: taskTitle || undefined,
          };
          const currentSessions = sessionsDate === today ? sessions : [];
          const timeRemaining = timerMode === "countdown" ? settings.countdownMinutes * 60 : 0;
          set({
            timerState: "idle",
            timeRemainingSeconds: timeRemaining,
            elapsedSeconds: 0,
            startedAtTimestamp: null,
            pausedElapsedSeconds: 0,
            sessions: [...currentSessions, newSession],
            sessionsDate: today,
          });
          syncNewSession(newSession);
        } else {
          const timeRemaining = timerMode === "countdown" ? settings.countdownMinutes * 60 : 0;
          set({
            timerState: "idle",
            timeRemainingSeconds: timeRemaining,
            elapsedSeconds: 0,
            startedAtTimestamp: null,
            pausedElapsedSeconds: 0,
          });
        }
      },

      tick: () => {
        const { timerMode, timerState, startedAtTimestamp, pausedElapsedSeconds, settings } = get();
        if (timerState !== "running" || startedAtTimestamp === null) return;

        const elapsedSeconds = pausedElapsedSeconds + Math.floor((Date.now() - startedAtTimestamp) / 1000);

        if (timerMode === "stopwatch") {
          set({ elapsedSeconds });
        } else {
          const totalDuration = settings.countdownMinutes * 60;
          const timeRemainingSeconds = Math.max(totalDuration - elapsedSeconds, 0);
          if (timeRemainingSeconds <= 0) {
            set({ elapsedSeconds, timeRemainingSeconds: 0 });
            get().completeSession();
            return;
          }
          set({ elapsedSeconds, timeRemainingSeconds });
        }
      },

      completeSession: () => {
        const { selectedItemId, taskTags, taskTitle, elapsedSeconds, sessions, sessionsDate } = get();
        const today = getTodayKey();

        const newSession: FocusSession = {
          id: crypto.randomUUID(),
          itemId: selectedItemId ?? undefined,
          startedAt: new Date(Date.now() - elapsedSeconds * 1000),
          endedAt: new Date(),
          durationSeconds: elapsedSeconds,
          completed: true,
          tags: taskTags.length > 0 ? taskTags : undefined,
          taskTitle: taskTitle || undefined,
        };

        const currentSessions = sessionsDate === today ? sessions : [];

        set({
          timerState: "idle",
          timeRemainingSeconds: 0,
          elapsedSeconds: 0,
          startedAtTimestamp: null,
          pausedElapsedSeconds: 0,
          sessions: [...currentSessions, newSession],
          sessionsDate: today,
        });
        syncNewSession(newSession);
      },

      updateSettings: (partial) => {
        set((state) => {
          const newSettings = { ...state.settings, ...partial };
          const updates: Partial<FocusState> = {
            settings: newSettings,
          };
          if (
            partial.countdownMinutes !== undefined &&
            state.timerMode === "countdown" &&
            state.timerState === "idle"
          ) {
            updates.timeRemainingSeconds = partial.countdownMinutes * 60;
          }
          return updates;
        });
      },

      loadFromCloud: async (userId) => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("focus_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("started_at", { ascending: true });
        if (!error && data) {
          const cloudSessions: FocusSession[] = data.map((row) => ({
            id: row.id,
            itemId: row.item_id ?? undefined,
            startedAt: new Date(row.started_at),
            endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
            durationSeconds: row.duration_seconds,
            completed: row.completed,
            tags: row.tags ?? undefined,
            taskTitle: row.task_title ?? undefined,
          }));
          set((state) => {
            const existingIds = new Set(state.sessions.map((s) => s.id));
            const merged = [...cloudSessions];
            for (const s of state.sessions) {
              if (!existingIds.has(s.id)) {
                merged.push(s);
              }
            }
            merged.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
            return { sessions: merged, loadedFromCloud: true };
          });
        } else {
          set({ loadedFromCloud: true });
        }
      },

      clearSessions: async () => {
        set({ sessions: [], sessionsDate: getTodayKey() });
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("focus_sessions").delete().eq("user_id", user.id);
        }
      },
    }),
    {
      name: "orkest-focus",
      partialize: (state) => ({
        settings: state.settings,
        timerMode: state.timerMode,
        timeRemainingSeconds: state.timerState === "idle" ? state.timeRemainingSeconds : undefined,
        sessions: state.sessions,
        sessionsDate: state.sessionsDate,
        startedAtTimestamp: state.timerState === "running" ? state.startedAtTimestamp : undefined,
        pausedElapsedSeconds: state.timerState === "paused" ? state.pausedElapsedSeconds : undefined,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<FocusState>;
        const settings = persisted.settings ?? currentState.settings;
        const timerMode = persisted.timerMode ?? currentState.timerMode;
        const timeRemainingSeconds =
          persisted.timeRemainingSeconds ??
          (timerMode === "countdown" ? settings.countdownMinutes * 60 : 0);
        return {
          ...currentState,
          ...persisted,
          settings,
          timerMode,
          timeRemainingSeconds,
          loadedFromCloud: false,
        };
      },
    },
  ),
);
