import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgSlug: string };
}) {
  const supabase = createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", params.orgSlug)
    .single();

  if (!org) redirect("/orgs");

  const { data: userRole } = await supabase.rpc("user_org_role", { org_id: org.id });
  if (userRole !== "admin") redirect(`/orgs/${params.orgSlug}/projects`);

  return <>{children}</>;
}
