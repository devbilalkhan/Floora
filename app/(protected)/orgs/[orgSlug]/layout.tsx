import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ChevronRight, CalendarCheck2, CalendarDays, Settings, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  active:    "bg-success/10 text-success border-success/20",
  trial:     "bg-blue-400/10 text-blue-400 border-blue-400/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

function trialDaysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  return Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000);
}

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgSlug: string };
}) {
  const supabase = createClient();
  const [{ data: org }, { data: { user } }] = await Promise.all([
    supabase.from("organizations").select("id, name, slug").eq("slug", params.orgSlug).single(),
    supabase.auth.getUser(),
  ]);

  if (!org) notFound();

  const [{ data: userRole }, { data: profile }] = await Promise.all([
    supabase.rpc("user_org_role", { org_id: org.id }),
    user
      ? supabase.from("profiles").select("app_role").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!userRole && profile?.app_role !== "superadmin") redirect("/orgs");
  const isAdmin = userRole === "admin";
  const isSuperadmin = profile?.app_role === "superadmin";

  // Fetch the org admin's plan — visible to org admin (own plan) and superadmin (all plans)
  let plan: { plan: string; status: string; trial_ends_at: string | null } | null = null;
  if (isAdmin || isSuperadmin) {
    if (isAdmin) {
      // Org admin reads their own plan — RLS allows it
      const { data } = await supabase
        .from("user_plans")
        .select("plan, status, trial_ends_at")
        .single();
      plan = data ?? null;
    } else {
      // Superadmin: find the org's admin member, fetch their plan via service role
      const adminDb = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data: adminMember } = await adminDb
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", org.id)
        .eq("role", "admin")
        .limit(1)
        .single();
      if (adminMember) {
        const { data } = await adminDb
          .from("user_plans")
          .select("plan, status, trial_ends_at")
          .eq("user_id", adminMember.user_id)
          .single();
        plan = data ?? null;
      }
    }
  }

  return (
    <div>
      <div className="border-b border-border px-4 h-9 flex items-center gap-1.5 text-xs text-muted-foreground bg-background/50 print:hidden">
        <Link href="/orgs" className="hover:text-foreground transition-colors">
          Organizations
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{org.name}</span>

        {/* Subscription badge */}
        {plan && (
          <span className={cn(
            "inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-medium capitalize",
            STATUS_STYLE[plan.status] ?? STATUS_STYLE.trial
          )}>
            {plan.status}
            {plan.status === "trial" && trialDaysLeft(plan.trial_ends_at) !== null && (
              <span className="opacity-70">· {trialDaysLeft(plan.trial_ends_at)}d</span>
            )}
            {plan.status !== "trial" && (
              <span className="opacity-70">· {plan.plan}</span>
            )}
          </span>
        )}

        <div className="flex-1" />
        <Link
          href={`/orgs/${params.orgSlug}/reports`}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          title="Consolidated Reports"
        >
          <BarChart2 className="h-3.5 w-3.5" />
          <span>Reports</span>
        </Link>
        <span className="text-border">·</span>
        <Link
          href={`/orgs/${params.orgSlug}/planner`}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          title="Planner"
        >
          <CalendarCheck2 className="h-3.5 w-3.5" />
          <span>Planner</span>
        </Link>
        <span className="text-border">·</span>
        <Link
          href={`/orgs/${params.orgSlug}/planner?view=calendar`}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          title="Calendar"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Calendar</span>
        </Link>
        {(isAdmin || isSuperadmin) && (
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
