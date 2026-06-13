"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useCellEditorOpenStore } from "@/lib/stores/use-cell-editor-open-store";
import { cn } from "@/lib/utils";

type DetailRow = {
  /** Short label shown in uppercase (e.g. "Subtasks"). */
  label: string;
  /** Pre-formatted value rendered beneath the label. */
  value: ReactNode;
};

/**
 * A hover tooltip that renders a list of labelled key/value rows.
 * Used by the table view to surface fields that are not shown in their
 * own column (subtasks, timezone, due date, estimate, reminders, notes).
 */
export function ExtraDetailsTooltip({
  rows,
  disabled,
  children,
  className,
}: {
  rows: DetailRow[];
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const anyEditorOpen = useCellEditorOpenStore((s) => s.openCount) > 0;

  function handleEnter() {
    if (disabled || anyEditorOpen || rows.length === 0) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => setOpen(true), 350);
  }

  function handleLeave() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  }

  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      if (!triggerRef.current || !tipRef.current) return;
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tipRect = tipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      const placeAbove = spaceAbove > spaceBelow;
      const top = placeAbove
        ? triggerRect.top - tipRect.height - 6
        : triggerRect.bottom + 6;
      let left = triggerRect.left + triggerRect.width / 2 - tipRect.width / 2;
      const minLeft = 8;
      const maxLeft = viewportWidth - tipRect.width - 8;
      left = Math.max(minLeft, Math.min(maxLeft, left));
      setPosition({ top, left });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, rows.length]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if ((disabled || anyEditorOpen) && open) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setOpen(false);
    }
  }, [disabled, anyEditorOpen, open]);

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      className={cn("relative inline-flex max-w-full", className)}
    >
      {children}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tipRef}
              role="tooltip"
              style={{
                position: "fixed",
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? "visible" : "hidden",
                zIndex: 250,
              }}
              className={cn(
                "min-w-[12rem] max-w-[20rem] rounded-lg p-2.5 space-y-1.5",
                "border border-black/5 bg-[#1f1d24] text-[#f5f5f5] shadow-lg",
                "dark:border-white/10 dark:bg-[#0a0a0a]",
              )}
            >
              {rows.map((row, index) => (
                <div key={index}>
                  <div className="text-[10px] font-semibold tracking-[0.12em] text-[#9f99a3] uppercase">
                    {row.label}
                  </div>
                  <div className="mt-0.5 text-xs leading-snug break-words text-[#f5f5f5]">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
