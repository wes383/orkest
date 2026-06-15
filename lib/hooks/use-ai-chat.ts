"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useMemo } from "react";

import { useAutoResizeTextarea } from "@/lib/hooks/use-auto-resize-textarea";
import { useScrollLock } from "@/lib/hooks/use-scroll-lock";
import { useAiChatHistory } from "@/lib/hooks/use-ai-chat-history";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { useProgressStore } from "@/lib/stores/use-progress-store";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useFocusStore } from "@/lib/stores/use-focus-store";
import { getWeekStartDay } from "@/lib/stores/use-settings-store";
import type { ItemFormState, ManualItemRecord } from "@/lib/types/all-page";
import type { CandidateItem } from "@/lib/ai/candidate-search";
import type {
  AiBatchPreviewItem,
  AiChatContext,
  AiPageContext,
  OrkestAIMessage,
  SuspendedAiReviewState,
} from "@/lib/ai/chat-types";
import {
  getLatestProposedActions,
  convertProposedActionsToBatchPreview,
} from "@/lib/ai/chat-types";
import { inferFocusPreference } from "@/lib/ai/focus-preference-inference";
import { dayjs } from "@/lib/dayjs";
import { LOCALE_AI_NAMES, useI18n } from "@/lib/i18n";

const DRAG_VISUAL_EVENT = "orkest:item-drag-visual";
const ITEM_FORM_SAVED_EVENT = "orkest:item-form-saved";
export const AI_DROPPED_TARGET_LIMIT = 10;

export type UseAiChatConfig = {
  pageContext: AiPageContext;
  manualItems: ManualItemRecord[];
  userId?: string;
  username?: string;
  openComposer: () => void;
  openComposerWithForm: (form: ItemFormState, editingItem?: import("@/lib/types/item").Item) => void;
  setComposerSubmitOverride: (override: ((form: ItemFormState, editingItem: import("@/lib/types/item").Item | null) => string | null) | null) => void;
  handleCreateItems: (items: ItemFormState[]) => string | null;
  applyAiUpdates: (updates: Array<{ itemId: string; form: ItemFormState }>) => void;
  handleBatchDelete: (items: import("@/lib/types/all-page").DisplayItem[]) => void;
  toItemFromManualRecord: (record: ManualItemRecord) => import("@/lib/types/all-page").DisplayItem;
  handleDeleteProject: (projectId: string) => string | null;
};

