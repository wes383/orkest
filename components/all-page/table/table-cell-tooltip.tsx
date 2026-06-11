"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useCellEditorOpenStore } from "@/lib/stores/use-cell-editor-open-store";
import { cn } from "@/lib/utils";

/**
 * A lightweight hover tooltip rendered via a React portal so it can extend
 * beyond the boundaries of overflow:hidden / scrolling table cells.
 */
export function TableCellTooltip({
  label,
  value,
  hint,
  disabled,
  children,
  className,
}: {
  /** Short column name shown in uppercase (e.g. "Start"). */
  label: string;
  /** Full untruncated value for this cell. */
  value: string;
  /** Optional secondary line (e.g. timezone, additional context). */
  hint?: string;
  /** When true, suppresses the tooltip even if the value would normally warrant one. */
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const anyEditorOpen = useCellEditorOpenStore((s) => s.openCount) > 0;

  function handleEnter() {
    if (disabled || anyEditorOpen) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPlacement(rect.top < 64 ? "bottom" : "top");
      }
      setOpen(true);
    }, 350);
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
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      const actualPlacement =
        placement === "top" || spaceBelow < tipRect.height + 8
          ? spaceAbove > spaceBelow
            ? "top"
            : "bottom"
          : placement;
      const top =
        actualPlacement === "bottom"
          ? triggerRect.bottom + 6
          : triggerRect.top - tipRect.height - 6;
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
  }, [open, placement]);

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
            <span
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
                "min-w-max max-w-[20rem] rounded-lg px-2.5 py-1.5",
                "border border-black/5 bg-[#1f1d24] text-[#f5f5f5] shadow-lg",
                "dark:border-white/10 dark:bg-[#0a0a0a]",
              )}
            >
              <span className="block text-[10px] font-semibold tracking-[0.12em] text-[#9f99a3] uppercase">
                {label}
              </span>
              <span className="mt-0.5 block text-xs leading-snug break-words text-[#f5f5f5]">
                {value}
              </span>
              {hint ? (
                <span className="mt-0.5 block text-[10px] text-[#9f99a3]">{hint}</span>
              ) : null}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
