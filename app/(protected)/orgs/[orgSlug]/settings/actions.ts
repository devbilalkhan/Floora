"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";
import { createClient, createAuthedClient } from "@/lib/supabase/server";

const VALID_ORG_ROLES = ["admin", "project_manager", "estimator", "viewer"] as const;

async function requireOrgAdmin(orgId: string) {
  const userDb = createClient();
  const { data: role } = await userDb.rpc("user_org_role", { org_id: orgId });
  if (role !== "admin") throw new Error("Admin access required.");
}

function getAdminClient() {
  return createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function saveEmailSettings(
  orgSlug: string,
  orgId: string,
  template: string,
  signature: string
) {
  await requireOrgAdmin(orgId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("organizations")
    .update({
      price_request_template: template || null,
      price_request_signature: signature || null,
    })
    .eq("id", orgId);

  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}/settings`);
}

export async function saveOrgLogo(
  orgSlug: string,
  orgId: string,
  logoUrl: string | null
) {
  await requireOrgAdmin(orgId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: logoUrl })
    .eq("id", orgId);

  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}/settings`);
}

export async function saveOrgDetails(
  orgSlug: string,
  orgId: string,
  details: {
    org_code: string;
    abn: string;
    address: string;
    phone: string;
    org_email: string;
    quote_terms?: string;
    quote_notes?: string;
    quote_prefix?: string;
    quote_number_seq?: number;
  }
) {
  await requireOrgAdmin(orgId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("organizations")
    .update({
      org_code: details.org_code || null,
      abn: details.abn || null,
      address: details.address || null,
      phone: details.phone || null,
      org_email: details.org_email || null,
      quote_terms: details.quote_terms ?? null,
      quote_notes: details.quote_notes ?? null,
      quote_prefix: details.quote_prefix || "SPM",
      quote_number_seq: details.quote_number_seq ?? 99,
    })
    .eq("id", orgId);

  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}/settings`);
}

export async function saveDefaultRates(
  orgSlug: string,
  orgId: string,
  rates: { mat: Record<string, number>; lab: Record<string, number> }
) {
  await requireOrgAdmin(orgId);
  const { supabase } = await createAuthedClient();
  const { error } = await supabase
    .from("organizations")
    .update({ default_rates: rates })
    .eq("id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/settings`);
}

export async function addOrgWorker(
  orgId: string,
  orgSlug: string,
  worker: { name: string; role: string; phone: string; email: string }
) {
  await requireOrgAdmin(orgId);
  const { supabase } = await createAuthedClient();

  const { data, error } = await supabase
    .from("org_workers")
    .insert({
      org_id: orgId,
      name: worker.name.trim(),
      role: worker.role.trim(),
      phone: worker.phone.trim() || null,
      email: worker.email.trim() || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}/settings`);
  return data;
}

export async function updateOrgWorker(
  workerId: string,
  orgSlug: string,
  worker: { name: string; role: string; phone: string; email: string }
) {
  const { supabase } = await createAuthedClient();
  const { data: existing } = await supabase
    .from("org_workers")
    .select("org_id")
    .eq("id", workerId)
    .single();
  if (!existing) throw new Error("Worker not found.");
  await requireOrgAdmin(existing.org_id);

  const { error } = await supabase
    .from("org_workers")
    .update({
      name: worker.name.trim(),
      role: worker.role.trim(),
      phone: worker.phone.trim() || null,
      email: worker.email.trim() || null,
    })
    .eq("id", workerId);

  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}/settings`);
}

