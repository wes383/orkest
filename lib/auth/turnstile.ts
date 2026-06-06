type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export function getRequestIp(request: Request) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function verifyTurnstileToken(token: unknown, remoteIp: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return {
      success: false,
      error: "Turnstile is not configured.",
    };
  }

  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return {
      success: false,
      error: "Please complete the verification challenge.",
    };
  }

  let response: Response;

  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: remoteIp,
      }),
    });
  } catch {
    return {
      success: false,
      error: "Verification failed. Please try again.",
    };
  }

  const result = (await response.json()) as TurnstileResponse;

  if (!response.ok || !result.success) {
    return {
      success: false,
      error: "Verification failed. Please try again.",
      errorCodes: result["error-codes"] ?? [],
    };
  }

  return { success: true };
}
