import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { sendReminderEmailFn } from "@/lib/inngest/functions/send-reminder-email";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendReminderEmailFn],
});
