"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createAuthedClient } from "@/lib/supabase/server";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function friendlyError(msg: string): string {
  if (msg.includes("23505") || msg.includes("unique"))
    return "An organization with that name already exists.";
  if (msg.includes("JWT") || msg.includes("auth"))
    return "Your session has expired. Please log in again.";
  return "Something went wrong. Please try again.";
}

export async function createOrganization(formData: FormData) {
  const { supabase, user } = await createAuthedClient();

  // Superadmins (platform) bypass plan limits — they provision orgs for clients.
  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role")
    .eq("id", user.id)
    .single();

  if (profile?.app_role !== "superadmin") {
    const [{ count: adminCount }, { data: plan }] = await Promise.all([
      supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("role", "admin"),
      supabase
        .from("user_plans")
        .select("org_limit, status, trial_ends_at")
        .eq("user_id", user.id)
        .single(),
    ]);

    const isActive =
      plan?.status === "active" ||
      (plan?.status === "trial" && new Date(plan.trial_ends_at) > new Date());

    if (!isActive)
      throw new Error("Your subscription is inactive. Please renew to create an organization.");

    const limit = plan?.org_limit ?? 2;
    if (limit !== -1 && (adminCount ?? 0) >= limit)
      throw new Error(
        `Your plan allows up to ${limit} organization${limit === 1 ? "" : "s"}. Upgrade to add more.`
      );
  }

  const name = formData.get("name") as string;
  const slug = toSlug(name);

  // Ensure the profile row exists — password sign-in bypasses /auth/callback
  // so the profile may not have been created yet for that sign-in method.
  await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email }, { onConflict: "id", ignoreDuplicates: true });

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name, slug })
    .select("id, slug")
    .single();

  if (orgError) {
    console.error("[org insert]", orgError.code, orgError.message);
    throw new Error(friendlyError(orgError.message));
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "admin" });

  if (memberError) {
    console.error("[member insert]", memberError.code, memberError.message);
    throw new Error(friendlyError(memberError.message));
  }

  revalidatePath("/orgs");
  return { slug: org.slug };
}

export async function deleteOrganization(orgId: string, orgSlug: string) {
  const userDb = createClient();
  const { data: userRole } = await userDb.rpc("user_org_role", { org_id: orgId });
  if (userRole !== "admin") throw new Error("Only admins can delete an organization.");

  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("organizations").delete().eq("id", orgId);
  if (error) {
    console.error("[org delete]", error.code, error.message);
    throw new Error("Failed to delete organization. Please try again.");
  }

  revalidatePath("/orgs");
  redirect("/orgs");
}
