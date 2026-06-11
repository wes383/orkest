import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "../supabase/client";
import { detectBrowserLocale, DEFAULT_LOCALE, isLocale, LOCALE_DATE_TAGS, type Locale } from "@/lib/i18n/config";
import type { DigestTopic } from "@/lib/types/daily-digest";

export type TimeFormat = "12h" | "24h";

export type Appearance = "light" | "dark" | "system";

export type AllDefaultView = "timeline" | "list" | "calendar" | "kanban" | "table";

export type Density = "default" | "compact";

export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEK_START_OPTIONS: { value: WeekStartDay; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 6, label: "Saturday" },
];

const DIGEST_TOPICS: readonly DigestTopic[] = [
  "task_summary",
  "daily_quote",
  "today_in_history",
  "daily_book",
  "daily_movie",
];

type SettingsPayload = {
  sleepStart: string;
  sleepEnd: string;
  locale: Locale;
  timeFormat: TimeFormat;
  weekStartDay: WeekStartDay;
  bufferMinutes: number;
  appearance: Appearance;
  showCompletedOnToday: boolean;
  allDefaultView: AllDefaultView;
  density: Density;
  dateFormatRegion: string;
  dailyDigestEnabled: boolean;
  dailyDigestTopics: DigestTopic[];
  aiCalendarProcessingEnabled: boolean;
  welcomeDismissed: boolean;
};

type SettingsState = SettingsPayload & {
  loadedFromCloud: boolean;
  welcomeDismissed: boolean;
  setSleepStart: (time: string) => void;
  setSleepEnd: (time: string) => void;
  setLocale: (locale: Locale, options?: { skipSync?: boolean }) => void;
  setTimeFormat: (format: TimeFormat) => void;
  setWeekStartDay: (day: WeekStartDay) => void;
  setBufferMinutes: (minutes: number) => void;
  setAppearance: (appearance: Appearance) => void;
  setShowCompletedOnToday: (show: boolean) => void;
  setAllDefaultView: (view: AllDefaultView) => void;
  setDensity: (density: Density) => void;
  setDateFormatRegion: (region: string) => void;
  setDailyDigestEnabled: (enabled: boolean) => void;
  setDailyDigestTopics: (topics: DigestTopic[]) => void;
  setAiCalendarProcessingEnabled: (enabled: boolean) => void;
  setWelcomeDismissed: (dismissed: boolean) => void;
  loadFromCloud: (userId: string) => Promise<void>;
};

