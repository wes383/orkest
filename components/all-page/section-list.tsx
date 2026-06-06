"use client";

import { ListTodo, MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { EmptyState } from "@/components/ui/empty-state";
import { DayGroupSection } from "./day-group";
import type { Section } from "@/lib/types/all-page";

export function SectionList({
  sections,
  onSwitchToList,
}: {
  sections: Section[];
  onSwitchToList?: () => void;
}) {
  const { t } = useI18n();
  const openComposer = useAllPageStore((s) => s.openComposer);
  const ai = useAiChatContext();
  const density = useSettingsStore((s) => s.density);
  const isCompact = density === "compact";
  const filteredSections = sections.filter((section) => section.id !== "no-date");

  return (
    <div className={`${isCompact ? "space-y-12" : "space-y-20"}`}>
      {filteredSections.length === 0 && (
        <EmptyState
          icon={ListTodo}
          title={t("empty.list.title")}
          description={t("empty.list.description")}
          action={{
            label: t("empty.createTask"),
            onClick: () => openComposer(),
          }}
          secondaryAction={{
            label: t("welcome.askAi"),
            icon: MessageCircle,
            onClick: () => ai.setExpandedState(true),
          }}
        />
      )}
      {filteredSections.map((section) => (
        <section
          key={section.id}
          className={`grid ${isCompact ? "gap-8 pt-6" : "gap-12 pt-10"} border-t border-black/6 first:border-t-0 first:pt-0 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-10`}
        >
          <aside className="space-y-3 lg:sticky lg:top-12 lg:self-start">
            <div className="relative inline-block">
              <h2 className={`${isCompact ? "text-[1.2rem]" : "text-[1.6rem]"} leading-none font-semibold tracking-[-0.01em] text-[#2b2a30] dark:text-[#d4d4d4] lg:pt-4`}>
                {section.title}
              </h2>
              <span className="absolute -top-1 -right-5 lg:top-4 text-xs font-medium text-[#9f99a3]">
                {section.groups.flatMap((g) => g.items).length}
              </span>
            </div>
          </aside>

          <div className={`${isCompact ? "space-y-8" : "space-y-14"}`}>
            {section.groups.map((group) => (
              <DayGroupSection key={group.date.toISOString()} group={group} />
            ))}
          </div>
        </section>
      ))}

      <div className="border-t border-black/6 pt-10 text-center dark:border-white/10">
        <p className="text-sm text-[#9f99a3] dark:text-[#737373]">
          {t("timeline.noUnscheduledHint")}{" "}
          <button
            type="button"
            onClick={onSwitchToList}
            className="cursor-pointer font-medium text-[#6f6a72] underline decoration-black/10 underline-offset-4 hover:text-[#2b2a30] hover:decoration-black/30 dark:text-[#e5e5e5] dark:decoration-white/20 dark:hover:text-[#f5f5f5] dark:hover:decoration-white/40"
          >
            {t("timeline.switchToList")}
          </button>{" "}
          {t("timeline.toSeeThem")}
        </p>
      </div>
    </div>
  );
}
