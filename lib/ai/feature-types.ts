/**
 * Feature identifiers for AI usage tracking.
 * Shared between structured-generate.ts and daily-limit.ts to avoid circular deps.
 */
export type AiFeature =
  | "chat"
  | "digest"
  | "transcribe"
  | "daily_quote"
  | "daily_book"
  | "daily_movie"
  | "daily_onthisday";
