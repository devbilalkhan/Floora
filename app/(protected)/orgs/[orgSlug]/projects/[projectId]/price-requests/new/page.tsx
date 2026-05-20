import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Composer } from "./composer";
import { DEFAULT_TEMPLATE } from "@/lib/email-template";

const DEFAULT_SIGNATURE = `Bilal Khan
Business Development Manager
Specialised Preventative Maintenance
Commercial Flooring | Sports Flooring | Wall & Door Protection Systems | Acoustic Panels | HandRails | Corner Guards | Damp Course Injection
M: +61 497 134 012
E: bilal.khan@spmprotect.com
W: DFO Flooring - www.dfoflooring.au
W: SPM - www.dfoflooring.au/spm-specialised-preventative-maintenance`;
import type { TakeoffRow } from "@/app/(protected)/orgs/[orgSlug]/projects/[projectId]/takeoff/takeoff-table";

export default async function NewPriceRequestPage({
  params,
}: {
  params: { orgSlug: string; projectId: string };
}) {
  const supabase = createClient();

  const { data: userRole } = await supabase.rpc("user_project_role", { proj_id: params.projectId });
  if (userRole === "viewer" || !userRole) {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }

  const [
    { data: project },
    { data: rawTakeoffs },
    { data: { user } },
    { data: org },
  ] = await Promise.all([
    supabase.from("projects").select("name").eq("id", params.projectId).single(),
    supabase
      .from("takeoffs")
      .select("id, name, sort_order")
      .eq("project_id", params.projectId)
      .order("sort_order"),
    supabase.auth.getUser(),
    supabase
      .from("organizations")
      .select("price_request_template, price_request_signature")
      .eq("slug", params.orgSlug)
      .single(),
  ]);

  if (!project) notFound();

  const takeoffs = rawTakeoffs ?? [];

  // Load all project_takeoff rows for all takeoffs in one query
  const takeoffIds = takeoffs.map((t) => t.id);
  const { data: rawRows } = takeoffIds.length
    ? await supabase
        .from("project_takeoff")
        .select("*")
        .in("takeoff_id", takeoffIds)
    : { data: [] };

  const rows = (rawRows ?? []) as TakeoffRow[];

  // Check if user has Gmail connected
  const { data: gmailToken } = user
    ? await supabase
        .from("user_gmail_tokens")
        .select("user_id")
        .eq("user_id", user.id)
        .single()
    : { data: null };

  const hasGmail = Boolean(gmailToken);

  const template  = org?.price_request_template  ?? DEFAULT_TEMPLATE;
  const signature = org?.price_request_signature ?? DEFAULT_SIGNATURE;
  const senderEmail = user?.email ?? "";

  return (
    <Composer
      orgSlug={params.orgSlug}
      projectId={params.projectId}
      projectName={project.name}
      takeoffs={takeoffs}
      allRows={rows}
      hasGmail={hasGmail}
      template={template}
      signature={signature}
      senderEmail={senderEmail}
    />
  );
}
