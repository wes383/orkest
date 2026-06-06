"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

import { useAiChat } from "@/lib/hooks/use-ai-chat";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useAuth } from "@/lib/auth/auth-provider";
import type { ItemFormState } from "@/lib/types/all-page";
import type { AiPageContext } from "@/lib/ai/chat-types";
import { toItemFromManualRecord } from "@/lib/all-page-utils";
import { sanitizeUsername } from "@/lib/ai/sanitize";

type AiChatContextValue = ReturnType<typeof useAiChat> & {
  pageContext: AiPageContext;
  setPageContext: (ctx: AiPageContext) => void;
};

const AiChatContext = createContext<AiChatContextValue | null>(null);

export function AiChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pageContext, setPageContextState] = useState<AiPageContext>("today");

  const setPageContext = useCallback((ctx: AiPageContext) => {
    setPageContextState((prev) => (prev === ctx ? prev : ctx));
  }, []);

  const manualItems = useAllPageStore((s) => s.manualItems);
  const openComposer = useAllPageStore((s) => s.openComposer);
  const openComposerWithForm = useAllPageStore((s) => s.openComposerWithForm);
  const setComposerSubmitOverride = useAllPageStore((s) => s.setComposerSubmitOverride);
  const handleCreateItems = useAllPageStore((s) => s.handleCreateItems);
  const applyAiUpdates = useAllPageStore((s) => s.applyAiUpdates);
  const handleBatchDelete = useAllPageStore((s) => s.handleBatchDelete);

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
  });

  const value = useMemo<AiChatContextValue>(
    () => ({ ...ai, pageContext, setPageContext }),
    [ai, pageContext, setPageContext],
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