export async function deleteOrgWorker(workerId: string, orgSlug: string) {
  const { supabase } = await createAuthedClient();
  const { data: existing } = await supabase
    .from("org_workers")
    .select("org_id")
    .eq("id", workerId)
    .single();
  if (!existing) throw new Error("Worker not found.");
  await requireOrgAdmin(existing.org_id);

  const { error } = await supabase
    .from("org_workers")
    .delete()
    .eq("id", workerId);

  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}/settings`);
}

// ── Member management ──────────────────────────────────────────────────────────

export async function getOrgMembers(orgId: string) {
  await requireOrgAdmin(orgId);
  const { supabase } = await createAuthedClient();
  const adminDb = getAdminClient();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", orgId),
    supabase
      .from("org_invites")
      .select("id, email, role, created_at, expires_at")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  // profiles RLS restricts reads to own row — use admin client to get emails
  const userIds = (members ?? []).map((m: any) => m.user_id as string);
  const { data: profiles } =
    userIds.length > 0
      ? await adminDb.from("profiles").select("id, email").in("id", userIds)
      : { data: [] };
  const emailById = Object.fromEntries(
    (profiles ?? []).map((p: any) => [p.id as string, p.email as string])
  );

  return {
    members: (members ?? []).map((m: any) => ({
      user_id: m.user_id as string,
      email: (emailById[m.user_id] ?? "unknown") as string,
      org_role: m.role as string,
    })),
    invites: (invites ?? []) as {
      id: string;
      email: string;
      role: string;
      created_at: string;
      expires_at: string;
    }[],
  };
}

export async function inviteOrgMember(
  orgSlug: string,
  orgId: string,
  email: string,
  role: string
) {
  await requireOrgAdmin(orgId);
  if (!VALID_ORG_ROLES.includes(role as typeof VALID_ORG_ROLES[number]))
    throw new Error("Invalid role.");
  const { supabase, user } = await createAuthedClient();
  const normalised = email.toLowerCase().trim();

  const { error: insertError } = await supabase.from("org_invites").insert({
    org_id: orgId,
    email: normalised,
    role,
    invited_by: user.id,
  });

  if (insertError) {
    if (insertError.code === "23505")
      throw new Error("A pending invite already exists for this email.");
    throw new Error(insertError.message);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const adminClient = getAdminClient();
  const { error: authError } = await adminClient.auth.admin.inviteUserByEmail(normalised, {
    redirectTo: `${siteUrl}/auth/callback`,
  });

  if (authError && !authError.message.toLowerCase().includes("already been registered")) {
    await supabase
      .from("org_invites")
      .delete()
      .eq("org_id", orgId)
      .eq("email", normalised)
      .eq("status", "pending");
    throw new Error(authError.message);
  }

  revalidatePath(`/orgs/${orgSlug}/settings`);
  return { alreadyRegistered: !!authError };
}

export async function updateMemberRole(
  orgSlug: string,
  orgId: string,
  memberId: string,
  newRole: string
) {
  await requireOrgAdmin(orgId);
  if (!VALID_ORG_ROLES.includes(newRole as typeof VALID_ORG_ROLES[number]))
    throw new Error("Invalid role.");
  const { supabase, user } = await createAuthedClient();

  const { error } = await supabase
    .from("organization_members")
    .update({ role: newRole })
    .eq("organization_id", orgId)
    .eq("user_id", memberId)
    .neq("user_id", user.id); // prevent self-demotion

  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/settings`);
}

export async function removeMember(orgSlug: string, orgId: string, memberId: string) {
  await requireOrgAdmin(orgId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", memberId);

  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/settings`);
}

// ── Voice token management ─────────────────────────────────────────────────────

async function requireVoiceRole(orgId: string) {
  const userDb = createClient();
  const { data: role } = await userDb.rpc("user_org_role", { org_id: orgId });
  if (role !== "admin" && role !== "project_manager")
    throw new Error("Access denied.");
}

export async function generateVoiceToken(orgSlug: string, orgId: string) {
  const userDb = createClient();
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  await requireVoiceRole(orgId);

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const { supabase } = await createAuthedClient();

  // Soft-revoke all active tokens for this user + org
  await supabase
    .from("voice_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .is("revoked_at", null);

  const { error } = await supabase.from("voice_tokens").insert({
    user_id: user.id,
    org_id: orgId,
    token_hash: tokenHash,
    label: "My Shortcut",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/orgs/${orgSlug}/settings`);
  return rawToken; // returned once; never stored in DB
}

export async function revokeVoiceToken(orgSlug: string, orgId: string) {
  const userDb = createClient();
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  await requireVoiceRole(orgId);

  const { supabase } = await createAuthedClient();
  await supabase
    .from("voice_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .is("revoked_at", null);

  revalidatePath(`/orgs/${orgSlug}/settings`);
}

export async function cancelInvite(orgSlug: string, inviteId: string) {
  const { supabase } = await createAuthedClient();
  const { data: invite } = await supabase
    .from("org_invites")
    .select("org_id")
    .eq("id", inviteId)
    .single();
  if (!invite) throw new Error("Invite not found.");
  await requireOrgAdmin(invite.org_id);

  const { error } = await supabase
    .from("org_invites")
    .delete()
    .eq("id", inviteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/settings`);
}
