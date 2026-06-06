"use client";

import { ArrowDown, ArrowUp, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDateLocale, useSettingsStore } from "@/lib/stores/use-settings-store";
import { getBrowserTimezone } from "@/lib/timezone";
import { useI18n } from "@/lib/i18n";
import { TrashPageSkeleton } from "@/components/ui/page-skeletons";

function formatTime(item: { startDate?: string; startTime?: string; endDate?: string; endTime?: string; allDay?: boolean; hasTime?: boolean }, is12h: boolean, allDayLabel: string): string | null {
  if (!item.startDate && !item.startTime && !item.allDay) return null;

  const tz = getBrowserTimezone() || undefined;
  const d = item.startDate ? new Date(item.startDate + "T00:00:00") : new Date();
  const currentYear = new Date().getFullYear();
  const showYear = d.getFullYear() !== currentYear;
  const dateLabel = d.toLocaleDateString(getDateLocale(), { month: "short", day: "numeric", timeZone: tz, ...(showYear ? { year: "numeric" } : {}) });

  if (item.allDay) return `${dateLabel} · ${allDayLabel}`;

  if (!item.hasTime || !item.startTime) return dateLabel;

  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    if (is12h) {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    }
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  if (item.endTime) {
    return `${dateLabel} · ${fmt(item.startTime)} - ${fmt(item.endTime)}`;
  }

  return `${dateLabel} · ${fmt(item.startTime)}`;
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function getDaysUntilPermanentDeletion(deletedAt: string): number {
  const now = new Date();
  const deleted = new Date(deletedAt);
  const diffMs = now.getTime() - deleted.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, 30 - diffDays);
}

function formatSortTime(item: { startDate?: string; startTime?: string; endDate?: string; endTime?: string; allDay?: boolean; hasTime?: boolean }): string {
  const d = item.startDate ? new Date(item.startDate + "T00:00:00") : new Date(0);
  const dateStr = d.toISOString().slice(0, 10);
  const timeStr = item.hasTime && item.startTime ? item.startTime : "";
  return `${dateStr} ${timeStr}`;
}

function SortArrow({ field, sortField, sortAsc }: { field: string; sortField: string; sortAsc: boolean }) {
  if (field !== sortField) return <span className="inline-block w-3 ml-0.5" />;
  return sortAsc ? <ArrowUp className="h-3 w-3 inline ml-0.5" /> : <ArrowDown className="h-3 w-3 inline ml-0.5" />;
}

