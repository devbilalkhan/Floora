import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuoteEditor } from "../../estimates/[estimateId]/quote/quote-editor";
import type { QuotePdfLine } from "../../estimates/[estimateId]/quote/quote-pdf-document";

export default async function SavedQuotePage({
  params,
}: {
  params: { orgSlug: string; projectId: string; quoteId: string };
}) {
  const supabase = createClient();

  const { data: userRole } = await supabase.rpc("user_project_role", {
    proj_id: params.projectId,
  });
  if (!userRole) redirect(`/orgs/${params.orgSlug}/projects`);

  const [{ data: quote }, { data: project }, { data: org }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", params.quoteId).single(),
    supabase.from("projects").select("id, name").eq("id", params.projectId).single(),
    supabase
      .from("organizations")
      .select("id, name, logo_url")
      .eq("slug", params.orgSlug)
      .single(),
  ]);

  if (!quote || !project) notFound();

  const lines = (quote.lines ?? []) as QuotePdfLine[];

  return (
    <QuoteEditor
      orgSlug={params.orgSlug}
      orgId={org?.id ?? ""}
      projectId={params.projectId}
      estimateId={quote.estimate_id ?? ""}
      orgName={org?.name ?? params.orgSlug}
      orgLogoUrl={org?.logo_url ?? null}
      orgAbn={quote.company_abn ?? ""}
      orgAddress={quote.company_address ?? ""}
      orgPhone={quote.company_phone ?? ""}
      orgEmail={quote.company_email ?? ""}
      quoteTerms={quote.terms ?? ""}
      quoteNotes={quote.notes ?? ""}
      projectName={project.name}
      projectLocation={quote.project_loc ?? ""}
      clientName={quote.to_name ?? ""}
      estimateName={quote.project_ref ?? project.name}
      primaryItems={[]}
      summary={{
        base: 0, accountingCost: 0, adminCost: 0,
        subtotalAfterOverhead: 0, markupAmount: 0, subtotalAfterMarkup: 0,
        additionalCosts: 0, floorPrepBags: 0, floorPrepRevenue: 0,
        floorPrepCost: 0, floorPrepProfit: 0, wetAreasTotalLabor: 0,
        wetAreasTotalCharge: 0, wetAreasProfit: 0, wetAreasCount: 0,
        totalExGst: quote.total_ex_gst ?? 0,
        gst: quote.gst ?? 0,
        grandTotal: quote.grand_total ?? 0,
        grossMarginPct: 0,
      }}
      quoteNumber={quote.quote_number}
      today={quote.quote_date}
      initialQuoteId={quote.id}
      initialLines={lines}
      initialScopeText={quote.scope_text ?? ""}
      initialToAddress={quote.to_address ?? ""}
      initialToContact={quote.to_contact ?? ""}
      initialToEmail={quote.to_email ?? ""}
      initialProjectLoc={quote.project_loc ?? ""}
      initialValidity={quote.valid_for ?? "30 days from date of issue"}
    />
  );
}
