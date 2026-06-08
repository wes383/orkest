/**
 * AES-256-GCM encryption for Google OAuth tokens at rest.
 *
 * The `google_calendar_connections` table stores OAuth access and refresh
 * tokens. We never want them to be readable in plaintext by anyone with
 * direct database access (Supabase dashboards, backups, replicas, error
 * reports). We therefore encrypt them in the application layer before
 * they are written to Postgres, and decrypt them when we read them back
 * to make an API call to Google.
 *
 * Format
 * ------
 * Encrypted values are stored as a UTF-8 string:
 *
 *     v1.<base64(iv)>.<base64(authTag)>.<base64(ciphertext)>
 *
 *   - `v1` is the algorithm/version tag. Bump to `v2` if you change the
 *     KDF or the cipher so that older ciphertexts can be detected and
 *     re-encrypted during a migration.
 *   - `iv` is a 12-byte random nonce (recommended for GCM).
 *   - `authTag` is the 16-byte GCM authentication tag.
 *   - `ciphertext` is the AES-256-GCM encrypted plaintext.
 *
 * The master key is read from `GOOGLE_TOKEN_ENCRYPTION_KEY` and is
 * expected to be a base64-encoded 32-byte key. Generate it with:
 *
 *     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * If the master key is missing or malformed, all encrypt/decrypt calls
 * fail fast (we never want to silently fall back to plaintext storage).
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const VERSION = "v1";

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY is not set. Refusing to read or write Google tokens without an encryption key. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not valid base64.");
  }
  if (key.length !== 32) {
    throw new Error(
      `GOOGLE_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). ` +
        "Generate a fresh one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  cachedKey = key;
  return key;
}

/**
 * Returns true if the value looks like an encrypted v1 token (our format).
 * Plaintext tokens (legacy data) start with "ya29." (access) or "1//" (refresh)
 * and are not prefixed with "v1.".
 */
export function isEncryptedToken(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith(`${VERSION}.`);
}

/**
 * Encrypt a plaintext token for at-rest storage. Returns the formatted
 * ciphertext string described in the file header.
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;
  // Idempotent: encrypting an already-encrypted value would double-wrap it.
  if (isEncryptedToken(plaintext)) return plaintext;

  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Decrypt a v1-encrypted token. If the value is not encrypted (legacy
 * plaintext), it is returned as-is so that read paths can transparently
 * handle data that was written before encryption was enabled.
 */
export function decryptToken(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined) return null;
  if (stored === "") return stored;
  if (!isEncryptedToken(stored)) return stored;

  const parts = stored.split(".");
  if (parts.length !== 4) {
    throw new Error("Encrypted token has unexpected format.");
  }
  const [, ivB64, tagB64, dataB64] = parts;

  const key = loadKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Encrypted token IV has wrong length: ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Encrypted token auth tag has wrong length: ${authTag.length}`);
  }

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Return a shallow copy of a connection row with the token fields
 * decrypted, suitable for handing to googleapis.
 */
export function withDecryptedTokens<
  T extends { access_token: string | null; refresh_token: string | null },
>(connection: T): T {
  return {
    ...connection,
    access_token: decryptToken(connection.access_token),
    refresh_token: decryptToken(connection.refresh_token),
  };
}

/**
 * Encrypt token fields in a connection update / insert payload. Use this
 * before calling `supabase.from("google_calendar_connections").upsert(...)`
 * or `.update(...)`.
 */
export function withEncryptedTokens<
  T extends { access_token?: string | null; refresh_token?: string | null },
>(payload: T): T {
  const next: T = { ...payload };
  if (typeof next.access_token === "string") {
    next.access_token = encryptToken(next.access_token);
  }
  if (typeof next.refresh_token === "string") {
    next.refresh_token = encryptToken(next.refresh_token);
  }
  return next;
}

// Re-export for tests / migrations that want to assert correctness.
export const __test__ = {
  ALGO,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
  VERSION,
  timingSafeEqual,
};
