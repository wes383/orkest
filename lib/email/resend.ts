import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionary";

type SendAuthEmailInput = {
  to: string;
  subject: string;
  code: string;
  intro: string;
  locale?: Locale;
};

type ResendEmailResponse = {
  message?: string;
  name?: string;
};

function getFromAddress() {
  const fromEnv = process.env.AUTH_EMAIL_FROM ?? "Orkest <onboarding@resend.dev>";
  // Remove surrounding quotes if present (common issue when setting env vars in deployment platforms)
  return fromEnv.replace(/^["']|["']$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildAuthEmailHtml({ code, intro, locale = DEFAULT_LOCALE }: SendAuthEmailInput) {
  const safeCode = escapeHtml(code);
  const safeIntro = escapeHtml(intro);

  return `
    <div style="margin:0;padding:0;background:#fcfbfa;">
      <div style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#25242a;max-width:448px;margin:0 auto;padding:56px 24px;">
        <div style="text-align:center;margin:0 0 40px;">
          <h1 style="font-family:Manrope,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:64px;line-height:0.9;font-weight:600;letter-spacing:0;margin:0;color:#25242a;">
            Orkest
          </h1>
          <p style="margin:18px 0 0;font-size:16px;color:#7d7880;">
            ${safeIntro}
          </p>
        </div>

        <div style="margin:0 0 20px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:500;color:#25242a;">
            ${escapeHtml(translate(locale, "auth.emailCodeLabel"))}
          </p>
          <div style="box-sizing:border-box;width:100%;min-height:56px;border:1px solid rgba(0,0,0,0.08);background:#ffffff;border-radius:16px;padding:16px 18px;text-align:center;font-size:32px;line-height:1;font-weight:600;letter-spacing:8px;color:#25242a;">
            ${safeCode}
          </div>
        </div>

        <p style="margin:0;text-align:center;font-size:14px;color:#7d7880;">
          ${escapeHtml(translate(locale, "auth.emailIgnore"))}
        </p>
      </div>
    </div>
  `;
}

function buildAuthEmailText({ code, intro, locale = DEFAULT_LOCALE }: SendAuthEmailInput) {
  return `${intro}

${translate(locale, "auth.emailTextCode", { code })}

${translate(locale, "auth.emailIgnore")}`;
}

export async function sendAuthEmail(input: SendAuthEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: input.to,
      subject: input.subject,
      html: buildAuthEmailHtml(input),
      text: buildAuthEmailText(input),
    }),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as ResendEmailResponse;
      detail = payload.message ?? payload.name ?? detail;
    } catch {
      // Keep the HTTP status text if Resend did not return JSON.
    }
    throw new Error(`Resend email failed: ${detail}`);
  }

  await response.json().catch(() => null);
}

export type SendFeedbackEmailInput = {
  to: string;
  fromUserEmail: string;
  fromUserName?: string;
  fromUserId: string;
  type: string;
  content: string;
  userAgent?: string;
};

export async function sendFeedbackEmail(input: SendFeedbackEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  const typeLabels: Record<string, string> = {
    bug: "Bug / Issue",
    feature_request: "Feature Request",
    general: "General Feedback",
    technical_support: "Technical Support",
  };
  const displayType = typeLabels[input.type] ?? input.type;

  const subject = `[Orkest Feedback] New ${displayType} submitted`;
  const fromAddress = getFromAddress();

  const userIdentifier = input.fromUserName
    ? `${input.fromUserName} (${input.fromUserEmail})`
    : input.fromUserEmail;

  const html = `
    <div style="margin:0;padding:0;background:#fcfbfa;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#25242a;">
      <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
        <div style="background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:24px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.02);">
          <h2 style="font-size:20px;font-weight:600;margin:0 0 24px;color:#25242a;border-bottom:1px solid rgba(0,0,0,0.08);padding-bottom:16px;">
            New Feedback Received
          </h2>

          <div style="margin:0 0 20px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr>
                <td style="padding:6px 0;font-weight:500;color:#7d7880;width:120px;vertical-align:top;">Feedback Type</td>
                <td style="padding:6px 0;color:#25242a;font-weight:600;vertical-align:top;">
                  <span style="display:inline-block;padding:2px 8px;border-radius:6px;background:${
                    input.type === "bug" ? "#fef2f2;color:#991b1b" :
                    input.type === "feature_request" ? "#f0fdf4;color:#166534" :
                    input.type === "technical_support" ? "#eff6ff;color:#1e40af" :
                    "#f5f5f4;color:#44403c"
                  };">${escapeHtml(displayType)}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-weight:500;color:#7d7880;vertical-align:top;">Submitted By</td>
                <td style="padding:6px 0;color:#25242a;vertical-align:top;">${escapeHtml(userIdentifier)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-weight:500;color:#7d7880;vertical-align:top;">User ID</td>
                <td style="padding:6px 0;font-family:monospace;font-size:12px;color:#7d7880;vertical-align:top;">${escapeHtml(input.fromUserId)}</td>
              </tr>
              ${input.userAgent ? `
              <tr>
                <td style="padding:6px 0;font-weight:500;color:#7d7880;vertical-align:top;">User Agent</td>
                <td style="padding:6px 0;font-size:12px;color:#7d7880;vertical-align:top;">${escapeHtml(input.userAgent)}</td>
              </tr>` : ""}
            </table>
          </div>

          <div style="margin:24px 0 0;border-top:1px solid rgba(0,0,0,0.08);padding-top:20px;">
            <p style="margin:0 0 8px;font-size:14px;font-weight:500;color:#7d7880;">Feedback Content</p>
            <div style="background:#fafafa;border:1px solid rgba(0,0,0,0.04);border-radius:12px;padding:16px 20px;font-size:15px;line-height:1.6;color:#25242a;white-space:pre-wrap;">${escapeHtml(input.content)}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const text = `New Feedback Received\n\nType: ${displayType}\nUser: ${userIdentifier}\nUser ID: ${input.fromUserId}\nUser Agent: ${input.userAgent ?? "N/A"}\n\nContent:\n${input.content}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: input.to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as ResendEmailResponse;
      detail = payload.message ?? payload.name ?? detail;
    } catch {}
    throw new Error(`Resend email failed: ${detail}`);
  }

  await response.json().catch(() => null);
}

