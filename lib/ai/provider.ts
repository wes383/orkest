import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

type AiProvider = "openai" | "gemini";

function getProvider(): AiProvider {
  return process.env.AI_PROVIDER?.toLowerCase() === "gemini" ? "gemini" : "openai";
}

/**
 * Parse a comma-separated env var into an array of trimmed strings.
 * Falls back to [defaultVal] if the env var is empty/missing.
 */
function parseModelList(envVal: string | undefined, defaultVal: string): string[] {
  if (!envVal || !envVal.trim()) return [defaultVal];
  return envVal.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Get the ordered list of model names for the current provider */
export function getModelList(): string[] {
  if (getProvider() === "gemini") {
    return parseModelList(process.env.AI_MODELS, "gemini-2.0-flash");
  }
  return parseModelList(process.env.AI_MODELS, process.env.AI_MODEL || "gpt-4o-mini");
}

/** Build a LanguageModel instance for a given model name */
export function getAiLanguageModel(modelName?: string): LanguageModel {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_API_KEY is not configured in .env.local");
  }

  if (getProvider() === "gemini") {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(modelName || process.env.AI_MODEL || "gemini-2.0-flash");
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
  });
  return openai.chat(modelName || process.env.AI_MODEL || "gpt-4o-mini");
}

/**
 * Check if an error indicates the model's token quota is exhausted.
 * Covers common patterns from DashScope / OpenAI-compatible APIs.
 */
export function isQuotaExhaustedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("quota") ||
    msg.includes("exhausted") ||
    msg.includes("insufficient") ||
    msg.includes("rate_limit") ||
    msg.includes("ratelimit") ||
    msg.includes("429") ||
    msg.includes("403") ||
    msg.includes("capacity") ||
    msg.includes("limit reached") ||
    msg.includes("free tier")
  );
}
