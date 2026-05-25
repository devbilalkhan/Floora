import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { AdminTable } from "./admin-table";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role")
    .eq("id", user.id)
    .single();

  if (profile?.app_role !== "superadmin") redirect("/orgs");

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch orgs, admin members, and member counts in parallel
  const [{ data: orgs }, { data: adminMembers }, { data: memberCounts }] = await Promise.all([
    db.from("organizations").select("id, name, slug, created_at").order("created_at", { ascending: false }),
    db.from("organization_members").select("organization_id, user_id, role").eq("role", "admin"),
    db.from("organization_members").select("organization_id"),
  ]);

  // Once we know the admin user IDs, fetch profiles and plans in parallel
  const ownerIds = Array.from(new Set((adminMembers ?? []).map((m) => m.user_id)));
  const [{ data: ownerProfiles }, { data: plans }] = await Promise.all([
    ownerIds.length > 0
      ? db.from("profiles").select("id, display_name, email").in("id", ownerIds)
      : Promise.resolve({ data: [] as any[] }),
    ownerIds.length > 0
      ? db.from("user_plans").select("user_id, plan, status, org_limit, trial_ends_at").in("user_id", ownerIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const countByOrg = (memberCounts ?? []).reduce<Record<string, number>>(
    (acc, m) => {
      acc[m.organization_id] = (acc[m.organization_id] ?? 0) + 1;
      return acc;
    },
    {}
  );

  // Build profile + plan lookup maps
  const profileMap = Object.fromEntries(
    (ownerProfiles ?? []).map((p: any) => [p.id, p])
  );
  const planMap = Object.fromEntries(
    (plans ?? []).map((p: any) => [p.user_id, p])
  );

  // Map org_id → first admin member
  const ownerByOrg = (adminMembers ?? []).reduce<Record<string, string>>(
    (acc, m) => {
      if (!acc[m.organization_id]) acc[m.organization_id] = m.user_id;
      return acc;
    },
    {}
  );

  const rows = (orgs ?? []).map((org: any) => {
    const ownerId = ownerByOrg[org.id] ?? null;
    const owner = ownerId ? profileMap[ownerId] ?? null : null;
    const plan = ownerId ? planMap[ownerId] ?? null : null;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.created_at,
      memberCount: countByOrg[org.id] ?? 0,
      owner: owner
        ? {
            id: ownerId!,
            name: owner.display_name ?? null,
            email: owner.email ?? null,
          }
        : null,
      plan: plan
        ? {
            plan: plan.plan as string,
            status: plan.status as string,
            orgLimit: plan.org_limit as number,
            trialEndsAt: plan.trial_ends_at as string | null,
          }
        : null,
    };
  });

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Platform Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {rows.length} organization{rows.length !== 1 ? "s" : ""} on the platform
        </p>
      </div>
      <AdminTable rows={rows} />
    </div>
  );
}