export type DailyDigestExtras = {
  quote?: { quote: string; author: string } | null;
  onThisDay?: Array<{ year: number; text: string }> | null;
  book?: { title: string; author: string; year: number; recommendation: string } | null;
  movie?: { title: string; year: number; genres: string; directors: string; recommendation: string } | null;
};

export type SendDailyDigestEmailInput = {
  to: string;
  username?: string;
  locale?: Locale;
  stats: {
    totalTasks: number;
    completedTasks: number;
    remainingTasks: number;
    overdueTasks: number;
  };
  highPriorityTitles?: string[];
  extras?: DailyDigestExtras;
};

export async function sendDailyDigestEmail(input: SendDailyDigestEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY.");

  const locale = input.locale ?? DEFAULT_LOCALE;

  const statsHtml = `
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      <tr>
        <td style="text-align:center;padding:12px 8px;border-right:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:28px;font-weight:700;color:#25242a;">${input.stats.remainingTasks}</div>
          <div style="font-size:11px;color:#7d7880;text-transform:uppercase;letter-spacing:0.5px;">${translate(locale, "email.left")}</div>
        </td>
        <td style="text-align:center;padding:12px 8px;border-right:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:28px;font-weight:700;color:#16a34a;">${input.stats.completedTasks}</div>
          <div style="font-size:11px;color:#7d7880;text-transform:uppercase;letter-spacing:0.5px;">${translate(locale, "email.done")}</div>
        </td>
        <td style="text-align:center;padding:12px 8px;">
          <div style="font-size:28px;font-weight:700;color:${input.stats.overdueTasks > 0 ? "#dc2626" : "#7d7880"};">${input.stats.overdueTasks}</div>
          <div style="font-size:11px;color:#7d7880;text-transform:uppercase;letter-spacing:0.5px;">${translate(locale, "email.overdue")}</div>
        </td>
      </tr>
    </table>
  `;

  const extras = input.extras ?? {};
  const sectionStyle = 'background:#ffffff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:20px;margin:0 0 12px;';
  const labelStyle = 'font-size:10px;font-weight:600;color:#7d7880;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 8px;';

  let extrasHtml = '';
  if (extras.quote) {
    extrasHtml += `<div style="${sectionStyle}"><p style="${labelStyle}">${translate(locale, "email.dailyQuote")}</p><p style="margin:0;font-size:14px;line-height:1.6;color:#3c3841;font-style:italic;">"${escapeHtml(extras.quote.quote)}"</p><p style="margin:8px 0 0;font-size:12px;color:#7d7880;">— ${escapeHtml(extras.quote.author)}</p></div>`;
  }
  if (extras.onThisDay && extras.onThisDay.length > 0) {
    const events = extras.onThisDay.map((e) => `<tr><td style="padding:4px 12px 4px 0;font-size:12px;font-weight:600;color:#7d7880;vertical-align:top;white-space:nowrap;">${e.year}</td><td style="padding:4px 0;font-size:13px;color:#3c3841;">${escapeHtml(e.text)}</td></tr>`).join('');
    extrasHtml += `<div style="${sectionStyle}"><p style="${labelStyle}">${translate(locale, "email.onThisDay")}</p><table style="width:100%;border-collapse:collapse;">${events}</table></div>`;
  }
  if (extras.book) {
    extrasHtml += `<div style="${sectionStyle}"><p style="${labelStyle}">${translate(locale, "email.bookRecommendation")}</p><p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#25242a;">${escapeHtml(extras.book.title)}</p><p style="margin:0 0 8px;font-size:12px;color:#7d7880;">${escapeHtml(extras.book.author)} · ${extras.book.year}</p><p style="margin:0;font-size:13px;line-height:1.5;color:#3c3841;">${escapeHtml(extras.book.recommendation)}</p></div>`;
  }
  if (extras.movie) {
    extrasHtml += `<div style="${sectionStyle}"><p style="${labelStyle}">${translate(locale, "email.movieRecommendation")}</p><p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#25242a;">${escapeHtml(extras.movie.title)} (${extras.movie.year})</p><p style="margin:0 0 8px;font-size:12px;color:#7d7880;">${escapeHtml(extras.movie.directors)} · ${escapeHtml(extras.movie.genres)}</p><p style="margin:0;font-size:13px;line-height:1.5;color:#3c3841;">${escapeHtml(extras.movie.recommendation)}</p></div>`;
  }

  const html = `
    <div style="margin:0;padding:0;background:#fcfbfa;">
      <div style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#25242a;max-width:480px;margin:0 auto;padding:48px 24px;">
        <div style="text-align:center;margin:0 0 32px;">
          <h1 style="font-family:Manrope,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:48px;line-height:0.9;font-weight:600;letter-spacing:0;margin:0;color:#25242a;">Orkest</h1>
          <p style="margin:14px 0 0;font-size:14px;color:#7d7880;">${translate(locale, "email.dailyDigest")}</p>
        </div>
        <div style="background:#ffffff;border:1px solid rgba(0,0,0,0.06);border-radius:20px;padding:28px;margin:0 0 20px;">
          ${statsHtml}
          ${input.highPriorityTitles && input.highPriorityTitles.length > 0 ? `<div style="border-top:1px solid rgba(0,0,0,0.06);padding-top:16px;margin:0;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#7d7880;text-transform:uppercase;letter-spacing:0.5px;">${translate(locale, "email.highPriority")}</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3c3841;">${input.highPriorityTitles.map(t => escapeHtml(t)).join(" · ")}</p>
          </div>` : ''}
        </div>
        ${extrasHtml}
        <div style="text-align:center;margin:0;">
          <a href="https://orkest.wesluma.com" style="display:inline-block;background:#25242a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 24px;border-radius:100px;">${translate(locale, "email.viewInOrkest")}</a>
        </div>
        <p style="margin:24px 0 0;text-align:center;font-size:12px;color:#9d98a0;">${translate(locale, "email.disableHint")}</p>
      </div>
    </div>
  `;

  const text = `${translate(locale, "email.left")}: ${input.stats.remainingTasks} | ${translate(locale, "email.done")}: ${input.stats.completedTasks} | ${translate(locale, "email.overdue")}: ${input.stats.overdueTasks}\n\n${input.highPriorityTitles && input.highPriorityTitles.length > 0 ? `${translate(locale, "email.highPriority")}: ${input.highPriorityTitles.join(", ")}\n\n` : ''}${translate(locale, "email.viewInOrkest")}: https://orkest.wesluma.com`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: input.to,
      subject: translate(locale, "email.subject"),
      html,
      text,
    }),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as ResendEmailResponse;
      detail = payload.message ?? payload.name ?? detail;
    } catch {}
    throw new Error(`Resend email failed: ${detail}`);
  }

  await response.json().catch(() => null);
}

