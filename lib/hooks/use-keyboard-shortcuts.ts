"use client";

import { useEffect, useRef } from "react";

export type ShortcutHandler = (event: KeyboardEvent) => void;

export interface ShortcutDef {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  /** If true, allow firing even when an input/textarea is focused */
  allowInput?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  const isEditable =
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable;
  return isEditable;
}

function isModalOpen(): boolean {
  return document.querySelector("[data-state='open'][role='dialog']") !== null;
}

export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isModalOpen()) return;

      for (const s of shortcutsRef.current) {
        if (s.ctrl && !event.ctrlKey && !event.metaKey) continue;
        if (s.meta && !event.metaKey) continue;
        if (s.shift && !event.shiftKey) continue;
        if (s.alt && !event.altKey) continue;
        if (event.key.toLowerCase() !== s.key.toLowerCase()) continue;

        if (!s.allowInput && isTypingTarget(event.target)) continue;

        event.preventDefault();
        s.handler(event);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
