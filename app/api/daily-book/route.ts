import { z } from "zod";

import { ensureBook } from "@/lib/daily-content";
import { createClient } from "@/lib/supabase/server-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDateKeyWithOffset } from "@/lib/daily-digest-utils";

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

  const { locale, dateKey, timezoneOffset } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    const result = await ensureBook(admin, dateKey, locale, user.id);

    const cutoffDate = getDateKeyWithOffset(
      timezoneOffset,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );
    await admin.from("daily_book_translations").delete().lt("book_date", cutoffDate);

    return Response.json(result);
  } catch (error) {
    console.error("Daily book failed:", error);
    return Response.json({ error: "Failed to fetch book" }, { status: 502 });
  }
}
