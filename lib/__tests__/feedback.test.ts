import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendFeedbackEmail } from "../email/resend";

describe("sendFeedbackEmail", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
  });

  it("calls fetch with correct email parameters", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "123" }),
    } as Response);

    await sendFeedbackEmail({
      to: "receiver@example.com",
      fromUserEmail: "user@example.com",
      fromUserId: "user-123",
      type: "bug",
      content: "This is a bug report",
      userAgent: "Mozilla/5.0",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    
    const body = JSON.parse(init?.body as string);
    expect(body.to).toBe("receiver@example.com");
    expect(body.subject).toContain("Bug / Issue");
    expect(body.text).toContain("This is a bug report");
    expect(body.html).toContain("This is a bug report");
  });
});
