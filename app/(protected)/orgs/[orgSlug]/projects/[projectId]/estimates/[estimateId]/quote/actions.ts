"use server";

import { revalidatePath } from "next/cache";
import { createAuthedClient } from "@/lib/supabase/server";
import type { QuotePdfLine } from "./quote-pdf-document";

export type QuoteSavePayload = {
  orgId: string;
  projectId: string;
  estimateId: string;
  name?: string;
  quoteNumber: string;
  quoteDate: string;
  validFor: string;
  companyName: string;
  companyAbn: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  toName: string;
  toAddress: string;
  toContact: string;
  toEmail: string;
  projectRef: string;
  projectLoc: string;
  scopeText: string;
  notes: string;
  terms: string;
  lines: QuotePdfLine[];
  totalExGst: number;
  gst: number;
  grandTotal: number;
  hideZeros?: boolean;
  status?: string;
};

export async function saveQuote(
  orgSlug: string,
  payload: QuoteSavePayload,
  existingId?: string
): Promise<string> {
  const { supabase } = await createAuthedClient();

  const row = {
    org_id:          payload.orgId,
    project_id:      payload.projectId,
    estimate_id:     payload.estimateId || null,
    name:            payload.name ?? null,
    quote_number:    payload.quoteNumber,
    quote_date:      payload.quoteDate,
    valid_for:       payload.validFor,
    company_name:    payload.companyName,
    company_abn:     payload.companyAbn,
    company_address: payload.companyAddress,
    company_phone:   payload.companyPhone,
    company_email:   payload.companyEmail,
    to_name:         payload.toName,
    to_address:      payload.toAddress,
    to_contact:      payload.toContact,
    to_email:        payload.toEmail,
    project_ref:     payload.projectRef,
    project_loc:     payload.projectLoc,
    scope_text:      payload.scopeText,
    notes:           payload.notes,
    terms:           payload.terms,
    lines:           payload.lines,
    total_ex_gst:    payload.totalExGst,
    gst:             payload.gst,
    grand_total:     payload.grandTotal,
    hide_zeros:      payload.hideZeros ?? false,
    status:          payload.status ?? "draft",
    updated_at:      new Date().toISOString(),
  };

  if (existingId) {
    const { error } = await supabase.from("quotes").update(row).eq("id", existingId);
    if (error) throw new Error(error.message);
    revalidatePath(`/orgs/${orgSlug}/projects/${payload.projectId}/quotes`);
    return existingId;
  }

  const { data, error } = await supabase.from("quotes").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/projects/${payload.projectId}/quotes`);
  return data.id as string;
}

export async function deleteQuote(orgSlug: string, projectId: string, quoteId: string) {
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}/quotes`);
}

export async function updateQuoteStatus(quoteId: string, status: string, orgSlug: string, projectId: string) {
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("quotes").update({ status, updated_at: new Date().toISOString() }).eq("id", quoteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}/quotes`);
}

export async function renameQuote(quoteId: string, name: string, orgSlug: string, projectId: string) {
  const { supabase } = await createAuthedClient();
  const { error } = await supabase.from("quotes").update({ name: name || null, updated_at: new Date().toISOString() }).eq("id", quoteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}/quotes`);
}
