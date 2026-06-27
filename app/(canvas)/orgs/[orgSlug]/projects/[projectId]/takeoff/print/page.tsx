import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/takeoff-types";
import type { TakeoffRow } from "@/lib/takeoff-types";
import { PrintControls } from "./print-controls";

function fmt(n: number) {
  return n.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function uLabel(u: string) {
  return u === "m2" ? "m²" : u;
}
function today() {
  return new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Professional monochrome palette — prints cleanly without ink-heavy colour fills
const BRAND = {
  spm: { label: "SPM Flooring" },
  dfo: { label: "DFO Flooring" },
} as const;

const C = {
  headerBg:    "#0f172a", // slate-900  — table column headers
  categoryBg:  "#f1f5f9", // slate-100  — category group row
  categoryText:"#1e293b", // slate-800
  stripe:      "#f8fafc", // slate-50   — alternating data rows
  border:      "#e2e8f0", // slate-200  — all grid lines
  ruleDark:    "#cbd5e1", // slate-300  — section dividers
  textPrimary: "#0f172a", // slate-900
  textSecondary:"#475569",// slate-600
  textMuted:   "#94a3b8", // slate-400
  supplyText:  "#1e40af", // blue-800   — supply quantities (only accent colour)
} as const;

export default async function TakeoffPrintPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string; projectId: string };
  searchParams: { takeoffId?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: project }, { data: profile }, { data: takeoffList }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, brand, location, head_client, notes")
        .eq("id", params.projectId)
        .single(),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single(),
      supabase
        .from("takeoffs")
        .select("id")
        .eq("project_id", params.projectId),
    ]);

  const allTakeoffIds = (takeoffList ?? []).map((t) => t.id as string);
  const takeoffIds = searchParams.takeoffId && allTakeoffIds.includes(searchParams.takeoffId)
    ? [searchParams.takeoffId]
    : allTakeoffIds;

  const { data: rawRows } =
    takeoffIds.length > 0
      ? await supabase
          .from("project_takeoff")
          .select("id, takeoff_id, scope_category, finish_code, description, manufacturer, colour, location, level, product_type, qty, unit, waste_pct, notes, sort_order, parent_finish_code, cove_height_mm")
          .in("takeoff_id", takeoffIds)
          .order("scope_category")
          .order("sort_order")
      : { data: [] };

  if (!project) notFound();

  const rows = (rawRows ?? []) as TakeoffRow[];
  const brand = BRAND[project.brand === "dfo" ? "dfo" : "spm"];

  const grandTotal = rows.reduce(
    (acc, r) => {
      if (r.qty > 0) acc[r.unit] = (acc[r.unit] || 0) + Number(r.qty);
      return acc;
    },
    {} as Record<string, number>
  );

  // Code summary
  const codeMap: Record<
    string,
    {
      finish_code: string;
      description: string | null;
      manufacturer: string | null;
      colour: string | null;
      scope_category: string;
      totals: Record<string, number>;
      supply: Record<string, number>;
      locations: string[];
    }
  > = {};
  rows.forEach((r) => {
    if (!r.finish_code) return;
    if (!codeMap[r.finish_code]) {
      codeMap[r.finish_code] = {
        finish_code: r.finish_code,
        description: r.description,
        manufacturer: r.manufacturer,
        colour: r.colour,
        scope_category: r.scope_category,
        totals: {},
        supply: {},
        locations: [],
      };
    }
    const e = codeMap[r.finish_code];
    if (r.qty > 0) {
      e.totals[r.unit] = (e.totals[r.unit] || 0) + Number(r.qty);
      e.supply[r.unit] = (e.supply[r.unit] || 0) + Number(r.qty) * (1 + r.waste_pct / 100);
    }
    if (r.location && !e.locations.includes(r.location))
      e.locations.push(r.location);
  });
  const codeSummary = Object.values(codeMap).sort((a, b) =>
    a.finish_code.localeCompare(b.finish_code)
  );

  const backHref = `/orgs/${params.orgSlug}/projects/${params.projectId}/takeoff`;
  const pdfHref = `/api/takeoff-pdf?projectId=${params.projectId}&orgSlug=${params.orgSlug}`;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { size: A4 landscape; margin: 10mm 12mm; }
            @media print {
              html, body { background: white !important; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            @media screen {
              html, body { background: #d1d5db; }
            }
          `,
        }}
      />

      <div className="print:contents min-h-screen py-8 px-4">

        {/* Controls — screen only */}
        <div className="print:hidden max-w-[1050px] mx-auto mb-4">
          <PrintControls backHref={backHref} pdfHref={pdfHref} />
        </div>

        {/* Document */}
        <div className="bg-white mx-auto max-w-[1050px] shadow-xl print:shadow-none print:max-w-none overflow-hidden">

          {/* ── Top rule ── */}
          <div style={{ height: 4, background: C.headerBg }} />

          {/* ── Header ── */}
          <div className="px-8 py-5 flex items-start justify-between gap-6" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div
                className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2"
                style={{ color: C.textMuted }}
              >
                {brand.label} · Quantity Takeoff
              </div>
              <div className="text-lg font-bold uppercase tracking-wide" style={{ color: C.textPrimary }}>
                {project.name}
              </div>
              {project.location && (
                <div className="text-xs mt-0.5" style={{ color: C.textSecondary }}>{project.location}</div>
              )}
              {project.head_client && (
                <div className="text-xs" style={{ color: C.textSecondary }}>
                  Client: {project.head_client}
                </div>
              )}
            </div>
            <div
              className="text-right text-[11px] shrink-0 space-y-0.5 pt-1 pl-6 border-l"
              style={{ borderColor: C.border, color: C.textSecondary }}
            >
              <div>
                <span className="font-semibold" style={{ color: C.textPrimary }}>Date: </span>
                {today()}
              </div>
              <div>
                <span className="font-semibold" style={{ color: C.textPrimary }}>Prepared by: </span>
                {profile?.display_name ?? user.email}
              </div>
              <div>
                <span className="font-semibold" style={{ color: C.textPrimary }}>Status: </span>
                Preliminary
              </div>
              <div className="mt-2 pt-1.5 border-t" style={{ borderColor: C.border }}>
                <span className="font-semibold" style={{ color: C.textPrimary }}>Total rows: </span>
                {rows.length}
              </div>
            </div>
          </div>

          {/* ── Takeoff table ── */}
          <div className="px-8 pt-4 pb-2">
            <table className="w-full border-collapse text-[11px]">
              <colgroup>
                <col style={{ width: 22 }} />
                <col style={{ width: 56 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 32 }} />
                <col style={{ width: 52 }} />
                <col style={{ width: 28 }} />
                <col style={{ width: 62 }} />
                <col style={{ width: 200 }} />
              </colgroup>
              <thead>
                <tr>
                  {[
                    ["#",            "text-center"],
                    ["Code",         "text-left"],
                    ["Description",  "text-left"],
                    ["Manufacturer", "text-left"],
                    ["Colour",       "text-left"],
                    ["Location",     "text-left"],
                    ["Lvl",          "text-center"],
                    ["Qty",          "text-right"],
                    ["Unit",         "text-left"],
                    ["Wastage",      "text-right"],
                    ["Notes / Ref",  "text-left"],
                  ].map(([label, align], i) => (
                    <th
                      key={i}
                      className={`px-1.5 py-1.5 font-semibold text-[10px] uppercase tracking-wide border-r last:border-r-0 ${align}`}
                      style={{ background: C.headerBg, color: "#ffffff", borderColor: "#334155" }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((cat) => {
                  const catRows = rows
                    .filter((r) => r.scope_category === cat.key)
                    .sort((a, b) => a.sort_order - b.sort_order);
                  if (catRows.length === 0) return null;

                  const catTotals = catRows.reduce(
                    (acc, r) => {
                      if (r.qty > 0)
                        acc[r.unit] = (acc[r.unit] || 0) + Number(r.qty);
                      return acc;
                    },
                    {} as Record<string, number>
                  );

                  return (
                    <>
                      <tr key={`hdr-${cat.key}`} style={{ borderTop: `1px solid ${C.ruleDark}`, borderBottom: `1px solid ${C.border}` }}>
                        <td
                          colSpan={11}
                          className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                          style={{ background: C.categoryBg, color: C.categoryText, borderLeft: `3px solid ${C.ruleDark}` }}
                        >
                          <div className="flex items-center justify-between">
                            <span>{cat.label}</span>
                            <span className="font-normal normal-case tracking-normal" style={{ color: C.textSecondary }}>
                              {Object.entries(catTotals)
                                .map(([u, t]) => `${fmt(t)} ${uLabel(u)}`)
                                .join(" · ")}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {catRows.map((row, i) => (
                        <tr
                          key={row.id}
                          style={{ background: i % 2 === 0 ? "#ffffff" : C.stripe, borderBottom: `1px solid ${C.border}` }}
                        >
                          <td className="px-1.5 py-0.5 text-center tabular-nums border-r" style={{ color: C.textMuted, borderColor: C.border }}>
                            {i + 1}
                          </td>
                          <td className="px-1.5 py-0.5 font-mono font-semibold border-r" style={{ color: C.textPrimary, borderColor: C.border }}>
                            {row.finish_code ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 border-r" style={{ color: C.textPrimary, borderColor: C.border }}>
                            {row.description ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 border-r" style={{ color: C.textSecondary, borderColor: C.border }}>
                            {row.manufacturer ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 border-r" style={{ color: C.textSecondary, borderColor: C.border }}>
                            {row.colour ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 border-r" style={{ color: C.textSecondary, borderColor: C.border }}>
                            {row.location ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 text-center border-r" style={{ color: C.textSecondary, borderColor: C.border }}>
                            {row.level ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 text-right font-semibold tabular-nums border-r" style={{ color: C.textPrimary, borderColor: C.border }}>
                            {row.qty > 0 ? fmt(row.qty) : ""}
                          </td>
                          <td className="px-1.5 py-0.5 border-r" style={{ color: C.textSecondary, borderColor: C.border }}>
                            {uLabel(row.unit)}
                          </td>
                          <td className="px-1.5 py-0.5 text-right tabular-nums font-semibold border-r" style={{ color: C.supplyText, borderColor: C.border }}>
                            {row.qty > 0 ? fmt(row.qty * (1 + (row.waste_pct ?? 10) / 100)) : ""}
                          </td>
                          <td className="px-1.5 py-0.5" style={{ color: C.textMuted }}>
                            {row.notes ?? ""}
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>

            {/* Grand total */}
            <div className="mt-2 pt-2 flex items-center gap-8 justify-end" style={{ borderTop: `2px solid ${C.ruleDark}` }}>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.textSecondary }}>
                Grand Total
              </span>
              {Object.entries(grandTotal).map(([unit, total]) => (
                <div key={unit} className="text-[12px]">
                  <span className="font-bold tabular-nums" style={{ color: C.textPrimary }}>{fmt(total)}</span>{" "}
                  <span style={{ color: C.textSecondary }}>{uLabel(unit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Code Summary ── */}
          {codeSummary.length > 0 && (
            <div className="px-8 pb-6 pt-3">
              <div className="pt-3 mb-3 flex items-baseline justify-between" style={{ borderTop: `1px solid ${C.ruleDark}` }}>
                <div className="text-[12px] font-bold uppercase tracking-widest" style={{ color: C.textSecondary }}>
                  Code Summary
                </div>
                <div className="text-[10px]" style={{ color: C.textMuted }}>
                  Consolidated quantities by finish code — for estimate costing
                </div>
              </div>
              <table className="w-full border-collapse text-[11px]">
                <colgroup>
                  <col style={{ width: 50 }} />
                  <col style={{ width: 82 }} />
                  <col />
                  <col style={{ width: 108 }} />
                  <col style={{ width: 78 }} />
                  <col style={{ width: 50 }} />
                  <col style={{ width: 54 }} />
                  <col style={{ width: 46 }} />
                  <col style={{ width: 50 }} />
                  <col style={{ width: 46 }} />
                  <col style={{ width: 50 }} />
                  <col style={{ width: 34 }} />
                  <col style={{ width: 38 }} />
                </colgroup>
                <thead>
                  <tr>
                    {[
                      ["Code",        "text-left"],
                      ["Category",    "text-left"],
                      ["Description", "text-left"],
                      ["Manufacturer","text-left"],
                      ["Colour",      "text-left"],
                      ["Net m²",      "text-right"],
                      ["Supply m²",   "text-right"],
                      ["Net lm",      "text-right"],
                      ["Supply lm",   "text-right"],
                      ["Net blm",     "text-right"],
                      ["Supply blm",  "text-right"],
                      ["ea",          "text-right"],
                      ["Locs",        "text-right"],
                    ].map(([label, align], i) => (
                      <th
                        key={i}
                        className={`px-1.5 py-1.5 font-semibold text-[10px] uppercase tracking-wide border-r last:border-r-0 ${align}`}
                        style={{ background: C.headerBg, color: "#ffffff", borderColor: "#334155" }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {codeSummary.map((entry, i) => {
                    const catLabel =
                      CATEGORIES.find((c) => c.key === entry.scope_category)
                        ?.label ?? entry.scope_category;
                    return (
                      <tr
                        key={entry.finish_code}
                        style={{ background: i % 2 === 0 ? "#ffffff" : C.stripe, borderBottom: `1px solid ${C.border}` }}
                      >
                        <td className="px-1.5 py-0.5 font-mono font-semibold border-r" style={{ color: C.textPrimary, borderColor: C.border }}>
                          {entry.finish_code}
                        </td>
                        <td className="px-1.5 py-0.5 border-r" style={{ color: C.textSecondary, borderColor: C.border }}>
                          {catLabel}
                        </td>
                        <td className="px-1.5 py-0.5 border-r" style={{ color: C.textPrimary, borderColor: C.border }}>
                          {entry.description ?? ""}
                        </td>
                        <td className="px-1.5 py-0.5 border-r" style={{ color: C.textSecondary, borderColor: C.border }}>
                          {entry.manufacturer ?? ""}
                        </td>
                        <td className="px-1.5 py-0.5 border-r" style={{ color: C.textSecondary, borderColor: C.border }}>
                          {entry.colour ?? ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums border-r" style={{ color: C.textMuted, borderColor: C.border }}>
                          {entry.totals["m2"] ? fmt(entry.totals["m2"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums font-semibold border-r" style={{ color: C.supplyText, borderColor: C.border }}>
                          {entry.supply["m2"] ? fmt(entry.supply["m2"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums border-r" style={{ color: C.textMuted, borderColor: C.border }}>
                          {entry.totals["lm"] ? fmt(entry.totals["lm"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums font-semibold border-r" style={{ color: C.supplyText, borderColor: C.border }}>
                          {entry.supply["lm"] ? fmt(entry.supply["lm"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums border-r" style={{ color: C.textMuted, borderColor: C.border }}>
                          {entry.totals["blm"] ? fmt(entry.totals["blm"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums font-semibold border-r" style={{ color: C.supplyText, borderColor: C.border }}>
                          {entry.supply["blm"] ? fmt(entry.supply["blm"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums border-r" style={{ color: C.textPrimary, borderColor: C.border }}>
                          {entry.totals["ea"] ? String(entry.totals["ea"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums" style={{ color: C.textSecondary }}>
                          {entry.locations.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Footer ── */}
          <div
            className="px-8 py-2 flex items-center justify-between text-[9px]"
            style={{ borderTop: `1px solid ${C.border}`, color: C.textMuted }}
          >
            <span>{brand.label} · Quantity Takeoff · {project.name}</span>
            <span>Generated {today()} · Preliminary — not for construction</span>
          </div>
        </div>
      </div>
    </>
  );
}
