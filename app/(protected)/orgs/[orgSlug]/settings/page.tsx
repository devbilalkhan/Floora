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
      .select("id, price_request_template, price_request_signature, org_code, abn, address, phone, org_email, logo_url, quote_terms, quote_notes, quote_prefix, quote_number_seq, default_rates")
      .eq("slug", params.orgSlug)
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!org) notFound();

  const [{ data: workers }, { data: voiceToken }, { data: userRole }] = await Promise.all([
    supabase
      .from("org_workers")
      .select("id, org_id, name, role, phone, email, sort_order")
      .eq("org_id", org.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("voice_tokens")
      .select("id, label, last_used, created_at")
      .eq("org_id", org.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("user_org_role", { org_id: org.id }),
  ]);

  return (
    <SettingsForm
      params={params}
      orgId={org.id}
      currentUserId={user?.id ?? ""}
      userRole={(userRole ?? "estimator") as string}
      voiceTokenMeta={voiceToken as { id: string; label: string | null; last_used: string | null; created_at: string } | null}
      initialData={{
        org_code: org.org_code ?? "",
        abn: org.abn ?? "",
        address: org.address ?? "",
        phone: org.phone ?? "",
        org_email: org.org_email ?? "",
        logo_url: org.logo_url ?? null,
        quote_terms: org.quote_terms ?? "",
        quote_notes: org.quote_notes ?? "",
        quote_prefix: org.quote_prefix ?? "SPM",
        quote_number_seq: org.quote_number_seq ?? 99,
        price_request_template: org.price_request_template,
        price_request_signature: org.price_request_signature,
        default_rates: (org.default_rates ?? {}) as {
          mat?: Record<string, number>;
          lab?: Record<string, number>;
        },
      }}
      initialWorkers={(workers as OrgWorker[]) ?? []}
    />
  );
}
