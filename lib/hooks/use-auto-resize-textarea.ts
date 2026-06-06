"use client";

import { useCallback, useEffect, useRef } from "react";

export function useAutoResizeTextarea(minHeight = 44, maxHeight = 200) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    const newHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${newHeight}px`;
  }, [minHeight, maxHeight]);

  useEffect(() => {
    resize();
  }, [resize]);

  return { textareaRef, resize };
}
