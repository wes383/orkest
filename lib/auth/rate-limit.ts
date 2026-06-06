type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

type UpstashResult<T = unknown> = {
  result?: T;
  error?: string;
};

const buckets = new Map<string, RateLimitEntry>();

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

function cleanupExpiredBuckets() {
  if (buckets.size < 5000) {
    return;
  }

  const now = Date.now();
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function getRetryAfterSeconds(resetAt: number) {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

async function upstashCommand<T>(command: Array<string | number>): Promise<T> {
  const config = getUpstashConfig();
  if (!config) {
    throw new Error("Upstash Redis is not configured.");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const payload = (await response.json()) as UpstashResult<T>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Upstash Redis command failed.");
  }

  return payload.result as T;
}

async function checkUpstashRule(rule: RateLimitRule): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, Math.ceil(rule.windowMs / 1000));
  const didSet = await upstashCommand<"OK" | null>(["SET", rule.key, 1, "EX", windowSeconds, "NX"]);

  if (didSet === "OK") {
    return { allowed: true };
  }

  const count = await upstashCommand<number>(["INCR", rule.key]);

  if (count <= rule.limit) {
    return { allowed: true };
  }

  const ttl = await upstashCommand<number>(["TTL", rule.key]);

  return {
    allowed: false,
    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}

function checkMemoryRule(rule: RateLimitRule): RateLimitResult {
  cleanupExpiredBuckets();

  const now = Date.now();
  const existing = buckets.get(rule.key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(rule.key, {
      count: 1,
      resetAt: now + rule.windowMs,
    });
    return { allowed: true };
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false,
      retryAfterSeconds: getRetryAfterSeconds(existing.resetAt),
    };
  }

  existing.count += 1;
  return { allowed: true };
}

export function checkRateLimit(rules: RateLimitRule[]): RateLimitResult {
  for (const rule of rules) {
    const result = checkMemoryRule(rule);
    if (!result.allowed) {
      return result;
    }
  }

  return { allowed: true };
}

async function checkUpstashRateLimit(rules: RateLimitRule[]): Promise<RateLimitResult> {
  for (const rule of rules) {
    const result = await checkUpstashRule(rule);
    if (!result.allowed) {
      return result;
    }
  }

  return { allowed: true };
}

export async function checkSharedRateLimit(rules: RateLimitRule[]): Promise<RateLimitResult> {
  if (!getUpstashConfig()) {
    return checkRateLimit(rules);
  }

  try {
    return await checkUpstashRateLimit(rules);
  } catch (error) {
    console.error("Shared rate limit check failed; falling back to in-memory limiter.", error);
    return checkRateLimit(rules);
  }
}

export function getAuthCodeRateLimitRules({
  ip,
  email,
  purpose,
}: {
  ip: string;
  email: string;
  purpose: string;
}): RateLimitRule[] {
  const safeIp = ip || "unknown";
  const safeEmail = email.toLowerCase();

  return [
    {
      key: `auth-code:ip-minute:${purpose}:${safeIp}`,
      limit: 3,
      windowMs: 60 * 1000,
    },
    {
      key: `auth-code:ip-hour:${purpose}:${safeIp}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    },
    {
      key: `auth-code:email-minute:${purpose}:${safeEmail}`,
      limit: 1,
      windowMs: 60 * 1000,
    },
    {
      key: `auth-code:email-day:${purpose}:${safeEmail}`,
      limit: 10,
      windowMs: 24 * 60 * 60 * 1000,
    },
  ];
}

export function getLoginRateLimitRules({
  ip,
  email,
}: {
  ip: string;
  email: string;
}): RateLimitRule[] {
  const safeIp = ip || "unknown";
  const safeEmail = email.toLowerCase();

  return [
    {
      key: `login:ip-minute:${safeIp}`,
      limit: 10,
      windowMs: 60 * 1000,
    },
    {
      key: `login:ip-hour:${safeIp}`,
      limit: 50,
      windowMs: 60 * 60 * 1000,
    },
    {
      key: `login:email-minute:${safeEmail}`,
      limit: 5,
      windowMs: 60 * 1000,
    },
    {
      key: `login:email-hour:${safeEmail}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    },
  ];
}
