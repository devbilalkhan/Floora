import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { CornerGuardLine } from "@/lib/corner-guard-calc";
import type { WallPanelLine, WeldRodLine } from "@/lib/wall-panel-calc";
import type { RailLine } from "@/lib/rail-calc";
import type { DoorPanelLine } from "@/lib/door-panel-calc";

const RAIL_COLUMNS =
  "id, sort_order, description, length_lm, order_lm, price, install_rate, brackets_qty, bracket_price, screws_qty, screw_price, notes";
import { CornerGuardEditor } from "./corner-guard-editor";

export default async function ProtectionEstimatePage({
  params,
}: {
  params: { orgSlug: string; projectId: string; estimateId: string };
}) {
  const supabase = createClient();

  const [{ data: project }, { data: userRole }, { data: estimate }, { data: lines }, { data: wpLines }, { data: weldRods }, { data: hrLines }, { data: crLines }, { data: dpLines }] =
    await Promise.all([
      supabase.from("projects").select("name").eq("id", params.projectId).single(),
      supabase.rpc("user_project_role", { proj_id: params.projectId }),
      supabase
        .from("protection_estimates")
        .select(
          "id, name, default_price_std, default_price_nib, default_install_rate, default_coving_mm, cutting_enabled, default_cutting_rate, training, accommodation, meals, travel, freight, admin_pct, markup_pct, wp_sheet_width_mm, wp_sheet_length_mm, wp_wastage_pct, wp_default_price, wp_install_rate, wp_glue_rate, wp_cutout_rate, hr_default_price, hr_install_rate, cr_default_price, cr_install_rate"
        )
        .eq("id", params.estimateId)
        .eq("project_id", params.projectId)
        .maybeSingle(),
      supabase
        .from("corner_guard_lines")
        .select(
          "id, sort_order, group_name, description, wall_height_mm, coving_mm, qty_std, qty_nib, price_std, price_nib, install_rate, cutting_enabled, cuts_qty, cutting_rate, notes"
        )
        .eq("estimate_id", params.estimateId)
        .order("sort_order"),
      supabase
        .from("wall_panel_lines")
        .select(
          "id, sort_order, item_code, product, gross_m2, net_m2, sheet_width_mm, sheet_length_mm, sheets_override, wastage_pct, price, install_rate, glue_rate, cutouts_qty, cutout_rate, notes"
        )
        .eq("estimate_id", params.estimateId)
        .order("sort_order"),
      supabase
        .from("wall_panel_weld_rods")
        .select("id, sort_order, description, qty, unit, unit_cost, wastage_pct, labour, notes")
        .eq("estimate_id", params.estimateId)
        .order("sort_order"),
      supabase.from("handrail_lines").select(RAIL_COLUMNS).eq("estimate_id", params.estimateId).order("sort_order"),
      supabase.from("crash_rail_lines").select(RAIL_COLUMNS).eq("estimate_id", params.estimateId).order("sort_order"),
      supabase
        .from("door_panel_lines")
        .select(
          "id, sort_order, item, sheets_qty, price, panels_qty, install_rate, cutting_enabled, cutting_rate, glue_rate, notes"
        )
        .eq("estimate_id", params.estimateId)
        .order("sort_order"),
    ]);

  if (!["admin", "project_manager"].includes(userRole ?? "")) {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }
  if (!project || !estimate) notFound();

  const {
    id,
    name,
    training,
    accommodation,
    meals,
    travel,
    freight,
    admin_pct,
    markup_pct,
    wp_sheet_width_mm,
    wp_sheet_length_mm,
    wp_wastage_pct,
    wp_default_price,
    wp_install_rate,
    wp_glue_rate,
    wp_cutout_rate,
    hr_default_price,
    hr_install_rate,
    cr_default_price,
    cr_install_rate,
    ...defaults
  } = estimate;

  return (
    <div className="w-full py-6 px-8 space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href={`/orgs/${params.orgSlug}/projects`} className="hover:text-foreground transition-colors">
          Projects
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/orgs/${params.orgSlug}/projects/${params.projectId}`}
          className="hover:text-foreground transition-colors"
        >
          {project.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>Wall &amp; Door Protection</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{name}</span>
      </nav>

      <CornerGuardEditor
        estimateId={id}
        projectId={params.projectId}
        orgSlug={params.orgSlug}
        initialName={name}
        initialDefaults={defaults}
        initialCosting={{ training, accommodation, meals, travel, freight, admin_pct, markup_pct }}
        initialLines={(lines ?? []) as CornerGuardLine[]}
        initialWpDefaults={{
          wp_sheet_width_mm,
          wp_sheet_length_mm,
          wp_wastage_pct,
          wp_default_price,
          wp_install_rate,
          wp_glue_rate,
          wp_cutout_rate,
        }}
        initialWpLines={(wpLines ?? []) as WallPanelLine[]}
        initialWeldRods={(weldRods ?? []) as WeldRodLine[]}
        initialHrDefaults={{ default_price: hr_default_price, install_rate: hr_install_rate }}
        initialHrLines={(hrLines ?? []) as RailLine[]}
        initialCrDefaults={{ default_price: cr_default_price, install_rate: cr_install_rate }}
        initialCrLines={(crLines ?? []) as RailLine[]}
        initialDpLines={(dpLines ?? []) as DoorPanelLine[]}
      />
    </div>
  );
}
