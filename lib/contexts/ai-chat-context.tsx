"use client";

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";

import { useAiChat } from "@/lib/hooks/use-ai-chat";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { useAuth } from "@/lib/auth/auth-provider";
import type { ItemFormState } from "@/lib/types/all-page";
import type { AiPageContext } from "@/lib/ai/chat-types";
import { toItemFromManualRecord } from "@/lib/all-page-utils";
import { sanitizeUsername } from "@/lib/ai/sanitize";
import { useI18n } from "@/lib/i18n";

export type AiPanelStyle = "floating" | "sidebar";
export type AiPanelDisplayMode = AiPanelStyle | "fullscreen";

const AI_PANEL_STYLE_STORAGE_KEY = "ai-panel-style";

type AiChatContextValue = ReturnType<typeof useAiChat> & {
  pageContext: AiPageContext;
  setPageContext: (ctx: AiPageContext) => void;
  panelStyle: AiPanelStyle;
  displayMode: AiPanelDisplayMode;
  setPanelStyle: (style: AiPanelStyle) => void;
  setDisplayMode: (mode: AiPanelDisplayMode) => void;
};

const AiChatContext = createContext<AiChatContextValue | null>(null);

export function AiChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [pageContext, setPageContextState] = useState<AiPageContext>("today");

  const setPageContext = useCallback((ctx: AiPageContext) => {
    setPageContextState((prev) => (prev === ctx ? prev : ctx));
  }, []);

  // Panel style: persisted (floating or sidebar)
  const [panelStyle, setPanelStyleState] = useState<AiPanelStyle>(() => {
    if (typeof window === "undefined") return "floating";
    const saved = localStorage.getItem(AI_PANEL_STYLE_STORAGE_KEY);
    return saved === "sidebar" ? "sidebar" : "floating";
  });

  // Display mode: includes fullscreen as temporary state
  const [displayMode, setDisplayModeState] = useState<AiPanelDisplayMode>(panelStyle);

  // Persist panel style changes (only floating/sidebar)
  useEffect(() => {
    localStorage.setItem(AI_PANEL_STYLE_STORAGE_KEY, panelStyle);
  }, [panelStyle]);

  const setPanelStyle = useCallback((style: AiPanelStyle) => {
    setPanelStyleState(style);
    setDisplayModeState(style);
  }, []);

  const setDisplayMode = useCallback((mode: AiPanelDisplayMode) => {
    if (mode === "fullscreen") {
      // Fullscreen is temporary, don't update panelStyle
      setDisplayModeState("fullscreen");
    } else {
      // Switching to floating or sidebar also persists
      setPanelStyleState(mode);
      setDisplayModeState(mode);
    }
  }, []);

  const manualItems = useAllPageStore((s) => s.manualItems);
  const openComposer = useAllPageStore((s) => s.openComposer);
  const openComposerWithForm = useAllPageStore((s) => s.openComposerWithForm);
  const setComposerSubmitOverride = useAllPageStore((s) => s.setComposerSubmitOverride);
  const handleCreateItems = useAllPageStore((s) => s.handleCreateItems);
  const applyAiUpdates = useAllPageStore((s) => s.applyAiUpdates);
  const handleBatchDelete = useAllPageStore((s) => s.handleBatchDelete);
  const deleteProjectFromStore = useProjectStore((s) => s.deleteProject);

  const handleDeleteProject = useCallback(
    (projectId: string): string | null => {
      if (!user?.id) {
        return t("ai.missingUser");
      }
      // Optimistic delete — store updates local state and enqueues sync.
      // The project store's deleteProject is fire-and-forget and never throws.
      void deleteProjectFromStore(user.id, projectId);
      return null;
    },
    [deleteProjectFromStore, user?.id, t],
  );

  const ai = useAiChat({
    pageContext,
    manualItems,
    userId: user?.id,
    // Sanitize the display name before it ever reaches the LLM system prompt.
    // We deliberately do NOT fall back to email here — emails are PII and
    // must not be sent to a third-party AI provider.
    username: sanitizeUsername(user?.user_metadata?.username as string | undefined),
    openComposer: () => openComposer(),
    openComposerWithForm: (form: ItemFormState, editingItem?: import("@/lib/types/item").Item) =>
      openComposerWithForm(form, editingItem),
    setComposerSubmitOverride,
    handleCreateItems,
    applyAiUpdates,
    handleBatchDelete,
    toItemFromManualRecord,
    handleDeleteProject,
  });

  const value = useMemo<AiChatContextValue>(
    () => ({ ...ai, pageContext, setPageContext, panelStyle, displayMode, setPanelStyle, setDisplayMode }),
    [ai, pageContext, setPageContext, panelStyle, displayMode, setPanelStyle, setDisplayMode],
  );

  return (
    <AiChatContext.Provider value={value}>
      {children}
    </AiChatContext.Provider>
  );
}

export function useAiChatContext() {
  const ctx = useContext(AiChatContext);
  if (!ctx) {
    throw new Error("useAiChatContext must be used within AiChatProvider");
  }
  return ctx;
}
