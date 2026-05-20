import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronRight, CalendarCheck2, Settings } from "lucide-react";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgSlug: string };
}) {
  const supabase = createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", params.orgSlug)
    .single();

  if (!org) notFound();

  const { data: userRole } = await supabase.rpc("user_org_role", { org_id: org.id });
  if (!userRole) redirect("/orgs");
  const isAdmin = userRole === "admin";

  return (
    <div>
      <div className="border-b border-border px-4 h-9 flex items-center gap-1.5 text-xs text-muted-foreground bg-background/50">
        <Link href="/orgs" className="hover:text-foreground transition-colors">
          Organizations
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{org.name}</span>
        <div className="flex-1" />
        <Link
          href={`/orgs/${params.orgSlug}/planner`}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          title="Planner"
        >
          <CalendarCheck2 className="h-3.5 w-3.5" />
          <span>Planner</span>
        </Link>
        {isAdmin && (
          <>
            <span className="text-border">·</span>
            <Link
              href={`/orgs/${params.orgSlug}/settings`}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              title="Organisation settings"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </Link>
          </>
        )}
      </div>
      {children}
    </div>
  );
}
