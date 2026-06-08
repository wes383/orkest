"use client";

import { Search, Plus, ArrowRight, CheckCircle2, Circle, AlertCircle, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { fuzzySearchItems } from "@/lib/ai/candidate-search";
import type { CandidateItem } from "@/lib/ai/candidate-search";
import type { ManualItemRecord } from "@/lib/types/all-page";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenComposer?: () => void;
  onNavigate?: (href: string) => void;
  onNavigateSettings?: () => void;
  onToggleAi?: () => void;
}

type QuickAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
};

function toCandidateItem(record: ManualItemRecord): CandidateItem {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    startDate: record.startDate,
    startTime: record.startTime,
    endDate: record.endDate,
    endTime: record.endTime,
    allDay: record.allDay,
    hasTime: record.hasTime,
    hasDueDate: !!record.dueDate,
    dueDate: record.dueDate,
    timezone: record.timezone,
    recurrenceType: record.recurrenceType,
    recurrenceInterval: record.recurrenceInterval,
    daysOfWeek: record.daysOfWeek,
    recurrenceEndType: record.recurrenceEndType,
    recurrenceEndDate: record.recurrenceEndDate,
    recurrenceCount: record.recurrenceCount,
    recurrenceBysetpos: record.recurrenceBysetpos,
    priority: record.priority,
    estimateMinutes: record.estimateMinutes,
    tags: record.tags,
    projectId: record.projectId,
    projectName: undefined,
    subtasks: undefined,
    status: record.status ?? "active",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    rrule: record.rrule,
    exdates: record.exdates,
    completedOccurrences: record.completedOccurrences,
    reopenedOccurrences: record.reopenedOccurrences,
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

export function CommandPalette({ open, onClose, onOpenComposer, onNavigate, onNavigateSettings, onToggleAi }: CommandPaletteProps) {
  const { t } = useI18n();
  const manualItems = useAllPageStore((s) => s.manualItems);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        id: "create-task",
        label: t("ai.prompt.addTask"),
        icon: <Plus className="h-4 w-4" />,
        action: () => {
          onClose();
          onOpenComposer?.();
        },
      },
      {
        id: "toggle-ai",
        label: t("shortcuts.toggleAi"),
        icon: <MessageCircle className="h-4 w-4" />,
        action: () => {
          onClose();
          onToggleAi?.();
        },
      },
      {
        id: "go-today",
        label: t("nav.today"),
        icon: <ArrowRight className="h-4 w-4" />,
        action: () => {
          onClose();
          onNavigate?.("/");
        },
      },
      {
        id: "go-all",
        label: t("nav.all"),
        icon: <ArrowRight className="h-4 w-4" />,
        action: () => {
          onClose();
          onNavigate?.("/all");
        },
      },
      {
        id: "go-focus",
        label: t("nav.focus"),
        icon: <ArrowRight className="h-4 w-4" />,
        action: () => {
          onClose();
          onNavigate?.("/focus");
        },
      },
      {
        id: "go-settings",
        label: t("nav.settings"),
        icon: <ArrowRight className="h-4 w-4" />,
        action: () => {
          onClose();
          onNavigateSettings?.();
        },
      },
    ],
    [t, onClose, onOpenComposer, onNavigate, onNavigateSettings, onToggleAi],
  );

  // Build project name map
  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    // Projects come from the project store, but we can derive names from items
    for (const item of manualItems) {
      if (item.projectId) {
        // We don't have project names in ManualItemRecord directly
        // The candidate search handles this via projectName field
      }
    }
    return map;
  }, [manualItems]);

  // Filtered quick actions (match query)
  const filteredActions = useMemo(() => {
    if (!query.trim()) return quickActions;
    const q = query.trim().toLowerCase();
    return quickActions.filter((a) => a.label.toLowerCase().includes(q));
  }, [query, quickActions]);

  // Search results
  const searchResults = useMemo(() => {
    if (query.trim().length < 2) return [];

    const candidates = manualItems
      .filter((item) => !item.deletedAt && item.status !== "cancelled")
      .map(toCandidateItem);

    const scored = fuzzySearchItems(candidates, query.trim());
    return scored.slice(0, 15);
  }, [query, manualItems]);

  // Combined items for navigation
  const allItems = useMemo(() => {
    const items: Array<{ id: string; type: "action" | "task"; action: () => void }> = [];

    // Quick actions (filtered by query)
    for (const action of filteredActions) {
      items.push({ id: action.id, type: "action", action: action.action });
    }

    // Task results
    for (const result of searchResults) {
      items.push({
        id: result.id,
        type: "task",
        action: () => {
          onClose();
          // Navigate to All page and scroll to the item
          onNavigate?.("/all");
          // Dispatch a custom event so the All page can highlight the item
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("orkest:scroll-to-item", { detail: { itemId: result.id } }),
            );
          }, 300);
        },
      });
    }

    return items;
  }, [quickActions, searchResults, onClose, onNavigate]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Ctrl+K / Cmd+K to close (since isModalOpen() blocks the global shortcut)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Clamp selected index
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, allItems.length - 1)));
  }, [allItems.length]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector(`[data-index="${selectedIndex}"]`);
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (allItems[selectedIndex]) {
            allItems[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [allItems, selectedIndex, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/50"
        style={{ backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-black/8 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1e1e1e]">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-black/6 px-4 py-3 dark:border-white/8">
          <Search className="h-4.5 w-4.5 shrink-0 text-[#9b95a0]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("commandPalette.placeholder")}
            className="flex-1 bg-transparent text-sm text-[#25242a] placeholder:text-[#9b95a0] focus:outline-none dark:text-[#f5f5f5] dark:placeholder:text-[#7a7a7a]"
          />
          <kbd className="hidden rounded border border-black/10 bg-black/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-[#9b95a0] sm:inline dark:border-white/10 dark:bg-white/[0.05]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {/* Quick Actions */}
          {filteredActions.length > 0 && (
            <>
              <div className="px-2 py-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#9b95a0]">
                  {t("commandPalette.quickActions")}
                </p>
              </div>
              {filteredActions.map((action, i) => (
            <button
              key={action.id}
              data-index={i}
              onClick={action.action}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                selectedIndex === i
                  ? "bg-[#f4f0ec] text-[#25242a] dark:bg-[#2a2a2a] dark:text-[#f5f5f5]"
                  : "text-[#6d6770] hover:bg-[#f4f0ec]/60 dark:text-[#a3a3a3] dark:hover:bg-[#2a2a2a]/60"
              }`}
            >
              <span className="text-[#9b95a0]">{action.icon}</span>
              <span className="flex-1 truncate">{action.label}</span>
            </button>
              ))}
            </>
          )}

          {/* Task Results */}
          {searchResults.length > 0 && (
            <>
              <div className="mt-2 px-2 py-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#9b95a0]">
                  {t("commandPalette.tasks")}
                </p>
              </div>
              {searchResults.map((result, i) => {
                const globalIndex = filteredActions.length + i;
                const statusIcon =
                  result.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : result.status === "in_progress" ? (
                    <AlertCircle className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-[#9b95a0]" />
                  );

                return (
                  <button
                    key={result.id}
                    data-index={globalIndex}
                    onClick={allItems[globalIndex]?.action}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      selectedIndex === globalIndex
                        ? "bg-[#f4f0ec] text-[#25242a] dark:bg-[#2a2a2a] dark:text-[#f5f5f5]"
                        : "text-[#6d6770] hover:bg-[#f4f0ec]/60 dark:text-[#a3a3a3] dark:hover:bg-[#2a2a2a]/60"
                    }`}
                  >
                    {statusIcon}
                    <span className="flex-1 truncate">{result.title}</span>
                    {result.priority && result.priority !== "none" && (
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_COLORS[result.priority] ?? "bg-gray-400"}`}
                      />
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* Empty state */}
          {query.trim().length >= 2 && searchResults.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-[#9b95a0]">
              {t("commandPalette.noResults")}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-black/6 px-4 py-2 text-[11px] text-[#9b95a0] dark:border-white/8">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-black/10 bg-black/[0.03] px-1 py-0.5 text-[10px] dark:border-white/10 dark:bg-white/[0.05]">↑↓</kbd>
            {t("commandPalette.navigate")}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-black/10 bg-black/[0.03] px-1 py-0.5 text-[10px] dark:border-white/10 dark:bg-white/[0.05]">↵</kbd>
            {t("commandPalette.select")}
          </span>
        </div>
      </div>
    </div>
  );
}
