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

// Brand colour palettes — all hardcoded hex for reliable print rendering
const BRAND = {
  spm: {
    accent:      "#7c3aed", // violet-600 — used sparingly for borders/text only
    accentDark:  "#4c1d95", // violet-900 — headings, labels
    accentLight: "#f5f3ff", // violet-50  — very pale tint for backgrounds
    accentBorder:"#ddd6fe", // violet-200 — borders, stripes
    accentMuted: "#6d28d9", // violet-700 — subtle text emphasis
    label:       "SPM Flooring",
  },
  dfo: {
    accent:      "#db2777", // pink-600 — used sparingly
    accentDark:  "#831843", // pink-900 — headings, labels
    accentLight: "#fdf4ff", // pink-50
    accentBorder:"#fbcfe8", // pink-200
    accentMuted: "#be185d", // pink-700
    label:       "DFO Flooring",
  },
} as const;

export default async function TakeoffPrintPage({
  params,
}: {
  params: { orgSlug: string; projectId: string };
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

  const takeoffIds = (takeoffList ?? []).map((t) => t.id as string);
  const { data: rawRows } =
    takeoffIds.length > 0
      ? await supabase
          .from("project_takeoff")
          .select("*")
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
          <PrintControls backHref={backHref} />
        </div>

        {/* Document */}
        <div className="bg-white mx-auto max-w-[1050px] shadow-xl print:shadow-none print:max-w-none overflow-hidden">

          {/* ── Accent top stripe — thin pastel band ── */}
          <div style={{ height: 4, background: brand.accentBorder }} />

          {/* ── Header ── */}
          <div className="px-8 py-5 flex items-start justify-between gap-6" style={{ borderBottom: `1px solid ${brand.accentBorder}` }}>
            <div>
              {/* Brand pill */}
              <span
                className="inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2"
                style={{ background: brand.accentLight, color: brand.accent }}
              >
                {brand.label}
              </span>
              <div className="text-lg font-bold uppercase tracking-wide text-gray-900">
                Quantity Takeoff
              </div>
              <div className="text-base font-semibold mt-0.5 text-gray-800">{project.name}</div>
              {project.location && (
                <div className="text-xs text-gray-500 mt-0.5">{project.location}</div>
              )}
              {project.head_client && (
                <div className="text-xs text-gray-500">
                  Client: {project.head_client}
                </div>
              )}
            </div>
            <div
              className="text-right text-[11px] shrink-0 space-y-0.5 pt-1 pl-6 border-l"
              style={{ borderColor: brand.accentBorder, color: "#6b7280" }}
            >
              <div>
                <span className="font-semibold text-gray-700">Date:</span>{" "}
                {today()}
              </div>
              <div>
                <span className="font-semibold text-gray-700">Prepared by:</span>{" "}
                {profile?.display_name ?? user.email}
              </div>
              <div>
                <span className="font-semibold text-gray-700">Status:</span>{" "}
                <span style={{ color: brand.accent }} className="font-medium">Preliminary</span>
              </div>
              <div className="mt-2 pt-1.5 border-t border-gray-200">
                <span className="font-semibold text-gray-700">Total rows:</span>{" "}
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
                <col />
                <col style={{ width: 118 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 32 }} />
                <col style={{ width: 48 }} />
                <col style={{ width: 28 }} />
                <col style={{ width: 34 }} />
                <col style={{ width: 96 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: `1px solid ${brand.accentBorder}` }}>
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
                    ["Wastage",       "text-right"],
                    ["Notes / Ref",  "text-left"],
                  ].map(([label, align], i) => (
                    <th
                      key={i}
                      className={`px-1.5 py-1.5 font-semibold text-gray-600 text-[10px] uppercase tracking-wide border-r border-gray-200 last:border-r-0 ${align}`}
                      style={{ background: brand.accentLight }}
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
                      <tr key={`hdr-${cat.key}`}>
                        <td
                          colSpan={11}
                          className="px-2 py-0.5 font-semibold text-[10px] uppercase tracking-widest"
                          style={{ background: brand.accentLight, color: brand.accentDark, borderLeft: `3px solid ${brand.accentBorder}` }}
                        >
                          <div className="flex items-center justify-between">
                            <span>{cat.label}</span>
                            <span className="font-normal normal-case tracking-normal text-gray-500">
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
                          className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          <td className="px-1.5 py-0.5 text-center text-gray-400 border-r border-gray-200">
                            {i + 1}
                          </td>
                          <td className="px-1.5 py-0.5 font-mono font-semibold text-gray-800 border-r border-gray-200">
                            {row.finish_code ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 border-r border-gray-200 text-gray-800">
                            {row.description ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 text-gray-500 border-r border-gray-200">
                            {row.manufacturer ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 text-gray-500 border-r border-gray-200">
                            {row.colour ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 border-r border-gray-200 text-gray-700">
                            {row.location ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 text-center text-gray-500 border-r border-gray-200">
                            {row.level ?? ""}
                          </td>
                          <td className="px-1.5 py-0.5 text-right font-semibold tabular-nums border-r border-gray-200 text-gray-800">
                            {row.qty > 0 ? fmt(row.qty) : ""}
                          </td>
                          <td className="px-1.5 py-0.5 text-gray-500 border-r border-gray-200">
                            {uLabel(row.unit)}
                          </td>
                          <td className="px-1.5 py-0.5 text-right tabular-nums text-gray-400 border-r border-gray-200">
                            {row.qty > 0 ? fmt(row.qty * (1 + (row.waste_pct ?? 10) / 100)) : ""}
                          </td>
                          <td className="px-1.5 py-0.5 text-gray-400">
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
            <div className="mt-2 pt-2 flex items-center gap-8 justify-end" style={{ borderTop: `1px solid ${brand.accentBorder}` }}>
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-700">
                Grand Total
              </span>
              {Object.entries(grandTotal).map(([unit, total]) => (
                <div key={unit} className="text-[12px]">
                  <span className="font-bold tabular-nums text-gray-900">{fmt(total)}</span>{" "}
                  <span className="text-gray-500">{uLabel(unit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Code Summary ── */}
          {codeSummary.length > 0 && (
            <div className="px-8 pb-6 pt-3">
              <div className="pt-3 mb-3 flex items-baseline justify-between border-t border-gray-200">
                <div className="text-[12px] font-bold uppercase tracking-wide text-gray-700">
                  Code Summary
                </div>
                <div className="text-[10px] text-gray-400">
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
                  <tr style={{ borderBottom: `1px solid ${brand.accentBorder}` }}>
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
                        className={`px-1.5 py-1.5 font-semibold text-gray-600 text-[10px] uppercase tracking-wide border-r border-gray-200 last:border-r-0 ${align}`}
                        style={{ background: brand.accentLight }}
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
                        className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="px-1.5 py-0.5 font-mono font-semibold text-gray-800 border-r border-gray-200">
                          {entry.finish_code}
                        </td>
                        <td className="px-1.5 py-0.5 text-gray-500 border-r border-gray-200">
                          {catLabel}
                        </td>
                        <td className="px-1.5 py-0.5 text-gray-800 border-r border-gray-200">
                          {entry.description ?? ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-gray-500 border-r border-gray-200">
                          {entry.manufacturer ?? ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-gray-500 border-r border-gray-200">
                          {entry.colour ?? ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums text-gray-400 border-r border-gray-200">
                          {entry.totals["m2"] ? fmt(entry.totals["m2"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums font-semibold text-gray-800 border-r border-gray-200">
                          {entry.supply["m2"] ? fmt(entry.supply["m2"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums text-gray-400 border-r border-gray-200">
                          {entry.totals["lm"] ? fmt(entry.totals["lm"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums font-semibold text-gray-800 border-r border-gray-200">
                          {entry.supply["lm"] ? fmt(entry.supply["lm"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums text-gray-400 border-r border-gray-200">
                          {entry.totals["blm"] ? fmt(entry.totals["blm"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums font-semibold text-gray-800 border-r border-gray-200">
                          {entry.supply["blm"] ? fmt(entry.supply["blm"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums text-gray-800 border-r border-gray-200">
                          {entry.totals["ea"] ? String(entry.totals["ea"]) : ""}
                        </td>
                        <td className="px-1.5 py-0.5 text-right tabular-nums text-gray-500">
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
            className="px-8 py-2 flex items-center justify-between text-[9px] text-gray-400"
            style={{ borderTop: `1px solid ${brand.accentBorder}` }}
          >
            <span>
              {brand.label} · Quantity Takeoff · {project.name}
            </span>
            <span>
              Generated {today()} · Preliminary — not for construction
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
