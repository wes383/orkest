"use client";

import { useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

import { AiOverlay } from "@/components/ai/ai-overlay";
import { BatchPreviewItemRenderer } from "@/components/ai/batch-preview-item";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProgressStore } from "@/lib/stores/use-progress-store";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { ProgressDetailPage } from "@/components/progress/progress-detail-page";
import type { AiBatchPreviewItem } from "@/lib/ai/chat-types";
import { useI18n } from "@/lib/i18n";

export default function ProgressDetailRoute() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const progressId = params?.id ?? "";
  const { user } = useAuth();
  const isLoaded = useAllPageStore((s) => s.isLoaded);
  const loadItemsFromCloud = useAllPageStore((s) => s.loadItemsFromCloud);
  const progressLoaded = useProgressStore((s) => s.isLoaded);
  const loadProgresses = useProgressStore((s) => s.loadProgresses);
  const loadLinks = useProgressStore((s) => s.loadLinks);
  const progresses = useProgressStore((s) => s.progresses);

  const ai = useAiChatContext();

  useEffect(() => {
    ai.setPageContext("progress");
  }, [ai]);

  useEffect(() => {
    if (!isLoaded && user) void loadItemsFromCloud(user.id);
    if (!progressLoaded && user) {
      void loadProgresses(user.id);
      void loadLinks(user.id);
    }
  }, [isLoaded, loadItemsFromCloud, progressLoaded, loadProgresses, loadLinks, user]);

  const handleToggleBatchPreviewSelection = useCallback(
    (index: number, selected: boolean) => {
      ai.setAiBatchPreview((current) =>
        current.map((item, i) => (i === index ? { ...item, selected } : item)),
      );
    },
    [ai],
  );

  const handleEditBatchPreview = useCallback(() => undefined, []);

  function renderAiBatchPreviewItem(item: AiBatchPreviewItem, index: number) {
    return (
      <BatchPreviewItemRenderer
        key={item.id}
        item={item}
        index={index}
        projects={progresses}
        onToggleSelection={handleToggleBatchPreviewSelection}
        onEdit={handleEditBatchPreview}
        isFullscreen={ai.isFullscreen}
      />
    );
  }

  if (!progressId) return null;

  return (
    <>
      <ProgressDetailPage progressId={progressId} />
      <AiOverlay
        ai={ai}
        renderAiBatchPreviewItem={renderAiBatchPreviewItem}
        quickPrompts={[
          t("ai.prompt.createProgress"),
          t("ai.prompt.bindTasksToProgress"),
          t("ai.prompt.progressStatus"),
        ]}
      />
    </>
  );
}
