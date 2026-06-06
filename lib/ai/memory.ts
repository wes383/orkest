import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { embedMemoryText, isEmbeddingEnabled, cosineSimilarity } from "@/lib/ai/embedding";
import { validateMemoryContent } from "@/lib/ai/sanitize";

const MAX_MEMORIES_PER_USER = 20;
const CONFIDENCE_DECAY_DAYS = 180; // confidence decays to 20% over 180 days

export type AiMemoryCategory = "preference" | "habit" | "fact" | "pattern";

export type AiUserMemory = {
  id: string;
  key: string;
  value: string;
  category: AiMemoryCategory;
  confidence: number;
  source?: string;
  updatedAt: string;
};

type Supabase = SupabaseClient<Database>;

export async function fetchUserMemories(
  supabase: Supabase,
  userId: string,
  queryEmbedding?: number[],
): Promise<AiUserMemory[]> {
  const { data, error } = await supabase
    .from("ai_user_memory")
    .select("id, key, value, category, confidence, source, embedding, updated_at")
    .eq("user_id", userId)
    .order("confidence", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(MAX_MEMORIES_PER_USER);

  if (error || !data) return [];

  const now = Date.now();
  const memories = data.map((row) => {
    const daysSinceUpdate = (now - new Date(row.updated_at).getTime()) / 86400000;
    const decayFactor = Math.max(0.2, 1 - daysSinceUpdate / CONFIDENCE_DECAY_DAYS);
    return {
      id: row.id,
      key: row.key,
      value: row.value,
      category: row.category as AiMemoryCategory,
      confidence: row.confidence * decayFactor,
      source: row.source ?? undefined,
      updatedAt: row.updated_at,
      _embedding: row.embedding as number[] | null,
      _rawConfidence: row.confidence,
    };
  });

  // If a query embedding is provided and embeddings exist, sort by similarity
  if (queryEmbedding && queryEmbedding.length > 0) {
    const hasEmbeddings = memories.some((m) => m._embedding && m._embedding.length > 0);
    if (hasEmbeddings) {
      memories.sort((a, b) => {
        const simA = a._embedding ? cosineSimilarity(queryEmbedding, a._embedding) : 0;
        const simB = b._embedding ? cosineSimilarity(queryEmbedding, b._embedding) : 0;
        const scoreA = simA * 0.7 + a.confidence * 0.3;
        const scoreB = simB * 0.7 + b.confidence * 0.3;
        return scoreB - scoreA;
      });
    }
  } else {
    // Re-sort by decayed confidence (DB sorts by raw confidence)
    memories.sort((a, b) => b.confidence - a.confidence);
  }

  // Apply confidence decay to the returned values (not persisted to DB)
  // The decay is already applied in the mapping above
  return memories.map(({ _embedding: _, _rawConfidence: _r, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
}

export async function upsertMemory(
  supabase: Supabase,
  userId: string,
  memory: {
    key: string;
    value: string;
    category: AiMemoryCategory;
    confidence: number;
    source?: string;
  },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Reject (and never persist) anything that looks like a credential, PII,
  // or a prompt-injection payload. Memories are re-injected into future
  // system prompts, so writing them is a high-trust operation.
  const validation = validateMemoryContent(memory.key, memory.value);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }
  const sanitizedKey = validation.key;
  const sanitizedValue = validation.value;

  // Generate embedding if enabled (fire-and-forget style)
  let embedding: number[] | null = null;
  if (isEmbeddingEnabled()) {
    try {
      embedding = await embedMemoryText(sanitizedKey, sanitizedValue);
    } catch {
      // Embedding failure should not block memory storage
    }
  }

  // Upsert the memory
  const { error } = await supabase
    .from("ai_user_memory")
    .upsert(
      {
        user_id: userId,
        key: sanitizedKey,
        value: sanitizedValue,
        category: memory.category,
        confidence: memory.confidence,
        source: memory.source ?? null,
        embedding: embedding && embedding.length > 0 ? embedding : undefined,
      },
      { onConflict: "user_id,key" },
    );

  if (error) return { ok: false, reason: error.message };

  // Prune if over limit: delete lowest-confidence entries beyond MAX
  const { count } = await supabase
    .from("ai_user_memory")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count && count > MAX_MEMORIES_PER_USER) {
    // Fetch the IDs to delete (lowest confidence, oldest first)
    const { data: toDelete } = await supabase
      .from("ai_user_memory")
      .select("id")
      .eq("user_id", userId)
      .order("confidence", { ascending: true })
      .order("updated_at", { ascending: true })
      .limit(count - MAX_MEMORIES_PER_USER);

    if (toDelete && toDelete.length > 0) {
      await supabase
        .from("ai_user_memory")
        .delete()
        .in(
          "id",
          toDelete.map((r) => r.id),
        );
    }
  }

  return { ok: true };
}

export async function deleteMemory(
  supabase: Supabase,
  userId: string,
  id: string,
): Promise<void> {
  await supabase
    .from("ai_user_memory")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
}