export function useAiChat(config: UseAiChatConfig) {
  const {
    pageContext,
    manualItems,
    userId,
    username,
    openComposer,
    openComposerWithForm,
    setComposerSubmitOverride,
    handleCreateItems,
    applyAiUpdates,
    handleBatchDelete,
    toItemFromManualRecord,
    handleDeleteProject,
  } = config;

  const projects = useProjectStore((s) => s.projects);
  const projectsLoaded = useProjectStore((s) => s.isLoaded);
  const progresses = useProgressStore((s) => s.progresses);
  const progressesLoaded = useProgressStore((s) => s.isLoaded);
  const links = useProgressStore((s) => s.links);
  const { locale, t } = useI18n();
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const loadProgresses = useProgressStore((s) => s.loadProgresses);
  const loadLinks = useProgressStore((s) => s.loadLinks);
  const createProgress = useProgressStore((s) => s.createProgress);
  const updateProgress = useProgressStore((s) => s.updateProgress);
  const deleteProgress = useProgressStore((s) => s.deleteProgress);
  const bindProgressTasks = useProgressStore((s) => s.bindTasks);
  const unbindProgressTask = useProgressStore((s) => s.unbindTask);
  const setManualValue = useProgressStore((s) => s.setManualValue);
  const sleepStart = useSettingsStore((s) => s.sleepStart);
  const sleepEnd = useSettingsStore((s) => s.sleepEnd);
  const bufferMinutes = useSettingsStore((s) => s.bufferMinutes);
  const focusSessions = useFocusStore((s) => s.sessions);
  const isComposerOpen = useAllPageStore((s) => s.isComposerOpen);

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const aiCalendarProcessingEnabled = useSettingsStore((s) => s.aiCalendarProcessingEnabled);

  const candidateItems = useMemo<CandidateItem[]>(() => {
    const subtasksMap = new Map<string, string[]>();
    for (const item of manualItems) {
      if (item.parentId && !item.deletedAt) {
        const existing = subtasksMap.get(item.parentId) ?? [];
        existing.push(item.title);
        subtasksMap.set(item.parentId, existing);
      }
    }

    return manualItems
      .filter((item) => !item.deletedAt && !item.parentId)
      .filter((item) => aiCalendarProcessingEnabled || !item.googleEventId)
      .map((item) => {
        const daysOfWeek = item.daysOfWeek ?? [];

        return {
          id: item.id,
          title: item.title,
          description: item.description?.slice(0, 200),
          hasTime: item.hasTime,
          startDate: item.startDate,
          startTime: item.startTime,
          endDate: item.endDate,
          endTime: item.endTime,
          allDay: item.allDay,
          hasDueDate: Boolean(item.dueDate),
          dueDate: item.dueDate,
          recurrenceType: item.recurrenceType,
          recurrenceInterval: item.recurrenceInterval?.toString() ?? "1",
          daysOfWeek,
          recurrenceEndType: item.recurrenceEndType,
          recurrenceEndDate: item.recurrenceEndDate,
          recurrenceCount: item.recurrenceCount,
          recurrenceBysetpos: item.recurrenceBysetpos,
          exdates: item.exdates ?? [],
          completedOccurrences: item.completedOccurrences ?? [],
          reopenedOccurrences: item.reopenedOccurrences ?? [],
          status: item.status,
          priority: item.priority,
          estimateMinutes: item.estimateMinutes?.toString() ?? "",
          tags: item.tags ?? [],
          projectId: item.projectId,
          timezone: item.timezone,
          projectName: item.projectId ? projectNameById.get(item.projectId) : undefined,
          subtasks: subtasksMap.get(item.id) ?? [],
          reminders: item.reminders ?? [],
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
  }, [manualItems, projectNameById, aiCalendarProcessingEnabled]);

  useEffect(() => {
    if (userId && !projectsLoaded) {
      loadProjects(userId);
    }
    if (userId && !progressesLoaded) {
      loadProgresses(userId);
      loadLinks(userId);
    }
  }, [userId, projectsLoaded, progressesLoaded, loadProjects, loadProgresses, loadLinks]);

  // --- State ---
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBatchPreview, setAiBatchPreview] = useState<AiBatchPreviewItem[]>([]);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiTargetItems, setAiTargetItems] = useState<CandidateItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [dragHighlightColor, setDragHighlightColor] = useState<string>("#7b7580");
  const [aiInputContainerHeight, setAiInputContainerHeight] = useState(0);

  // --- Refs ---
  const aiChatOuterScrollRef = useRef<HTMLDivElement>(null);
  const aiChatScrollRef = useRef<HTMLDivElement>(null);
  const dragExpandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragExpandedByTimerRef = useRef(false);
  const dragInsideDropZoneRef = useRef(false);
  const dragPanelRef = useRef<HTMLDivElement>(null);
  const dragFabRef = useRef<HTMLDivElement>(null);
  const suspendedAiReviewRef = useRef<SuspendedAiReviewState | null>(null);
  const shouldRestoreAiReviewRef = useRef(false);
  const shouldRestoreAiReviewAfterSaveRef = useRef(false);
  const didSaveComposerRef = useRef(false);
  const previousComposerOpenRef = useRef(false);
  const aiInputContainerRef = useRef<HTMLDivElement>(null);
  const aiInputBaselineHeightRef = useRef<number | null>(null);
  const prevChatPaddingRef = useRef(64);

  const { textareaRef: aiInputRef, resize: resizeAiInput } = useAutoResizeTextarea(44, 200);

  // --- Context builder (depends on state) ---
  const buildAiChatContext = useCallback((): AiChatContext => {
    const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Shanghai";
    const nowInTz = dayjs().tz(tz);
    return {
      items: candidateItems,
      selectedItems: aiTargetItems,
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        color: project.color,
      })),
      progresses: progresses.map((progress) => ({
        id: progress.id,
        name: progress.name,
        goalValue: progress.goalValue,
        goalUnit: progress.goalUnit,
        trackingMode: progress.trackingMode,
        manualValue: progress.manualValue,
        status: progress.status,
        color: progress.color,
      })),
      progressLinks: links.map((link) => ({
        progressId: link.progressId,
        itemId: link.itemId,
      })),
      today: nowInTz.format("YYYY-MM-DD"),
      currentTime: nowInTz.format("HH:mm"),
      timezone: tz,
      sleepStart,
      sleepEnd,
      bufferMinutes,
      focusPreference: inferFocusPreference(focusSessions),
      focusSessions: focusSessions.map((s) => ({
        itemId: s.itemId,
        taskTitle: s.taskTitle,
        startedAt: s.startedAt,
        durationSeconds: s.durationSeconds,
        tags: s.tags,
      })),
      pageContext,
      username,
      locale,
      language: LOCALE_AI_NAMES[locale],
      weekStartDay: getWeekStartDay(),
    };
  }, [candidateItems, aiTargetItems, projects, progresses, links, sleepStart, sleepEnd, bufferMinutes, focusSessions, pageContext, username, locale]);

  // --- Chat History ---
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    createConversation,
    updateConversation,
    deleteConversation,
    loadConversationMessages,
  } = useAiChatHistory(userId);

  const [showHistory, setShowHistory] = useState(false);
  const [showMemories, setShowMemories] = useState(false);
  const [memories, setMemories] = useState<Array<{ id: string; key: string; value: string; category: string; confidence: number; updatedAt: string }>>([]);

  const fetchMemories = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-memories");
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories ?? []);
      }
    } catch {
      // non-critical
    }
  }, []);

  const deleteMemoryById = useCallback(async (id: string) => {
    try {
      await fetch(`/api/ai-memories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // non-critical
    }
  }, []);

  const [aiDailyRemaining, setAiDailyRemaining] = useState<number | null>(null);
  const [aiDailyLimit, setAiDailyLimit] = useState<number | null>(null);

  const fetchDailyLimit = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/ai-chat/limit");
      if (res.ok) {
        const data = await res.json();
        setAiDailyRemaining(data.remaining);
        setAiDailyLimit(data.limit);
      }
    } catch {
      // limit info is non-critical
    }
  }, [userId]);

  // Keep refs stable for effects (updated via effect, not render)
  const fetchDailyLimitRef = useRef(fetchDailyLimit);

  useEffect(() => {
    fetchDailyLimitRef.current = fetchDailyLimit;
  });

  const updateConversationRef = useRef(updateConversation);
  const createConversationRef = useRef(createConversation);
  const setCurrentConversationIdRef = useRef(setCurrentConversationId);

  useEffect(() => {
    updateConversationRef.current = updateConversation;
    createConversationRef.current = createConversation;
    setCurrentConversationIdRef.current = setCurrentConversationId;
  });

  // Always start with empty messages on page load
  const initialMessages = useMemo(() => {
    return [];
  }, []);

  // Removed automatic conversation restoration on mount
  // Now each page refresh will start with a fresh new chat

  const aiChatTransport = useMemo(
    () => new DefaultChatTransport<OrkestAIMessage>({ api: "/api/ai-chat" }),
    [],
  );
  const {
    messages: aiMessages,
    sendMessage: sendAiMessage,
    status: aiChatStatus,
    stop: stopAiMessage,
    setMessages: setAiMessages,
  } = useChat<OrkestAIMessage>({
    transport: aiChatTransport,
    messages: initialMessages,
    onError: (error) => {
      if (error.message.includes("Trial expired")) {
        setAiError("TRIAL_EXPIRED:" + t("ai.trialExpired"));
      } else if (error.message.includes("Daily AI chat limit reached")) {
        const limitMatch = error.message.match(/"limit"\s*:\s*(\d+)/);
        const limit = limitMatch ? limitMatch[1] : "100";
        setAiError(t("ai.dailyLimitReached", { limit }));
      } else {
        setAiError(error.message);
      }
    },
    onFinish: ({ messages }) => {
      const actions = getLatestProposedActions(messages);
      if (actions.length > 0) {
        setAiBatchPreview(convertProposedActionsToBatchPreview(actions));
        setAiAnswer(null);
      }
    },
  });
  const aiLoading = aiChatStatus === "submitted" || aiChatStatus === "streaming";

  // --- Scroll lock (only when composer is open, not when AI panel is expanded) ---
  useScrollLock(false);

  // --- Computed ---
  const isReviewingAiItem = aiBatchPreview.length > 0;
  const isShowingAiAnswer = Boolean(aiAnswer);
  const isShowingResult = isReviewingAiItem || isShowingAiAnswer;
  const showDragHint = !isShowingResult && isExpanded && isDraggingItem;

  // --- Actions ---
  const setExpandedState = useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
    if (!expanded) setIsFullscreen(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      if (prev) {
        // Exiting fullscreen: close history/memories
        setShowHistory(false);
        setShowMemories(false);
      }
      return !prev;
    });
  }, []);

  const handleNewChat = useCallback(() => {
    if (aiLoading) return;
    if (!currentConversationId && aiMessages.length > 0) {
      createConversation(aiMessages);
    }
    setAiMessages([]);
    setCurrentConversationId(null);
    setAiBatchPreview([]);
    setAiAnswer(null);
    setAiError(null);
    if (!isFullscreen) {
      setShowHistory(false);
      setShowMemories(false);
    }
  }, [aiLoading, currentConversationId, aiMessages, createConversation, setAiMessages, setCurrentConversationId, setShowHistory, isFullscreen]);

  const handleLoadConversation = useCallback(async (conversationId: string) => {
    const messages = await loadConversationMessages(conversationId);
    if (messages.length > 0) {
      setAiMessages(messages);
      setCurrentConversationId(conversationId);
      setAiBatchPreview([]);
      setAiAnswer(null);
      setAiError(null);
      if (!isFullscreen) setShowHistory(false);
    }
  }, [loadConversationMessages, setAiMessages, setCurrentConversationId, setShowHistory, isFullscreen]);

  const handleDeleteConversation = useCallback((e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    deleteConversation(conversationId);
    if (currentConversationId === conversationId) {
      setAiMessages([]);
      setCurrentConversationId(null);
      setAiBatchPreview([]);
      setAiAnswer(null);
      setAiError(null);
    }
  }, [deleteConversation, currentConversationId, setAiMessages, setCurrentConversationId]);

  // Auto-save conversation on messages change
  // Use a serialized hash to avoid infinite loops — aiMessages is a new
  // reference every render, so using it directly as a dependency would
  // trigger the effect on every render.
  const aiMessagesHash = useMemo(
    () => aiMessages.map((m) => `${m.role}:${m.id}:${(m.targetItems ?? []).map(t => t.id).join(",")}:${m.toolName ?? ""}`).join("|"),
    [aiMessages],
  );

  useEffect(() => {
    if (aiMessages.length === 0) return;

    if (aiLoading) {
      return;
    }

    if (currentConversationId) {
      void updateConversationRef.current(currentConversationId, aiMessages);
    } else {
      void createConversationRef.current(aiMessages).then((newId) => {
        setCurrentConversationIdRef.current(newId);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiMessagesHash, currentConversationId, aiLoading]);

  const handleAiSubmit = useCallback((e?: { preventDefault(): void }) => {
    e?.preventDefault();
    const text = aiInput.trim();
    if (!text || aiLoading) return;

    // Parse /toolName prefix and map user-facing names to actual tool names
    let preferredTool: string | undefined;
    let messageText = text;
    let rawToolName: string | undefined;
    const toolMatch = text.match(/^\/([\w-]+)(?:\s+(.*))?$/);
    if (toolMatch) {
      const rawTool = toolMatch[1];
      const afterTool = toolMatch[2]?.trim();
      // Map user-facing slash names to actual tool names
      const toolNameMap: Record<string, string> = {
        "plan-today": "planMyDay",
        "plan-week": "planMyWeek",
        "add": "proposeCreateItems",
        "update": "proposeUpdateItems",
        "done": "proposeStatusChange",
        "batch-complete": "proposeBatchComplete",
        "delete": "proposeDeleteItems",
        "schedule": "proposeScheduleItems",
        "subtask": "proposeDecomposeTask",
        "search": "searchItems",
        "today": "getTodaySchedule",
        "overdue": "getOverdueTasks",
        "upcoming": "getUpcomingDueTasks",
        "duration": "estimateTaskDuration",
        "check-conflicts": "detectConflicts",
        "move-to-tomorrow": "rescheduleToTomorrow",
        "memory": "updateUserMemory",
      };
      if (rawTool in toolNameMap) {
        preferredTool = toolNameMap[rawTool];
        rawToolName = rawTool;
        messageText = afterTool || text; // fall back to full text if no content after tool name
      }
    }

    const targetItemsToSend = [...aiTargetItems];

    setAiError(null);
    setAiAnswer(null);
    setAiBatchPreview([]);
    setAiTargetItems([]);
    setAiInput("");
    resizeAiInput();

    setTimeout(() => {
      aiChatOuterScrollRef.current?.scrollTo({ top: aiChatOuterScrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);

    try {
      const context = buildAiChatContext();
      if (preferredTool) context.preferredTool = preferredTool;
      void sendAiMessage(
        { text: messageText },
        { body: { context } },
      );

      // Asynchronously update the newly sent user message to store targetItems and toolName
      setTimeout(() => {
        setAiMessages((prev) => {
          const lastUserIndex = [...prev].reverse().findIndex((m) => m.role === "user");
          if (lastUserIndex !== -1) {
            const idx = prev.length - 1 - lastUserIndex;
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              targetItems: targetItemsToSend.length > 0 ? targetItemsToSend : undefined,
              toolName: rawToolName || undefined,
            };
            return updated;
          }
          return prev;
        });
      }, 50);

      setTimeout(() => fetchDailyLimitRef.current(), 2000);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : t("ai.networkError")
      );
    }
  }, [aiInput, aiLoading, aiTargetItems, resizeAiInput, sendAiMessage, setAiMessages, buildAiChatContext, t]);

  const handleCancelAiSubmit = useCallback(() => {
    void stopAiMessage();
    setAiError(null);
  }, [stopAiMessage]);

  const handleBackToPrompt = useCallback(() => {
    if (aiLoading) return;

    setAiError(null);
    setAiBatchPreview([]);
    setAiAnswer(null);
  }, [aiLoading]);

  const handleManualInput = useCallback(() => {
    if (aiLoading) return;
    setExpandedState(false);
    openComposer();
  }, [aiLoading, setExpandedState, openComposer]);

  const handleToggleBatchPreviewSelection = useCallback((index: number, selected: boolean) => {
    setAiBatchPreview((current) => current.map((item, i) => i === index ? { ...item, selected } : item));
  }, []);

  const handleEditBatchPreview = useCallback((index: number) => {
    if (aiLoading) return;

    const item = aiBatchPreview[index];
    if (!item) return;

    suspendedAiReviewRef.current = {
      aiTargetItems: [...aiTargetItems],
      aiBatchPreview: aiBatchPreview.map((entry) => ({ ...entry })),
      aiAnswer,
      aiError,
    };
    shouldRestoreAiReviewRef.current = true;
    shouldRestoreAiReviewAfterSaveRef.current = false;
    didSaveComposerRef.current = false;

    setExpandedState(false);
    setComposerSubmitOverride((savedForm: ItemFormState) => {
      shouldRestoreAiReviewAfterSaveRef.current = true;
      setAiBatchPreview((current) =>
        current.map((entry, i) =>
          i === index ? { ...entry, formState: savedForm } : entry
        )
      );
      setComposerSubmitOverride(null);
      return null;
    });
    openComposerWithForm(item.formState);
  }, [aiLoading, aiBatchPreview, aiTargetItems, aiAnswer, aiError, setExpandedState, setComposerSubmitOverride, openComposerWithForm]);

  const handleConfirmAiPreview = useCallback(async () => {
    if (aiBatchPreview.length === 0 || aiLoading) return;

    const selectedDrafts = aiBatchPreview.filter((item) => item.selected);
    if (selectedDrafts.length === 0) {
      setAiError(t("ai.selectAtLeastOne"));
      return;
    }

    const updateItems = selectedDrafts
      .filter((item): item is AiBatchPreviewItem & { targetItemId: string } =>
        item.kind === "update" && typeof item.targetItemId === "string"
      )
      .map((item) => ({
        itemId: item.targetItemId,
        form: item.formState,
      }));

    const createItems = selectedDrafts
      .filter((item) => item.kind === "create")
      .map((item) => item.formState);

    const deleteItems = selectedDrafts
      .filter((item): item is AiBatchPreviewItem & { targetItemId: string } =>
        item.kind === "delete" && typeof item.targetItemId === "string"
      )
      .map((item) => manualItems.find((record) => record.id === item.targetItemId))
      .filter((record): record is NonNullable<typeof record> => Boolean(record))
      .map((record) => toItemFromManualRecord(record));

    const deleteProjects = selectedDrafts
      .filter((item): item is AiBatchPreviewItem & { projectId: string } =>
        item.kind === "delete_project" && typeof item.projectId === "string"
      )
      .map((item) => item.projectId);

    const createProgresses = selectedDrafts.filter((item) => item.kind === "create_progress");
    const updateProgresses = selectedDrafts
      .filter((item): item is AiBatchPreviewItem & { progressId: string } =>
        item.kind === "update_progress" && typeof item.progressId === "string"
      )
      .map((item) => ({ progressId: item.progressId, patch: item.progressPatch ?? {} }));
    const deleteProgresses = selectedDrafts
      .filter((item): item is AiBatchPreviewItem & { progressId: string } =>
        item.kind === "delete_progress" && typeof item.progressId === "string"
      )
      .map((item) => item.progressId);
    const bindTasksList = selectedDrafts
      .filter((item): item is AiBatchPreviewItem & { progressId: string; progressItemIds: string[] } =>
        item.kind === "bind_progress_tasks" &&
        typeof item.progressId === "string" &&
        Array.isArray(item.progressItemIds)
      )
      .map((item) => ({ progressId: item.progressId, itemIds: item.progressItemIds }));
    const unbindTasksList = selectedDrafts
      .filter((item): item is AiBatchPreviewItem & { progressId: string; progressItemIds: string[] } =>
        item.kind === "unbind_progress_tasks" &&
        typeof item.progressId === "string" &&
        Array.isArray(item.progressItemIds)
      )
      .map((item) => ({ progressId: item.progressId, itemIds: item.progressItemIds }));
    const setManualValuesList = selectedDrafts
      .filter((item): item is AiBatchPreviewItem & { progressId: string; progressManualValue: number } =>
        item.kind === "set_manual_value" &&
        typeof item.progressId === "string" &&
        typeof item.progressManualValue === "number"
      )
      .map((item) => ({ progressId: item.progressId, value: item.progressManualValue }));
    const generateProgressTasksList = selectedDrafts
      .filter((item): item is AiBatchPreviewItem & { progressId: string; progressGeneratedTasks: Array<{ title: string; description?: string }> } =>
        item.kind === "generate_progress_tasks" &&
        typeof item.progressId === "string" &&
        Array.isArray(item.progressGeneratedTasks)
      )
      .map((item) => ({ progressId: item.progressId, tasks: item.progressGeneratedTasks }));

    if (updateItems.length > 0) {
      applyAiUpdates(updateItems);
    }

    if (createItems.length > 0) {
      const error = handleCreateItems(createItems);
      if (error) {
        setAiError(error);
        return;
      }
    }

    if (deleteItems.length > 0) {
      handleBatchDelete(deleteItems);
    }

    if (deleteProjects.length > 0) {
      for (const projectId of deleteProjects) {
        if (!userId) {
          setAiError(t("ai.missingUser"));
          return;
        }
        const error = handleDeleteProject(projectId);
        if (error) {
          setAiError(error);
          return;
        }
      }
    }

    if (createProgresses.length > 0) {
      if (!userId) {
        setAiError(t("ai.missingUser"));
        return;
      }
      for (const item of createProgresses) {
        if (typeof item.progressGoalValue !== "number" || !item.progressName) continue;
        await createProgress(userId, {
          name: item.progressName,
          description: item.progressDescription,
          goalValue: item.progressGoalValue,
          goalUnit: item.progressGoalUnit ?? "tasks",
          trackingMode: item.progressTrackingMode ?? "count",
          color: item.progressColor,
          targetDate: item.progressTargetDate,
        });
      }
    }

    if (updateProgresses.length > 0) {
      if (!userId) {
        setAiError(t("ai.missingUser"));
        return;
      }
      for (const { progressId, patch } of updateProgresses) {
        const result = await updateProgress(userId, progressId, patch);
        if (!result) {
          setAiError(t("ai.progress.updateFailed"));
          return;
        }
      }
    }

    if (deleteProgresses.length > 0) {
      if (!userId) {
        setAiError(t("ai.missingUser"));
        return;
      }
      for (const progressId of deleteProgresses) {
        const ok = await deleteProgress(userId, progressId);
        if (!ok) {
          setAiError(t("ai.progress.deleteFailed"));
          return;
        }
      }
    }

    if (bindTasksList.length > 0) {
      if (!userId) {
        setAiError(t("ai.missingUser"));
        return;
      }
      for (const { progressId, itemIds } of bindTasksList) {
        await bindProgressTasks(userId, progressId, itemIds);
      }
    }

    if (unbindTasksList.length > 0) {
      if (!userId) {
        setAiError(t("ai.missingUser"));
        return;
      }
      for (const { progressId, itemIds } of unbindTasksList) {
        for (const itemId of itemIds) {
          await unbindProgressTask(userId, progressId, itemId);
        }
      }
    }

    if (setManualValuesList.length > 0) {
      if (!userId) {
        setAiError(t("ai.missingUser"));
        return;
      }
      for (const { progressId, value } of setManualValuesList) {
        const ok = await setManualValue(userId, progressId, value);
        if (!ok) {
          setAiError(t("ai.progress.updateFailed"));
          return;
        }
      }
    }

    if (generateProgressTasksList.length > 0) {
      if (!userId) {
        setAiError(t("ai.missingUser"));
        return;
      }
      for (const { progressId, tasks } of generateProgressTasksList) {
        // Create tasks using the existing form-based creation
        const forms: ItemFormState[] = tasks.map((task) => ({
          title: task.title,
          description: task.description || "",
          hasTime: false,
          startDate: "",
          startTime: "",
          endDate: "",
          endTime: "",
          allDay: false,
          hasDueDate: false,
          dueDate: "",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          recurrenceType: "none",
          recurrenceInterval: "1",
          daysOfWeek: [false, false, false, false, false, false, false],
          recurrenceEndType: "never",
          recurrenceEndDate: "",
          recurrenceCount: "",
          monthlyPattern: "day_of_month",
          nthWeekdayPosition: "1",
          nthWeekdayDay: 1,
          priority: undefined,
          estimateMinutes: "",
          tags: [],
          subtasks: [],
          projectId: "",
          projectName: "",
          progressIds: [],
          status: undefined,
          reminders: [],
        }));
        const error = handleCreateItems(forms);
        if (error) {
          setAiError(error);
          return;
        }
        // Find created items by title and bind to progress
        const store = useAllPageStore.getState();
        const createdIds = tasks
          .map((task) => store.manualItems.find((item) => item.title === task.title && !item.deletedAt)?.id)
          .filter((id): id is string => Boolean(id));
        if (createdIds.length > 0) {
          await bindProgressTasks(userId, progressId, createdIds);
        }
      }
    }

    setAiBatchPreview([]);
    setAiTargetItems([]);
    setAiError(null);
  }, [aiBatchPreview, aiLoading, manualItems, toItemFromManualRecord, applyAiUpdates, handleCreateItems, handleBatchDelete, handleDeleteProject, createProgress, updateProgress, deleteProgress, bindProgressTasks, unbindProgressTask, setManualValue, userId, t]);

  const applyDroppedItem = useCallback((item: CandidateItem) => {
    setAiTargetItems((current) => {
      const exists = current.some((entry) => entry.id === item.id);
      if (exists) {
        return current;
      }

      if (current.length >= AI_DROPPED_TARGET_LIMIT) {
        setAiError(t("ai.dragLimit", { count: AI_DROPPED_TARGET_LIMIT }));
        return current;
      }

      return [...current, item];
    });
    setAiError(null);
    setExpandedState(true);
    setTimeout(() => aiInputRef.current?.focus(), 0);
  }, [setExpandedState, aiInputRef, t]);

  // --- Effects ---

  // Auto-focus AI input when expanded
  useEffect(() => {
    if (isExpanded) {
      aiInputRef.current?.focus();
    }
  }, [isExpanded, aiInputRef]);

  // Reset textarea height when panel opens with empty input
  useEffect(() => {
    if (isExpanded && !aiInput) {
      const el = aiInputRef.current;
      if (el) {
        el.style.height = "44px";
      }
    }
  }, [isExpanded, aiInput, aiInputRef]);

  // Track input container height for dynamic chat area padding
  const lastTrackedHeightRef = useRef(0);
  useEffect(() => {
    const el = aiInputContainerRef.current;
    if (!el || !isExpanded) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.round(entry.contentRect.height);
        if (height === lastTrackedHeightRef.current) return;
        lastTrackedHeightRef.current = height;
        if (aiInputBaselineHeightRef.current === null) {
          aiInputBaselineHeightRef.current = height;
        }
        setAiInputContainerHeight(height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isExpanded]);

  // Also read container height when tags or input content changes
  useEffect(() => {
    if (!isExpanded) return;
    const el = aiInputContainerRef.current;
    if (!el) return;
    const height = Math.round(el.offsetHeight);
    if (height !== lastTrackedHeightRef.current) {
      lastTrackedHeightRef.current = height;
      setAiInputContainerHeight(height);
    }
  }, [aiTargetItems.length, aiInput, isExpanded]);

  // Auto-scroll down when padding increases
  useEffect(() => {
    if (!isExpanded) return;
    const scrollEl = aiChatOuterScrollRef.current;
    if (!scrollEl) return;
    const currentPadding = Math.max(64, aiInputContainerHeight);
    const prevPadding = prevChatPaddingRef.current;
    const delta = currentPadding - prevPadding;
    prevChatPaddingRef.current = currentPadding;
    if (delta > 0) {
      scrollEl.scrollBy({ top: delta, behavior: "smooth" });
    }
  }, [aiInputContainerHeight, isExpanded]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!isExpanded) return;
    const scrollEl = aiChatOuterScrollRef.current;
    if (!scrollEl) return;
    scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
  }, [aiMessages.length, isExpanded]);

  // Scroll to bottom when scroll container re-appears after drag
  useLayoutEffect(() => {
    if (!isExpanded || isDragOver) return;
    aiChatOuterScrollRef.current?.scrollTo({ top: aiChatOuterScrollRef.current.scrollHeight });
  }, [isDragOver, isExpanded]);

  // Cleanup drag expand timeout on unmount
  useEffect(() => {
    return () => {
      if (dragExpandTimeoutRef.current) {
        clearTimeout(dragExpandTimeoutRef.current);
      }
      void stopAiMessage();
    };
  }, [stopAiMessage]);

  useEffect(() => {
    function handleItemFormSaved() {
      didSaveComposerRef.current = true;
    }

    window.addEventListener(ITEM_FORM_SAVED_EVENT, handleItemFormSaved);
    return () => window.removeEventListener(ITEM_FORM_SAVED_EVENT, handleItemFormSaved);
  }, []);

  // Composer open/close — restore suspended AI review
  useEffect(() => {
    const wasComposerOpen = previousComposerOpenRef.current;
    previousComposerOpenRef.current = isComposerOpen;

    if (!wasComposerOpen || isComposerOpen || !shouldRestoreAiReviewRef.current) {
      return;
    }

    if (didSaveComposerRef.current && !shouldRestoreAiReviewAfterSaveRef.current) {
      suspendedAiReviewRef.current = null;
      shouldRestoreAiReviewRef.current = false;
      shouldRestoreAiReviewAfterSaveRef.current = false;
      didSaveComposerRef.current = false;
      return;
    }

    const suspendedReview = suspendedAiReviewRef.current;
    if (suspendedReview) {
      setAiTargetItems(suspendedReview.aiTargetItems);
      setAiBatchPreview(suspendedReview.aiBatchPreview);
      setAiAnswer(suspendedReview.aiAnswer);
      setAiError(suspendedReview.aiError);
      setExpandedState(true);
    }

    shouldRestoreAiReviewRef.current = false;
    shouldRestoreAiReviewAfterSaveRef.current = false;
    didSaveComposerRef.current = false;
  }, [isComposerOpen, setExpandedState]);

  // --- Drag & Drop ---
  function isPointInsideRect(rect: DOMRect, x: number, y: number) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  const isInsideDropZone = useEffectEvent((x: number, y: number) => {
    const panelRect = dragPanelRef.current?.getBoundingClientRect();
    if (panelRect && panelRect.width > 0 && panelRect.height > 0 && isPointInsideRect(panelRect, x, y)) {
      return true;
    }

    const fabRect = dragFabRef.current?.getBoundingClientRect();
    if (fabRect && fabRect.width > 0 && fabRect.height > 0 && isPointInsideRect(fabRect, x, y)) {
      return true;
    }

    return false;
  });

  const dragDisabled = aiBatchPreview.length > 0 || Boolean(aiAnswer);

  useEffect(() => {
    function clearDragExpandTimeout() {
      if (dragExpandTimeoutRef.current) {
        clearTimeout(dragExpandTimeoutRef.current);
        dragExpandTimeoutRef.current = null;
      }
    }

    function scheduleDragExpand() {
      if (dragDisabled || isExpanded || dragExpandTimeoutRef.current) {
        return;
      }

      dragExpandTimeoutRef.current = setTimeout(() => {
        setExpandedState(true);
        dragExpandedByTimerRef.current = true;
        dragExpandTimeoutRef.current = null;
      }, 500);
    }

    function startDragInteraction() {
      setIsDragOver(true);
    }

    function stopDragInteraction() {
      setIsDragOver(false);
    }

    function isItemDragging() {
      return document.body.classList.contains("is-item-dragging");
    }

    function isCalendarEventDragging() {
      return document.body.classList.contains("is-calendar-event-dragging");
    }

    function syncDragInteraction(e: DragEvent) {
      if (dragDisabled) {
        clearDragExpandTimeout();
        setIsDraggingItem(false);
        stopDragInteraction();
        dragInsideDropZoneRef.current = false;
        return false;
      }

      if (!isItemDragging()) {
        setIsDraggingItem(false);
        return false;
      }

      setIsDraggingItem(true);
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }

      if (!isCalendarEventDragging()) {
        scheduleDragExpand();
      }

      if (isInsideDropZone(e.clientX, e.clientY)) {
        dragInsideDropZoneRef.current = true;
        startDragInteraction();
      } else {
        dragInsideDropZoneRef.current = false;
        stopDragInteraction();
      }

      return true;
    }

    function handleGlobalDragEnter(e: DragEvent) {
      syncDragInteraction(e);
    }

    function handleGlobalDragOver(e: DragEvent) {
      syncDragInteraction(e);
    }

    function handleGlobalDrop(e: DragEvent) {
      if (!isItemDragging()) {
        setIsDraggingItem(false);
        return;
      }

      e.preventDefault();
      clearDragExpandTimeout();
      setIsDraggingItem(false);
      stopDragInteraction();
      dragInsideDropZoneRef.current = false;

      const droppedInside = isInsideDropZone(e.clientX, e.clientY);
      if (!droppedInside) {
        if (dragExpandedByTimerRef.current) {
          setExpandedState(false);
          dragExpandedByTimerRef.current = false;
        }
        return;
      }
      dragExpandedByTimerRef.current = false;

      try {
        const data = e.dataTransfer?.getData("application/json");
        if (data) {
          applyDroppedItem(JSON.parse(data) as CandidateItem);
        }
      } catch {
        // Invalid drop data
      }
    }

    function handleWindowDragEnd() {
      clearDragExpandTimeout();
      setIsDraggingItem(false);
      stopDragInteraction();
      if (dragExpandedByTimerRef.current && !dragInsideDropZoneRef.current) {
        setExpandedState(false);
        dragExpandedByTimerRef.current = false;
      }
      dragInsideDropZoneRef.current = false;
    }

    document.addEventListener("dragenter", handleGlobalDragEnter, true);
    document.addEventListener("dragover", handleGlobalDragOver, true);
    document.addEventListener("drop", handleGlobalDrop, true);
    window.addEventListener("dragend", handleWindowDragEnd);

    return () => {
      document.removeEventListener("dragenter", handleGlobalDragEnter, true);
      document.removeEventListener("dragover", handleGlobalDragOver, true);
      document.removeEventListener("drop", handleGlobalDrop, true);
      window.removeEventListener("dragend", handleWindowDragEnd);
    };
  }, [applyDroppedItem, dragDisabled, isExpanded, setExpandedState]);

  useEffect(() => {
    function handleDragVisualEvent(e: Event) {
      const detail = (e as CustomEvent<{ enabled?: boolean; color?: string }>).detail;
      if (!detail?.enabled || !detail.color) {
        setDragHighlightColor("#7b7580");
        return;
      }

      setDragHighlightColor(detail.color);
    }

    window.addEventListener(DRAG_VISUAL_EVENT, handleDragVisualEvent);
    return () => window.removeEventListener(DRAG_VISUAL_EVENT, handleDragVisualEvent);
  }, []);

  // Listen for "AI Edit" from item-card
  useEffect(() => {
    function handleOpenAiUpdate(e: Event) {
      const detail = (e as CustomEvent).detail as CandidateItem;
      applyDroppedItem(detail);
    }
    window.addEventListener("orkest:open-ai-update", handleOpenAiUpdate);
    return () => window.removeEventListener("orkest:open-ai-update", handleOpenAiUpdate);
  }, [applyDroppedItem]);

  return {
    // State
    isExpanded,
    isFullscreen,
    isComposerOpen,
    aiInput,
    aiError,
    aiBatchPreview,
    aiAnswer,
    aiTargetItems,
    isDragOver,
    isDraggingItem,
    dragHighlightColor,
    aiInputContainerHeight,
    aiMessages,
    aiLoading,
    aiChatStatus,
    showHistory,
    showMemories,
    memories,
    conversations,
    currentConversationId,
    aiDailyRemaining,
    aiDailyLimit,
    fetchDailyLimit,
    // Computed
    isReviewingAiItem,
    isShowingAiAnswer,
    isShowingResult,
    showDragHint,
    candidateItems,
    projects,
    // Actions
    setExpandedState,
    toggleFullscreen,
    setIsFullscreen,
    setAiInput,
    setAiError,
    setAiBatchPreview,
    setAiAnswer,
    setAiTargetItems,
    setIsDragOver,
    setShowHistory,
    setShowMemories,
    fetchMemories,
    deleteMemoryById,
    handleNewChat,
    handleLoadConversation,
    handleDeleteConversation,
    handleAiSubmit,
    handleCancelAiSubmit,
    handleBackToPrompt,
    handleManualInput,
    handleToggleBatchPreviewSelection,
    handleEditBatchPreview,
    handleConfirmAiPreview,
    applyDroppedItem,
    buildAiChatContext,
    resizeAiInput,
    // Refs
    aiInputRef,
    aiChatOuterScrollRef,
    aiChatScrollRef,
    aiInputContainerRef,
    dragPanelRef,
    dragFabRef,
  };
}
