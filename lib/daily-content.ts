import { z } from "zod";
import { structuredGenerate, textGenerate } from "@/lib/ai/structured-generate";
import { LOCALE_AI_NAMES } from "@/lib/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

type Admin = ReturnType<typeof createAdminClient>;

// --- Schemas for structured AI output ---

const quoteTranslationSchema = z.object({
  quote: z.string(),
  author: z.string(),
});

const bookTranslationSchema = z.object({
  title: z.string(),
  author: z.string(),
  language: z.string(),
  recommendation: z.string(),
});

const movieTranslationSchema = z.object({
  title: z.string(),
  genres: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  directors: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  recommendation: z.string(),
});

const onThisDayTranslationSchema = z.array(z.object({
  year: z.number(),
  text: z.string(),
}));

// --- Quote ---

interface QuoteApiResponse {
  id: number;
  quote: string;
  author: string;
  category: string[];
}

async function fetchQuoteFromApi(seed: string): Promise<QuoteApiResponse> {
  const url = new URL("https://quote.wesluma.com/api/random");
  url.searchParams.set("seed", seed);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Quote API failed: ${res.status}`);
  return res.json();
}

export interface QuoteResult {
  quote: string;
  author: string;
  category: string[];
  sourceId: number;
}

export async function ensureQuote(admin: Admin, dateKey: string, locale: string, userId?: string | null): Promise<QuoteResult> {
  // 1. Check cache for this locale
  const { data: cached } = await admin
    .from("daily_quote_translations")
    .select("quote, author, category, source_id")
    .eq("quote_date", dateKey)
    .eq("locale", locale)
    .maybeSingle();

  if (cached) {
    return {
      quote: cached.quote,
      author: cached.author,
      category: cached.category as unknown as string[],
      sourceId: cached.source_id as number,
    };
  }

  // 2. Check English source cache
  const { data: enCached } = await admin
    .from("daily_quote_translations")
    .select("quote, author, category, source_id")
    .eq("quote_date", dateKey)
    .eq("locale", "en")
    .maybeSingle();

  let sourceQuote: string;
  let sourceAuthor: string;
  let sourceCategory: string[];
  let sourceId: number;

  if (enCached) {
    sourceQuote = enCached.quote;
    sourceAuthor = enCached.author;
    sourceCategory = enCached.category as unknown as string[];
    sourceId = enCached.source_id as number;
  } else {
    // 3. Fetch from external API
    const api = await fetchQuoteFromApi(dateKey);
    sourceQuote = api.quote;
    sourceAuthor = api.author;
    sourceCategory = api.category;
    sourceId = api.id;
    await admin.from("daily_quote_translations").upsert({
      quote_date: dateKey, locale: "en", quote: sourceQuote, author: sourceAuthor,
      category: sourceCategory, source_id: sourceId, fetched_at: new Date().toISOString(),
    }, { onConflict: "quote_date, locale" });
  }

  if (locale === "en") {
    return { quote: sourceQuote, author: sourceAuthor, category: sourceCategory, sourceId };
  }

  // 4. Translate using structured output
  const language = LOCALE_AI_NAMES[locale as keyof typeof LOCALE_AI_NAMES];
  const translated = await structuredGenerate({
    schema: quoteTranslationSchema,
    prompt: `Translate the following famous quote and author name into ${language}.

Rules:
1. If this quote has a well-known translation in ${language}, use that version.
2. If no well-known translation exists, translate naturally and elegantly.
3. If the author's name has a well-known version in ${language}, use that.
4. Output must use exactly these JSON field names: "quote" and "author". Do NOT add language suffixes.

Original quote: "${sourceQuote}"
Author: ${sourceAuthor}`,
    feature: "daily_quote",
    userId,
  });

  const finalQuote = translated.data.quote || sourceQuote;
  const finalAuthor = translated.data.author || sourceAuthor;

  await admin.from("daily_quote_translations").upsert({
    quote_date: dateKey, locale, quote: finalQuote, author: finalAuthor,
    category: sourceCategory, source_id: sourceId, fetched_at: new Date().toISOString(),
  }, { onConflict: "quote_date, locale" });

  return { quote: finalQuote, author: finalAuthor, category: sourceCategory, sourceId };
}

// --- On This Day ---

interface WikipediaEvent { year: number; text: string; wikipediaUrl: string }

const NEGATIVE_PATTERNS = [
  /killed|killing|massacre|murder|assassinat|shooting|mass shooting|gunman|terror|bombing|explosion/i,
  /death|died|dead|fatal|fatali|casualt|victim/i,
  /war|invasion|attack|strike|riot|clash|crash|disaster|flood|earthquake|tsunami|hurricane|tornado|wildfire|famine|plague|pandemic|epidemic/i,
  /execut|behead|tortur|genocide|holocaust|ethnic cleansing/i,
  /suicide|self-immolat|hijack|kidnap|hostage/i,
  /injur|wound|hospitaliz|evacuat/i,
  /coup|overthrow|impeach|resign|scandal|corrupt/i,
  /crash|collision|collid|derail|sink|capsiz|wreck/i,
];

function isNegativeEvent(text: string): boolean {
  return NEGATIVE_PATTERNS.some((p) => p.test(text));
}

async function fetchOnThisDay(mm: string, dd: string): Promise<WikipediaEvent[]> {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${mm}/${dd}`,
    { headers: { Accept: "application/json", "Api-User-Agent": "Orkest App (https://orkest.wesluma.com)" } },
  );
  if (!res.ok) throw new Error(`Wikipedia API failed: ${res.status}`);
  const data = await res.json() as Record<string, unknown>;
  const rawEvents = ((data as Record<string, unknown>).selected ?? (data as Record<string, unknown>).events ?? []) as Array<unknown>;
  const all = rawEvents.map((e) => {
    const ev = e as Record<string, unknown>;
    const pages = ev.pages as Array<Record<string, unknown>> | undefined;
    return {
      year: ev.year as number,
      text: ev.text as string,
      wikipediaUrl: (pages?.[0]?.content_urls as Record<string, unknown> | undefined)?.desktop as { page?: string } | undefined,
    };
  }).map((e) => ({
    year: e.year,
    text: e.text,
    wikipediaUrl: (e.wikipediaUrl as { page?: string } | undefined)?.page ?? "",
  }));
  const positive = all.filter((e) => !isNegativeEvent(e.text));
  return positive.slice(0, 5);
}

