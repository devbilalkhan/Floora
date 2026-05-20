"use server";

import { createAuthedClient } from "@/lib/supabase/server";
import {
  DEFAULT_HRCW,
  DEFAULT_HAZARDS,
  DEFAULT_EMERGENCY_PROCEDURES,
  DEFAULT_EMERGENCY_CONTACTS,
  DEFAULT_S4,
} from "@/lib/swms-types";
import type { SwmsData } from "@/lib/swms-types";

function deriveProjectCode(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 6);
}

export async function createSwms(
  estimateId: string,
  orgId: string,
  seed: {
    projectName: string;
    projectLocation: string | null;
    estimateName: string;
    orgCode: string | null;
    orgSlug: string;
  }
) {
  const { supabase } = await createAuthedClient();

  const orgCode = (seed.orgCode || seed.orgSlug).toUpperCase();
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const pc = deriveProjectCode(seed.projectName);
  const docNumber = `${orgCode}-SWMS-${ym}-${pc}-FLR-v1`;

  const location = [seed.projectName, seed.projectLocation].filter(Boolean).join(" — ");

  const { data, error } = await supabase
    .from("swms")
    .insert({
      estimate_id: estimateId,
      org_id: orgId,
      document_number: docNumber,
      s1_workplace_location: location || null,
      s1_project_reference: seed.estimateName,
      s1_compliance_measures:
        "• On-site supervision by SPM Site Supervisor at all times during HRCW activities.\n• Daily pre-start toolbox referencing this SWMS and the day's hazards.\n• Worker sign-on register kept on site (Section 8).\n• Re-briefing required if scope, plant, products, or personnel change.",
      s1_review_triggers:
        "• On change to work activity, plant, products, materials or work environment.\n• On any notifiable incident or near miss; or where a control is found ineffective.\n• On reasonable request by PC, regulator or workers; otherwise scheduled annually.",
      s2_hrcw: DEFAULT_HRCW,
      s3_persons: [],
      s4_project: seed.projectName,
      s4_activity_description: DEFAULT_S4.activity_description,
      s4_plant_equipment: DEFAULT_S4.plant_equipment,
      s4_materials: DEFAULT_S4.materials,
      s4_ppe: DEFAULT_S4.ppe,
      s4_training: DEFAULT_S4.training,
      s4_permits: DEFAULT_S4.permits,
      s4_maintenance: DEFAULT_S4.maintenance,
      s4_legislation: DEFAULT_S4.legislation,
      s4_codes: DEFAULT_S4.codes,
      s4_standards: DEFAULT_S4.standards,
      s6_hazards: DEFAULT_HAZARDS,
      s7_procedures: DEFAULT_EMERGENCY_PROCEDURES,
      s7_contacts: DEFAULT_EMERGENCY_CONTACTS,
      s8_workers: [],
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SwmsData;
}

export async function updateSwms(id: string, patch: Partial<SwmsData>) {
  const { supabase } = await createAuthedClient();

  // Strip read-only fields before updating
  const { id: _id, estimate_id: _eid, org_id: _oid, created_at: _ca, updated_at: _ua, ...rest } = patch as Record<string, unknown>;
  void _id; void _eid; void _oid; void _ca; void _ua;

  const { error } = await supabase.from("swms").update(rest).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function publishSwmsVersion(id: string, currentVersion: number) {
  const { supabase } = await createAuthedClient();

  // Re-read current document_number to bump version suffix
  const { data: current } = await supabase
    .from("swms")
    .select("document_number")
    .eq("id", id)
    .single();

  const newVersion = currentVersion + 1;
  const docNumber = current?.document_number
    ? current.document_number.replace(/-v\d+$/, `-v${newVersion}`)
    : null;

  const { error } = await supabase
    .from("swms")
    .update({ version: newVersion, document_number: docNumber, status: "approved" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  return { version: newVersion, document_number: docNumber };
}
