"use client";

import { Link2Off } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { ItemCard } from "@/components/all-page/item-card";
import type { DisplayItem, ManualItemRecord } from "@/lib/types/all-page";
import { buildDisplayItems, toItemFromManualRecord } from "@/lib/all-page-utils";

interface ProgressBoundTaskListProps {
  items: ManualItemRecord[];
  onUnlink: (itemId: string) => void;
}

export function ProgressBoundTaskList({ items, onUnlink }: ProgressBoundTaskListProps) {
  const { t } = useI18n();

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-black/8 px-4 py-6 text-center text-sm text-[#7d7880] dark:border-white/10 dark:text-[#a3a3a3]">
        {t("progress.detail.noTasks")}
      </p>
    );
  }

  const displayItems: DisplayItem[] = buildDisplayItems(
    items.map((record) => toItemFromManualRecord(record)),
  ).filter((item) => !item.parentId);

  return (
    <ul className="flex flex-col gap-1.5">
      {displayItems.map((item) => (
        <li key={getItemCardKey(item)}>
          <ItemCard
            item={item}
            disableDrag
            disableLeadingBleed
            compactActions
            extraActions={
              <button
                type="button"
                onClick={() => onUnlink(item.id)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                title={t("progress.unlink")}
                aria-label={t("progress.unlink")}
              >
                <Link2Off className="h-3.5 w-3.5" />
                <span className="flex-1">{t("progress.unlink")}</span>
              </button>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function getItemCardKey(item: DisplayItem) {
  return `${item.id}:${item.occurrenceKey ?? "base"}`;
}
