"use client";

import { cn } from "@/lib/utils";
import { useFocusStore } from "@/lib/stores/use-focus-store";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useI18n } from "@/lib/i18n";
import type { DisplayItem } from "@/lib/types/all-page";
import type { Priority } from "@/lib/types/item";
import { Check, ChevronDown, Target } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useState } from "react";

const PRIORITY_DOT_COLORS: Record<Priority, string> = {
  low: "bg-gray-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

export function TaskSelector({ items }: { items: DisplayItem[] }) {
  const { t } = useI18n();
  const selectedItemId = useFocusStore((s) => s.selectedItemId);
  const setSelectedItemId = useFocusStore((s) => s.setSelectedItemId);
  const timerState = useFocusStore((s) => s.timerState);
  const openComposer = useAllPageStore((s) => s.openComposer);
  const [isOpen, setIsOpen] = useState(false);

  const isDisabled = timerState === "running" || timerState === "paused";
  const selectedItem = items.find((item) => item.id === selectedItemId);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title={t("empty.focus.title")}
        description={t("empty.focus.description")}
        compact
        action={{ label: t("empty.createTask"), onClick: () => openComposer() }}
      />
    );
  }

  return (
    <div className="relative w-full">
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-black/8 dark:border-white/10 bg-white/75 dark:!bg-[#202020] px-4 py-3 text-left transition-all",
          "hover:border-black/15 dark:hover:border-white/20",
          isDisabled && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex-1 min-w-0">
          {selectedItem ? (
            <div className="flex items-center gap-2">
              {selectedItem.priority && (
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    PRIORITY_DOT_COLORS[selectedItem.priority],
                  )}
                />
              )}
              <span className="truncate text-sm font-medium text-[#25242a] dark:text-[#e8e6ea]">
                {selectedItem.title}
              </span>
            </div>
          ) : (
            <span className="text-sm text-[#9f99a3] dark:text-[#8a858f]">{t("focus.noTask")}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[#7d7880] dark:text-[#a9a4ae] transition-transform",
            isOpen && "rotate-180",
          )}
          strokeWidth={2}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-black/8 dark:border-white/10 bg-white dark:!bg-[#202020] shadow-lg">
            <div className="max-h-64 overflow-y-auto scrollbar-transparent-track">
              <button
                type="button"
                onClick={() => {
                  setSelectedItemId(null);
                  setIsOpen(false);
                }}
                className="flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-sm text-[#7d7880] dark:text-[#a9a4ae] transition-colors hover:bg-black/[0.035] dark:hover:bg-white/[0.06]"
              >
                <span>{t("focus.noTask")}</span>
              </button>
              {items.map((item) => {
                const isSelected = item.id === selectedItemId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedItemId(item.id, item.tags ?? [], item.title);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-black/[0.035] dark:hover:bg-white/[0.06]",
                      isSelected && "bg-black/[0.035] dark:bg-white/[0.08]",
                    )}
                  >
                    {item.priority ? (
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          PRIORITY_DOT_COLORS[item.priority],
                        )}
                      />
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                    )}
                    <span className="flex-1 truncate text-[#25242a] dark:text-[#e8e6ea]">{item.title}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-[#25242a] dark:text-[#e8e6ea]" strokeWidth={2} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