export interface OnThisDayResult {
  events: Array<{ year: number; text: string; wikipediaUrl: string }>;
}

export async function ensureOnThisDay(admin: Admin, dateKey: string, locale: string, userId?: string | null): Promise<OnThisDayResult> {
  const { data: cached } = await admin
    .from("daily_onthisday_translations")
    .select("events")
    .eq("event_date", dateKey)
    .eq("locale", locale)
    .maybeSingle();
  if (cached?.events) {
    return { events: cached.events as unknown as Array<{ year: number; text: string; wikipediaUrl: string }> };
  }

  const { data: enCached } = await admin
    .from("daily_onthisday_translations")
    .select("events")
    .eq("event_date", dateKey)
    .eq("locale", "en")
    .maybeSingle();

  let events: WikipediaEvent[];
  if (enCached?.events) {
    events = enCached.events as unknown as WikipediaEvent[];
  } else {
    const [mm, dd] = dateKey.split("-").slice(1);
    events = await fetchOnThisDay(mm, dd);
    await admin.from("daily_onthisday_translations").upsert({
      event_date: dateKey, locale: "en", events: events as unknown as Json, fetched_at: new Date().toISOString(),
    }, { onConflict: "event_date, locale" });
  }

  if (locale === "en") return { events };

  const language = LOCALE_AI_NAMES[locale as keyof typeof LOCALE_AI_NAMES];
  const translated = await structuredGenerate({
    schema: onThisDayTranslationSchema,
    prompt: `Translate the following historical event descriptions into ${language}.

Rules:
1. Preserve historical accuracy. Do not alter facts, dates, or names.
2. If an event has a well-known name in ${language}, use that version.
3. Keep year numbers unchanged.
4. Return an array with the same number of items, each with "year" and "text" fields.

Input:
${JSON.stringify(events.map((e) => ({ year: e.year, text: e.text })), null, 2)}`,
    feature: "daily_onthisday",
    userId,
  });

  const finalEvents = events.map((event, i) => ({
    year: event.year,
    text: translated.data[i]?.text ?? event.text,
    wikipediaUrl: event.wikipediaUrl ?? "",
  }));

  await admin.from("daily_onthisday_translations").upsert({
    event_date: dateKey, locale, events: finalEvents as unknown as Json, fetched_at: new Date().toISOString(),
  }, { onConflict: "event_date, locale" });

  return { events: finalEvents };
}

