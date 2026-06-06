function summarizeResponseBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (!normalized) return "The server returned an empty response.";

  const snippet = normalized.slice(0, 160);
  if (/<!doctype|<html|<body/i.test(normalized)) {
    return "The server returned an HTML page instead of JSON. In this app, that usually means the Next.js route crashed before it could return JSON, the dev server was recompiling, or the request hit an HTML error page.";
  }

  return `The server returned a non-JSON response: ${snippet}`;
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const text = await response.text();

  if (!text.trim()) {
    throw new Error("The server returned an empty response.");
  }

  if (!contentType.includes("application/json")) {
    throw new Error(summarizeResponseBody(text));
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(summarizeResponseBody(text));
  }
}
