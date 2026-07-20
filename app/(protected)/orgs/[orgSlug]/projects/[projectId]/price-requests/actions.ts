"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAuthedClient } from "@/lib/supabase/server";
import {
  refreshGoogleToken,
  sendGmailMessage,
  getGmailThread,
  extractMessageText,
  getHeader,
  listGmailLabels,
  createGmailLabel,
  applyGmailLabel,
} from "@/lib/gmail";

// Gmail label names can't contain "/" without creating unintended nesting,
// so strip any slashes out of project/supplier names before building the path.
function labelSegment(value: string): string {
  return value.replace(/\//g, "-").trim();
}

async function getOrCreateLabelId(
  supabase: Awaited<ReturnType<typeof createAuthedClient>>["supabase"],
  accessToken: string,
  userId: string,
  labelPath: string
): Promise<string> {
  const { data: cached } = await supabase
    .from("gmail_labels")
    .select("gmail_label_id")
    .eq("user_id", userId)
    .eq("label_path", labelPath)
    .maybeSingle();

  if (cached) return cached.gmail_label_id;

  const existing = await listGmailLabels(accessToken);
  const found = existing.find((l) => l.name === labelPath);
  const labelId = found?.id ?? (await createGmailLabel(accessToken, labelPath));

  await supabase
    .from("gmail_labels")
    .upsert({ user_id: userId, label_path: labelPath, gmail_label_id: labelId });

  return labelId;
}

async function requireProjectManagerRole(projectId: string) {
  const userDb = createClient();
  const { data: role } = await userDb.rpc("user_project_role", { proj_id: projectId });
  if (!["admin", "project_manager"].includes(role ?? ""))
    throw new Error("You don't have permission to do this.");
}

export type ProductSnapshot = {
  finish_code: string;
  description: string | null;
  manufacturer: string | null;
  colour: string | null;
  scope_category: string;
  supply: Record<string, number>;
  confirmed_price?: number | null;
};

export async function sendPriceRequest(input: {
  projectId: string;
  projectName: string;
  orgSlug: string;
  takeoffId: string | null;
  supplierName: string;
  supplierEmail: string;
  subject: string;
  emailBody: string;
  products: ProductSnapshot[];
}) {
  await requireProjectManagerRole(input.projectId);
  const { supabase, user } = await createAuthedClient();

  const { data: tokenRow } = await supabase
    .from("user_gmail_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) {
    throw new Error("Gmail not connected. Please sign in with Google to send price requests.");
  }

  const accessToken = await refreshGoogleToken(tokenRow.refresh_token);

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  const fromEmail = profile?.email ?? user.email ?? "";

  const { messageId, threadId } = await sendGmailMessage(accessToken, {
    to: input.supplierEmail,
    subject: input.subject,
    body: input.emailBody,
    fromEmail,
  });

  try {
    const labelPath = `Price Requests/${labelSegment(input.projectName)}/${labelSegment(input.supplierName)}`;
    const labelId = await getOrCreateLabelId(supabase, accessToken, user.id, labelPath);
    await applyGmailLabel(accessToken, messageId, labelId);
  } catch {
    // Non-fatal: labeling requires the gmail.modify scope, which existing
    // users won't have until they reconnect Google — don't block the send.
  }

  const { error } = await supabase.from("price_requests").insert({
    project_id: input.projectId,
    takeoff_id: input.takeoffId,
    supplier_name: input.supplierName,
    supplier_email: input.supplierEmail,
    subject: input.subject,
    email_body: input.emailBody,
    products: input.products,
    status: "sent",
    gmail_message_id: messageId,
    gmail_thread_id: threadId,
    sent_at: new Date().toISOString(),
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${input.orgSlug}/projects/${input.projectId}/price-requests`);
}

export async function confirmProductPrice(
  requestId: string,
  finishCode: string,
  price: number,
  orgSlug: string,
  projectId: string
) {
  await requireProjectManagerRole(projectId);
  const { supabase } = await createAuthedClient();

  const { data: req } = await supabase
    .from("price_requests")
    .select("products")
    .eq("id", requestId)
    .single();

  if (!req) throw new Error("Price request not found.");

  const products = (Array.isArray(req.products) ? req.products : []) as ProductSnapshot[];
  const updated = products.map((p) =>
    p.finish_code === finishCode ? { ...p, confirmed_price: price > 0 ? price : null } : p
  );

  const { error } = await supabase
    .from("price_requests")
    .update({ products: updated })
    .eq("id", requestId);

  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}/price-requests/${requestId}`);
}

export async function checkForReplies(projectId: string, orgSlug: string) {
  await requireProjectManagerRole(projectId);
  const { supabase, user } = await createAuthedClient();

  const { data: requests } = await supabase
    .from("price_requests")
    .select("id, gmail_thread_id")
    .eq("project_id", projectId)
    .eq("status", "sent")
    .not("gmail_thread_id", "is", null);

  if (!requests?.length) return { checked: 0, found: 0 };

  const { data: tokenRow } = await supabase
    .from("user_gmail_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) return { checked: 0, found: 0 };

  const accessToken = await refreshGoogleToken(tokenRow.refresh_token);

  let found = 0;
  for (const req of requests) {
    if (!req.gmail_thread_id) continue;
    try {
      const thread = await getGmailThread(accessToken, req.gmail_thread_id);
      if (thread.messages.length <= 1) continue;

      const reply = thread.messages[thread.messages.length - 1];
      const replyBody = extractMessageText(reply);
      const replyFrom = getHeader(reply, "From");
      const replyDate = new Date(parseInt(reply.internalDate)).toISOString();

      await supabase
        .from("price_requests")
        .update({
          status: "received",
          reply_body: replyBody,
          reply_from: replyFrom,
          reply_received_at: replyDate,
        })
        .eq("id", req.id);

      found++;
    } catch {
      // Non-fatal: skip if Gmail API call fails for this thread
    }
  }

  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}/price-requests`);
  return { checked: requests.length, found };
}