function getSettingsPayload(state: SettingsPayload): SettingsPayload {
  return {
    sleepStart: state.sleepStart,
    sleepEnd: state.sleepEnd,
    locale: state.locale,
    timeFormat: state.timeFormat,
    weekStartDay: state.weekStartDay,
    bufferMinutes: state.bufferMinutes,
    appearance: state.appearance,
    showCompletedOnToday: state.showCompletedOnToday,
    allDefaultView: state.allDefaultView,
    density: state.density,
    dateFormatRegion: state.dateFormatRegion,
    dailyDigestEnabled: state.dailyDigestEnabled,
    dailyDigestTopics: state.dailyDigestTopics,
    aiCalendarProcessingEnabled: state.aiCalendarProcessingEnabled,
    welcomeDismissed: state.welcomeDismissed,
  };
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimeFormat(value: unknown): value is TimeFormat {
  return value === "12h" || value === "24h";
}

function isAppearance(value: unknown): value is Appearance {
  return value === "light" || value === "dark" || value === "system";
}

function isAllDefaultView(value: unknown): value is AllDefaultView {
  return (
    value === "timeline" ||
    value === "list" ||
    value === "calendar" ||
    value === "kanban" ||
    value === "table"
  );
}

function isDensity(value: unknown): value is Density {
  return value === "default" || value === "compact";
}

function isWeekStartDay(value: unknown): value is WeekStartDay {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6;
}

function isDigestTopic(value: unknown): value is DigestTopic {
  return DIGEST_TOPICS.includes(value as DigestTopic);
}

function settingsFromCloud(settings: Record<string, unknown>): Omit<SettingsPayload, "welcomeDismissed"> {
  const locale = typeof settings.locale === "string" && isLocale(settings.locale)
    ? settings.locale
    : DEFAULT_SETTINGS.locale;
  const dailyDigestTopics = Array.isArray(settings.dailyDigestTopics)
    ? settings.dailyDigestTopics.filter(isDigestTopic)
    : DEFAULT_SETTINGS.dailyDigestTopics;

  return {
    sleepStart: DEFAULT_SETTINGS.sleepStart,
    sleepEnd: DEFAULT_SETTINGS.sleepEnd,
    locale,
    timeFormat: DEFAULT_SETTINGS.timeFormat,
    weekStartDay: DEFAULT_SETTINGS.weekStartDay,
    bufferMinutes: DEFAULT_SETTINGS.bufferMinutes,
    appearance: DEFAULT_SETTINGS.appearance,
    showCompletedOnToday: DEFAULT_SETTINGS.showCompletedOnToday,
    allDefaultView: DEFAULT_SETTINGS.allDefaultView,
    density: DEFAULT_SETTINGS.density,
    dateFormatRegion: DEFAULT_SETTINGS.dateFormatRegion,
    dailyDigestEnabled: DEFAULT_SETTINGS.dailyDigestEnabled,
    dailyDigestTopics: DEFAULT_SETTINGS.dailyDigestTopics,
    aiCalendarProcessingEnabled: DEFAULT_SETTINGS.aiCalendarProcessingEnabled,
    ...(typeof settings.sleepStart === "string" ? { sleepStart: settings.sleepStart } : {}),
    ...(typeof settings.sleepEnd === "string" ? { sleepEnd: settings.sleepEnd } : {}),
    ...(isTimeFormat(settings.timeFormat) ? { timeFormat: settings.timeFormat } : {}),
    ...(isWeekStartDay(settings.weekStartDay) ? { weekStartDay: settings.weekStartDay } : {}),
    ...(typeof settings.bufferMinutes === "number" ? { bufferMinutes: Math.max(0, Math.min(60, settings.bufferMinutes)) } : {}),
    ...(isAppearance(settings.appearance) ? { appearance: settings.appearance } : {}),
    ...(typeof settings.showCompletedOnToday === "boolean" ? { showCompletedOnToday: settings.showCompletedOnToday } : {}),
    ...(isAllDefaultView(settings.allDefaultView) ? { allDefaultView: settings.allDefaultView } : {}),
    ...(isDensity(settings.density) ? { density: settings.density } : {}),
    ...(typeof settings.dateFormatRegion === "string" ? { dateFormatRegion: settings.dateFormatRegion } : {}),
    ...(typeof settings.dailyDigestEnabled === "boolean" ? { dailyDigestEnabled: settings.dailyDigestEnabled } : {}),
    ...(dailyDigestTopics.length > 0 ? { dailyDigestTopics } : {}),
    ...(typeof settings.aiCalendarProcessingEnabled === "boolean" ? { aiCalendarProcessingEnabled: settings.aiCalendarProcessingEnabled } : {}),
  };
}

function logSettingsSyncError(action: string, error: unknown) {
  console.error(`[SettingsStore] ${action} failed:`, error);
}

async function upsertSettingsForUser(userId: string, settings: SettingsPayload): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("user_settings").upsert({
      user_id: userId,
      settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) {
      logSettingsSyncError("sync to cloud", error);
      return false;
    }

    return true;
  } catch (error) {
    logSettingsSyncError("sync to cloud", error);
    return false;
  }
}

async function syncCurrentSettingsToCloud(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      logSettingsSyncError("read auth user before sync", error);
      return false;
    }
    if (!user) return false;

    return upsertSettingsForUser(user.id, getSettingsPayload(useSettingsStore.getState()));
  } catch (error) {
    logSettingsSyncError("read auth user before sync", error);
    return false;
  }
}

function debouncedSyncToCloud() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    await syncCurrentSettingsToCloud();
  }, 500);
}

const DEFAULT_SETTINGS: SettingsPayload = {
  sleepStart: "23:00",
  sleepEnd: "06:00",
  locale: detectBrowserLocale(),
  timeFormat: "12h",
  weekStartDay: 0,
  bufferMinutes: 0,
  appearance: "light",
  showCompletedOnToday: true,
  allDefaultView: "timeline",
  density: "default",
  dateFormatRegion: "",
  dailyDigestEnabled: true,
  dailyDigestTopics: ["task_summary"],
  aiCalendarProcessingEnabled: true,
  welcomeDismissed: false,
};

const LOCAL_SEED_KEYS: Exclude<keyof SettingsPayload, "locale">[] = [
  "sleepStart",
  "sleepEnd",
  "timeFormat",
  "weekStartDay",
  "bufferMinutes",
  "appearance",
  "showCompletedOnToday",
  "allDefaultView",
  "density",
  "dateFormatRegion",
  "dailyDigestEnabled",
  "dailyDigestTopics",
  "aiCalendarProcessingEnabled",
];

function areSettingValuesEqual(left: SettingsPayload[keyof SettingsPayload], right: SettingsPayload[keyof SettingsPayload]) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

function hasLocalSettingsStorage(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem("orkest-settings") !== null;
}

