"use client";

import { useEffect, useCallback } from "react";

import { AiOverlay } from "@/components/ai/ai-overlay";
import { BatchPreviewItemRenderer } from "@/components/ai/batch-preview-item";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { ProjectsPage } from "@/components/projects/projects-page";
import type { AiBatchPreviewItem } from "@/lib/ai/chat-types";
import { useI18n } from "@/lib/i18n";

export default function ProjectsRoute() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isLoaded = useAllPageStore((s) => s.isLoaded);
  const loadItemsFromCloud = useAllPageStore((s) => s.loadItemsFromCloud);
  const projectsLoaded = useProjectStore((s) => s.isLoaded);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const projects = useProjectStore((s) => s.projects);

  const ai = useAiChatContext();

  useEffect(() => {
    ai.setPageContext("projects");
  }, [ai]);

  useEffect(() => {
    if (!isLoaded && user) {
      void loadItemsFromCloud(user.id);
    }
    if (!projectsLoaded && user) {
      void loadProjects(user.id);
    }
  }, [isLoaded, loadItemsFromCloud, projectsLoaded, loadProjects, user]);

  const handleToggleBatchPreviewSelection = useCallback(
    (index: number, selected: boolean) => {
      ai.setAiBatchPreview((current) =>
        current.map((item, i) => (i === index ? { ...item, selected } : item)),
      );
    },
    [ai],
  );

  const handleEditBatchPreview = useCallback(
    (_index: number) => {
      // The projects page has no item composer, so editing an AI batch draft
      // is a no-op here. The renderer only shows the Edit button for item-level
      // kinds (create/update), not delete_project, so this is rarely reached.
    },
    [],
  );

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

  return (
    <>
      <ProjectsPage />
      <AiOverlay
        ai={ai}
        renderAiBatchPreviewItem={renderAiBatchPreviewItem}
        quickPrompts={[
          t("ai.prompt.addTask"),
          t("ai.prompt.updateSelected"),
          t("ai.prompt.planWeek"),
          t("ai.prompt.review"),
          t("ai.prompt.search"),
          t("ai.prompt.overdue"),
        ]}
      />
    </>
  );
}
