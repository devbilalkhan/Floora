import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SwmsEditor } from "./swms-editor";
import type { SwmsData, OrgWorker } from "@/lib/swms-types";

export default async function SwmsPage({
  params,
}: {
  params: { orgSlug: string; projectId: string; estimateId: string };
}) {
  const supabase = createClient();

  const { data: userRole } = await supabase.rpc("user_project_role", { proj_id: params.projectId });
  if (userRole === "viewer" || !userRole) {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }

  const [{ data: estimate }, { data: project }] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, name, project_id")
      .eq("id", params.estimateId)
      .single(),
    supabase
      .from("projects")
      .select("id, name, location, head_client, organization_id")
      .eq("id", params.projectId)
      .single(),
  ]);

  if (!estimate || !project) notFound();

  const [{ data: org }, { data: existingSwms }, { data: orgWorkers }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug, org_code, abn, address, phone, org_email, logo_url")
        .eq("id", project.organization_id)
        .single(),
      supabase
        .from("swms")
        .select("id, estimate_id, org_id, version, document_number, status, s1_pc_name, s1_pc_contact, s1_works_manager, s1_works_manager_contact, s1_date_provided_to_pc, s1_workplace_location, s1_work_activity, s1_project_reference, s1_dev_responsible, s1_compliance_person, s1_compliance_measures, s1_reviewer, s1_date_received_by_reviewer, s1_review_triggers, s1_next_review_date, s2_hrcw, s3_persons, s4_project, s4_pc, s4_activity_description, s4_plant_equipment, s4_materials, s4_ppe, s4_training, s4_permits, s4_maintenance, s4_legislation, s4_codes, s4_standards, s6_hazards, s7_procedures, s7_contacts, s8_responsible_person, s8_responsible_quals, s8_workers, created_at, updated_at")
        .eq("estimate_id", params.estimateId)
        .maybeSingle(),
      supabase
        .from("org_workers")
        .select("id, org_id, name, role, phone, email, sort_order")
        .eq("org_id", project.organization_id)
        .order("sort_order")
        .order("created_at"),
    ]);

  if (!org) notFound();

  return (
    <div className="max-w-[1200px] mx-auto py-6 px-4 space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href={`/orgs/${params.orgSlug}/projects`} className="hover:text-foreground transition-colors">
          Projects
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/orgs/${params.orgSlug}/projects/${params.projectId}`} className="hover:text-foreground transition-colors">
          {project.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/orgs/${params.orgSlug}/projects/${params.projectId}/estimates/${params.estimateId}/costing`}
          className="hover:text-foreground transition-colors"
        >
          {estimate.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">SWMS</span>
      </nav>

      <SwmsEditor
        existingSwms={existingSwms as SwmsData | null}
        orgWorkers={(orgWorkers as OrgWorker[]) ?? []}
        estimate={{ id: estimate.id, name: estimate.name }}
        project={{ id: project.id, name: project.name, location: project.location }}
        org={{
          id: org.id,
          name: org.name,
          slug: org.slug,
          org_code: org.org_code,
          abn: org.abn,
          address: org.address,
          phone: org.phone,
          org_email: org.org_email,
          logo_url: org.logo_url ?? null,
        }}
        params={params}
      />
    </div>
  );
}
