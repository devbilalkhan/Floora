import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TakeoffRow } from "@/lib/takeoff-types";
import { SendEmailComposer } from "./send-email-composer";

export default async function SubmissionSendPage({
  params,
}: {
  params: { orgSlug: string; projectId: string };
}) {
  const supabase = createClient();

  const [
    { data: userRole },
    { data: project },
    { data: org },
    { data: quotes },
    { data: takeoffList },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase.rpc("user_project_role", { proj_id: params.projectId }),
    supabase
      .from("projects")
      .select("id, name, location, head_client, brand, submission_pack_draft")
      .eq("id", params.projectId)
      .single(),
    supabase
      .from("organizations")
      .select("id, name, abn, address, phone, org_email, logo_url")
      .eq("slug", params.orgSlug)
      .single(),
    supabase
      .from("quotes")
      .select("*")
      .eq("project_id", params.projectId)
      .order("created_at", { ascending: true }),
    supabase.from("takeoffs").select("id").eq("project_id", params.projectId),
    supabase.auth.getUser(),
  ]);

  if (!userRole || userRole === "viewer") {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }
  if (!project || !org) notFound();

  const takeoffIds = (takeoffList ?? []).map((t) => t.id as string);
  const { data: rawRows } =
    takeoffIds.length > 0
      ? await supabase
          .from("project_takeoff")
          .select("*")
          .in("takeoff_id", takeoffIds)
          .order("scope_category")
          .order("sort_order")
      : { data: [] };

  const { data: gmailToken } = user
    ? await supabase
        .from("user_gmail_tokens")
        .select("user_id")
        .eq("user_id", user.id)
        .single()
    : { data: null };

  const today = new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <SendEmailComposer
      orgSlug={params.orgSlug}
      project={project}
      org={org}
      quotes={quotes ?? []}
      takeoffRows={(rawRows ?? []) as TakeoffRow[]}
      today={today}
      draft={project.submission_pack_draft ?? null}
      hasGmail={Boolean(gmailToken)}
      senderEmail={user?.email ?? ""}
    />
  );
}
