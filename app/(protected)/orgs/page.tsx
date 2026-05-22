import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NewOrgDialog } from "./new-org-dialog";
import { OrgRowActions } from "./org-row-actions";

export default async function OrgsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminDb = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Process pending invites — catches password login, which bypasses /auth/callback
  if (user.email) {
    const { data: pendingInvites } = await adminDb
      .from("org_invites")
      .select("id, org_id, role")
      .eq("email", user.email.toLowerCase())
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    for (const invite of pendingInvites ?? []) {
      await adminDb.from("organization_members").upsert(
        { organization_id: invite.org_id, user_id: user.id, role: invite.role },
        { onConflict: "organization_id,user_id", ignoreDuplicates: true }
      );
      await adminDb.from("org_invites").update({ status: "accepted" }).eq("id", invite.id);
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role")
    .eq("id", user.id)
    .single();

  const isSuperadmin = profile?.app_role === "superadmin";

  const [{ data: memberships }, { data: allOrgs }, { data: acceptedInvites }] =
    await Promise.all([
      isSuperadmin
        ? Promise.resolve({ data: [] as any[] })
        : supabase
            .from("organization_members")
            .select("role, organizations(id, name, slug)")
            .eq("user_id", user.id),
      isSuperadmin
        ? supabase.from("organizations").select("id, name, slug").order("name")
        : Promise.resolve({ data: [] as any[] }),
      user.email
        ? adminDb
            .from("org_invites")
            .select("id")
            .eq("email", user.email.toLowerCase())
            .eq("status", "accepted")
            .limit(1)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);

  type OrgRow = { id: string; name: string; slug: string };
  type Org = OrgRow & { role: string };

  const orgs: Org[] = isSuperadmin
    ? (allOrgs ?? []).map((o) => ({ ...o, role: "superadmin" }))
    : (memberships ?? []).map((m) => ({
        ...(m.organizations as unknown as OrgRow),
        role: m.role as string,
      }));

  const hasElevatedRole = isSuperadmin || orgs.some((o) => ["admin", "project_manager"].includes(o.role));
  if (orgs.length === 1 && !hasElevatedRole) {
    redirect(`/orgs/${orgs[0].slug}/projects`);
  }

  // User previously accepted an invite but is no longer a member of any org — they were removed.
  const wasRemoved = orgs.length === 0 && (acceptedInvites?.length ?? 0) > 0;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Organizations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select an organization to continue.
          </p>
        </div>
        {!wasRemoved && <NewOrgDialog />}
      </div>

      {orgs.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            {wasRemoved ? (
              <>
                <p className="text-base font-medium">Access removed</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  You&apos;re no longer a member of any organization. Ask your PM or
                  admin to send you a new invite link.
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-medium">No organizations yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Create your first organization or wait for an admin to invite you.
                </p>
                <NewOrgDialog />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/orgs/${org.slug}/projects`}
              className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/40 transition-colors group"
            >
              <div>
                <p className="font-medium group-hover:text-primary transition-colors">
                  {org.name}
                </p>
                <p className="text-xs text-muted-foreground">{org.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground capitalize">
                  {org.role.replace("_", " ")}
                </span>
                {(org.role === "admin" || isSuperadmin) && (
                  <OrgRowActions orgId={org.id} orgSlug={org.slug} orgName={org.name} />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
