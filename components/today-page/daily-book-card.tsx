"use client";

import { useEffect, useReducer, useRef } from "react";
import { BookOpen, Loader2, AlertCircle } from "lucide-react";

import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import { getTodayDateKey, getTimezoneOffset } from "@/lib/daily-digest-utils";

interface BookData {
  title: string;
  author: string;
  year: number;
  language: string;
  recommendation: string;
  sourceId: number;
}

type BookState = {
  book: BookData | null;
  isLoading: boolean;
  error: boolean;
};

type BookAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; book: BookData }
  | { type: "FETCH_ERROR" };

function bookReducer(state: BookState, action: BookAction): BookState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: false };
    case "FETCH_SUCCESS":
      return { book: action.book, isLoading: false, error: false };
    case "FETCH_ERROR":
      return { ...state, isLoading: false, error: true };
  }
}

export function DailyBookCard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const locale = useSettingsStore((s) => s.locale);

  const [state, dispatch] = useReducer(bookReducer, {
    book: null,
    isLoading: false,
    error: false,
  });

  const hasRequestedRef = useRef(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (hasRequestedRef.current) return;
    if (!userId) return;

    hasRequestedRef.current = true;
    dispatch({ type: "FETCH_START" });

    void (async () => {
      try {
        const response = await fetch("/api/daily-book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            dateKey: getTodayDateKey(),
            timezoneOffset: getTimezoneOffset(),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch daily book");
        }

        const data = await response.json();
        dispatch({
          type: "FETCH_SUCCESS",
          book: data,
        });
      } catch {
        dispatch({ type: "FETCH_ERROR" });
      }
    })();
  }, [userId, locale]);

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-[#8c8691] dark:text-[#a09ba5]" />
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
          {t("digest.topic.daily_book")}
        </p>
      </div>

      <div className="mt-4">
        {state.isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8c8691] dark:text-[#a09ba5]" />
            <p className="text-sm text-[#8c8691] dark:text-[#a09ba5]">
              {t("book.loading")}
            </p>
          </div>
        ) : state.error ? (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#8c8691] dark:text-[#a09ba5]" />
            <p className="text-sm text-[#8c8691] dark:text-[#a09ba5]">
              {t("book.error")}
            </p>
          </div>
        ) : state.book ? (
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-[#25242a] dark:text-[#f5f5f5]">
              {state.book.title}
            </h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6f6a72] dark:text-[#a09ba5]">
              <span>
                {t("book.author")}: {state.book.author}
              </span>
              <span>
                {t("book.year")}: {state.book.year}
              </span>
              <span>
                {t("book.language")}: {state.book.language}
              </span>
            </div>
            <p className="pt-1 text-sm leading-relaxed text-[#25242a] dark:text-[#f5f5f5]">
              {state.book.recommendation}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
