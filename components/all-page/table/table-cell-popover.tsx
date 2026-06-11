"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type Align = "start" | "center" | "end";
type Side = "bottom" | "top";

export function Popover({
  open,
  onClose,
  anchor,
  align = "start",
  side = "bottom",
  offset = 6,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchor: HTMLElement | null;
  align?: Align;
  side?: Side;
  offset?: number;
  className?: string;
  children: ReactNode;
}) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number; actualSide: Side } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    function update() {
      if (!anchor || !popoverRef.current) return;
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - anchorRect.bottom;
      const spaceAbove = anchorRect.top;
      const popoverHeight = popoverRect.height || 1;
      const popoverWidth = popoverRect.width || 1;
      const needAbove =
        side === "top" ||
        spaceBelow < popoverHeight + offset + 8 ||
        spaceAbove > spaceBelow;
      const actualSide: Side = needAbove ? "top" : "bottom";

      let left = anchorRect.left;
      if (align === "center") {
        left = anchorRect.left + anchorRect.width / 2 - popoverWidth / 2;
      } else if (align === "end") {
        left = anchorRect.right - popoverWidth;
      }
      // Clamp horizontally to viewport
      const minLeft = 8;
      const maxLeft = viewportWidth - popoverWidth - 8;
      left = Math.max(minLeft, Math.min(maxLeft, left));

      const top =
        actualSide === "bottom"
          ? anchorRect.bottom + offset
          : anchorRect.top - popoverHeight - offset;

      // Final safety: if the computed top still extends past the viewport,
      // clamp it to keep the popover fully on screen.
      const clampedTop = Math.max(
        8,
        Math.min(top, viewportHeight - popoverHeight - 8),
      );

      setPosition({ top: clampedTop, left, actualSide });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    let observer: ResizeObserver | null = null;
    if (popoverRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => update());
      observer.observe(popoverRef.current);
    }

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      if (observer) observer.disconnect();
    };
  }, [open, anchor, align, side, offset]);

  useEffect(() => {
    if (!open) return;
    function handle(event: MouseEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", key);
    };
  }, [open, onClose, anchor]);

  if (!open || typeof document === "undefined") return null;

  const style: React.CSSProperties = position
    ? { top: position.top, left: position.left, position: "fixed" }
    : { visibility: "hidden", position: "fixed", top: 0, left: 0 };

  return createPortal(
    <div
      ref={popoverRef}
      role="presentation"
      style={style}
      className={cn(
        "z-[200] min-w-[10rem] rounded-lg border border-black/8 bg-white p-1 shadow-xl",
        "dark:border-white/10 dark:bg-[#1a1a1a]",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
