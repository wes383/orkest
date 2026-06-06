"use client";

import { useEffect, useReducer, useRef } from "react";
import { Film, Loader2, AlertCircle, ExternalLink } from "lucide-react";

import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import { getTodayDateKey, getTimezoneOffset } from "@/lib/daily-digest-utils";

interface MovieData {
  title: string;
  year: number;
  genres: string;
  directors: string;
  recommendation: string;
  imdbId: string;
  sourceId: number;
}

type MovieState = {
  movie: MovieData | null;
  isLoading: boolean;
  error: boolean;
};

type MovieAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; movie: MovieData }
  | { type: "FETCH_ERROR" };

function movieReducer(state: MovieState, action: MovieAction): MovieState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: false };
    case "FETCH_SUCCESS":
      return { movie: action.movie, isLoading: false, error: false };
    case "FETCH_ERROR":
      return { ...state, isLoading: false, error: true };
  }
}

export function DailyMovieCard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const locale = useSettingsStore((s) => s.locale);

  const [state, dispatch] = useReducer(movieReducer, {
    movie: null,
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
        const response = await fetch("/api/daily-movie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            dateKey: getTodayDateKey(),
            timezoneOffset: getTimezoneOffset(),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch daily movie");
        }

        const data = await response.json();
        dispatch({
          type: "FETCH_SUCCESS",
          movie: data,
        });
      } catch {
        dispatch({ type: "FETCH_ERROR" });
      }
    })();
  }, [userId, locale]);

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
      <div className="flex items-center gap-2">
        <Film className="h-4 w-4 text-[#8c8691] dark:text-[#a09ba5]" />
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
          {t("digest.topic.daily_movie")}
        </p>
      </div>

      <div className="mt-4">
        {state.isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8c8691] dark:text-[#a09ba5]" />
            <p className="text-sm text-[#8c8691] dark:text-[#a09ba5]">
              {t("movie.loading")}
            </p>
          </div>
        ) : state.error ? (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#8c8691] dark:text-[#a09ba5]" />
            <p className="text-sm text-[#8c8691] dark:text-[#a09ba5]">
              {t("movie.error")}
            </p>
          </div>
        ) : state.movie ? (
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-[#25242a] dark:text-[#f5f5f5]">
              {state.movie.title}
            </h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6f6a72] dark:text-[#a09ba5]">
              <span>
                {t("movie.year")}: {state.movie.year}
              </span>
              <span>
                {t("movie.genres")}: {state.movie.genres}
              </span>
              <span>
                {t("movie.directors")}: {state.movie.directors}
              </span>
            </div>
            {state.movie.recommendation && (
              <p className="pt-1 text-sm leading-relaxed text-[#25242a] dark:text-[#f5f5f5]">
                {state.movie.recommendation}
              </p>
            )}
            <a
              href={`https://www.imdb.com/title/${state.movie.imdbId}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 pt-1 text-xs text-[#8c8691] hover:text-[#25242a] dark:text-[#a09ba5] dark:hover:text-[#f5f5f5] transition-colors"
            >
              {t("movie.viewOnImdb")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
