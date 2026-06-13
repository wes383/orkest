"use client";

import { Bot, Home, MessageCircle, Plus, ArrowUp, Square, Sparkles, Trash2, X, Clock, Mic, Loader2, Brain, Maximize2, Minimize2, PanelRight, PanelBottom, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownText } from "@/components/ui/markdown-text";
import { useVoiceInput } from "@/lib/hooks/use-voice-input";
import { useI18n, addLocaleToPathname } from "@/lib/i18n";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import type { AiPanelStyle } from "@/lib/contexts/ai-chat-context";

import type { CandidateItem } from "@/lib/ai/candidate-search";
import type {
  AiBatchPreviewItem,
  OrkestAIMessage,
} from "@/lib/ai/chat-types";
import {
  isAiToolResult,
  getMessageText,
} from "@/lib/ai/chat-types";
import { withAlpha } from "@/lib/all-page-utils";

type UserMessageBubbleProps = {
  text: string | null;
  isSingleLine: boolean;
  isUser: boolean;
  hasReview: boolean;
  isAssistant: boolean;
  isFullscreen?: boolean;
  renderAiToolStatus: () => React.ReactNode;
  aiBatchPreview: AiBatchPreviewItem[];
  setAiBatchPreview: React.Dispatch<React.SetStateAction<AiBatchPreviewItem[]>>;
  handleBackToPrompt: () => void;
  handleConfirmAiPreview: () => void;
  renderAiBatchPreviewItem: (item: AiBatchPreviewItem, index: number) => React.ReactNode;
  targetItems?: CandidateItem[];
  toolName?: string;
};

