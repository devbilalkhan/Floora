"use server";

import { createAuthedClient } from "@/lib/supabase/server";

export type PackDraft = {
  clientName: string;
  projectName: string;
  packageName: string;
  packDate: string;
  contactName: string;
  contactTitle: string;
  clientCompany: string;
  reSubject: string;
  reSubjectEdited: boolean;
  refRows: { id: number; type: "drawing" | "min_order" | "other"; reference: string; note: string }[];
  capabilitiesText: string;
  approachIntro: string;
  approachPointsText: string;
  closingText: string;
  signatoryName: string;
  signatoryTitle: string;
  signatoryCompany: string;
  signatoryPhone: string;
  signatoryEmail: string;
  selectedQuoteIds: string[];
  pricedQuoteIds: string[];
  quoteSettings: Record<string, { type: "conforming" | "non-conforming"; level: string }>;
  selectedTakeoffIds: string[];
  dedupeNotesTerms: boolean;
  exclusionRows: { id: number; label: string; checked: boolean }[];
  customExclusions: { id: number; text: string }[];
};

export async function savePackDraft(projectId: string, draft: PackDraft) {
  const { supabase } = await createAuthedClient();
  const { error } = await supabase
    .from("projects")
    .update({ submission_pack_draft: draft })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
}
