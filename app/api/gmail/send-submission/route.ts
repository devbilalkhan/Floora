import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshGoogleToken, sendGmailMessageWithAttachment } from "@/lib/gmail";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tokenRow } = await supabase
    .from("user_gmail_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });
  }

  let body: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    pdfBase64: string;
    filename?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.to || !body.subject || !body.body || !body.pdfBase64) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const accessToken = await refreshGoogleToken(tokenRow.refresh_token);
    const fromName: string =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      "";
    const result = await sendGmailMessageWithAttachment(accessToken, {
      to: body.to,
      cc: body.cc || undefined,
      subject: body.subject,
      body: body.body,
      fromEmail: user.email ?? "",
      fromName: fromName || undefined,
      attachmentBase64: body.pdfBase64,
      attachmentFilename: body.filename ?? "Submission_Pack.pdf",
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[send-submission]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send" },
      { status: 500 }
    );
  }
}
