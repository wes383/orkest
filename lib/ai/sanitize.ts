/**
 * Sanitization helpers for user-controlled text that is embedded in AI prompts
 * or stored in long-lived memory. These are defense-in-depth utilities and
 * should be applied at the boundary before user data is exposed to a language
 * model or persisted in a context that other systems rely on.
 *
 * NOTE: This is a best-effort defense layer. The underlying LLM provider's
 * own safety filters remain the primary line of defense.
 */

// ASCII control characters (0x00-0x1F, 0x7F) and common Unicode control/format
// characters (BOM, zero-width, line/paragraph separators).
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u2029\uFEFF]/g;

// Characters frequently used to break out of a prompt template or to embed
// markdown/HTML/tool-call syntax. They are never expected in a display name.
const INJECTION_CHARS_RE = /[<>{}|`\\]/g;

export const USERNAME_MAX_LEN = 30;

/**
 * Sanitize a user-supplied display name (e.g. username) for safe inclusion in
 * an LLM system prompt.
 *
 * - Strips control characters, zero-width, and line/paragraph separators.
 * - Replaces CR/LF/tab with a single space.
 * - Removes characters commonly used in prompt-injection / template escape
 *   attempts (< > { } | ` \\).
 * - Truncates to maxLen characters.
 * - Returns undefined when the result is empty (so callers can omit the
 *   field entirely rather than sending a blank name to the model).
 */
export function sanitizeUsername(
  input: string | null | undefined,
  maxLen: number = USERNAME_MAX_LEN,
): string | undefined {
  if (!input) return undefined;
  const cleaned = String(input)
    .replace(CONTROL_CHAR_RE, "")
    .replace(/[\r\n\t]/g, " ")
    .replace(INJECTION_CHARS_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : undefined;
}

// ─── Memory content validation ──────────────────────────────────────────────

export const MEMORY_KEY_MAX_LEN = 80;
export const MEMORY_VALUE_MAX_LEN = 400;

// Patterns that look like credentials or tokens. Matching any of these
// causes a memory write to be rejected.
const CREDENTIAL_PATTERNS: RegExp[] = [
  // Common vendor prefixes
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bsk_(?:proj-|or-|live-|test-)?[A-Za-z0-9_-]{16,}\b/,
  /\bghp_[A-Za-z0-9]{16,}\b/,
  /\bgho_[A-Za-z0-9]{16,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{16,}\b/,
  /\bAKIA[0-9A-Z]{12,}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /\bxai-[A-Za-z0-9]{20,}\b/,
  // Generic "key = value" / "token: value" assignments
  /(?:bearer|api[_-]?key|access[_-]?token|secret[_-]?key|auth[_-]?token)\s*[:=]\s*[\w./+-]{12,}/i,
  // JWTs (header.payload.signature, all base64url)
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  // Long high-entropy hex / base64-ish strings
  /\b[A-Fa-f0-9]{40,}\b/,
  /\b[A-Za-z0-9+/]{60,}={0,2}\b/,
];

// Phrases that almost always indicate an attempt to override the system
// prompt or extract its contents.
const INJECTION_KEYWORDS: readonly string[] = [
  "ignore previous",
  "ignore all previous",
  "ignore the above",
  "ignore your instructions",
  "disregard prior",
  "disregard previous",
  "forget previous",
  "forget everything",
  "override system",
  "system prompt",
  "system message",
  "system:",
  "[inst]",
  "[/inst]",
  "new instructions",
  "reveal your instructions",
  "reveal the system",
  "output the prompt",
  "print your prompt",
  "show your prompt",
  "developer message",
  "developer prompt",
  "jailbreak",
];

// Loose RFC-5322-ish match. Intentionally permissive — we only need to catch
// obvious PII being written to a long-lived memory slot.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

export type MemoryValidationResult =
  | { ok: true; key: string; value: string }
  | { ok: false; reason: string };

/**
 * Validate and sanitize a candidate (key, value) for the AI memory store.
 *
 * The returned key/value are safe to persist and to inject into a system
 * prompt on a later turn. When the input is rejected, the reason is
 * short and human-readable so the model can pick a better alternative.
 */
export function validateMemoryContent(
  key: unknown,
  value: unknown,
  opts: { keyMaxLen?: number; valueMaxLen?: number } = {},
): MemoryValidationResult {
  const { keyMaxLen = MEMORY_KEY_MAX_LEN, valueMaxLen = MEMORY_VALUE_MAX_LEN } = opts;

  if (typeof key !== "string" || typeof value !== "string") {
    return { ok: false, reason: "key and value must be strings" };
  }

  const cleanKey = key
    .replace(CONTROL_CHAR_RE, "")
    .replace(/[\r\n\t]/g, " ")
    .replace(INJECTION_CHARS_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, keyMaxLen);
  if (!cleanKey) {
    return { ok: false, reason: "key is empty after sanitization" };
  }

  const cleanValue = value
    .replace(CONTROL_CHAR_RE, "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, valueMaxLen);
  if (!cleanValue) {
    return { ok: false, reason: "value is empty after sanitization" };
  }

  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(cleanValue)) {
      return { ok: false, reason: "value contains a credential-like pattern" };
    }
  }

  const lower = cleanValue.toLowerCase();
  for (const keyword of INJECTION_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { ok: false, reason: "value contains a disallowed instruction-like phrase" };
    }
  }

  if (EMAIL_RE.test(cleanValue)) {
    return { ok: false, reason: "value contains an email address" };
  }

  return { ok: true, key: cleanKey, value: cleanValue };
}
