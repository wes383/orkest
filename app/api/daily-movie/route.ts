import { z } from "zod";

import { ensureMovie } from "@/lib/daily-content";
import { createClient } from "@/lib/supabase/server-client";
import { createAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.object({
  locale: z.enum(["en", "zh-CN", "es", "fr", "de", "ja", "pt"]).default("en"),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezoneOffset: z.number().default(0),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { locale, dateKey } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    const result = await ensureMovie(admin, dateKey, locale, user.id);

    // Note: Cleanup of old translations moved to a cron job to prevent
    // any user from triggering global data deletion via admin client.

    return Response.json(result);
  } catch (error) {
    console.error("Daily movie failed:", error);
    return Response.json({ error: "Failed to fetch movie" }, { status: 502 });
  }
}
