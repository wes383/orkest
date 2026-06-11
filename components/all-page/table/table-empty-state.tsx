"use client";

import { ListTodo, MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { EmptyState } from "@/components/ui/empty-state";

export function TableEmptyState({
  isFiltered,
  onClearFilters,
}: {
  isFiltered: boolean;
  onClearFilters: () => void;
}) {
  const { t } = useI18n();
  const openComposer = useAllPageStore((s) => s.openComposer);
  const ai = useAiChatContext();

  if (isFiltered) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <ListTodo className="h-8 w-8 text-[#9f99a3]" />
        <h3 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">
          {t("table.empty.filteredTitle") as string}
        </h3>
        <p className="max-w-md text-xs text-[#7d7880] dark:text-[#a3a3a3]">
          {t("table.empty.filteredDescription") as string}
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-1 cursor-pointer rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-medium text-[#525059] hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4] dark:hover:bg-white/10"
        >
          {t("common.clearFilters") as string}
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <EmptyState
        icon={ListTodo}
        title={t("table.empty.unfilteredTitle") as string}
        description={t("table.empty.unfilteredDescription") as string}
        compact
        action={{ label: t("empty.createTask") as string, onClick: () => openComposer() }}
        secondaryAction={{
          label: t("welcome.askAi") as string,
          icon: MessageCircle,
          onClick: () => ai.setExpandedState(true),
        }}
      />
    </div>
  );
}