function hasLocalSettingsToSeed(state: SettingsState): boolean {
  if (!hasLocalSettingsStorage()) return false;
  const payload = getSettingsPayload(state);
  return LOCAL_SEED_KEYS.some((key) => !areSettingValuesEqual(payload[key], DEFAULT_SETTINGS[key]));
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      loadedFromCloud: false,
      setSleepStart: (time) => {
        set({ sleepStart: time });
        debouncedSyncToCloud();
      },
      setSleepEnd: (time) => {
        set({ sleepEnd: time });
        debouncedSyncToCloud();
      },
      setLocale: (locale, options) => {
        set({ locale });
        if (!options?.skipSync) {
          debouncedSyncToCloud();
        }
      },
      setTimeFormat: (format) => {
        set({ timeFormat: format });
        debouncedSyncToCloud();
      },
      setWeekStartDay: (day) => {
        set({ weekStartDay: day });
        debouncedSyncToCloud();
      },
      setBufferMinutes: (minutes) => {
        set({ bufferMinutes: Math.max(0, Math.min(60, minutes)) });
        debouncedSyncToCloud();
      },
      setAppearance: (appearance) => {
        set({ appearance });
        debouncedSyncToCloud();
      },
      setShowCompletedOnToday: (show) => {
        set({ showCompletedOnToday: show });
        debouncedSyncToCloud();
      },
      setAllDefaultView: (view) => {
        set({ allDefaultView: view });
        debouncedSyncToCloud();
      },
      setDensity: (density) => {
        set({ density });
        debouncedSyncToCloud();
      },
      setDateFormatRegion: (region) => {
        set({ dateFormatRegion: region });
        debouncedSyncToCloud();
      },
      setDailyDigestEnabled: (enabled) => {
        set({ dailyDigestEnabled: enabled });
        debouncedSyncToCloud();
      },
      setDailyDigestTopics: (topics) => {
        set({ dailyDigestTopics: topics });
        debouncedSyncToCloud();
      },
      setAiCalendarProcessingEnabled: (enabled) => {
        set({ aiCalendarProcessingEnabled: enabled });
        debouncedSyncToCloud();
      },
      setWelcomeDismissed: (dismissed) => {
        set({ welcomeDismissed: dismissed });
      },
      loadFromCloud: async (userId) => {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from("user_settings")
            .select("settings")
            .eq("user_id", userId)
            .maybeSingle();

          if (error) {
            logSettingsSyncError("load from cloud", error);
            set({ loadedFromCloud: true });
            return;
          }

          if (isRecord(data?.settings)) {
            set({
              ...settingsFromCloud(data.settings),
              loadedFromCloud: true,
            });
          } else {
            const currentState = get();
            if (hasLocalSettingsToSeed(currentState)) {
              await upsertSettingsForUser(userId, getSettingsPayload(currentState));
            }
            set({ loadedFromCloud: true });
          }
        } catch (error) {
          logSettingsSyncError("load from cloud", error);
          set({ loadedFromCloud: true });
        }
      },
    }),
    {
      name: "orkest-settings",
      partialize: (state) => getSettingsPayload(state),
      onRehydrateStorage: () => {
        return (state) => {
          // Mark that local storage has been rehydrated
          if (state) {
            state.loadedFromCloud = false;
          }
        };
      },
    },
  ),
);

export function getTimeFormatHour12(): boolean {
  return useSettingsStore.getState().timeFormat === "12h";
}

export function getWeekStartDay(): WeekStartDay {
  return useSettingsStore.getState().weekStartDay;
}

export function getDateLocale(): string {
  const state = useSettingsStore.getState();
  if (state.dateFormatRegion) {
    return state.dateFormatRegion;
  }
  // Use browser language as default
  if (typeof navigator !== "undefined") {
    const browserLang = navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage;
    if (browserLang) {
      return browserLang;
    }
  }
  return LOCALE_DATE_TAGS[state.locale] ?? LOCALE_DATE_TAGS[DEFAULT_LOCALE];
}

export function useDateLocale(): string {
  const dateFormatRegion = useSettingsStore((s) => s.dateFormatRegion);
  const locale = useSettingsStore((s) => s.locale);
  
  if (dateFormatRegion) {
    return dateFormatRegion;
  }
  // Use browser language as default
  if (typeof navigator !== "undefined") {
    const browserLang = navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage;
    if (browserLang) {
      return browserLang;
    }
  }
  return LOCALE_DATE_TAGS[locale] ?? LOCALE_DATE_TAGS[DEFAULT_LOCALE];
}

export function getAppLocale(): Locale {
  return useSettingsStore.getState().locale;
}
