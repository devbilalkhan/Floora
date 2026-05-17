import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewOrgDialog } from "./new-org-dialog";

export default async function OrgsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .eq("user_id", user.id);

  type OrgRow = { id: string; name: string; slug: string };
  type Org = OrgRow & { role: string };
  const orgs: Org[] =
    memberships?.map((m) => ({
      ...(m.organizations as unknown as OrgRow),
      role: m.role as string,
    })) ?? [];

  if (orgs.length === 1) {
    redirect(`/orgs/${orgs[0].slug}/projects`);
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Organizations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select an organization to continue.
          </p>
        </div>
        <NewOrgDialog />
      </div>

      {orgs.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <p className="text-base font-medium">No organizations yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first organization to get started.
            </p>
            <NewOrgDialog />
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
              <span className="text-xs text-muted-foreground capitalize">
                {org.role.replace("_", " ")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
