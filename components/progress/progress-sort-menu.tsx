"use client";

import { createPortal } from "react-dom";
import { ArrowDownAZ, ArrowUpDown, Calendar, ChevronDown, GripVertical, List } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n";
import type { ProgressSortMode } from "@/lib/progress/progress-stats";

interface ProgressSortMenuProps {
  sortMode: ProgressSortMode;
  onChange: (mode: ProgressSortMode) => void;
}

export function ProgressSortMenu({ sortMode, onChange }: ProgressSortMenuProps) {
  const { t } = useI18n();
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const options: Array<{ mode: ProgressSortMode; icon: typeof GripVertical; label: string }> = [
    { mode: "default", icon: GripVertical, label: t("progress.sort.default") },
    { mode: "alpha", icon: ArrowDownAZ, label: t("progress.sort.alpha") },
    { mode: "recent", icon: List, label: t("progress.sort.recent") },
    { mode: "completion", icon: Calendar, label: t("progress.sort.completion") },
  ];

  const currentLabel = options.find((o) => o.mode === sortMode)?.label ?? t("progress.sort.default");

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
          open
            ? "border-black/12 bg-white text-[#25242a] dark:border-white/12 dark:bg-[#2a2a2a] dark:text-[#f5f5f5]"
            : "border-black/8 bg-transparent text-[#7d7880] hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]"
        }`}
      >
        <ArrowUpDown className="h-3 w-3" />
        <span className="max-w-[6rem] truncate">{currentLabel}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 w-44 rounded-xl border border-black/8 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#1f1d24] flex flex-col gap-0.5"
              style={{ top: pos.top, left: pos.left }}
            >
              {options.map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    onChange(mode);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    sortMode === mode
                      ? "bg-black/[0.05] text-[#25242a] dark:bg-white/10 dark:text-[#f5f5f5]"
                      : "text-[#7d7880] hover:bg-black/[0.035] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
