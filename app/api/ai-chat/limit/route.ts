import { createClient } from "@/lib/supabase/server-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAiDailyLimit } from "@/lib/ai/daily-limit";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (Math.random() < 0.01) {
      try {
        const admin = createAdminClient();
        await admin.rpc("cleanup_old_ai_usage");
      } catch {
        // cleanup failure is non-critical
      }
    }

    const result = await checkAiDailyLimit(user.id);

    return Response.json({
      limit: result.limit,
      remaining: result.allowed ? result.remaining : 0,
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to check limit. Please try again." },
      { status: 500 },
    );
  }
}