export async function sendReminderEmail(
  to: string,
  title: string,
  triggerTime: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const heading = translate(locale, "reminder.heading");
  const formattedTime = new Date(triggerTime).toLocaleString(locale === "zh-CN" ? "zh-CN" : locale, {
    dateStyle: "full",
    timeStyle: "short",
  });

  const html = `
    <div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fafafa;">
      <div style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e5e5e5;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9f99a3;">${escapeHtml(heading)}</p>
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#25242a;">${escapeHtml(title)}</h1>
        <p style="margin:0;font-size:14px;color:#6d6770;">${escapeHtml(formattedTime)}</p>
      </div>
      <p style="margin:20px 0 0;text-align:center;font-size:12px;color:#9d98a0;">
        <a href="https://orkest.wesluma.com" style="color:#6d6770;text-decoration:underline;">Orkest</a>
      </p>
    </div>
  `;

  const text = `${heading}: ${title}\n${formattedTime}\n\nhttps://orkest.wesluma.com`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to,
      subject: `${heading}: ${title}`,
      html,
      text,
    }),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as ResendEmailResponse;
      detail = payload.message ?? payload.name ?? detail;
    } catch {}
    throw new Error(`Resend reminder email failed: ${detail}`);
  }

  await response.json().catch(() => null);
}

