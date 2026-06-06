"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { TodayHeader } from "@/components/today-page/today-header";
import { TimelineSection } from "@/components/today-page/timeline-section";
import { MessageCircle, Sparkles } from "lucide-react";
import { DailyDigestCard } from "@/components/today-page/daily-digest-card";
import { DailyQuoteCard } from "@/components/today-page/daily-quote-card";
import { OnThisDayCard } from "@/components/today-page/on-this-day-card";
import { DailyBookCard } from "@/components/today-page/daily-book-card";
import { DailyMovieCard } from "@/components/today-page/daily-movie-card";
import { AiOverlay } from "@/components/ai/ai-overlay";
import { BatchPreviewItemRenderer } from "@/components/ai/batch-preview-item";
import { useAuth } from "@/lib/auth/auth-provider";
import { buildTodayViewModel } from "@/lib/today-page-utils";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { TodayPageSkeleton } from "@/components/ui/page-skeletons";

import type { AiBatchPreviewItem } from "@/lib/ai/chat-types";
import { toItemFromManualRecord } from "@/lib/all-page-utils";
import { useI18n } from "@/lib/i18n";

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

export default function TodayPage() {
  const mounted = useMounted();
  const { t } = useI18n();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const dateFormatRegion = useSettingsStore((s) => s.dateFormatRegion);
  void dateFormatRegion;

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  const manualItems = useAllPageStore((s) => s.manualItems);
  const isLoaded = useAllPageStore((s) => s.isLoaded);
  const isSyncing = useAllPageStore((s) => s.isSyncing);
  const loadItemsFromCloud = useAllPageStore((s) => s.loadItemsFromCloud);
  const openComposerWithForm = useAllPageStore((s) => s.openComposerWithForm);
  const openComposer = useAllPageStore((s) => s.openComposer);
  const setComposerSubmitOverride = useAllPageStore((s) => s.setComposerSubmitOverride);
  const setSelectedItem = useAllPageStore((s) => s.setSelectedItem);

  const projects = useProjectStore((s) => s.projects);

  const ai = useAiChatContext();

  useEffect(() => {
    ai.setPageContext("today");
  }, [ai]);

  useEffect(() => {
    if (user && !isLoaded) {
      void loadItemsFromCloud(user.id);
    }
  }, [isLoaded, loadItemsFromCloud, user]);

  const locale = useSettingsStore((s) => s.locale);
  const showCompletedOnToday = useSettingsStore((s) => s.showCompletedOnToday);
  const dailyDigestEnabled = useSettingsStore((s) => s.dailyDigestEnabled);
  const dailyDigestTopics = useSettingsStore((s) => s.dailyDigestTopics);
  const welcomeDismissed = useSettingsStore((s) => s.welcomeDismissed);
  const setWelcomeDismissed = useSettingsStore((s) => s.setWelcomeDismissed);

  const todayView = useMemo(() => buildTodayViewModel(manualItems, now, showCompletedOnToday), [manualItems, now, showCompletedOnToday]);

  const [viewMode, setViewModeState] = useState<"digest" | "timeline">("digest");
  const setViewMode = useCallback((mode: "digest" | "timeline") => {
    setViewModeState(mode);
  }, []);
  const setViewModeWithScroll = useCallback((mode: "digest" | "timeline") => {
    setViewModeState(mode);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  function handleEditBatchPreview(index: number) {
    if (ai.aiLoading) return;

    const draft = ai.aiBatchPreview[index];
    if (!draft) return;
    if (draft.kind === "delete") return;

    setComposerSubmitOverride((form) => {
      ai.setAiBatchPreview((current) => {
        const next = current.map((item, i) => (i === index ? { ...item, formState: form } : item));
        return next;
      });
      return null;
    });

    if (draft.kind === "update" && draft.targetItemId) {
      const targetRecord = manualItems.find((record) => record.id === draft.targetItemId);
      if (targetRecord) {
        openComposerWithForm(draft.formState, toItemFromManualRecord(targetRecord));
      }
    } else {
      openComposerWithForm(draft.formState);
    }

    if (!ai.isFullscreen) ai.setExpandedState(false);
  }

  function handleToggleBatchPreviewSelection(index: number, selected: boolean) {
    ai.setAiBatchPreview((current) => current.map((item, i) => i === index ? { ...item, selected } : item));
  }

  function renderAiBatchPreviewItem(item: AiBatchPreviewItem, index: number) {
    return (
      <BatchPreviewItemRenderer
        key={item.id}
        item={item}
        index={index}
        projects={projects}
        onToggleSelection={handleToggleBatchPreviewSelection}
        onEdit={handleEditBatchPreview}
        isFullscreen={ai.isFullscreen}
      />
    );
  }

  if (!mounted || authLoading || (isSyncing && !isLoaded)) {
    return <TodayPageSkeleton />;
  }

  return (
    <section
      className="relative min-h-screen bg-[#fcfbfa] px-8 py-8 text-[#2b2a30] transition-[padding] duration-300 ease-in-out sm:px-14 lg:px-14 lg:py-12 group-data-[sidebar-collapsed=true]/sidebar:lg:pl-32 group-data-[sidebar-collapsed=true]/sidebar:lg:pr-24"
      onClick={() => setSelectedItem(null)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#fcfbfa] via-[#fcfbfa]/70 to-[#fcfbfa]/0 sm:hidden"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 lg:gap-10">
        <TodayHeader
          dateLabel={todayView.dateLabel}
        />

        <div className="flex justify-center lg:justify-start px-2 lg:px-3">
          <div className="relative grid grid-cols-2 rounded-full border border-black/8 dark:border-white/10 bg-[#f4f0ec]/[0.5] dark:bg-[#2a2a2a] p-0.5">
            {/* Sliding background */}
            <div
              className="absolute top-0.5 bottom-0.5 rounded-full bg-[#ffffff] shadow-sm transition-all duration-300 ease-in-out dark:bg-[#d4d4d4]"
              style={{
                left: viewMode === "digest" ? "2px" : "50%",
                width: "calc(50% - 2px)",
              }}
            />
            <button
              type="button"
              onClick={() => setViewModeWithScroll("digest")}
              className={`relative z-10 flex cursor-pointer items-center justify-center rounded-full px-5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                viewMode === "digest"
                  ? "text-[#1a1a1a] dark:text-[#000000]"
                  : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
              }`}
            >
              {t("digest.view.digest")}
            </button>
            <button
              type="button"
              onClick={() => setViewModeWithScroll("timeline")}
              className={`relative z-10 flex cursor-pointer items-center justify-center rounded-full px-5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                viewMode === "timeline"
                  ? "text-[#1a1a1a] dark:text-[#000000]"
                  : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
              }`}
            >
              {t("digest.view.timeline")}
            </button>
          </div>
        </div>

        {!welcomeDismissed && manualItems.filter((r) => !r.deletedAt && !r.parentId).length === 0 && (
          <div className="rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f0ec] dark:bg-white/10">
                <Sparkles className="h-5 w-5 text-[#6d6770] dark:text-[#a3a3a3]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">
                  {t("welcome.title")}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#6a6570] dark:text-[#a09ba5]">
                  {t("welcome.description")}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openComposer()}
                    className="cursor-pointer rounded-full bg-[#25242a] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3a3840] dark:bg-[#e8e6ea] dark:text-[#111111] dark:hover:bg-[#d4d4d4]"
                  >
                    {t("empty.createTask")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWelcomeDismissed(true);
                      ai.setExpandedState(true);
                    }}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/10 bg-[#fafafa] px-4 py-2 text-sm font-medium text-[#25242a] transition-colors hover:border-[#25242a]/30 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4] dark:hover:border-white/20"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {t("welcome.askAi")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWelcomeDismissed(true)}
                    className="cursor-pointer px-3 py-2 text-sm font-medium text-[#6a6570] transition-colors hover:text-[#25242a] dark:text-[#a09ba5] dark:hover:text-[#f5f5f5]"
                  >
                    {t("welcome.dismiss")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === "digest" ? (
          <div className="flex flex-col gap-6">
            {dailyDigestEnabled && dailyDigestTopics.includes("task_summary") && (
              <DailyDigestCard viewModel={todayView} />
            )}
            {dailyDigestEnabled && dailyDigestTopics.includes("daily_quote") && (
              <DailyQuoteCard />
            )}
            {dailyDigestEnabled && dailyDigestTopics.includes("today_in_history") && (
              <OnThisDayCard />
            )}
            {dailyDigestEnabled && dailyDigestTopics.includes("daily_book") && (
              <DailyBookCard />
            )}
            {dailyDigestEnabled && dailyDigestTopics.includes("daily_movie") && (
              <DailyMovieCard />
            )}
            {!(dailyDigestEnabled && (dailyDigestTopics.includes("task_summary") || dailyDigestTopics.includes("daily_quote") || dailyDigestTopics.includes("today_in_history") || dailyDigestTopics.includes("daily_book") || dailyDigestTopics.includes("daily_movie"))) && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-black/8 bg-white p-12 dark:border-white/10 dark:bg-[#181818]">
                <p className="text-sm text-[#6f6a72] dark:text-[#a09ba5]">
                  {t("digest.noTopicsHint")}
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/settings`)}
                    className="cursor-pointer font-medium text-[#6f6a72] underline decoration-black/10 underline-offset-4 hover:text-[#2b2a30] hover:decoration-black/30 dark:text-[#e5e5e5] dark:decoration-white/20 dark:hover:text-[#f5f5f5] dark:hover:decoration-white/40"
                  >
                    {t("nav.settings")}
                  </button>
                  {t("digest.noTopicsSuffix")}
                </p>
                <button
                  type="button"
                  onClick={() => setViewMode("timeline")}
                  className="cursor-pointer rounded-full border border-black/10 bg-[#fafafa] px-4 py-2 text-sm font-medium text-[#25242a] transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
                >
                  {t("digest.view.timeline")}
                </button>
              </div>
            )}
            <p className="text-center text-xs text-black/30 dark:text-white/30">{t("settings.aiDisclaimer")}</p>
          </div>
        ) : (
          <TimelineSection items={todayView.scheduledItems} now={now} />
        )}
      </div>

      <AiOverlay
        ai={ai}
        renderAiBatchPreviewItem={renderAiBatchPreviewItem}
        emptyStateMessage={t("ai.empty")}
        quickPrompts={[t("ai.prompt.briefing"), t("ai.prompt.planDay"), t("ai.prompt.focus"), t("ai.prompt.overdue"), t("ai.prompt.moveTomorrow")]}
      />
    </section>
  );
}
