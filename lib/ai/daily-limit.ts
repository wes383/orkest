import { createAdminClient } from "@/lib/supabase/admin";

import type { AiFeature } from "@/lib/ai/feature-types";

const DEFAULT_DAILY_LIMIT = 50;

/**
 * Usage category determines how AI calls are billed/tracked:
 * - "user_action": User-initiated, counts against personal daily limit (chat, digest, transcribe)
 * - "shared_cache": Shared content cached by locale/date, not billed per-user (daily_quote, daily_book, daily_movie, daily_onthisday)
 * - "system_background": System-initiated, not billed to user (email cron motivational messages)
 */
export type UsageCategory = "user_action" | "shared_cache" | "system_background";

const FEATURE_CATEGORIES: Record<AiFeature, UsageCategory> = {
  chat: "user_action",
  digest: "user_action",
  transcribe: "shared_cache",
  daily_quote: "shared_cache",
  daily_book: "shared_cache",
  daily_movie: "shared_cache",
  daily_onthisday: "shared_cache",
};

type DailyLimitResult =
  | { allowed: true; remaining: number; limit: number }
  | { allowed: false; remaining: 0; limit: number; retryAfterSeconds: number };

/**
 * Check if a user is within their daily AI limit.
 * Only applies to "user_action" features.
 */
export async function checkAiDailyLimit(
  userId: string,
  feature?: AiFeature,
): Promise<DailyLimitResult> {
  // Shared cache and system features bypass the limit
  if (feature && FEATURE_CATEGORIES[feature] !== "user_action") {
    return { allowed: true, remaining: DEFAULT_DAILY_LIMIT, limit: DEFAULT_DAILY_LIMIT };
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const [limitResult, usageResult] = await Promise.all([
    admin
      .from("user_ai_limits")
      .select("daily_limit")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("user_ai_usage")
      .select("usage_count")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .maybeSingle(),
  ]);

  const dailyLimit = limitResult.data?.daily_limit ?? DEFAULT_DAILY_LIMIT;
  const currentCount = usageResult.data?.usage_count ?? 0;

  if (currentCount >= dailyLimit) {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    const secondsUntilMidnight = Math.ceil((midnight.getTime() - now.getTime()) / 1000);

    return {
      allowed: false,
      remaining: 0,
      limit: dailyLimit,
      retryAfterSeconds: secondsUntilMidnight,
    };
  }

  return {
    allowed: true,
    remaining: dailyLimit - currentCount - 1,
    limit: dailyLimit,
  };
}

/**
 * Record AI usage with feature categorization.
 * Only "user_action" features increment the user's daily usage count.
 * All features are logged for telemetry.
 */
export async function recordAiUsage(
  userId: string | null,
  feature: AiFeature,
  options?: {
    model?: string;
    status?: "success" | "failure";
    costEstimate?: number;
  },
): Promise<void> {
  const category = FEATURE_CATEGORIES[feature];
  const model = options?.model ?? "unknown";
  const status = options?.status ?? "success";

  // Log telemetry for all usage
  console.log(JSON.stringify({
    type: "ai_usage",
    feature,
    category,
    model,
    status,
    userId: userId ?? "system",
    costEstimate: options?.costEstimate,
    timestamp: new Date().toISOString(),
  }));

  // Only increment user daily limit for user_action features
  if (category === "user_action" && userId) {
    await incrementUserDailyUsage(userId);
  }
}

async function incrementUserDailyUsage(userId: string): Promise<void> {
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Atomic upsert via RPC: INSERT ... ON CONFLICT DO UPDATE SET usage_count = usage_count + 1
  // This eliminates the TOCTOU race condition of the previous SELECT + UPDATE approach.
  const { error } = await (admin.rpc as any)("increment_ai_usage", {
    p_user_id: userId,
    p_date: today,
  });

  if (error) {
    console.error("Failed to increment AI usage:", error);
  }
}

/**
 * Backward-compatible alias for recordAiUsage with feature="chat".
 */
export const incrementAiUsage = (userId: string) => recordAiUsage(userId, "chat");