export function TrashPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const is12h = timeFormat === "12h";
  const manualItems = useAllPageStore((s) => s.manualItems);
  const isLoaded = useAllPageStore((s) => s.isLoaded);
  const isSyncing = useAllPageStore((s) => s.isSyncing);
  const loadItemsFromCloud = useAllPageStore((s) => s.loadItemsFromCloud);
  const restoreItem = useAllPageStore((s) => s.restoreItem);
  const permanentlyDeleteItem = useAllPageStore((s) => s.permanentlyDeleteItem);
  const emptyTrash = useAllPageStore((s) => s.emptyTrash);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  type SortField = "title" | "time" | "deletedAt" | "expiresIn";
  const [sort, setSort] = useState<{ field: SortField; asc: boolean }>({ field: "deletedAt", asc: false });

  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => ({
      field,
      asc: prev.field === field ? !prev.asc : field === "title",
    }));
  }, []);

  useEffect(() => {
    if (!isLoaded && user) {
      void loadItemsFromCloud(user.id);
    }
  }, [isLoaded, loadItemsFromCloud, user]);

  const deletedItems = useMemo(() => {
    return manualItems
      .filter((item) => item.deletedAt)
      .sort((a, b) => {
        let cmp = 0;
        if (sort.field === "title") {
          cmp = a.title.localeCompare(b.title);
        } else if (sort.field === "deletedAt") {
          cmp = new Date(a.deletedAt!).getTime() - new Date(b.deletedAt!).getTime();
        } else if (sort.field === "expiresIn") {
          cmp = getDaysUntilPermanentDeletion(a.deletedAt!) - getDaysUntilPermanentDeletion(b.deletedAt!);
        } else if (sort.field === "time") {
          const ta = formatSortTime(a);
          const tb = formatSortTime(b);
          cmp = ta.localeCompare(tb);
        }
        return sort.asc ? cmp : -cmp;
      });
  }, [manualItems, sort]);

  if (authLoading || (isSyncing && !isLoaded)) {
    return <TrashPageSkeleton />;
  }

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === deletedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(deletedItems.map((item) => item.id)));
    }
  };

  const handleRestoreSelected = () => {
    for (const id of selectedItems) {
      restoreItem(id);
    }
    setSelectedItems(new Set());
  };

  const handleDeleteSelected = () => {
    for (const id of selectedItems) {
      void permanentlyDeleteItem(id);
    }
    setSelectedItems(new Set());
  };

  const handleEmptyTrash = () => {
    if (deletedItems.length === 0) return;
    void emptyTrash();
    setSelectedItems(new Set());
    setConfirmOpen(false);
  };

  if (deletedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-8 py-12 text-center max-w-md">
          <Trash2 className="mx-auto h-12 w-12 text-[#b0a9b2] dark:text-[#6a6570] mb-4" />
          <h2 className="font-display text-2xl font-semibold text-[#25242a] dark:text-[#e8e6ea]">
            {t("trash.emptyTitle")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6a6570] dark:text-[#a09ba5]">
            {t("trash.emptyDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#25242a] dark:text-[#e8e6ea]">{t("trash.title")}</h1>
          <p className="mt-1 text-sm text-[#6a6570] dark:text-[#a09ba5]">
            {t("trash.itemCount", { count: deletedItems.length })}{deletedItems.length !== 1 && t("trash.itemCountPlural") ? t("trash.itemCountPlural") : ""} · {t("trash.autoDeleteHint")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedItems.size > 0 && (
            <>
              <button
                type="button"
                onClick={handleRestoreSelected}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#25242a] dark:text-[#e8e6ea] rounded-xl border border-black/8 dark:border-white/10 hover:bg-black/[0.035] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                {t("trash.restore")} ({selectedItems.size})
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 rounded-xl border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                {t("trash.delete")} ({selectedItems.size})
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#7d7880] dark:text-[#a9a4ae] rounded-xl border border-black/8 dark:border-white/10 hover:bg-black/[0.035] dark:hover:bg-white/[0.06] hover:text-[#25242a] dark:hover:text-[#e8e6ea] transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            {t("trash.emptyTrash")}
          </button>

          {confirmOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
              onClick={() => setConfirmOpen(false)}
            >
              <div
                className="w-72 rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#202020] p-0 shadow-[0_24px_64px_rgba(28,24,35,0.16)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-6 pb-2">
                  <p className="text-base font-semibold text-[#25242a] dark:text-[#e8e6ea]">{t("trash.confirmEmptyTitle")}</p>
                  <p className="mt-1 text-xs text-[#9f99a3] dark:text-[#a09ba5]">
                    {t("trash.confirmEmptyDescription", { count: deletedItems.length })}
                  </p>
                </div>
                <div className="space-y-0.5 px-2 pb-2">
                  <button
                    type="button"
                    onClick={handleEmptyTrash}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-red-600 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                  >
                    {t("trash.emptyTrash")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-[#7d7880] dark:text-[#a9a4ae] transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                  >
                    {t("itemForm.cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-black/8 dark:border-white/10 bg-white/75 dark:bg-[#202020] overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-black/6 dark:border-white/10 bg-[#fcfbfa] dark:bg-[#181818]">
          <input
            type="checkbox"
            checked={selectedItems.size === deletedItems.length}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-black/20 text-[#25242a] focus:ring-[#25242a] dark:border-white/20 dark:text-[#e8e6ea] dark:bg-[#2a2a2a]"
          />
          <button type="button" onClick={() => handleSort("title")} className="flex items-center gap-1 text-xs font-semibold tracking-[0.16em] text-[#8c8691] dark:text-[#a09ba5] uppercase flex-1 text-left cursor-pointer hover:text-[#25242a] dark:hover:text-[#e8e6ea] transition-colors">
            {t("trash.title")}<SortArrow field="title" sortField={sort.field} sortAsc={sort.asc} />
          </button>
          <button type="button" onClick={() => handleSort("time")} className="flex items-center justify-end gap-1 text-xs font-semibold tracking-[0.16em] text-[#8c8691] dark:text-[#a09ba5] uppercase w-40 text-right cursor-pointer hover:text-[#25242a] dark:hover:text-[#e8e6ea] transition-colors">
            {t("itemForm.time")}<SortArrow field="time" sortField={sort.field} sortAsc={sort.asc} />
          </button>
          <button type="button" onClick={() => handleSort("deletedAt")} className="flex items-center justify-end gap-1 text-xs font-semibold tracking-[0.16em] text-[#8c8691] dark:text-[#a09ba5] uppercase w-32 text-right cursor-pointer hover:text-[#25242a] dark:hover:text-[#e8e6ea] transition-colors">
            {t("trash.deleted")}<SortArrow field="deletedAt" sortField={sort.field} sortAsc={sort.asc} />
          </button>
          <button type="button" onClick={() => handleSort("expiresIn")} className="flex items-center justify-end gap-1 text-xs font-semibold tracking-[0.16em] text-[#8c8691] dark:text-[#a09ba5] uppercase w-32 text-right cursor-pointer hover:text-[#25242a] dark:hover:text-[#e8e6ea] transition-colors whitespace-nowrap">
            {t("trash.expiresIn")}<SortArrow field="expiresIn" sortField={sort.field} sortAsc={sort.asc} />
          </button>
          <span className="w-20" />
        </div>

        {deletedItems.map((item) => {
          const daysLeft = getDaysUntilPermanentDeletion(item.deletedAt!);
          const isExpiringSoon = daysLeft <= 3;

          return (
            <div
              key={item.id}
              className="flex items-center gap-4 px-4 py-3 border-b border-black/4 dark:border-white/5 last:border-0 hover:bg-[#fcfbfa] dark:hover:bg-[#181818] transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedItems.has(item.id)}
                onChange={() => toggleSelect(item.id)}
                className="h-4 w-4 rounded border-black/20 text-[#25242a] focus:ring-[#25242a] dark:border-white/20 dark:text-[#e8e6ea] dark:bg-[#2a2a2a]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#25242a] dark:text-[#e8e6ea] truncate">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-[#6a6570] dark:text-[#a09ba5] truncate mt-0.5">{item.description}</p>
                )}
              </div>
              <div className="w-40 text-right shrink-0">
                {formatTime(item, is12h, t("calendar.allDay") as string) && (
                  <p className="text-xs font-medium tabular-nums text-[#6a6570] dark:text-[#a09ba5]">{formatTime(item, is12h, t("calendar.allDay") as string)}</p>
                )}
              </div>
              <span className="text-xs text-[#6a6570] dark:text-[#a09ba5] w-32 text-right shrink-0">
                {getRelativeTime(item.deletedAt!)}
              </span>
              <span
                className={`text-xs w-32 text-right shrink-0 whitespace-nowrap ${
                  isExpiringSoon ? "text-red-500 dark:text-red-400 font-medium" : "text-[#6a6570] dark:text-[#a09ba5]"
                }`}
              >
                {daysLeft}d
              </span>
              <div className="flex items-center gap-1 w-20 justify-end">
                <button
                  type="button"
                  onClick={() => restoreItem(item.id)}
                  className="p-1.5 rounded-lg text-[#6a6570] dark:text-[#a09ba5] hover:text-[#25242a] dark:hover:text-[#e8e6ea] hover:bg-black/[0.035] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  title={t("trash.restore")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void permanentlyDeleteItem(item.id)}
                  className="p-1.5 rounded-lg text-[#6a6570] dark:text-[#a09ba5] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors cursor-pointer"
                  title={t("trash.deletePermanent")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