// --- Book ---

interface BookApiResponse { book: { id: number; title: string; author: string; year: number; language: string } }

async function fetchBookFromApi(seed: string): Promise<BookApiResponse> {
  const url = new URL("https://book.wesluma.com/api/random-book");
  url.searchParams.set("seed", seed);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Book API failed: ${res.status}`);
  return res.json();
}

export interface BookResult {
  title: string;
  author: string;
  year: number;
  language: string;
  recommendation: string;
  sourceId: number;
}

export async function ensureBook(admin: Admin, dateKey: string, locale: string, userId?: string | null): Promise<BookResult> {
  const { data: cached } = await admin
    .from("daily_book_translations")
    .select("title, author, year, language, recommendation, source_id")
    .eq("book_date", dateKey)
    .eq("locale", locale)
    .maybeSingle();
  if (cached?.recommendation) {
    return {
      title: cached.title,
      author: cached.author,
      year: cached.year,
      language: cached.language,
      recommendation: cached.recommendation,
      sourceId: cached.source_id as number,
    };
  }

  // Ensure English source is cached
  const { data: enCached } = await admin
    .from("daily_book_translations")
    .select("title, author, year, language, recommendation, source_id")
    .eq("book_date", dateKey)
    .eq("locale", "en")
    .maybeSingle();

  let sourceTitle: string;
  let sourceAuthor: string;
  let sourceYear: number;
  let sourceLanguage: string;
  let sourceId: number;
  let enRecommendation: string;

  if (enCached?.recommendation) {
    sourceTitle = enCached.title;
    sourceAuthor = enCached.author;
    sourceYear = enCached.year;
    sourceLanguage = enCached.language;
    sourceId = enCached.source_id as number;
    enRecommendation = enCached.recommendation;
  } else {
    const api = await fetchBookFromApi(dateKey);
    sourceTitle = api.book.title;
    sourceAuthor = api.book.author;
    sourceYear = api.book.year;
    sourceLanguage = api.book.language;
    sourceId = api.book.id;

    const enResult = await structuredGenerate({
      schema: bookTranslationSchema,
      prompt: `You are a professional book recommender.

Given the following book, write a short, compelling recommendation (1-2 sentences) in English.

Title: ${sourceTitle}
Author: ${sourceAuthor}
Year: ${sourceYear}
Language: ${sourceLanguage}

Return a JSON object with:
- title: the book title
- author: the author name
- language: the language name
- recommendation: a short, compelling recommendation`,
      feature: "daily_book",
    });

    enRecommendation = enResult.data.recommendation || "";

    await admin.from("daily_book_translations").upsert({
      book_date: dateKey, locale: "en", title: sourceTitle, author: sourceAuthor,
      year: sourceYear, language: sourceLanguage, recommendation: enRecommendation,
      source_id: sourceId, fetched_at: new Date().toISOString(),
    }, { onConflict: "book_date, locale" });
  }

  if (locale === "en") {
    return { title: sourceTitle, author: sourceAuthor, year: sourceYear, language: sourceLanguage, recommendation: enRecommendation, sourceId };
  }

  // Translate using structured output — reuse source data, don't re-fetch API
  const language = LOCALE_AI_NAMES[locale as keyof typeof LOCALE_AI_NAMES];
  const translated = await structuredGenerate({
    schema: bookTranslationSchema,
    prompt: `You are a professional literary translator and book recommender.

Given the following book information, translate the title, author, and language fields into ${language}.
Also write a short, compelling book recommendation (1-2 sentences) in ${language}.

If the book title or author has a well-known name in ${language}, use that version.

Input:
${JSON.stringify({ title: sourceTitle, author: sourceAuthor, year: sourceYear, language: sourceLanguage }, null, 2)}

Return a JSON object with:
- title: translated title
- author: translated author name
- language: translated language name
- recommendation: a short, compelling recommendation in ${language}`,
    feature: "daily_book",
    userId,
  });

  const result = {
    title: translated.data.title || sourceTitle,
    author: translated.data.author || sourceAuthor,
    year: sourceYear,
    language: translated.data.language || sourceLanguage,
    recommendation: translated.data.recommendation || "",
    sourceId,
  };

  await admin.from("daily_book_translations").upsert({
    book_date: dateKey, locale, title: result.title, author: result.author,
    year: result.year, language: result.language, recommendation: result.recommendation,
    source_id: sourceId, fetched_at: new Date().toISOString(),
  }, { onConflict: "book_date, locale" });

  return result;
}

// --- Movie ---

interface MovieApiResponse { id: number; title: string; year: number; genres: string; imdb_id: string; directors: string }

async function fetchMovieFromApi(seed: string): Promise<MovieApiResponse> {
  const url = new URL("https://movie.wesluma.com/api/random-movie");
  url.searchParams.set("seed", seed);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Movie API failed: ${res.status}`);
  return res.json();
}

