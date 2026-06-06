"use client";

import { useCallback, useEffect } from "react";

import { AiOverlay } from "@/components/ai/ai-overlay";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { useI18n } from "@/lib/i18n";

import type { AiBatchPreviewItem } from "@/lib/ai/chat-types";

export default function AiChatPage() {
  const { t, locale } = useI18n();
  const ai = useAiChatContext();

  useEffect(() => {
    ai.setPageContext("focus");
  }, [ai]);

  useEffect(() => {
    ai.setExpandedState(true);
    ai.setIsFullscreen(true);
  }, [ai]);

  const renderAiBatchPreviewItem = useCallback(
    (_item: AiBatchPreviewItem, _index: number) => null, // eslint-disable-line @typescript-eslint/no-unused-vars
    [],
  );

  const handleClose = useCallback(() => {
    window.location.href = `/${locale}`;
  }, [locale]);

  return (
    <div className="h-full min-h-full">
      <AiOverlay
        ai={ai}
        renderAiBatchPreviewItem={renderAiBatchPreviewItem}
        emptyStateMessage="What can I help you with?"
        quickPrompts={[
          t("ai.prompt.planDay"),
          t("ai.prompt.breakDown"),
          t("ai.prompt.findConflicts"),
          t("ai.prompt.focus"),
        ]}
        hideFab
        hideFullscreenToggle
        onClose={handleClose}
      />
    </div>
  );
}
