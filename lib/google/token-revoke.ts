/**
 * Revoke a Google OAuth access_token or refresh_token.
 *
 * Google's revoke endpoint invalidates the supplied token AND every token
 * derived from the same refresh_token grant. We therefore always prefer
 * revoking the refresh_token (when present) so that any cached
 * access_token is also revoked.
 *
 * Spec: https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke
 *
 *   POST https://oauth2.googleapis.com/revoke?token=<TOKEN>
 *   Content-Type: application/x-www-form-urlencoded
 *
 * Any 2xx response indicates success. 4xx responses mean the token is
 * already invalid (which we treat as success because the desired end state
 * is achieved). 5xx / network errors are re-thrown so the caller can decide
 * how to handle them.
 */

const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export async function revokeGoogleToken(token: string): Promise<void> {
  if (!token) return;

  const body = new URLSearchParams({ token });
  const res = await fetch(GOOGLE_REVOKE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (res.ok) return;

  // 400 / 401 / 404 typically mean the token is invalid/expired/revoked.
  // The end state we want ("token cannot be used") is already true, so
  // we treat these as success and do not throw.
  if (res.status >= 400 && res.status < 500) return;

  const text = await res.text().catch(() => "");
  throw new Error(
    `Google revoke failed: ${res.status} ${res.statusText} ${text}`.trim()
  );
}
