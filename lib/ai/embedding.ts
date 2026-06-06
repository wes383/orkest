const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EMBEDDING_TIMEOUT_MS = 15000;

type CacheEntry = { vector: number[]; ts: number };

// LRU cache: Map maintains insertion order; deleting + re-inserting moves to end.
const EMBEDDING_CACHE = new Map<string, CacheEntry>();

export function isEmbeddingEnabled(): boolean {
  return process.env.USE_EMBEDDING === "true" || process.env.NEXT_PUBLIC_USE_EMBEDDING === "true";
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const cached = EMBEDDING_CACHE.get(text);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    EMBEDDING_CACHE.delete(text);
    EMBEDDING_CACHE.set(text, cached);
    return cached.vector;
  }

  const vector = await callOpenAIEmbedding(text);

  const now = Date.now();
  for (const [key, entry] of EMBEDDING_CACHE) {
    if (now - entry.ts >= CACHE_TTL_MS) EMBEDDING_CACHE.delete(key);
  }
  while (EMBEDDING_CACHE.size >= CACHE_MAX_SIZE) {
    const oldest = EMBEDDING_CACHE.keys().next().value;
    if (oldest) EMBEDDING_CACHE.delete(oldest);
  }

  EMBEDDING_CACHE.set(text, { vector, ts: now });
  return vector;
}

async function callOpenAIEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.EMBEDDING_API_KEY;
  if (!apiKey) throw new Error("EMBEDDING_API_KEY not configured for embedding");

  const baseUrl = process.env.EMBEDDING_API_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
  const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || "1024");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  const body: Record<string, unknown> = {
    model,
    input: text,
  };

  if (baseUrl.includes("openai")) {
    body.dimensions = dimensions;
  }

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.data?.[0]?.embedding ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

export function buildMemoryText(key: string, value: string): string {
  return `${key}: ${value}`.replace(/\s+/g, " ").trim();
}

export async function embedMemoryText(key: string, value: string): Promise<number[]> {
  if (!isEmbeddingEnabled()) return [];
  return generateEmbedding(buildMemoryText(key, value));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