function UserMessageBubble({
  text,
  isSingleLine,
  isUser,
  hasReview,
  isAssistant,
  isFullscreen,
  renderAiToolStatus,
  aiBatchPreview,
  setAiBatchPreview,
  handleBackToPrompt,
  handleConfirmAiPreview,
  renderAiBatchPreviewItem,
  targetItems,
  toolName,
}: UserMessageBubbleProps) {
  const { t } = useI18n();
  const textRef = React.useRef<HTMLParagraphElement>(null);
  const [isWrapped, setIsWrapped] = React.useState(false);

  React.useLayoutEffect(() => {
    if (textRef.current && isSingleLine) {
      setIsWrapped(textRef.current.scrollWidth > textRef.current.clientWidth);
    }
  }, [text, isSingleLine]);

  const useCapsule = isSingleLine && !isWrapped && (!targetItems || targetItems.length === 0);

  return (
    <div
      className={`border ${
        isUser
          ? `ml-8 border-black/8 bg-[#25242a] text-white ${useCapsule ? "inline-flex items-center max-w-[70%] rounded-3xl px-4 py-2.5" : "rounded-2xl p-3"}`
          : `mr-8 border-black/8 bg-white/75 text-[#3c3841] ${useCapsule ? "inline-flex flex-col max-w-[85%] rounded-3xl px-4 py-2.5" : "rounded-2xl p-3"}`
      }`}
    >
      {text ? (
        isAssistant ? (
          <div className="text-sm leading-6">
            <MarkdownText isFullscreen={isFullscreen}>{text}</MarkdownText>
          </div>
        ) : (
          <p
            ref={textRef}
            className={`text-sm leading-6 ${useCapsule ? "whitespace-pre-wrap break-words" : "whitespace-pre-wrap"}`}
          >
            {toolName ? (
              <>
                <span className="text-white/45">/{toolName}{text === `/${toolName}` ? "" : " "}</span>
                {text !== `/${toolName}` ? text : ""}
              </>
            ) : (
              text
            )}
          </p>
        )
      ) : null}
      {isUser && targetItems && targetItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {targetItems.map((target) => (
            <span
              key={target.id}
              className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/8 px-2 py-0.5 text-[11px] text-white/90"
            >
              <span className="max-w-32 truncate">{target.title}</span>
            </span>
          ))}
        </div>
      )}
      {isAssistant ? renderAiToolStatus() : null}

      {hasReview && (
        <div className="mt-4 space-y-3 border-t border-black/8 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.24em] text-[#7b7580] uppercase">
                Review Changes
              </p>
              <p className="mt-1 text-sm text-[#5f5a63]">
                {aiBatchPreview.filter((item) => item.selected).length} of {aiBatchPreview.length} selected
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setAiBatchPreview((current) =>
                  current.map((item) => ({ ...item, selected: true }))
                )
              }
              className="h-8 text-xs"
            >
              {t("ai.selectAll")}
            </Button>
          </div>

          <div className="space-y-3">
            {aiBatchPreview.map((item, index) => renderAiBatchPreviewItem(item, index))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBackToPrompt}
              className="h-8 text-xs"
            >
              Clear Review
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmAiPreview}
              disabled={aiBatchPreview.every((item) => !item.selected)}
              className="h-8 text-xs"
            >
              Apply Selected
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import React from "react";

import type { useAiChat } from "@/lib/hooks/use-ai-chat";

type AiOverlayProps = {
  ai: ReturnType<typeof useAiChat>;
  renderAiBatchPreviewItem: (item: AiBatchPreviewItem, index: number) => React.ReactNode;
  renderAiChatMessages?: () => React.ReactNode;
  quickPrompts?: string[];
  emptyStateMessage?: string;
  dragHighlightColorOverride?: string;
  hideFab?: boolean;
  hideFullscreenToggle?: boolean;
  onClose?: () => void;
};

type SlashTool = {
  name: string;
  label: string;
  description: string;
  toolName: string;
};

const SLASH_TOOLS: SlashTool[] = [
  { name: "plan-today", label: "/plan-today", description: "Plan today's schedule", toolName: "planMyDay" },
  { name: "plan-week", label: "/plan-week", description: "Plan the week ahead", toolName: "planMyWeek" },
  { name: "add", label: "/add", description: "Add new tasks", toolName: "proposeCreateItems" },
  { name: "update", label: "/update", description: "Update existing tasks", toolName: "proposeUpdateItems" },
  { name: "done", label: "/done", description: "Complete or reactivate tasks", toolName: "proposeStatusChange" },
  { name: "batch-complete", label: "/batch-complete", description: "Batch complete tasks", toolName: "proposeBatchComplete" },
  { name: "delete", label: "/delete", description: "Delete tasks", toolName: "proposeDeleteItems" },
  { name: "schedule", label: "/schedule", description: "Schedule tasks into time slots", toolName: "proposeScheduleItems" },
  { name: "subtask", label: "/subtask", description: "Break a task into subtasks", toolName: "proposeDecomposeTask" },
  { name: "search", label: "/search", description: "Search for tasks", toolName: "searchItems" },
  { name: "today", label: "/today", description: "View today's schedule overview", toolName: "getTodaySchedule" },
  { name: "overdue", label: "/overdue", description: "Find overdue tasks", toolName: "getOverdueTasks" },
  { name: "upcoming", label: "/upcoming", description: "Find upcoming due tasks", toolName: "getUpcomingDueTasks" },
  { name: "duration", label: "/duration", description: "Estimate task duration", toolName: "estimateTaskDuration" },
  { name: "check-conflicts", label: "/check-conflicts", description: "Detect schedule conflicts", toolName: "detectConflicts" },
  { name: "move-to-tomorrow", label: "/move-to-tomorrow", description: "Move tasks to tomorrow", toolName: "rescheduleToTomorrow" },
  { name: "memory", label: "/memory", description: "Remember a preference", toolName: "updateUserMemory" },
  { name: "briefing", label: "/briefing", description: "Get daily briefing", toolName: "getDailyBriefing" },
  { name: "review", label: "/review", description: "Get weekly review", toolName: "getWeeklyReview" },
];

export function AiOverlay({
  ai,
  renderAiBatchPreviewItem,
  renderAiChatMessages,
  quickPrompts,
  emptyStateMessage,
  dragHighlightColorOverride,
  hideFab = false,
  hideFullscreenToggle = false,
  onClose,
}: AiOverlayProps) {
  const { t, locale } = useI18n();
  const aiContext = useAiChatContext();
  const { panelStyle, setPanelStyle, displayMode, setDisplayMode } = aiContext;
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const styleMenuRef = useRef<HTMLDivElement>(null);
  const styleButtonRef = useRef<HTMLButtonElement>(null);

  // Close style menu on outside click
  useEffect(() => {
    if (!showStyleMenu) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        styleButtonRef.current?.contains(target) ||
        styleMenuRef.current?.contains(target)
      ) {
        return;
      }
      setShowStyleMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showStyleMenu]);
  const {
    isExpanded,
    isFullscreen,
    isComposerOpen,
    isShowingResult,
    showDragHint,
    isDragOver,
    aiInput,
    aiError,
    aiBatchPreview,
    aiAnswer,
    aiTargetItems,
    aiMessages,
    aiLoading,
    aiChatStatus,
    showHistory,
    showMemories,
    memories,
    conversations,
    currentConversationId,
    isReviewingAiItem,
    isShowingAiAnswer,
    aiInputContainerHeight,
    aiInputContainerRef,
    dragPanelRef,
    dragFabRef,
    aiInputRef,
    aiChatScrollRef,
    aiChatOuterScrollRef,
    setExpandedState,
    toggleFullscreen,
    setIsFullscreen,
    setAiInput,
    setAiBatchPreview,
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
    handleConfirmAiPreview,
    applyDroppedItem,
    resizeAiInput,
  } = ai;

  // --- Mobile detection & fullscreen enforcement ---
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile && isExpanded && !isFullscreen) {
      setIsFullscreen(true);
      setDisplayMode("fullscreen");
    }
  }, [isMobile, isExpanded, isFullscreen, setIsFullscreen, setDisplayMode]);

  const effectiveHideFullscreenToggle = hideFullscreenToggle || isMobile;

  const toolMatch = aiInput.match(/^\/([\w-]+)(\s+)/);
  const matchedToolName = toolMatch ? toolMatch[1] : null;
  const isValidTool = matchedToolName ? SLASH_TOOLS.some(t => t.name === matchedToolName) : false;

  let toolPart = "";
  let restPart = "";
  if (isValidTool && toolMatch) {
    toolPart = toolMatch[0];
    restPart = aiInput.slice(toolPart.length);
  }

  const paddingLeftClass = isFullscreen ? "pl-12" : "pl-[5.5rem]";
  const paddingTopClass = aiTargetItems.length > 0 ? "pt-2" : "pt-3";
  const paddingClasses = `${paddingTopClass} pb-2.5 ${paddingLeftClass} pr-14`;

  const effectiveDragColor = dragHighlightColorOverride ?? ai.dragHighlightColor;


  const hideFAB = isComposerOpen || isExpanded || isFullscreen || hideFab;

  const {
    isRecording,
    isTranscribing,
    error: voiceError,
    startRecording,
    stopRecording,
    resetError: resetVoiceError,
  } = useVoiceInput();

  // --- Slash command menu ---
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  const filteredTools = slashFilter
    ? SLASH_TOOLS.filter((t) => t.name.toLowerCase().includes(slashFilter.toLowerCase()))
    : SLASH_TOOLS;

  const selectSlashTool = useCallback((tool: SlashTool) => {
    setAiInput(`/${tool.name} `);
    setShowSlashMenu(false);
    setSlashFilter("");
    setSlashIndex(0);
    setTimeout(() => {
      const el = aiInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 0);
  }, [setAiInput, aiInputRef]);

  // Compute slash menu position based on textarea
  const [slashMenuPos, setSlashMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!showSlashMenu) {
      setSlashMenuPos(null);
      return;
    }
    const el = aiInputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSlashMenuPos({ top: rect.top - 4, left: rect.left, width: rect.width });
  }, [showSlashMenu, slashFilter, aiInputRef]);

  // Close slash menu on outside click
  useEffect(() => {
    if (!showSlashMenu) return;
    function handleClick(e: MouseEvent) {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setShowSlashMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSlashMenu]);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const [isFabRecording, setIsFabRecording] = useState(false);

  const handleFabPointerDown = async (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(async () => {
      isLongPressRef.current = true;
      setIsFabRecording(true);
      await startRecording();
    }, 400);
  };

  const handleFabPointerUp = async () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      setIsFabRecording(false);
      setExpandedState(true);
      const transcript = await stopRecording();
      if (transcript) {
        setAiInput(transcript);
      }
    }
  };

  const handleFabPointerLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      setIsFabRecording(false);
      stopRecording();
    }
  };

  useEffect(() => {
    if (!isExpanded) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isFullscreen && (showHistory || showMemories)) {
          setShowHistory(false);
          setShowMemories(false);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          setExpandedState(false);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExpanded, isFullscreen, showHistory, showMemories, setExpandedState, setIsFullscreen, setShowHistory, setShowMemories]);

  // Hide body scrollbar when fullscreen
  useEffect(() => {
    if (isFullscreen && isExpanded) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isFullscreen, isExpanded]);

  const dragPanelBackground = isDragOver && isExpanded
    ? withAlpha(effectiveDragColor, 0.24)
    : isFullscreen
      ? "var(--background)"
      : "var(--ai-panel-bg)";
  const dragFabBackground = isDragOver && !isExpanded
    ? withAlpha(effectiveDragColor, 0.32)
    : "var(--ai-fab-bg)";
  const dragFabHoverBackground = isDragOver && !isExpanded
    ? withAlpha(effectiveDragColor, 0.42)
    : "var(--ai-fab-hover-bg)";

  function renderAiToolStatus(message: OrkestAIMessage) {
    const toolParts = (message.parts ?? []).filter((part) => part.type.startsWith("tool-"));
    if (toolParts.length === 0) return null;

    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {toolParts.map((part, index) => {
          const state = "state" in part ? part.state : "input-available";
          const output = "output" in part ? part.output : undefined;
          const rawLabel = isAiToolResult(output)
            ? output.message
            : state === "output-available"
              ? t("ai.toolCompleted")
              : t("ai.usingTool");
          return (
            <span
              key={`${message.id}-tool-${index}`}
              className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-black/8 bg-[#f8f7f6] px-2.5 py-1 text-xs text-[#6d6871]"
            >
              <Sparkles className="h-3 w-3 shrink-0" />
              <span className="truncate">{rawLabel}</span>
            </span>
          );
        })}
      </div>
    );
  }

  function renderDefaultAiChatMessages() {
    const prompts = quickPrompts ?? [t("ai.prompt.addTask"), t("ai.prompt.updateSelected"), t("ai.prompt.planDay"), t("ai.prompt.findConflicts"), t("ai.prompt.breakDown")];

    const message = emptyStateMessage ?? t("ai.defaultEmpty");

    if (aiMessages.length === 0) {
      return (
        <div className="mb-4 rounded-2xl border border-black/8 bg-white/60 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[#3c3841]">
            <Bot className="h-4 w-4 text-[#7b7580]" />
            {message}
          </div>
          {!isFullscreen && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setAiInput(prompt);
                    setTimeout(() => {
                      const el = aiInputRef.current;
                      if (el) {
                        el.focus();
                        el.setSelectionRange(el.value.length, el.value.length);
                      }
                    }, 0);
                  }}
                  className="cursor-pointer rounded-full border border-black/8 bg-white px-2.5 py-1 text-xs font-medium text-[#5f5a63] transition-colors hover:bg-black/[0.03]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    const lastAssistantMessageIndex = [...aiMessages].reverse().findIndex((m) => m.role === "assistant");
    const lastAssistantMessageId = lastAssistantMessageIndex >= 0
      ? aiMessages[aiMessages.length - 1 - lastAssistantMessageIndex].id
      : null;

    return (
      <div ref={aiChatScrollRef} className="space-y-3 overflow-y-auto pr-1">
        {aiMessages.map((message) => {
          const text = getMessageText(message);
          if (!text && message.role === "user") return null;

          const isLastAssistant = message.role === "assistant" && message.id === lastAssistantMessageId;
          const hasReview = isLastAssistant && isReviewingAiItem;

          const isSingleLine = !!text && !text.includes("\n");

          return (
            <div key={message.id} className={message.role === "user" ? "flex justify-end" : ""}>
              <UserMessageBubble
                text={text}
                isSingleLine={isSingleLine}
                isUser={message.role === "user"}
                hasReview={hasReview}
                isAssistant={message.role === "assistant"}
                isFullscreen={isFullscreen}
                renderAiToolStatus={() => renderAiToolStatus(message)}
                aiBatchPreview={aiBatchPreview}
                setAiBatchPreview={setAiBatchPreview}
                handleBackToPrompt={handleBackToPrompt}
                handleConfirmAiPreview={handleConfirmAiPreview}
                renderAiBatchPreviewItem={renderAiBatchPreviewItem}
                targetItems={message.targetItems}
                toolName={message.toolName}
              />
            </div>
          );
        })}
        {aiChatStatus === "submitted" && (
          <div className="flex justify-start">
            <div className="inline-flex items-center rounded-3xl border border-black/8 bg-white/75 px-4 py-2.5">
              <span className="flex translate-y-px gap-1">
                <span className="h-1.5 w-1.5 animate-[bounce_1.4s_infinite_0s] rounded-full bg-[#8c8691]"></span>
                <span className="h-1.5 w-1.5 animate-[bounce_1.4s_infinite_0.2s] rounded-full bg-[#8c8691]"></span>
                <span className="h-1.5 w-1.5 animate-[bounce_1.4s_infinite_0.4s] rounded-full bg-[#8c8691]"></span>
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const isSidebarMode = displayMode === "sidebar" && isExpanded;

  return (
    <div className={isSidebarMode ? "fixed right-0 top-0 bottom-0 z-20 w-[360px]" : "fixed right-6 bottom-6 z-20"}>
      {/* Expanded rectangular input panel - bottom-aligned with FAB */}
      <div
        ref={dragPanelRef}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        style={{
          backgroundColor: dragPanelBackground,
          backdropFilter: isFullscreen ? "none" : "blur(18px) saturate(140%)",
          WebkitBackdropFilter: isFullscreen ? "none" : "blur(18px) saturate(140%)",
        }}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isFullscreen && isExpanded
            ? "fixed inset-0 z-50 rounded-none border-0 shadow-none"
            : isSidebarMode
              ? "h-full rounded-none border-l border-black/8 dark:border-white/10 shadow-none"
              : `origin-bottom-right absolute right-0 bottom-0 rounded-2xl border border-white/30 shadow-[0_10px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.35)] dark:border-white/25 dark:shadow-none ${
                  isExpanded
                    ? isShowingResult
                      ? "w-130 max-w-[calc(100vw-3rem)] opacity-100 pointer-events-auto scale-100"
                      : "w-110 max-w-[calc(100vw-3rem)] opacity-100 pointer-events-auto scale-100"
                    : "w-14 opacity-0 pointer-events-none scale-90"
                }`
        }`}
      >
        <div className="grid transition-all duration-300 ease-in-out" style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
          <div className="overflow-hidden">
            <div className="flex flex-col" style={isFullscreen ? { height: "100dvh" } : isSidebarMode ? { height: "100vh" } : { maxHeight: isShowingResult ? "82vh" : "80vh" }}>
              {!showDragHint && (
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#2b2a30]">Orkest AI</span>
                  <div className="flex items-center gap-1">
                    {!isFullscreen && (
                      <button
                        type="button"
                        onClick={handleNewChat}
                        disabled={aiLoading}
                        className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                          aiLoading ? "cursor-not-allowed text-gray-200" : "cursor-pointer text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        }`}
                        title={t("ai.newChat")}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!isFullscreen && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !showHistory;
                            setShowHistory(next);
                            if (next) setShowMemories(false);
                          }}
                          disabled={aiLoading}
                          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                            aiLoading
                              ? "cursor-not-allowed text-gray-200"
                              : showHistory
                                ? "cursor-pointer bg-gray-100 text-gray-600"
                                : "cursor-pointer text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          }`}
                          title={t("ai.history")}
                        >
                          <Clock className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !showMemories;
                            setShowMemories(next);
                            if (next) {
                              setShowHistory(false);
                              fetchMemories();
                            }
                          }}
                          disabled={aiLoading}
                          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                            aiLoading
                              ? "cursor-not-allowed text-gray-200"
                              : showMemories
                                ? "cursor-pointer bg-gray-100 text-gray-600"
                                : "cursor-pointer text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          }`}
                          title={t("ai.memories")}
                        >
                          <Brain className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-1">
                  {isFullscreen && (
                    <button
                      type="button"
                      onClick={handleNewChat}
                      disabled={aiLoading}
                      className={`flex h-10 w-10 sm:h-6 sm:w-6 cursor-pointer items-center justify-center rounded-full transition-colors ${
                        aiLoading ? "cursor-not-allowed text-gray-200" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      }`}
                      title={t("ai.newChat")}
                    >
                      <Plus className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                    </button>
                  )}
                  {isFullscreen && (
                    <button
                      type="button"
                      onClick={() => {
                        if (showHistory || showMemories) {
                          setShowHistory(false);
                          setShowMemories(false);
                        } else {
                          setShowHistory(true);
                          setShowMemories(false);
                        }
                      }}
                      className={`flex h-10 w-10 sm:h-6 sm:w-6 cursor-pointer items-center justify-center rounded-full transition-colors ${
                        showHistory || showMemories ? "bg-gray-100 text-gray-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      }`}
                      title={t("ai.sidebar.toggle")}
                    >
                      <Clock className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                    </button>
                  )}
                  {!effectiveHideFullscreenToggle && (
                    <div className="relative">
                      <button
                        type="button"
                        ref={styleButtonRef}
                        onClick={() => setShowStyleMenu(!showStyleMenu)}
                        className="flex h-10 w-10 sm:h-6 sm:w-6 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        title={t("ai.style.toggle")}
                      >
                        {isFullscreen ? (
                          <Maximize2 className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                        ) : panelStyle === "sidebar" ? (
                          <PanelRight className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                        ) : (
                          <PanelBottom className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                        )}
                      </button>
                      {showStyleMenu && (
                        <div
                          ref={styleMenuRef}
                          className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl bg-white p-1 shadow-lg border border-black/8 dark:border-white/10 dark:bg-[#202020] flex flex-col gap-0.5"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setPanelStyle("floating");
                              if (isFullscreen) setIsFullscreen(false);
                              setShowStyleMenu(false);
                            }}
                            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                              panelStyle === "floating" && !isFullscreen
                                ? "bg-black/[0.06] text-[#25242a] dark:bg-white/10 dark:text-white"
                                : "text-[#7d7880] hover:bg-black/[0.04] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-white"
                            }`}
                          >
                            <PanelBottom className="h-3.5 w-3.5" />
                            <span>{t("ai.style.floating")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPanelStyle("sidebar");
                              if (isFullscreen) setIsFullscreen(false);
                              setShowStyleMenu(false);
                            }}
                            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                              panelStyle === "sidebar" && !isFullscreen
                                ? "bg-black/[0.06] text-[#25242a] dark:bg-white/10 dark:text-white"
                                : "text-[#7d7880] hover:bg-black/[0.04] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-white"
                            }`}
                          >
                            <PanelRight className="h-3.5 w-3.5" />
                            <span>{t("ai.style.sidebar")}</span>
                          </button>
                          <div className="my-1 border-t border-black/6 dark:border-white/10" />
                          <button
                            type="button"
                            onClick={() => {
                              if (isFullscreen) {
                                setDisplayMode(panelStyle);
                                setIsFullscreen(false);
                              } else {
                                setDisplayMode("fullscreen");
                                setIsFullscreen(true);
                              }
                              setShowStyleMenu(false);
                            }}
                            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                              isFullscreen
                                ? "bg-black/[0.06] text-[#25242a] dark:bg-white/10 dark:text-white"
                                : "text-[#7d7880] hover:bg-black/[0.04] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-white"
                            }`}
                          >
                            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                            <span>{isFullscreen ? t("ai.exitFullscreen") : t("ai.fullscreen")}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { if (onClose) onClose(); else { if (isFullscreen) { setIsFullscreen(false); setDisplayMode(panelStyle); } setExpandedState(false); } }}
                    className="flex h-10 w-10 sm:h-6 sm:w-6 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title={onClose ? "Home" : t("ai.sidebar.close")}
                  >
                    {onClose ? <Home className="h-5 w-5 sm:h-4 sm:w-4" /> : <X className="h-5 w-5 sm:h-4 sm:w-4" />}
                  </button>
                </div>
              </div>
              )}

              <div className={`relative flex flex-1 flex-col overflow-hidden ${showDragHint ? "p-0" : isFullscreen ? "" : "pb-4 pl-4"}`}>
                {/* Drag hint - fills entire content area (hidden in fullscreen when sidebar is open) */}
                {showDragHint && !(isFullscreen && (showHistory || showMemories)) && (
                  <div className="flex flex-1 items-center justify-center p-6 text-center">
                    <div className="w-full rounded-2xl border border-dashed border-black/10 bg-white/55 px-6 py-10">
                      <p className="text-[11px] font-semibold tracking-[0.24em] text-[#7b7580] uppercase">
                        Drop To Modify
                      </p>
                      <p className="mt-3 text-lg font-semibold text-[#25242a]">
                        Drag your item here
                      </p>
                      <p className="mt-2 max-w-60 mx-auto text-sm leading-6 text-[#6d6871]">
                        Release to let Orkest AI read the item and help you.
                      </p>
                    </div>
                  </div>
                )}

            {!showDragHint && (
              <>
            {/* Fullscreen mode: two-column layout with sidebar */}
            {isFullscreen ? (
              <div className="flex flex-1 overflow-hidden relative">
                {/* Main chat area — always visible in fullscreen */}
                <div className={`flex flex-1 flex-col overflow-hidden ${showHistory || showMemories ? "sm:border-r border-black/6 dark:border-white/10" : ""}`}>
                  <div key="chat" ref={aiChatOuterScrollRef} className="flex-1 overflow-y-auto pt-2 px-8 scrollbar-transparent-track animate-[fadeSlideIn_150ms_ease-out]" style={{ scrollbarGutter: "stable", paddingBottom: isFullscreen ? "0" : `${Math.max(64, aiInputContainerHeight)}px` }}>
                    <div className="space-y-4 max-w-2xl mx-auto">
                      {renderAiChatMessages ? renderAiChatMessages() : renderDefaultAiChatMessages()}

                      {isShowingAiAnswer && aiAnswer && (
                        <div className="rounded-2xl border border-black/8 bg-white/80 p-4">
                          <p className="text-[11px] font-semibold tracking-[0.24em] text-[#7b7580] uppercase">
                            Answer
                          </p>
                          <div className="mt-2 text-sm leading-6 text-[#3c3841]">
                            <MarkdownText isFullscreen={isFullscreen}>{aiAnswer}</MarkdownText>
                          </div>
                        </div>
                      )}

                      {aiError && !isReviewingAiItem ? (
                        aiError.startsWith("TRIAL_EXPIRED:") ? (
                          <p className="text-xs text-[#b14242]">
                            {aiError.replace("TRIAL_EXPIRED:", "")}{" "}
                            <button
                              type="button"
                              onClick={() => {
                                const currentLocale = locale || "en";
                                window.location.href = addLocaleToPathname("/pricing", currentLocale as any);
                              }}
                              className="cursor-pointer underline hover:opacity-80"
                            >
                              {t("pricing.upgrade") || "Upgrade now"}
                            </button>
                          </p>
                        ) : (
                          <p className="text-xs text-[#b14242]">{aiError}</p>
                        )
                      ) : null}
                      {aiMessages.length > 0 && (
                        <p className="text-center text-xs text-black/30 dark:text-white/30">{t("ai.disclaimer")}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sidebar — only in fullscreen when history or memories is open */}
                {isFullscreen && (showHistory || showMemories) && (
                  <>
                    {/* Desktop: side panel */}
                    <div className="hidden sm:flex w-56 sm:w-80 shrink-0 flex-col overflow-hidden">
                      {/* Sidebar header with tabs */}
                      <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-black/6 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => { setShowHistory(true); setShowMemories(false); }}
                          className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            showHistory ? "bg-black/6 text-[#25242a] dark:bg-white/10 dark:text-white" : "text-[#7d7880] hover:bg-black/3 dark:hover:bg-white/5"
                          }`}
                        >
                          <Clock className="h-3 w-3 inline mr-1.5" />
                          {t("ai.history")}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowMemories(true); setShowHistory(false); fetchMemories(); }}
                          className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            showMemories ? "bg-black/6 text-[#25242a] dark:bg-white/10 dark:text-white" : "text-[#7d7880] hover:bg-black/3 dark:hover:bg-white/5"
                          }`}
                        >
                          <Brain className="h-3 w-3 inline mr-1.5" />
                          {t("ai.memories")}
                        </button>
                      </div>

                      {/* Sidebar content */}
                      <div className="flex-1 overflow-y-auto scrollbar-transparent-track">
                        {showHistory ? (
                          <div className="space-y-1 p-3">
                            {conversations.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Clock className="h-8 w-8 text-gray-300 mb-2" />
                                <p className="text-sm text-gray-400">{t("ai.noHistory")}</p>
                                <p className="text-xs text-gray-300 mt-1">{t("ai.startConversation")}</p>
                              </div>
                            ) : (
                              conversations.map((conv) => (
                                <div
                                  key={conv.id}
                                  onClick={() => handleLoadConversation(conv.id)}
                                  className={`group flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                                    currentConversationId === conv.id
                                      ? "bg-white/80 border border-black/8 dark:bg-white/20 dark:border-white/10"
                                      : "hover:bg-gray-200 dark:hover:bg-white/20"
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[#25242a] dark:text-white truncate">
                                      {conv.title}
                                    </p>
                                    <p className="text-xs text-[#7d7880] dark:text-gray-400 mt-0.5">
                                      {new Date(conv.createdAt).toLocaleDateString(locale)}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
                                    title={t("common.delete")}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                            {conversations.length > 0 && (
                              <p className="px-3 pt-3 pb-1 text-[10px] text-[#9d98a0] text-center">
                                {t("ai.historyLimit")}
                              </p>
                            )}
                          </div>
                        ) : showMemories ? (
                          <div className="space-y-1 p-3">
                            {memories.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Brain className="h-8 w-8 text-gray-300 mb-2" />
                                <p className="text-sm text-gray-400">{t("ai.noMemories")}</p>
                                <p className="text-xs text-gray-300 mt-1">{t("ai.memoryHint")}</p>
                              </div>
                            ) : (
                              memories.map((mem) => (
                                <div
                                  key={mem.key}
                                  className="group flex items-start justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-200 dark:hover:bg-white/20"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium text-[#25242a] dark:text-white truncate">
                                        {mem.key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                      </p>
                                      <span className="shrink-0 rounded-full border border-black/8 px-1.5 py-0.5 text-[10px] text-[#7d7880]">
                                        {mem.category}
                                      </span>
                                    </div>
                                    <p className="text-xs text-[#5f5a63] dark:text-gray-300 mt-0.5 line-clamp-2">
                                      {mem.value}
                                    </p>
                                    <p className="text-[10px] text-[#9d98a0] mt-1">
                                      confidence: {Math.round(mem.confidence * 100)}%
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => deleteMemoryById(mem.id)}
                                    className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
                                    title={t("common.delete")}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                            {memories.length > 0 && (
                              <p className="px-3 pt-3 pb-1 text-[10px] text-[#9d98a0] text-center">
                                {t("ai.memoryFooter")}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Mobile: full-width drawer overlay */}
                    <div className="sm:hidden fixed inset-0 z-[60] flex flex-col overflow-hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl animate-[fadeSlideIn_150ms_ease-out]">
                      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-black/6 dark:border-white/10">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setShowHistory(true); setShowMemories(false); }}
                            className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              showHistory ? "bg-black/6 text-[#25242a] dark:bg-white/10 dark:text-white" : "text-[#7d7880] hover:bg-black/3 dark:hover:bg-white/5"
                            }`}
                          >
                            <Clock className="h-3 w-3 inline mr-1.5" />
                            {t("ai.history")}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowMemories(true); setShowHistory(false); fetchMemories(); }}
                            className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              showMemories ? "bg-black/6 text-[#25242a] dark:bg-white/10 dark:text-white" : "text-[#7d7880] hover:bg-black/3 dark:hover:bg-white/5"
                            }`}
                          >
                            <Brain className="h-3 w-3 inline mr-1.5" />
                            {t("ai.memories")}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowHistory(false); setShowMemories(false); }}
                          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto scrollbar-transparent-track">
                        {showHistory ? (
                          <div className="space-y-1 p-4">
                            {conversations.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Clock className="h-8 w-8 text-gray-300 mb-2" />
                                <p className="text-sm text-gray-400">{t("ai.noHistory")}</p>
                                <p className="text-xs text-gray-300 mt-1">{t("ai.startConversation")}</p>
                              </div>
                            ) : (
                              conversations.map((conv) => (
                                <div
                                  key={conv.id}
                                  onClick={() => { handleLoadConversation(conv.id); setShowHistory(false); setShowMemories(false); }}
                                  className={`group flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                                    currentConversationId === conv.id
                                      ? "bg-white/80 border border-black/8 dark:bg-white/20 dark:border-white/10"
                                      : "hover:bg-gray-200 dark:hover:bg-white/20"
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[#25242a] dark:text-white truncate">
                                      {conv.title}
                                    </p>
                                    <p className="text-xs text-[#7d7880] dark:text-gray-400 mt-0.5">
                                      {new Date(conv.createdAt).toLocaleDateString(locale)}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
                                    title={t("common.delete")}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                            {conversations.length > 0 && (
                              <p className="px-3 pt-3 pb-1 text-[10px] text-[#9d98a0] text-center">
                                {t("ai.historyLimit")}
                              </p>
                            )}
                          </div>
                        ) : showMemories ? (
                          <div className="space-y-1 p-4">
                            {memories.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Brain className="h-8 w-8 text-gray-300 mb-2" />
                                <p className="text-sm text-gray-400">{t("ai.noMemories")}</p>
                                <p className="text-xs text-gray-300 mt-1">{t("ai.memoryHint")}</p>
                              </div>
                            ) : (
                              memories.map((mem) => (
                                <div
                                  key={mem.key}
                                  className="group flex items-start justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-200 dark:hover:bg-white/20"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium text-[#25242a] dark:text-white truncate">
                                        {mem.key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                      </p>
                                      <span className="shrink-0 rounded-full border border-black/8 px-1.5 py-0.5 text-[10px] text-[#7d7880]">
                                        {mem.category}
                                      </span>
                                    </div>
                                    <p className="text-xs text-[#5f5a63] dark:text-gray-300 mt-0.5 line-clamp-2">
                                      {mem.value}
                                    </p>
                                    <p className="text-[10px] text-[#9d98a0] mt-1">
                                      confidence: {Math.round(mem.confidence * 100)}%
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => deleteMemoryById(mem.id)}
                                    className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
                                    title={t("common.delete")}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                            {memories.length > 0 && (
                              <p className="px-3 pt-3 pb-1 text-[10px] text-[#9d98a0] text-center">
                                {t("ai.memoryFooter")}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
            /* Non-fullscreen mode: history/memories replace chat as before */
            <>
            {showHistory ? (
              <div key="history" className="flex-1 overflow-y-auto pt-2 pr-1 scrollbar-transparent-track animate-[fadeSlideIn_150ms_ease-out]" style={{ scrollbarGutter: "stable" }}>
                <div className="space-y-1">
                  {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Clock className="h-8 w-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">{t("ai.noHistory")}</p>
                      <p className="text-xs text-gray-300 mt-1">{t("ai.startConversation")}</p>
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => handleLoadConversation(conv.id)}
                        className={`group flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                          currentConversationId === conv.id
                            ? "bg-white/80 border border-black/8 dark:bg-white/20 dark:border-white/10"
                            : "hover:bg-gray-200 dark:hover:bg-white/20"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#25242a] dark:text-white truncate">
                            {conv.title}
                          </p>
                          <p className="text-xs text-[#7d7880] dark:text-gray-400 mt-0.5">
                            {new Date(conv.createdAt).toLocaleDateString(locale)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteConversation(e, conv.id)}
                          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {conversations.length > 0 && (
                  <p className="px-3 pt-3 pb-1 text-[10px] text-[#9d98a0] text-center">
                    {t("ai.historyLimit")}
                  </p>
                )}
              </div>
            ) : showMemories ? (
              <div key="memories" className="flex-1 overflow-y-auto pt-2 pr-1 scrollbar-transparent-track animate-[fadeSlideIn_150ms_ease-out]" style={{ scrollbarGutter: "stable" }}>
                <div className="space-y-1">
                  {memories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Brain className="h-8 w-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">{t("ai.noMemories")}</p>
                      <p className="text-xs text-gray-300 mt-1">{t("ai.memoryHint")}</p>
                    </div>
                  ) : (
                    memories.map((mem) => (
                      <div
                        key={mem.key}
                        className="group flex items-start justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-200 dark:hover:bg-white/20"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#25242a] dark:text-white truncate">
                              {mem.key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </p>
                            <span className="shrink-0 rounded-full border border-black/8 px-1.5 py-0.5 text-[10px] text-[#7d7880]">
                              {mem.category}
                            </span>
                          </div>
                          <p className="text-xs text-[#5f5a63] dark:text-gray-300 mt-0.5 line-clamp-2">
                            {mem.value}
                          </p>
                          <p className="text-[10px] text-[#9d98a0] mt-1">
                            confidence: {Math.round(mem.confidence * 100)}%
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteMemoryById(mem.id)}
                          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {memories.length > 0 && (
                  <p className="px-3 pt-3 pb-1 text-[10px] text-[#9d98a0] text-center">
                    {t("ai.memoryFooter")}
                  </p>
                )}
              </div>
            ) : (
            <div key="chat" ref={aiChatOuterScrollRef} className="flex-1 overflow-y-auto pt-2 scrollbar-transparent-track animate-[fadeSlideIn_150ms_ease-out]" style={{ scrollbarGutter: "stable", paddingBottom: `${Math.max(64, aiInputContainerHeight)}px` }}>
              <div className="space-y-4">
                {renderAiChatMessages ? renderAiChatMessages() : renderDefaultAiChatMessages()}

                {isShowingAiAnswer && aiAnswer && (
                  <div className="rounded-2xl border border-black/8 bg-white/80 p-4">
                    <p className="text-[11px] font-semibold tracking-[0.24em] text-[#7b7580] uppercase">
                      Answer
                    </p>
                    <div className="mt-2 text-sm leading-6 text-[#3c3841]">
                      <MarkdownText isFullscreen={isFullscreen}>{aiAnswer}</MarkdownText>
                    </div>
                  </div>
                )}

                {aiError && !isReviewingAiItem ? (
                  aiError.startsWith("TRIAL_EXPIRED:") ? (
                    <p className="text-xs text-[#b14242]">
                      {aiError.replace("TRIAL_EXPIRED:", "")}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          const currentLocale = locale || "en";
                          window.location.href = addLocaleToPathname("/pricing", currentLocale as any);
                        }}
                        className="cursor-pointer underline hover:opacity-80"
                      >
                        {t("pricing.upgrade") || "Upgrade now"}
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-[#b14242]">{aiError}</p>
                  )
                ) : null}
                {aiMessages.length > 0 && (
                  <p className="text-center text-xs text-black/30 dark:text-white/30">{t("ai.disclaimer")}</p>
                )}
              </div>
            </div>
            )}
            </>
            )}
            </>
            )}

            {/* Input area: visible when not showing drag hint, and either (non-fullscreen & no history/memories) or (fullscreen) */}
            {!showDragHint && ((isFullscreen) || (!showHistory && !showMemories)) && (
              <div ref={aiInputContainerRef} className={`${isFullscreen ? "shrink-0 flex flex-col items-center px-8 pb-[max(1rem,env(safe-area-inset-bottom))]" : "absolute bottom-0 left-0 right-0 pl-4 pr-4 pb-4 pt-2"} ${isFullscreen && (showHistory || showMemories) ? "sm:mr-80" : ""}`}>
                {/* Fullscreen prompt templates above input */}
                {isFullscreen && aiMessages.length === 0 && (() => {
                  const prompts = quickPrompts ?? [t("ai.prompt.addTask"), t("ai.prompt.updateSelected"), t("ai.prompt.planDay"), t("ai.prompt.findConflicts"), t("ai.prompt.breakDown")];
                  return (
                    <div className="flex flex-wrap gap-1.5 mb-2 w-full max-w-3xl justify-center">
                      {prompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => {
                            setAiInput(prompt);
                            setTimeout(() => {
                              const el = aiInputRef.current;
                              if (el) {
                                el.focus();
                                el.setSelectionRange(el.value.length, el.value.length);
                              }
                            }, 0);
                          }}
                          className="cursor-pointer rounded-full border border-black/8 bg-white px-2.5 py-1 text-xs font-medium text-[#5f5a63] transition-colors hover:bg-black/[0.03]"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                <form onSubmit={handleAiSubmit} className={isFullscreen ? "w-full max-w-3xl" : ""}>
                  <div className="relative rounded-3xl border border-black/8 bg-white transition-all duration-200">
                    {aiTargetItems.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
                    {aiTargetItems.map((target) => (
                      <span
                        key={target.id}
                        className="inline-flex items-center gap-1 rounded-full border border-black/8 bg-[#f8f7f6] px-2 py-0.5 text-[11px] text-[#5f5a63]"
                      >
                        <span className="max-w-24 truncate">{target.title}</span>
                        <button
                          type="button"
                          onClick={() =>
                            !aiLoading &&
                            setAiTargetItems((current) =>
                              current.filter((entry) => entry.id !== target.id)
                            )
                          }
                          disabled={aiLoading}
                          className="cursor-pointer text-[#8c8691] hover:text-[#5f5a63] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative flex items-center">
                {!isFullscreen && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleManualInput}
                  disabled={aiLoading || isRecording || isTranscribing}
                  className="absolute left-1.5 h-8 w-8 shrink-0 rounded-full"
                  title={t("ai.manualAdd")}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={aiLoading || isTranscribing}
                  onClick={async () => {
                    if (isRecording) {
                      const transcript = await stopRecording();
                      if (transcript) {
                        setAiInput((prev) => {
                          const next = prev ? `${prev} ${transcript}` : transcript;
                          setTimeout(() => {
                            const el = aiInputRef.current;
                            if (el) {
                              el.focus();
                              el.setSelectionRange(next.length, next.length);
                            }
                            resizeAiInput();
                          }, 0);
                          return next;
                        });
                      }
                    } else {
                      resetVoiceError();
                      await startRecording();
                    }
                  }}
                  className={`absolute ${isFullscreen ? "left-1.5" : "left-10"} h-8 w-8 shrink-0 rounded-full transition-colors ${
                    isRecording
                      ? "bg-red-500/15 text-red-600 animate-pulse"
                      : ""
                  }`}
                  title={isRecording ? t("ai.recording") : isTranscribing ? t("ai.transcribing") : t("ai.speak")}
                >
                  {isTranscribing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </Button>
                {isValidTool && (
                  <div
                    className={`absolute inset-0 pointer-events-none whitespace-pre-wrap break-words leading-5 text-sm sm:text-sm text-[16px] font-sans ${paddingClasses} text-left`}
                  >
                    <span className="text-[#8c8691]">{toolPart}</span>
                    <span className="text-[#3c3841] dark:text-[#f5f5f5]">{restPart}</span>
                  </div>
                )}
                <Textarea
                  ref={aiInputRef}
                  value={aiInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAiInput(val);
                    resizeAiInput();
                    // Show slash menu when input starts with "/" and no space yet
                    const slashMatch = val.match(/^\/([\w-]*)$/);
                    if (slashMatch) {
                      setShowSlashMenu(true);
                      setSlashFilter(slashMatch[1]);
                      setSlashIndex(0);
                    } else if (showSlashMenu) {
                      setShowSlashMenu(false);
                      setSlashFilter("");
                    }
                  }}
                  maxLength={2000}
                  placeholder={
                    isRecording
                      ? t("ai.placeholder.recording")
                      : aiTargetItems.length > 0
                        ? t("ai.placeholder.review")
                        : t("ai.placeholder.ask")
                  }
                  style={aiInput ? { minHeight: "44px" } : { minHeight: "44px", height: "44px" }}
                  className={aiTargetItems.length > 0
                    ? `!m-0 !rounded-3xl !border-0 !bg-transparent !pt-2 !pb-2.5 ${isFullscreen ? "!pl-12" : "!pl-[5.5rem]"} !pr-14 text-sm sm:text-sm text-[16px] leading-5 !outline-none !ring-0 focus-visible:!ring-0 scrollbar-hidden resize-none ${isValidTool ? "!text-transparent caret-[#25242a] dark:caret-white" : ""}`
                    : `!m-0 !rounded-3xl !border-0 !bg-transparent !pt-3 !pb-2.5 ${isFullscreen ? "!pl-12" : "!pl-[5.5rem]"} !pr-14 text-sm sm:text-sm text-[16px] leading-5 !outline-none !ring-0 focus-visible:!ring-0 scrollbar-hidden resize-none ${isValidTool ? "!text-transparent caret-[#25242a] dark:caret-white" : ""}`
                  }
                  disabled={aiLoading || isRecording}
                  rows={1}
                  onKeyDown={(e) => {
                    // Slash menu navigation
                    if (showSlashMenu && filteredTools.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSlashIndex((i) => (i + 1) % filteredTools.length);
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSlashIndex((i) => (i - 1 + filteredTools.length) % filteredTools.length);
                        return;
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        selectSlashTool(filteredTools[slashIndex]);
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setShowSlashMenu(false);
                        setSlashFilter("");
                        return;
                      }
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAiSubmit();
                    }
                  }}
                />
                <Button
                  type={aiLoading ? "button" : "submit"}
                  size="icon"
                  disabled={!aiLoading && !aiInput.trim()}
                  onClick={aiLoading ? handleCancelAiSubmit : undefined}
                  className="absolute right-1.5 h-8 w-8 shrink-0 rounded-full"
                  title={aiLoading ? t("common.stop") : t("common.send")}
                >
                  {aiLoading ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5" />
                  )}
                </Button>
                </div>
              </div>
              {voiceError && (
                <p className="mt-2 text-xs text-[#b14242]">{voiceError}</p>
              )}
            </form>
          </div>
          )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Circular FAB */}
      <div
        ref={dragFabRef}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        className="h-14 w-14 shrink-0 rounded-full"
      >
        <Button
          onClick={() => {
            if (!isLongPressRef.current) {
              setExpandedState(true);
            }
          }}
          onPointerDown={handleFabPointerDown}
          onPointerUp={handleFabPointerUp}
          onPointerLeave={handleFabPointerLeave}
          style={
            {
              backgroundColor: dragFabBackground,
              "--drag-fab-hover-bg": dragFabHoverBackground,
              backdropFilter: "blur(18px) saturate(140%)",
              WebkitBackdropFilter: "blur(18px) saturate(140%)",
            } as React.CSSProperties
          }
          className={`h-14 w-14 rounded-full border border-white/30 shadow-[0_10px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.35)] hover:scale-[1.03] hover:bg-(--drag-fab-hover-bg) hover:shadow-[0_12px_36px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.45)] transition-all duration-300 dark:border-white/35 dark:shadow-none dark:hover:shadow-none ${
            hideFAB
              ? "opacity-0 pointer-events-none scale-90"
              : "opacity-100 scale-100"
          }`}
          aria-label="Orkest AI"
        >
          {isFabRecording ? (
            <Mic className="h-8 w-8 text-red-500 animate-pulse" strokeWidth={2.2} />
          ) : (
            <MessageCircle className="h-8 w-8 text-gray-700 dark:text-[#f5f5f5]" strokeWidth={2.2} />
          )}
        </Button>
      </div>

      {/* Slash command menu (fixed position to avoid overflow clipping) */}
      {showSlashMenu && filteredTools.length > 0 && slashMenuPos && (
        <div
          ref={slashMenuRef}
          className="fixed z-[60] max-h-[min(16rem,80vh)] overflow-y-auto rounded-2xl border border-black/8 bg-white shadow-lg"
          style={{
            bottom: `calc(100vh - ${slashMenuPos.top}px)`,
            left: slashMenuPos.left,
            width: slashMenuPos.width,
          }}
        >
          <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[#8c8691] dark:text-[#a09ba5]">
            Tools
          </div>
          {filteredTools.map((tool, i) => (
            <button
              key={tool.name}
              type="button"
              onClick={() => selectSlashTool(tool)}
              onMouseEnter={() => setSlashIndex(i)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                i === slashIndex ? "bg-[#f8f7f6] dark:bg-white/8" : "hover:bg-[#f8f7f6] dark:hover:bg-white/8"
              }`}
            >
              <span className="text-xs font-medium text-[#1a1520] dark:text-[#e5e5e5]">{tool.label}</span>
              <span className="text-[11px] text-[#8c8691] dark:text-[#a09ba5]">{tool.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
