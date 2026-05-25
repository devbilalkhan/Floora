import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { EstimateItem } from "@/lib/estimate-types";
import { itemMatQty } from "@/lib/estimate-types";
import { CATEGORIES } from "@/lib/takeoff-types";
import { PrintButton } from "./print-button";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const uLabel = (u: string) => (u === "m2" ? "m²" : u);

// Known consolidated consumable descriptions
const D = {
  VINYL_GLUE:   "Glue Sheet/Plank",
  CARPET_GLUE:  "Glue Carpet",
  FEATHER:      "Feather Finish 20kg",
  CONTACT:      "Contact Brushable (Max Bond 102)",
  FILLET:       "Cove Fillet",
  WELD_ROD:     "Weld Rod",
} as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-sm overflow-hidden bg-card/65 backdrop-blur-xl">
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
        <div className="w-0.5 h-3.5 rounded-full bg-primary/60" />
        <h2 className="text-[11px] font-bold text-foreground/80 uppercase tracking-widest">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-r border-border last:border-r-0 ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  mono,
}: {
  children?: React.ReactNode;
  right?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 text-xs border-r border-border last:border-r-0 text-foreground ${right ? "text-right tabular-nums" : "text-left"} ${mono ? "font-mono uppercase tracking-wide" : ""}`}
    >
      {children}
    </td>
  );
}

type ConsolidatedRow = {
  description: string;
  qty: number;
  unit: string;
  rate: number;
  note?: string;
};

function ConsolidatedTable({ rows }: { rows: ConsolidatedRow[] }) {
  return (
    <table className="w-full text-xs">
      <colgroup>
        <col />
        <col className="w-24" />
        <col className="w-16" />
        <col className="w-24" />
        <col className="w-28" />
        <col className="w-48" />
      </colgroup>
      <thead>
        <tr className="border-b border-border bg-muted/10">
          <Th>Material</Th>
          <Th right>Qty</Th>
          <Th>Unit</Th>
          <Th right>Rate ($/u)</Th>
          <Th right>Total</Th>
          <Th>Note</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={row.description} className="hover:bg-muted/10">
            <Td>{row.description}</Td>
            <Td right>{fmt(row.qty)}</Td>
            <Td>{row.unit}</Td>
            <Td right>{row.rate > 0 ? `$${fmt(row.rate)}` : "—"}</Td>
            <Td right>{row.rate > 0 ? `$${fmt(row.qty * row.rate)}` : "—"}</Td>
            <Td>{row.note ?? ""}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MaterialsPage({
  params,
}: {
  params: { orgSlug: string; projectId: string; estimateId: string };
}) {
  const supabase = createClient();

  const { data: userRole } = await supabase.rpc("user_project_role", { proj_id: params.projectId });
  if (userRole === "viewer" || !userRole) {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }

  const [{ data: estimate }, { data: rawItems }, { data: project }] = await Promise.all([
    supabase.from("estimates").select("name, description").eq("id", params.estimateId).single(),
    supabase
      .from("estimate_items")
      .select("id, estimate_id, parent_item_id, sort_order, type, scope_category, finish_code, description, qty, unit, waste_pct, cov_lm, cov_area, cov_height_mm, mat_rate, lab_rate, coverage_m2, is_auto, manufacturer, level, product_type")
      .eq("estimate_id", params.estimateId)
      .order("sort_order"),
    supabase.from("projects").select("id, name").eq("id", params.projectId).single(),
  ]);

  if (!estimate || !project) notFound();

  const items = (rawItems ?? []) as EstimateItem[];
  const primaries = items.filter((i) => i.type === "primary");
  const consumables = items.filter((i) => i.type === "consumable");

  const primaryById = new Map(primaries.map((p) => [p.id, p]));

  // Sum qty for a given description across all consumables
  const sumQty = (desc: string) =>
    consumables.filter((c) => c.description === desc).reduce((s, c) => s + c.qty, 0);

  // First mat_rate found for a description (rates are standardised per consumable type)
  const firstRate = (desc: string) =>
    consumables.find((c) => c.description === desc)?.mat_rate ?? 0;

  // ── Consolidated consumable totals ────────────────────────────────────────
  const vinylGlueQty   = sumQty(D.VINYL_GLUE);
  const carpetGlueQty  = sumQty(D.CARPET_GLUE);
  const featherQty     = sumQty(D.FEATHER);
  const contactQty     = sumQty(D.CONTACT);
  const filletQty      = sumQty(D.FILLET);

  // ── Weld rod — one entry per vinyl primary ────────────────────────────────
  const weldRods = consumables
    .filter((c) => c.description === D.WELD_ROD && c.qty > 0)
    .map((c) => ({
      qty:    c.qty,
      rate:   c.mat_rate,
      parent: c.parent_item_id ? primaryById.get(c.parent_item_id) : undefined,
    }));

  // ── Primaries grouped by category ─────────────────────────────────────────
  const groupedPrimaries = CATEGORIES.map((cat) => ({
    cat,
    rows: primaries
      .filter((p) => p.scope_category === cat.key)
      .sort((a, b) => a.sort_order - b.sort_order),
  })).filter((g) => g.rows.length > 0);

  const covingRows: ConsolidatedRow[] = [
    ...(contactQty > 0
      ? [{ description: D.CONTACT, qty: contactQty, unit: "drum", rate: firstRate(D.CONTACT), note: "All sheets — consolidated" }]
      : []),
    ...(filletQty > 0
      ? [{ description: D.FILLET, qty: filletQty, unit: "coil", rate: firstRate(D.FILLET), note: "All sheets — consolidated" }]
      : []),
  ];

  const adhesiveRows: ConsolidatedRow[] = [
    ...(vinylGlueQty > 0
      ? [{ description: D.VINYL_GLUE, qty: vinylGlueQty, unit: "drum", rate: firstRate(D.VINYL_GLUE), note: "Vinyl & wall vinyl — consolidated" }]
      : []),
    ...(carpetGlueQty > 0
      ? [{ description: D.CARPET_GLUE, qty: carpetGlueQty, unit: "drum", rate: firstRate(D.CARPET_GLUE), note: "All carpet — consolidated" }]
      : []),
    ...(featherQty > 0
      ? [{ description: D.FEATHER, qty: featherQty, unit: "bag", rate: firstRate(D.FEATHER) }]
      : []),
  ];

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-5 print:py-4 print:px-0 print:space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground print:hidden">
        <Link
          href={`/orgs/${params.orgSlug}/projects`}
          className="hover:text-foreground transition-colors"
        >
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
        <Link
          href={`/orgs/${params.orgSlug}/projects/${params.projectId}/estimates/${params.estimateId}/costing`}
          className="hover:text-foreground transition-colors"
        >
          {estimate.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Material Schedule</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold">{estimate.name} — Material Schedule</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{project.name}</p>
        </div>
        <PrintButton />
      </div>

      {/* ── Floor Coverings ─────────────────────────────────────────────────── */}
      {groupedPrimaries.length > 0 && (
        <Section title="Floor Coverings">
          {groupedPrimaries.map(({ cat, rows }) => (
            <div key={cat.key}>
              <div className="px-4 py-1.5 bg-muted/20 border-b border-border">
                <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                  {cat.label}
                </span>
              </div>
              <table className="w-full text-xs border-b border-border">
                <colgroup>
                  <col className="w-20" />
                  <col className="w-28" />
                  <col />
                  <col className="w-28" />
                  <col className="w-14" />
                  <col className="w-24" />
                  <col className="w-28" />
                </colgroup>
                <thead>
                  <tr className="bg-muted/10 border-b border-border">
                    <Th>Code</Th>
                    <Th>Manufacturer</Th>
                    <Th>Description</Th>
                    <Th right>Purchase Qty</Th>
                    <Th>Unit</Th>
                    <Th right>Mat $/u</Th>
                    <Th right>Mat Total</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((item) => {
                    const purchaseQty = itemMatQty(item);
                    const matTotal = purchaseQty * item.mat_rate;
                    return (
                      <tr key={item.id} className="hover:bg-muted/10">
                        <Td mono>{item.finish_code ?? "—"}</Td>
                        <Td>{item.manufacturer ?? "—"}</Td>
                        <Td>{item.description ?? "—"}</Td>
                        <Td right>{purchaseQty > 0 ? fmt(purchaseQty) : "—"}</Td>
                        <Td>{uLabel(item.unit)}</Td>
                        <Td right>{item.mat_rate > 0 ? `$${fmt(item.mat_rate)}` : "—"}</Td>
                        <Td right>{item.mat_rate > 0 && purchaseQty > 0 ? `$${fmt(matTotal)}` : "—"}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </Section>
      )}

      {/* ── Adhesives & Preparation ─────────────────────────────────────────── */}
      {adhesiveRows.length > 0 && (
        <Section title="Adhesives & Preparation">
          <ConsolidatedTable rows={adhesiveRows} />
        </Section>
      )}

      {/* ── Coving Materials ────────────────────────────────────────────────── */}
      {covingRows.length > 0 && (
        <Section title="Coving Materials">
          <ConsolidatedTable rows={covingRows} />
        </Section>
      )}

      {/* ── Weld Rod (per vinyl) ────────────────────────────────────────────── */}
      {weldRods.length > 0 && (
        <Section title="Weld Rod">
          <table className="w-full text-xs">
            <colgroup>
              <col className="w-20" />
              <col className="w-28" />
              <col />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <Th>Code</Th>
                <Th>Manufacturer</Th>
                <Th>Vinyl Product</Th>
                <Th right>Qty (lm)</Th>
                <Th right>Rate</Th>
                <Th right>Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {weldRods.map((wr, i) => (
                <tr key={i} className="hover:bg-muted/10">
                  <Td mono>{wr.parent?.finish_code ?? "—"}</Td>
                  <Td>{wr.parent?.manufacturer ?? "—"}</Td>
                  <Td>{wr.parent?.description ?? "—"}</Td>
                  <Td right>{fmt(wr.qty)}</Td>
                  <Td right>{wr.rate > 0 ? `$${fmt(wr.rate)}` : "—"}</Td>
                  <Td right>{wr.rate > 0 ? `$${fmt(wr.qty * wr.rate)}` : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {items.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-xl flex items-center justify-center h-40">
          <p className="text-sm text-muted-foreground">No items in this estimate yet.</p>
        </div>
      )}
    </div>
  );
}
