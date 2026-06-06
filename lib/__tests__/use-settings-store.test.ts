import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: supabaseMocks.getUser,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: supabaseMocks.maybeSingle,
        }),
      }),
      upsert: supabaseMocks.upsert,
    }),
  }),
}));

import { useSettingsStore } from "../stores/use-settings-store";

function resetSettingsStore() {
  useSettingsStore.setState({
    sleepStart: "23:00",
    sleepEnd: "06:00",
    locale: "en",
    timeFormat: "12h",
    weekStartDay: 0,
    bufferMinutes: 0,
    appearance: "light",
    showCompletedOnToday: true,
    allDefaultView: "timeline",
    dateFormatRegion: "",
    dailyDigestEnabled: true,
    dailyDigestTopics: ["task_summary"],
    loadedFromCloud: false,
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  supabaseMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  supabaseMocks.maybeSingle.mockReset();
  supabaseMocks.upsert.mockReset();
  resetSettingsStore();
});

describe("useSettingsStore cloud loading", () => {
  it("applies cloud settings when they exist", async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({
      data: {
        settings: {
          appearance: "dark",
          timeFormat: "24h",
          bufferMinutes: 75,
          dailyDigestTopics: ["daily_quote", "not-a-topic"],
        },
      },
      error: null,
    });

    await useSettingsStore.getState().loadFromCloud("user-1");

    const state = useSettingsStore.getState();
    expect(state.appearance).toBe("dark");
    expect(state.timeFormat).toBe("24h");
    expect(state.bufferMinutes).toBe(60);
    expect(state.dailyDigestTopics).toEqual(["daily_quote"]);
    expect(state.loadedFromCloud).toBe(true);
    expect(supabaseMocks.upsert).not.toHaveBeenCalled();
  });

  it("keeps local settings when cloud loading fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useSettingsStore.setState({ appearance: "dark", timeFormat: "24h" });
    supabaseMocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "RLS denied" },
    });

    await useSettingsStore.getState().loadFromCloud("user-1");

    const state = useSettingsStore.getState();
    expect(state.appearance).toBe("dark");
    expect(state.timeFormat).toBe("24h");
    expect(state.loadedFromCloud).toBe(true);
    expect(supabaseMocks.upsert).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it("seeds existing local preferences when the cloud row is missing", async () => {
    useSettingsStore.setState({ timeFormat: "24h", appearance: "dark" });
    localStorage.setItem("orkest-settings", JSON.stringify({
      state: {
        timeFormat: "24h",
        appearance: "dark",
      },
      version: 0,
    }));
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    supabaseMocks.upsert.mockResolvedValue({ error: null });

    await useSettingsStore.getState().loadFromCloud("user-1");

    expect(supabaseMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        settings: expect.objectContaining({
          timeFormat: "24h",
          appearance: "dark",
        }),
      }),
      { onConflict: "user_id" },
    );
    expect(useSettingsStore.getState().loadedFromCloud).toBe(true);
  });

  it("does not seed untouched defaults when the cloud row is missing", async () => {
    localStorage.setItem("orkest-settings", JSON.stringify({
      state: {
        locale: "zh-CN",
      },
      version: 0,
    }));
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await useSettingsStore.getState().loadFromCloud("user-1");

    expect(supabaseMocks.upsert).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().loadedFromCloud).toBe(true);
  });
});
