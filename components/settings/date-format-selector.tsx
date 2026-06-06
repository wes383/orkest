"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { getDateFormatLocales } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n";

interface DateFormatSelectorProps {
  value: string;
  onChange: (v: string) => void;
}

export function DateFormatSelector({ value, onChange }: DateFormatSelectorProps) {
  const { t } = useI18n();
  const allLocales = useMemo(() => getDateFormatLocales(), []);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedLocale = allLocales.find((l) => l.code === value);
  const selectedLabel = selectedLocale
    ? `${selectedLocale.lang} (${selectedLocale.country}) — ${selectedLocale.fmt}`
    : value;

  const candidates = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allLocales
      .filter(
        (l) =>
          l.code.toLowerCase().includes(q) ||
          l.lang.toLowerCase().includes(q) ||
          l.country.toLowerCase().includes(q) ||
          l.fmt.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [query, allLocales]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder={focused ? t("settings.dateFormatSearch") : selectedLabel}
        value={focused ? query : selectedLabel}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { setFocused(true); setQuery(""); }}
        onBlur={() => setFocused(false)}
        className="flex h-12 w-full rounded-2xl border border-black/8 bg-white px-4 text-[15px] outline-none transition-colors placeholder:text-[#9f99a3] focus:border-black/22 dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5] dark:placeholder:text-[#737373] dark:focus:border-white/25"
      />
      {focused && candidates.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-2xl border border-black/8 bg-white shadow-lg dark:border-white/10 dark:bg-[#202020]">
          {candidates.map((l) => (
            <button
              key={l.code}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(l.code);
                setQuery("");
                setFocused(false);
              }}
              className={`flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-[15px] transition-colors hover:bg-black/3 dark:hover:bg-white/5 ${
                l.code === value
                  ? "font-medium text-black dark:text-white"
                  : "text-[#4d4a51] dark:text-[#d4d4d4]"
              }`}
            >
              <span className="flex-1">
                <span className="font-medium">{l.lang}</span>
                <span className="mx-1.5 text-[#9f99a3]">—</span>
                <span>{l.country}</span>
              </span>
              <span className="ml-3 text-xs text-[#9f99a3]">{l.fmt}</span>
            </button>
          ))}
        </div>
      )}
      {focused && query.trim() && candidates.length === 0 && (
        <p className="mt-1 text-xs text-[#9f99a3]">{t("settings.dateFormatNoMatch")}</p>
      )}
    </div>
  );
}
