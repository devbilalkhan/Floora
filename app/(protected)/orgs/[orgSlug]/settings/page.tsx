import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import type { OrgWorker } from "@/lib/swms-types";

export default async function OrgSettingsPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const supabase = createClient();

  const [{ data: org }, { data: { user } }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, price_request_template, price_request_signature, org_code, abn, address, phone, org_email, logo_url, quote_terms, quote_notes")
      .eq("slug", params.orgSlug)
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!org) notFound();

  const { data: workers } = await supabase
    .from("org_workers")
    .select("*")
    .eq("org_id", org.id)
    .order("sort_order")
    .order("created_at");

  return (
    <SettingsForm
      params={params}
      orgId={org.id}
      currentUserId={user?.id ?? ""}
      initialData={{
        org_code: org.org_code ?? "",
        abn: org.abn ?? "",
        address: org.address ?? "",
        phone: org.phone ?? "",
        org_email: org.org_email ?? "",
        logo_url: org.logo_url ?? null,
        quote_terms: org.quote_terms ?? "",
        quote_notes: org.quote_notes ?? "",
        price_request_template: org.price_request_template,
        price_request_signature: org.price_request_signature,
      }}
      initialWorkers={(workers as OrgWorker[]) ?? []}
    />
  );
}
