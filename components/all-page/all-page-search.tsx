"use client";

import { Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useI18n } from "@/lib/i18n";

export function AllPageSearch() {
  const { t } = useI18n();
  const filterConfig = useAllPageStore((s) => s.listFilterConfig);
  const setFilterConfig = useAllPageStore((s) => s.setListFilterConfig);
  const [localValue, setLocalValue] = useState(filterConfig.searchQuery ?? "");
  const deferredValue = useDeferredValue(localValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local state → store (deferred to avoid blocking input)
  useEffect(() => {
    setFilterConfig({ searchQuery: deferredValue });
  }, [deferredValue, setFilterConfig]);

  // Sync store → local (e.g. when cleared externally)
  useEffect(() => {
    if (filterConfig.searchQuery !== undefined && filterConfig.searchQuery !== deferredValue) {
      setLocalValue(filterConfig.searchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterConfig.searchQuery]);

  // "/" key focuses the search input when on All page and not in an input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !(document.activeElement as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative w-full max-w-80">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b95a0]" />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={t("common.search")}
        className="h-9 w-full rounded-full border border-black/8 bg-[#f4f0ec]/60 pl-9 pr-8 text-sm text-[#25242a] placeholder:text-[#9b95a0] focus:border-[#6d6770] focus:outline-none dark:border-white/10 dark:bg-[#2a2a2a] dark:text-[#f5f5f5] dark:placeholder:text-[#7a7a7a] dark:focus:border-[#a3a3a3]"
      />
      {localValue && (
        <button
          onClick={() => {
            setLocalValue("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#9b95a0] hover:bg-black/5 hover:text-[#6d6770] dark:hover:bg-white/10 dark:hover:text-[#a3a3a3]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
