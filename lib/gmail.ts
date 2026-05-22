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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Converts a plain-text email body to HTML. Double-newlines become paragraph
// breaks; lines starting with "•" are grouped into <ul><li> lists with indent.
function plainTextToHtml(text: string): string {
  const blocks = text.trim().split(/\n{2,}/);

  const rendered = blocks
    .map((block) => {
      const lines = block.split("\n");

      // If every line in the block starts with a bullet, render as <ul>
      if (lines.every((l) => l.trimStart().startsWith("•"))) {
        const items = lines
          .map((l) => `<li style="margin:0 0 4px 0;">${escapeHtml(l.trimStart().slice(1).trim())}</li>`)
          .join("");
        return `<ul style="margin:0 0 14px 0;padding-left:20px;">${items}</ul>`;
      }

      // Regular paragraph — join internal newlines with <br>
      return `<p style="margin:0 0 14px 0;line-height:1.6;">${lines.map(escapeHtml).join("<br>")}</p>`;
    })
    .join("");

  return `<html><body style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6;margin:0;padding:0;">${rendered}</body></html>`;
}

function formatFrom(email: string, name?: string): string {
  if (!name) return email;
  // RFC 2047 B-encode the display name so non-ASCII chars survive mail relays
  const encodedName = `=?utf-8?B?${Buffer.from(name, "utf-8").toString("base64")}?=`;
  return `${encodedName} <${email}>`;
}

function buildRawEmailWithAttachment(opts: {
  from: string;
  fromName?: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  attachmentBase64: string;
  attachmentFilename: string;
}): string {
  const boundary = `boundary_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const encodedSubject = `=?utf-8?B?${Buffer.from(opts.subject, "utf-8").toString("base64")}?=`;
  const htmlBody = plainTextToHtml(opts.body);
  const bodyB64 =
    Buffer.from(htmlBody, "utf-8")
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? "";
  const attachWrapped =
    opts.attachmentBase64.match(/.{1,76}/g)?.join("\r\n") ?? opts.attachmentBase64;

  const lines = [
    `From: ${formatFrom(opts.from, opts.fromName)}`,
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    bodyB64,
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${opts.attachmentFilename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${opts.attachmentFilename}"`,
    "",
    attachWrapped,
    "",
    `--${boundary}--`,
  ];

  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailMessageWithAttachment(
  accessToken: string,
  opts: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    fromEmail: string;
    fromName?: string;
    attachmentBase64: string;
    attachmentFilename: string;
  }
): Promise<{ messageId: string; threadId: string }> {
  const raw = buildRawEmailWithAttachment({
    from: opts.fromEmail,
    fromName: opts.fromName,
    to: opts.to,
    cc: opts.cc,
    subject: opts.subject,
    body: opts.body,
    attachmentBase64: opts.attachmentBase64,
    attachmentFilename: opts.attachmentFilename,
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
