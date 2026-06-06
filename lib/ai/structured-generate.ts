import { generateObject } from "ai";
import { z } from "zod";

import { getAiLanguageModel, getModelList, isQuotaExhaustedError } from "@/lib/ai/provider";
import { recordAiUsage } from "@/lib/ai/daily-limit";
import type { AiFeature } from "@/lib/ai/feature-types";

export type { AiFeature } from "@/lib/ai/feature-types";

interface StructuredGenerateOptions<T extends z.ZodType> {
  schema: T;
  prompt: string;
  system?: string;
  maxOutputTokens?: number;
  feature: AiFeature;
  /** User ID for usage tracking. null for system/background calls. */
  userId?: string | null;
}

interface StructuredGenerateResult<T> {
  data: T;
  model: string;
}

/**
 * Generate structured output using AI SDK's generateObject with Zod schema.
 * Falls back through the model list on quota exhaustion.
 * On structured parse failure, retries once with a simplified prompt.
 */
export async function structuredGenerate<T extends z.ZodType>(
  options: StructuredGenerateOptions<T>,
): Promise<StructuredGenerateResult<z.infer<T>>> {
  const { schema, prompt, system, maxOutputTokens = 800, feature, userId } = options;
  const modelList = getModelList();
  let lastError: unknown = null;

  for (const modelName of modelList) {
    try {
      const model = getAiLanguageModel(modelName);
      // Some providers (e.g. Qwen/DashScope) require the word "json" in the prompt
      // when using structured/json_object response format.
      const jsonHint = "\n\nRespond in JSON format.";
      const result = await generateObject({
        model,
        schema,
        prompt: prompt + jsonHint,
        system,
        maxOutputTokens,
      });
      // Record successful usage
      await recordAiUsage(userId ?? null, feature, { model: modelName, status: "success" }).catch(() => {});
      return { data: result.object as z.infer<T>, model: modelName };
    } catch (err) {
      lastError = err;
      if (isQuotaExhaustedError(err)) {
        console.warn(`[structuredGenerate:${feature}] Model "${modelName}" quota exhausted, trying next...`);
        continue;
      }
      // Record failed usage
      await recordAiUsage(userId ?? null, feature, { model: modelName, status: "failure" }).catch(() => {});
      throw err;
    }
  }

  // All models exhausted
  await recordAiUsage(userId ?? null, feature, { status: "failure" }).catch(() => {});
  throw lastError ?? new Error(`[structuredGenerate:${feature}] All models failed`);
}

/**
 * Generate plain text using AI SDK's generateText with model fallback.
 */
export async function textGenerate(options: {
  prompt: string;
  system?: string;
  maxOutputTokens?: number;
  feature: AiFeature;
  /** User ID for usage tracking. null for system/background calls. */
  userId?: string | null;
}): Promise<{ text: string; model: string }> {
  const { prompt, system, maxOutputTokens = 300, feature, userId } = options;
  const modelList = getModelList();
  let lastError: unknown = null;

  for (const modelName of modelList) {
    try {
      const model = getAiLanguageModel(modelName);
      const { generateText } = await import("ai");
      const result = await generateText({ model, prompt, system, maxOutputTokens });
      await recordAiUsage(userId ?? null, feature, { model: modelName, status: "success" }).catch(() => {});
      return { text: result.text, model: modelName };
    } catch (err) {
      lastError = err;
      if (isQuotaExhaustedError(err)) {
        console.warn(`[textGenerate:${feature}] Model "${modelName}" quota exhausted, trying next...`);
        continue;
      }
      await recordAiUsage(userId ?? null, feature, { model: modelName, status: "failure" }).catch(() => {});
      throw err;
    }
  }

  await recordAiUsage(userId ?? null, feature, { status: "failure" }).catch(() => {});
  throw lastError ?? new Error(`[textGenerate:${feature}] All models failed`);
}
