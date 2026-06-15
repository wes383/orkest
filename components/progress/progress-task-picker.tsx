"use client";

import { Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { ManualItemRecord } from "@/lib/types/all-page";

interface ProgressTaskPickerProps {
  open: boolean;
  candidates: ManualItemRecord[];
  boundItemIds: string[];
  onClose: () => void;
  onConfirm: (itemIds: string[]) => Promise<void> | void;
}

export function ProgressTaskPicker({ open, candidates, boundItemIds, onClose, onConfirm }: ProgressTaskPickerProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelected(new Set());
      setSearch("");
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const bound = useMemo(() => new Set(boundItemIds), [boundItemIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((item) => {
      if (bound.has(item.id)) return false;
      if (item.deletedAt) return false;
      if (item.parentId) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q);
    });
  }, [candidates, search, bound]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      await onConfirm(Array.from(selected));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-white/35 backdrop-blur-[5px] dark:bg-black/50"
      />
      <div className="relative z-10 flex h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.16)] dark:border-white/10 dark:bg-[#202020]">
        <div className="flex items-center justify-between border-b border-black/6 px-5 py-4 dark:border-white/8">
          <h2 className="text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">
            {t("progress.taskPicker.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.04] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-black/6 px-5 py-3 dark:border-white/8">
          <div className="flex items-center gap-2 rounded-lg border border-black/8 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#1f1d24]">
            <Search className="h-4 w-4 shrink-0 text-[#9f99a3]" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("progress.taskPicker.search")}
              className="flex-1 bg-transparent text-[#25242a] placeholder:text-[#9f99a3] focus:outline-none dark:text-[#f5f5f5]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#7d7880] dark:text-[#a3a3a3]">
              {t("progress.taskPicker.empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((item) => {
                const isSelected = selected.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-500/10"
                          : "hover:bg-black/[0.04] dark:hover:bg-white/8"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-black/20 dark:border-white/20"
                        }`}
                      >
                        {isSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="flex-1 truncate text-[#25242a] dark:text-[#f5f5f5]">
                        {item.title || t("ai.untitledItem")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-black/6 px-5 py-3 dark:border-white/8">
          <Button type="button" variant="ghost" onClick={onClose} className="h-8 px-3 text-xs">
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={selected.size === 0 || busy}
            className="h-8 px-3 text-xs"
          >
            {t("progress.taskPicker.confirm", { count: selected.size })}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
