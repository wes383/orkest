"use client";

import { type ReactNode, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  children: ReactNode;
  content: string;
  side?: "right" | "top" | "bottom" | "left";
  delay?: number;
  disabled?: boolean;
  maxWidth?: number;
}

export function Tooltip({ children, content, side = "right", delay = 300, disabled = false, maxWidth }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        let top = 0;
        let left = 0;

        switch (side) {
          case "right":
            top = rect.top + rect.height / 2;
            left = rect.right + 12;
            break;
          case "left":
            top = rect.top + rect.height / 2;
            left = rect.left - 8;
            break;
          case "top":
            top = rect.top - 8;
            left = rect.left + rect.width / 2;
            break;
          case "bottom":
            top = rect.bottom + 8;
            left = rect.left + rect.width / 2;
            break;
        }

        setPosition({ top, left });
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (disabled && isVisible) {
      hideTooltip();
    }
  }, [disabled, isVisible]);

  const getTransformStyle = () => {
    switch (side) {
      case "right":
        return "translateY(-50%)";
      case "left":
        return "translate(-100%, -50%)";
      case "top":
        return "translate(-50%, -100%)";
      case "bottom":
        return "translate(-50%, 0)";
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        className="inline-flex"
      >
        {children}
      </div>
      {isVisible &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[100] pointer-events-none"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              transform: getTransformStyle(),
            }}
          >
            <div
              className="rounded-lg bg-black/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-white/90 dark:text-black whitespace-nowrap"
              style={maxWidth ? { maxWidth, whiteSpace: "normal" } : undefined}
            >
              {content}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
