"use client";

import { useEffect, useReducer, useRef } from "react";
import { CalendarDays, Loader2, AlertCircle, ExternalLink } from "lucide-react";

import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import { getTodayDateKey, getTimezoneOffset } from "@/lib/daily-digest-utils";

interface OnThisDayEvent {
  year: number;
  text: string;
  wikipediaUrl: string;
  thumbnail?: string;
}

type OnThisDayState = {
  events: OnThisDayEvent[] | null;
  isLoading: boolean;
  error: boolean;
};

type OnThisDayAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; events: OnThisDayEvent[] }
  | { type: "FETCH_ERROR" };

function onThisDayReducer(state: OnThisDayState, action: OnThisDayAction): OnThisDayState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: false };
    case "FETCH_SUCCESS":
      return { events: action.events, isLoading: false, error: false };
    case "FETCH_ERROR":
      return { ...state, isLoading: false, error: true };
  }
}

export function OnThisDayCard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const locale = useSettingsStore((s) => s.locale);

  const [state, dispatch] = useReducer(onThisDayReducer, {
    events: null,
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
        const response = await fetch("/api/on-this-day", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            dateKey: getTodayDateKey(),
            timezoneOffset: getTimezoneOffset(),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch on this day");
        }

        const data = await response.json();
        dispatch({
          type: "FETCH_SUCCESS",
          events: data.events ?? [],
        });
      } catch {
        dispatch({ type: "FETCH_ERROR" });
      }
    })();
  }, [userId, locale]);

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[#8c8691] dark:text-[#a09ba5]" />
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
          {t("digest.topic.today_in_history")}
        </p>
      </div>

      <div className="mt-4">
        {state.isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8c8691] dark:text-[#a09ba5]" />
            <p className="text-sm text-[#8c8691] dark:text-[#a09ba5]">
              {t("onthisday.loading")}
            </p>
          </div>
        ) : state.error ? (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#8c8691] dark:text-[#a09ba5]" />
            <p className="text-sm text-[#8c8691] dark:text-[#a09ba5]">
              {t("onthisday.error")}
            </p>
          </div>
        ) : state.events && state.events.length > 0 ? (
          <div className="space-y-3">
            {state.events.map((event, index) => (
              <div key={index} className="flex gap-3">
                <span className="shrink-0 text-sm font-semibold text-[#8c8691] dark:text-[#a09ba5] w-12 text-right">
                  {event.year}
                </span>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed text-[#25242a] dark:text-[#f5f5f5]">
                    {event.text}
                  </p>
                  {event.wikipediaUrl && (
                    <a
                      href={event.wikipediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#6f6a72] hover:text-[#25242a] dark:text-[#a09ba5] dark:hover:text-[#f5f5f5] transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Wikipedia
                    </a>
                  )}
                </div>
              </div>
            ))}
            <p className="pt-2 text-[10px] text-[#8c8691] dark:text-[#a09ba5]">
              {t("onthisday.attribution")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
