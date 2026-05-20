// Server-only. Never import in client components.

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description ?? "Failed to refresh Google token");
  }
  const data = await res.json();
  return data.access_token as string;
}

function buildRawEmail(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): string {
  // RFC 2047 B-encoding ensures non-ASCII chars in the subject (em dash, etc.) display correctly
  const encodedSubject = `=?utf-8?B?${Buffer.from(opts.subject, "utf-8").toString("base64")}?=`;

  // base64 Content-Transfer-Encoding ensures the body UTF-8 bytes survive all mail relays
  const bodyB64 = Buffer.from(opts.body, "utf-8")
    .toString("base64")
    .match(/.{1,76}/g)
    ?.join("\r\n") ?? "";

  const msg = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    bodyB64,
  ].join("\r\n");

  // base64url encode the entire RFC 2822 message for the Gmail API
  return Buffer.from(msg)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailMessage(
  accessToken: string,
  opts: { to: string; subject: string; body: string; fromEmail: string }
): Promise<{ messageId: string; threadId: string }> {
  const raw = buildRawEmail({
    from: opts.fromEmail,
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
  });

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? "Failed to send email via Gmail");
  }

  const data = await res.json();
  return { messageId: data.id as string, threadId: data.threadId as string };
}

type GmailMessage = {
  id: string;
  internalDate: string;
  payload: {
    headers: { name: string; value: string }[];
    body: { data?: string };
    parts?: { mimeType: string; body: { data?: string } }[];
  };
};

export async function getGmailThread(
  accessToken: string,
  threadId: string
): Promise<{ messages: GmailMessage[] }> {
  const res = await fetch(`${GMAIL_API}/threads/${threadId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Gmail thread");
  return res.json();
}

export function extractMessageText(msg: GmailMessage): string {
  const plain = msg.payload.parts?.find((p) => p.mimeType === "text/plain");
  const data = plain?.body?.data ?? msg.payload.body?.data;
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

export function getHeader(msg: GmailMessage, name: string): string {
  return (
    msg.payload.headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    )?.value ?? ""
  );
}

// Strips quoted original email content from a reply body.
// Removes lines starting with ">" and everything after "On ... wrote:" headers.
export function stripQuotedContent(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith(">")) break;
    if (/^On .+(wrote:|writes:)/i.test(trimmed)) break;
    result.push(line);
  }
  while (result.length > 0 && !result[result.length - 1].trim()) result.pop();
  return result.join("\n");
}