export interface MovieResult {
  title: string;
  year: number;
  genres: string;
  directors: string;
  recommendation: string;
  imdbId: string;
  sourceId: number;
}

export async function ensureMovie(admin: Admin, dateKey: string, locale: string, userId?: string | null): Promise<MovieResult> {
  const { data: cached } = await admin
    .from("daily_movie_translations")
    .select("title, year, genres, directors, recommendation, imdb_id, source_id")
    .eq("movie_date", dateKey)
    .eq("locale", locale)
    .maybeSingle();
  if (cached?.recommendation) {
    return {
      title: cached.title,
      year: cached.year,
      genres: cached.genres,
      directors: cached.directors,
      recommendation: cached.recommendation,
      imdbId: cached.imdb_id as string,
      sourceId: cached.source_id as number,
    };
  }

  // Ensure English source is cached
  const { data: enCached } = await admin
    .from("daily_movie_translations")
    .select("title, year, genres, directors, recommendation, imdb_id, source_id")
    .eq("movie_date", dateKey)
    .eq("locale", "en")
    .maybeSingle();

  let sourceTitle: string;
  let sourceYear: number;
  let sourceGenres: string;
  let sourceDirectors: string;
  let sourceImdbId: string;
  let sourceId: number;
  let enRecommendation: string;

  if (enCached?.recommendation) {
    sourceTitle = enCached.title;
    sourceYear = enCached.year;
    sourceGenres = enCached.genres;
    sourceDirectors = enCached.directors;
    sourceImdbId = enCached.imdb_id as string;
    sourceId = enCached.source_id as number;
    enRecommendation = enCached.recommendation;
  } else {
    const api = await fetchMovieFromApi(dateKey);
    sourceTitle = api.title;
    sourceYear = api.year;
    sourceGenres = api.genres || "Unknown";
    sourceDirectors = api.directors || "Unknown";
    sourceImdbId = api.imdb_id;
    sourceId = api.id;

    const enResult = await structuredGenerate({
      schema: movieTranslationSchema,
      prompt: `You are a professional film critic and movie recommender.

Write a short, spoiler-free recommendation (1-2 sentences) for the following movie ONLY if you are confident you know this film well. If you are not familiar with this movie, return an empty recommendation.

Do NOT include spoilers. Focus on themes, style, emotional impact, or cultural significance.

Title: ${sourceTitle} (${sourceYear})
Directors: ${sourceDirectors}
Genres: ${sourceGenres}

Return a JSON object with:
- title: the movie title
- genres: the genres
- directors: the director(s)
- recommendation: a short recommendation or empty string`,
      feature: "daily_movie",
    });

    enRecommendation = enResult.data.recommendation || "";

    const { error: enUpsertError } = await admin.from("daily_movie_translations").upsert({
      movie_date: dateKey, locale: "en", title: sourceTitle, year: sourceYear,
      genres: sourceGenres, directors: sourceDirectors, recommendation: enRecommendation,
      imdb_id: sourceImdbId, source_id: sourceId, fetched_at: new Date().toISOString(),
    }, { onConflict: "movie_date, locale" });
    if (enUpsertError) {
      console.error("[ensureMovie] Failed to save English movie:", enUpsertError);
      throw new Error(`Failed to save English movie: ${enUpsertError.message}`);
    }
  }

  if (locale === "en") {
    return { title: sourceTitle, year: sourceYear, genres: sourceGenres, directors: sourceDirectors, recommendation: enRecommendation, imdbId: sourceImdbId, sourceId };
  }

  // Translate using structured output — reuse source data, don't re-fetch API
  const language = LOCALE_AI_NAMES[locale as keyof typeof LOCALE_AI_NAMES];
  const translated = await structuredGenerate({
    schema: movieTranslationSchema,
    prompt: `You are a professional film translator and movie recommender.

Given the following movie information, translate the title, genres, and director(s) into ${language}.
Also write a short, spoiler-free recommendation (1-2 sentences) in ${language} ONLY if you are confident you know this film well.

If the movie title or director has a well-known name in ${language}, use that version.

Input:
${JSON.stringify({ title: sourceTitle, year: sourceYear, genres: sourceGenres, directors: sourceDirectors }, null, 2)}

Return a JSON object with:
- title: translated title
- genres: translated genres (keep as semicolon-separated list)
- directors: translated director name(s)
- recommendation: a short recommendation in ${language}, or empty string`,
    feature: "daily_movie",
    userId,
  });

  const toArray = (v: string | string[] | null | undefined, fallback: string): string => {
    if (v == null) return fallback;
    if (Array.isArray(v)) return v.length > 0 ? v.join("; ") : fallback;
    return v || fallback;
  };

  const result = {
    title: translated.data.title || sourceTitle,
    year: sourceYear,
    genres: toArray(translated.data.genres, sourceGenres),
    directors: toArray(translated.data.directors, sourceDirectors),
    recommendation: translated.data.recommendation || "",
    imdbId: sourceImdbId,
    sourceId,
  };

  const { error: translatedUpsertError } = await admin.from("daily_movie_translations").upsert({
    movie_date: dateKey, locale, title: result.title, year: result.year,
    genres: result.genres, directors: result.directors, recommendation: result.recommendation,
    imdb_id: result.imdbId, source_id: sourceId, fetched_at: new Date().toISOString(),
  }, { onConflict: "movie_date, locale" });
  if (translatedUpsertError) {
    console.error("[ensureMovie] Failed to save translated movie:", translatedUpsertError);
    throw new Error(`Failed to save translated movie: ${translatedUpsertError.message}`);
  }

  return result;
}

// --- Motivational Message (shared between route and cron) ---

export async function generateMotivationalMessage(options: {
  username?: string;
  language: string;
  taskContext: string;
  memoryContext: string;
  userId?: string | null;
}): Promise<string> {
  const { username, language, taskContext, memoryContext, userId } = options;
  const nameGreeting = username ? `The user's name is ${username}.` : "";

  const result = await textGenerate({
    prompt: `You are a warm, encouraging daily planner assistant. ${nameGreeting}
Respond in ${language}. Keep the user-created task titles in their original language.
${memoryContext}

Based on the user's task summary for today:
${taskContext}

Generate a short, personalized motivational message (2-3 sentences max) for the entire day. Be specific about their tasks when relevant. Be encouraging but not overly enthusiastic. If they have overdue tasks, gently acknowledge them. If they have no tasks, suggest they enjoy the free day or plan ahead.

Return ONLY the motivational message text, nothing else. Do not use quotes around the message.`,
    feature: "digest",
    maxOutputTokens: 200,
    userId,
  });

  return result.text;
}
