import { inngest } from "../client";
import { sendReminderEmail } from "@/lib/email/resend";
import type { Locale } from "@/lib/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { rescheduleItemRemindersIfNeeded } from "@/lib/onesignal/reminder-service";
import { dbRowToManualItemRecord } from "@/lib/supabase/mapping";

export const sendReminderEmailFn = inngest.createFunction(
  {
    id: "send-reminder-email",
    triggers: [{ event: "reminder.email.scheduled" }],
  },
  async ({ event, step }) => {
    const { itemId, userEmail, title, triggerTime, locale } = event.data as {
      itemId: string;
      userEmail: string;
      title: string;
      triggerTime: string;
      locale?: Locale;
    };

    // Check if this reminder was cancelled
    const cancelled = await step.waitForEvent("check-cancel", {
      event: "reminder.email.cancelled",
      match: "data.itemId",
      timeout: triggerTime,
    });

    if (cancelled) {
      return { cancelled: true };
    }

    await step.run("send-email", async () => {
      await sendReminderEmail(userEmail, title, triggerTime, locale);
    });

    // Replenish occurrence reminders for recurring items (rolling window)
    await step.run("reschedule-if-needed", async () => {
      try {
        const admin = createAdminClient();
        const { data: row } = await admin
          .from("items")
          .select("*")
          .eq("id", itemId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!row) return;

        const record = dbRowToManualItemRecord(row);
        const updated = await rescheduleItemRemindersIfNeeded(
          row.user_id,
          record,
          locale,
          userEmail,
        );

        if (updated) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await admin.from("items").update({ reminders: updated as any }).eq("id", itemId);
        }
      } catch (err) {
        console.error("[Reminder] Auto-reschedule after email failed:", err);
      }
    });

    return { success: true };
  },
);
