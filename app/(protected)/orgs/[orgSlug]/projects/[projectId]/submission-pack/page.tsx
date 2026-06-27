import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TakeoffRow } from "@/lib/takeoff-types";
import { PackBuilder } from "./pack-builder";

export default async function SubmissionPackPage({
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
    { data: { user } },
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
      .select("id, org_id, project_id, estimate_id, quote_number, quote_date, valid_for, company_name, company_abn, company_address, company_phone, company_email, to_name, to_address, to_contact, to_email, project_ref, project_loc, scope_text, notes, terms, lines, total_ex_gst, gst, grand_total, status, created_at, updated_at")
      .eq("project_id", params.projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("takeoffs")
      .select("id, name, sort_order")
      .eq("project_id", params.projectId)
      .order("sort_order")
      .order("created_at"),
    supabase.auth.getUser(),
  ]);

  if (!userRole || userRole === "viewer") {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }
  if (!project || !org) notFound();

  const { data: gmailToken } = user
    ? await supabase
        .from("user_gmail_tokens")
        .select("user_id")
        .eq("user_id", user.id)
        .single()
    : { data: null };

  const takeoffs = (takeoffList ?? []) as { id: string; name: string; sort_order: number }[];

  // Fetch all takeoff rows for this project
  const takeoffIds = takeoffs.map((t) => t.id);
  const { data: rawRows } =
    takeoffIds.length > 0
      ? await supabase
          .from("project_takeoff")
          .select("id, takeoff_id, scope_category, finish_code, description, manufacturer, colour, location, level, product_type, qty, unit, waste_pct, notes, sort_order, parent_finish_code, cove_height_mm")
          .in("takeoff_id", takeoffIds)
          .order("scope_category")
          .order("sort_order")
      : { data: [] };

  const today = new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <PackBuilder
      orgSlug={params.orgSlug}
      project={project}
      org={org}
      quotes={quotes ?? []}
      takeoffs={takeoffs}
      takeoffRows={(rawRows ?? []) as TakeoffRow[]}
      today={today}
      draft={project.submission_pack_draft ?? null}
      hasGmail={Boolean(gmailToken)}
    />
  );
}
