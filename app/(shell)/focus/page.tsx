"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { FocusTimer } from "@/components/focus-page/focus-timer";
import { TimerControls } from "@/components/focus-page/timer-controls";
import { TimerModeSelector } from "@/components/focus-page/timer-mode-selector";
import { QuickPresets } from "@/components/focus-page/quick-presets";
import { TaskSelector } from "@/components/focus-page/task-selector";
import { FocusStatsDisplay } from "@/components/focus-page/focus-stats";
import { FocusTaskCard } from "@/components/focus-page/focus-task-card";
import { useAuth } from "@/lib/auth/auth-provider";
import { buildFocusViewModel } from "@/lib/focus-page-utils";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useFocusStore } from "@/lib/stores/use-focus-store";
import { useI18n } from "@/lib/i18n";
import { FocusPageSkeleton } from "@/components/ui/page-skeletons";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

function useMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default function FocusPage() {
  const mounted = useMounted();
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [now, setNow] = useState(() => new Date());
  // Subscribe to dateFormatRegion to trigger re-render when it changes
  const dateFormatRegion = useSettingsStore((s) => s.dateFormatRegion);
  void dateFormatRegion;

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const manualItems = useAllPageStore((s) => s.manualItems);
  const isLoaded = useAllPageStore((s) => s.isLoaded);
  const isSyncing = useAllPageStore((s) => s.isSyncing);
  const loadItemsFromCloud = useAllPageStore((s) => s.loadItemsFromCloud);
  const setSelectedItem = useAllPageStore((s) => s.setSelectedItem);

  const ai = useAiChatContext();

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (useFocusStore.getState().timerState === "running" || useFocusStore.getState().timerState === "paused") {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    ai.setPageContext("focus");
  }, [ai]);

  useEffect(() => {
    if (user && !isLoaded) {
      void loadItemsFromCloud(user.id);
    }
  }, [isLoaded, loadItemsFromCloud, user]);

  const todayItems = useMemo(
    () => buildFocusViewModel(manualItems, now),
    [manualItems, now],
  );

  // Collapse AI menu when switching to Focus page
  useEffect(() => {
    ai.setExpandedState(false);
  }, []);  if (!mounted || authLoading || (isSyncing && !isLoaded)) {
    return <FocusPageSkeleton />;
  }

  return (
    <section
      className="relative min-h-screen bg-[#fcfbfa] dark:bg-[#101010] px-4 py-8 text-[#2b2a30] dark:text-[#d4d4d4] transition-[padding] duration-300 ease-in-out sm:px-14 lg:px-14 lg:py-12 group-data-[sidebar-collapsed=true]/sidebar:lg:pl-32 group-data-[sidebar-collapsed=true]/sidebar:lg:pr-24"
      onClick={() => setSelectedItem(null)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#fcfbfa] via-[#fcfbfa]/70 to-[#fcfbfa]/0 dark:from-[#101010] dark:via-[#101010]/70 dark:to-[#101010]/0 sm:hidden"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 lg:gap-10" style={{ minHeight: "calc(100vh - 4rem)" }}>

        <div className="flex flex-1 w-full flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center lg:gap-40">
          <div className="flex flex-col items-center gap-8 lg:justify-center" style={{ flex: 1 }}>
            <TimerModeSelector />
            <FocusTimer />
            <QuickPresets />
            <TimerControls />
          </div>

          <div className="flex w-full flex-col gap-6 sm:w-96 sm:max-w-96 lg:pt-10">
            <TaskSelector items={todayItems} />
            <FocusTaskCard />
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl">
          <FocusStatsDisplay />
        </div>
      </div>
    </section>
  );
}
