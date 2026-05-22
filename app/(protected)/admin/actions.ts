"use server";

import { revalidatePath } from "next/cache";
import { createAuthedClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function assertSuperadmin() {
  const { supabase, user } = await createAuthedClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role")
    .eq("id", user.id)
    .single();
  if (profile?.app_role !== "superadmin") throw new Error("Forbidden");
  return user;
}

export async function updateOrgPlan(
  userId: string,
  updates: { plan?: string; status?: string; org_limit?: number }
) {
  await assertSuperadmin();
  const db = adminDb();

  const { error } = await db
    .from("user_plans")
    .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function cancelSubscription(userId: string) {
  await assertSuperadmin();
  const db = adminDb();

  const { error } = await db
    .from("user_plans")
    .update({ status: "cancelled" })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function deleteOrg(orgId: string) {
  await assertSuperadmin();
  const db = adminDb();

  // Cascade is handled by FK constraints on all child tables
  const { error } = await db.from("organizations").delete().eq("id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
