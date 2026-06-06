import { DEFAULT_LOCALE, LOCALE_TRANSCRIPTION_LANGUAGES, normalizeLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionary";
import { createClient } from "@/lib/supabase/server-client";
import { checkSharedRateLimit } from "@/lib/auth/rate-limit";
import { recordAiUsage } from "@/lib/ai/daily-limit";

const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/mp3",
  "audio/x-m4a",
  "audio/m4a",
]);

function getTranscribeRateLimitRules(userId: string) {
  return [
    {
      key: `transcribe:user-minute:${userId}`,
      limit: 5,
      windowMs: 60 * 1000,
    },
    {
      key: `transcribe:user-hour:${userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  ];
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        { error: translate(DEFAULT_LOCALE, "api.error.unauthorized") },
        { status: 401 },
      );
    }

    const rateLimitResult = await checkSharedRateLimit(getTranscribeRateLimitRules(user.id));
    if (!rateLimitResult.allowed) {
      return Response.json(
        {
          error: translate(DEFAULT_LOCALE, "auth.error.rateLimit").replace(
            "{seconds}",
            String(rateLimitResult.retryAfterSeconds ?? 60),
          ),
        },
        {
          status: 429,
          headers: rateLimitResult.retryAfterSeconds
            ? { "Retry-After": String(rateLimitResult.retryAfterSeconds) }
            : undefined,
        },
      );
    }

    const formData = await request.formData();
    const audio = formData.get("audio");
    const locale = normalizeLocale(typeof formData.get("locale") === "string" ? String(formData.get("locale")) : undefined);

    if (!(audio instanceof Blob)) {
      return Response.json(
        { error: translate(locale, "api.error.missingAudio") },
        { status: 400 },
      );
    }

    const mimeType = audio.type.split(";")[0].trim();
    const isAllowedType = [...ALLOWED_AUDIO_TYPES].some(
      (allowed) => mimeType === allowed || mimeType.startsWith(`${allowed};`),
    );
    if (!isAllowedType) {
      return Response.json(
        { error: translate(locale, "api.error.unsupportedAudioFormat") },
        { status: 400 },
      );
    }

    if (audio.size > MAX_AUDIO_SIZE) {
      return Response.json(
        { error: translate(locale, "api.error.audioTooLarge") },
        { status: 400 },
      );
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: translate(locale, "api.error.deepgramMissing") },
        { status: 500 },
      );
    }

    const deepgramUrl = new URL("https://api.deepgram.com/v1/listen");
    deepgramUrl.searchParams.set("model", "nova-3");
    deepgramUrl.searchParams.set("smart_format", "true");
    deepgramUrl.searchParams.set("punctuate", "true");
    deepgramUrl.searchParams.set("language", LOCALE_TRANSCRIPTION_LANGUAGES[locale] ?? LOCALE_TRANSCRIPTION_LANGUAGES[DEFAULT_LOCALE]);

    const deepgramResponse = await fetch(deepgramUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": audio.type || "audio/webm",
      },
      body: audio,
    });

    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text();
      console.error("Deepgram API error:", errorText);
      return Response.json(
        { error: translate(locale, "api.error.transcriptionFailed") },
        { status: 502 },
      );
    }

    const result = await deepgramResponse.json();
    const transcript =
      result.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

    // Record transcribe usage (counts against user's daily AI limit)
    await recordAiUsage(user.id, "transcribe", { model: "deepgram-nova-3" }).catch(() => {});

    return Response.json({ transcript });
  } catch (error) {
    console.error("Transcribe route error:", error);
    return Response.json(
      { error: translate(DEFAULT_LOCALE, "api.error.transcriptionFailed") },
      { status: 500 },
    );
  }
}
