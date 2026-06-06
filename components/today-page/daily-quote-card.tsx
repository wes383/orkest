"use client";

import { useEffect, useReducer, useRef } from "react";
import { Quote, Loader2, AlertCircle } from "lucide-react";

import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import { getTodayDateKey, getTimezoneOffset } from "@/lib/daily-digest-utils";

type QuoteState = {
  quote: string | null;
  author: string | null;
  isLoading: boolean;
  error: boolean;
};

type QuoteAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; quote: string; author: string }
  | { type: "FETCH_ERROR" };

function quoteReducer(state: QuoteState, action: QuoteAction): QuoteState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: false };
    case "FETCH_SUCCESS":
      return { quote: action.quote, author: action.author, isLoading: false, error: false };
    case "FETCH_ERROR":
      return { ...state, isLoading: false, error: true };
  }
}

export function DailyQuoteCard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const locale = useSettingsStore((s) => s.locale);

  const [state, dispatch] = useReducer(quoteReducer, {
    quote: null,
    author: null,
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
        const response = await fetch("/api/daily-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            dateKey: getTodayDateKey(),
            timezoneOffset: getTimezoneOffset(),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch quote");
        }

        const data = await response.json();
        dispatch({
          type: "FETCH_SUCCESS",
          quote: data.quote ?? "",
          author: data.author ?? "",
        });
      } catch {
        dispatch({ type: "FETCH_ERROR" });
      }
    })();
  }, [userId, locale]);

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
      <div className="flex items-center gap-2">
        <Quote className="h-4 w-4 text-[#8c8691] dark:text-[#a09ba5]" />
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
          {t("digest.topic.daily_quote")}
        </p>
      </div>

      <div className="mt-4">
        {state.isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8c8691] dark:text-[#a09ba5]" />
            <p className="text-sm text-[#8c8691] dark:text-[#a09ba5]">
              {t("quote.loading")}
            </p>
          </div>
        ) : state.error ? (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#8c8691] dark:text-[#a09ba5]" />
            <p className="text-sm text-[#8c8691] dark:text-[#a09ba5]">
              {t("quote.error")}
            </p>
          </div>
        ) : state.quote ? (
          <>
            <p className="text-base font-medium leading-relaxed text-[#25242a] dark:text-[#f5f5f5]">
              &ldquo;{state.quote}&rdquo;
            </p>
            {state.author && (
              <p className="mt-2 text-sm text-[#6f6a72] dark:text-[#a09ba5]">
                — {state.author}
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
