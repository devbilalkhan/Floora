import { Fragment } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActualsPrintToolbar } from "@/components/report/actuals-print-toolbar";

type Group = {
  id: string;
  type: "income" | "expense";
  name: string;
  sort_order: number;
  notes: string | null;
};

type LineItem = {
  id: string;
  group_id: string;
  sort_order: number;
  invoice_date: string | null;
  invoice_number: string | null;
  supplier: string | null;
  description: string;
  qty: number | null;
  unit_price: number | null;
  subtotal: number;
  retention_applied: boolean;
  included_in_totals: boolean;
};

function fmt(n: number) {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtQty(n: number | null) {
  if (n == null) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

// Invoices are ordered alphabetically by supplier name (blank suppliers last);
// ties broken by original insertion order.
function compareInvoiceBuckets(a: LineItem[], b: LineItem[]): number {
  const supplierA = a[0]?.supplier?.trim() || "";
  const supplierB = b[0]?.supplier?.trim() || "";
  if (supplierA && !supplierB) return -1;
  if (!supplierA && supplierB) return 1;
  const cmp = supplierA.localeCompare(supplierB, undefined, { sensitivity: "base" });
  if (cmp !== 0) return cmp;
  return Math.min(...a.map((x) => x.sort_order)) - Math.min(...b.map((x) => x.sort_order));
}

function bucketItems(items: LineItem[]) {
  const invoiceBuckets = new Map<string, LineItem[]>();
  const ungrouped: LineItem[] = [];
  for (const item of items) {
    if (item.invoice_number) {
      const bucket = invoiceBuckets.get(item.invoice_number) ?? [];
      bucket.push(item);
      invoiceBuckets.set(item.invoice_number, bucket);
    } else {
      ungrouped.push(item);
    }
  }
  const orderedBuckets = Array.from(invoiceBuckets.entries()).sort(
    ([, a], [, b]) => compareInvoiceBuckets(a, b)
  );
  return { orderedBuckets, ungrouped };
}

export default async function ActualsReportPage({
  params,
}: {
  params: { orgSlug: string; projectId: string };
}) {
  const supabase = createClient();

  const [{ data: project }, { data: org }, { data: groups }, { data: lineItems }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("name, retention_pct, retention_released, admin_fee_pct, admin_fee_estimated_cost")
        .eq("id", params.projectId)
        .single(),
      supabase
        .from("organizations")
        .select("name, logo_url")
        .eq("slug", params.orgSlug)
        .single(),
      supabase
        .from("actual_groups")
        .select("id, type, name, sort_order, notes")
        .eq("project_id", params.projectId)
        .order("sort_order"),
      supabase
        .from("actual_line_items")
        .select(
          "id, group_id, sort_order, invoice_date, invoice_number, supplier, description, qty, unit_price, subtotal, retention_applied, included_in_totals"
        )
        .eq("project_id", params.projectId)
        .order("sort_order"),
    ]);

  if (!project) notFound();

  const allGroups = (groups ?? []) as Group[];
  const allLineItems = (lineItems ?? []) as LineItem[];

  const incomeGroups = allGroups.filter((g) => g.type === "income");
  const expenseGroups = allGroups.filter((g) => g.type === "expense");

  const groupItems = (gId: string) => allLineItems.filter((i) => i.group_id === gId);
  const groupTotal = (gId: string) =>
    groupItems(gId).filter((i) => i.included_in_totals).reduce((s, i) => s + Number(i.subtotal), 0);
  const sectionTotal = (gs: Group[]) => gs.reduce((s, g) => s + groupTotal(g.id), 0);

  const totalIncome = sectionTotal(incomeGroups);
  const totalExpenses = sectionTotal(expenseGroups);
  const adminFeePct = project.admin_fee_pct != null ? Number(project.admin_fee_pct) : null;
  const adminFeeBase = project.admin_fee_estimated_cost != null
    ? Number(project.admin_fee_estimated_cost)
    : totalExpenses;
  const adminFeeUsingEstimate = project.admin_fee_estimated_cost != null;
  const adminFeeAmount = adminFeePct != null && adminFeePct > 0
    ? Math.round(adminFeeBase * (adminFeePct / 100) * 100) / 100
    : null;
  const totalCost = totalExpenses + (adminFeeAmount ?? 0);
  const grossProfit = totalIncome - totalCost;
  const gpPct = totalIncome === 0 ? 0 : (grossProfit / totalIncome) * 100;

  const retentionPct = project.retention_pct != null ? Number(project.retention_pct) : null;
  const retentionBase = incomeGroups.reduce(
    (s, g) => s + groupItems(g.id).filter((i) => i.retention_applied && i.included_in_totals).reduce((a, i) => a + Number(i.subtotal), 0),
    0
  );
  const retentionHeld = retentionPct != null ? (retentionBase * retentionPct) / 100 : null;
  const retentionReleased = Number(project.retention_released ?? 0);

  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const sections: Array<{
    label: string;
    groups: Group[];
    accent: string;
    accentLight: string;
    accentText: string;
    borderClass: string;
    totalBg: string;
    totalText: string;
  }> = [
    {
      label: "Income",
      groups: incomeGroups,
      accent: "#10b981",
      accentLight: "#ecfdf5",
      accentText: "#065f46",
      borderClass: "border-emerald-500",
      totalBg: "bg-emerald-50",
      totalText: "text-emerald-800",
    },
    {
      label: "Expenses",
      groups: expenseGroups,
      accent: "#ef4444",
      accentLight: "#fef2f2",
      accentText: "#7f1d1d",
      borderClass: "border-red-500",
      totalBg: "bg-red-50",
      totalText: "text-red-800",
    },
  ];

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 16mm; }
          body { background: white !important; }
          .avoid-break { break-inside: avoid; }
          .force-break { break-before: page; }
        }
        table { border-collapse: collapse; }
        th, td { vertical-align: top; }
      `}</style>

      <ActualsPrintToolbar projectName={project.name} />

      {/* Dark surround on screen; plain white in print */}
      <div className="min-h-screen bg-zinc-900 pt-14 pb-16 print:bg-white print:pt-0 print:pb-0">
        <div className="max-w-[67rem] mx-auto py-6 px-4 print:py-0 print:px-0 print:max-w-none">
          {/* White document */}
          <div className="bg-white rounded-xl shadow-2xl print:shadow-none print:rounded-none">
            <div className="px-10 py-9 print:px-0 print:py-0">

              {/* ── Document header ────────────────────────────── */}
              <div className="flex items-start justify-between pb-7 border-b-2 border-gray-200 mb-8 avoid-break">
                <div>
                  {org?.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={org.logo_url}
                      alt={org.name ?? ""}
                      className="h-10 mb-3 object-contain object-left"
                    />
                  )}
                  <p className="text-sm text-gray-500 leading-none">{org?.name ?? params.orgSlug}</p>
                  <h1 className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{project.name}</h1>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-gray-800">Actuals Report</p>
                  <p className="text-sm text-gray-400 mt-1">{today}</p>
                </div>
              </div>

              {/* ── Summary cards ─────────────────────────────── */}
              <div className="mb-10 avoid-break">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                  Summary
                </h2>
                <div className={`grid gap-3 ${retentionPct != null ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-4"}`}>
                  {/* Income */}
                  <SummaryCard
                    label="Total Income"
                    value={fmt(totalIncome)}
                    bg="bg-emerald-50"
                    border="border-emerald-200"
                    labelColor="text-emerald-700"
                    valueColor="text-emerald-900"
                  />
                  {/* Expenses */}
                  <SummaryCard
                    label={adminFeeAmount != null ? "Total Cost" : "Total Expenses"}
                    value={fmt(adminFeeAmount != null ? totalCost : totalExpenses)}
                    sub={adminFeeAmount != null ? `incl. ${adminFeePct}% admin fee` : undefined}
                    bg="bg-red-50"
                    border="border-red-200"
                    labelColor="text-red-700"
                    valueColor="text-red-900"
                  />
                  {/* Gross Profit */}
                  <SummaryCard
                    label="Gross Profit"
                    value={fmt(grossProfit)}
                    sub={grossProfit < 0 ? "Loss" : undefined}
                    bg={grossProfit >= 0 ? "bg-blue-50" : "bg-orange-50"}
                    border={grossProfit >= 0 ? "border-blue-200" : "border-orange-200"}
                    labelColor={grossProfit >= 0 ? "text-blue-700" : "text-orange-700"}
                    valueColor={grossProfit >= 0 ? "text-blue-900" : "text-orange-900"}
                  />
                  {/* GP% */}
                  <SummaryCard
                    label="GP %"
                    value={`${gpPct.toFixed(1)}%`}
                    bg="bg-violet-50"
                    border="border-violet-200"
                    labelColor="text-violet-700"
                    valueColor="text-violet-900"
                  />
                  {/* Retention (conditional) */}
                  {retentionPct != null && (
                    <>
                      <SummaryCard
                        label="Retention Held"
                        value={fmt(retentionHeld!)}
                        sub={`${retentionPct}% of flagged income`}
                        bg="bg-amber-50"
                        border="border-amber-200"
                        labelColor="text-amber-700"
                        valueColor="text-amber-900"
                      />
                      <SummaryCard
                        label="Net Receivable"
                        value={fmt(totalIncome - (retentionHeld! - retentionReleased))}
                        sub={`Released: ${fmt(retentionReleased)}`}
                        bg="bg-slate-50"
                        border="border-slate-200"
                        labelColor="text-slate-600"
                        valueColor="text-slate-900"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* ── Detail sections ────────────────────────────── */}
              {sections.map(({ label, groups: sectionGroups, accent, accentLight, accentText, borderClass, totalBg, totalText }) => {
                if (sectionGroups.length === 0) return null;
                const total = sectionTotal(sectionGroups);

                return (
                  <div key={label} className={`mb-10${label === "Expenses" }`}>
                    {/* Section header bar */}
                    <div className={`flex items-center gap-2 mb-5 pb-2 border-b-2 ${borderClass} avoid-break`}>
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: accent }}
                      />
                      <h2
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: accent }}
                      >
                        {label}
                      </h2>
                      <div className="flex-1 text-right">
                        <span className="text-sm font-bold text-gray-800">{fmt(total)}</span>
                      </div>
                    </div>

                    {/* Groups */}
                    {sectionGroups.map((group) => {
                      const items = groupItems(group.id);
                      const { orderedBuckets, ungrouped } = bucketItems(items);
                      const gTotal = groupTotal(group.id);
                      const itemCount = items.length;

                      return (
                        <div key={group.id} className="mb-6 avoid-break">
                          {/* Group name */}
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-700">{group.name}</h3>
                            <span className="text-[11px] text-gray-400">
                              {itemCount} line{itemCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {group.notes && (
                            <p className="text-[11px] text-gray-400 mb-2 italic">{group.notes}</p>
                          )}

                          <table className="w-full table-fixed text-[11px] text-gray-700">
                            <colgroup>
                              <col style={{ width: "90px" }} />
                              <col style={{ width: "84px" }} />
                              <col style={{ width: "160px" }} />
                              <col />
                              <col style={{ width: "56px" }} />
                              <col style={{ width: "90px" }} />
                              <col style={{ width: "90px" }} />
                            </colgroup>
                            <thead>
                              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                <Th>Date</Th>
                                <Th>Invoice #</Th>
                                <Th>Supplier</Th>
                                <Th>Description</Th>
                                <Th right>Qty</Th>
                                <Th right>Unit Price</Th>
                                <Th right>Subtotal</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Invoice sub-groups */}
                              {orderedBuckets.map(([invoiceNum, invItems]) => {
                                const invTotal = invItems
                                  .filter((i) => i.included_in_totals)
                                  .reduce((s, i) => s + Number(i.subtotal), 0);
                                const firstItem = invItems[0];
                                return (
                                  <Fragment key={invoiceNum}>
                                    {/* Invoice header row */}
                                    <tr style={{ backgroundColor: accentLight, borderBottom: `1px solid ${accent}22` }}>
                                      <td colSpan={6} className="py-1.5 px-2 font-semibold" style={{ color: accentText }}>
                                        <span className="font-normal text-[9px] mr-1.5 uppercase tracking-wider opacity-60">Invoice</span>
                                        {invoiceNum}
                                        {firstItem.supplier && (
                                          <span className="font-normal opacity-60 ml-2">
                                            · {firstItem.supplier}
                                          </span>
                                        )}
                                        <span className="font-normal opacity-50 ml-2 text-[9px]">
                                          {invItems.length} item{invItems.length !== 1 ? "s" : ""}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-bold" style={{ color: accentText }}>
                                        {fmt(invTotal)}
                                      </td>
                                    </tr>
                                    {/* Invoice line items */}
                                    {invItems.map((item, idx) => (
                                      <tr
                                        key={item.id}
                                        style={{
                                          backgroundColor: idx % 2 === 1 ? "#f8fafc" : "white",
                                          borderBottom: "1px solid #f1f5f9",
                                          opacity: item.included_in_totals ? 1 : 0.45,
                                        }}
                                      >
                                        <Td muted pl4>{fmtDate(item.invoice_date)}</Td>
                                        <Td muted small>{item.invoice_number}</Td>
                                        <Td muted>{item.supplier ?? ""}</Td>
                                        <Td small>
                                          {item.description}
                                          {!item.included_in_totals && (
                                            <span className="ml-1.5 text-[9px] italic text-gray-400">(excluded)</span>
                                          )}
                                        </Td>
                                        <Td right muted>{fmtQty(item.qty)}</Td>
                                        <Td right muted>{item.unit_price != null ? fmt(Number(item.unit_price)) : ""}</Td>
                                        <Td right>{fmt(Number(item.subtotal))}</Td>
                                      </tr>
                                    ))}
                                  </Fragment>
                                );
                              })}

                              {/* Ungrouped items (no invoice number) */}
                              {ungrouped.map((item, idx) => (
                                <tr
                                  key={item.id}
                                  style={{
                                    backgroundColor: idx % 2 === 1 ? "#f8fafc" : "white",
                                    borderBottom: "1px solid #f1f5f9",
                                    opacity: item.included_in_totals ? 1 : 0.45,
                                  }}
                                >
                                  <Td muted>{fmtDate(item.invoice_date)}</Td>
                                  <Td muted small>{item.invoice_number ?? ""}</Td>
                                  <Td muted>{item.supplier ?? ""}</Td>
                                  <Td small>
                                    {item.description}
                                    {!item.included_in_totals && (
                                      <span className="ml-1.5 text-[9px] italic text-gray-400">(excluded)</span>
                                    )}
                                  </Td>
                                  <Td right muted>{fmtQty(item.qty)}</Td>
                                  <Td right muted>{item.unit_price != null ? fmt(Number(item.unit_price)) : ""}</Td>
                                  <Td right>{fmt(Number(item.subtotal))}</Td>
                                </tr>
                              ))}

                              {/* Empty state */}
                              {items.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={7}
                                    className="py-3 px-2 text-center text-gray-400 italic"
                                    style={{ borderBottom: "1px solid #e2e8f0" }}
                                  >
                                    No line items
                                  </td>
                                </tr>
                              )}

                              {/* Group total row */}
                              <tr className={`${totalBg} border-t-2`} style={{ borderTopColor: accent }}>
                                <td
                                  colSpan={6}
                                  className={`py-2 px-2 text-right text-[10px] font-bold uppercase tracking-wider ${totalText}`}
                                >
                                  {group.name} Total
                                </td>
                                <td className={`py-2 px-2 text-right font-bold ${totalText}`}>
                                  {fmt(gTotal)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })}

                    {/* Admin fee table — after all expense groups */}
                    {label === "Expenses" && adminFeeAmount != null && (
                      <div className="mb-6 avoid-break" style={{ breakBefore: "avoid" }}>
                        <table className="w-full table-fixed text-[11px] text-gray-700">
                          <colgroup>
                            <col />
                            <col style={{ width: "120px" }} />
                            <col style={{ width: "76px" }} />
                          </colgroup>
                          <thead>
                            <tr style={{ backgroundColor: "#fef2f2", borderBottom: "1px solid #fca5a5" }}>
                              <th className="py-1.5 px-2 text-left font-semibold text-red-700 text-[10px] uppercase tracking-wider" colSpan={2}>
                                Admin &amp; Other Fee
                              </th>
                              <th className="py-1.5 px-2 text-right font-semibold text-red-700 text-[10px] uppercase tracking-wider">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ backgroundColor: "white", borderBottom: "1px solid #f1f5f9" }}>
                              <td className="py-1.5 px-2 text-gray-500 italic">Administrative overhead and miscellaneous costs</td>
                              <td className="py-1.5 px-2 text-gray-500 text-right tabular-nums">
                                {adminFeePct}% of {fmt(adminFeeBase)}
                                {adminFeeUsingEstimate
                                  ? <span className="ml-1 text-[9px] opacity-60">(estimated)</span>
                                  : <span className="ml-1 text-[9px] opacity-60">(actual)</span>
                                }
                              </td>
                              <td className="py-1.5 px-2 text-right font-medium text-gray-800 tabular-nums">
                                {fmt(adminFeeAmount)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Summary row at the bottom ──────────────────── */}
              <div className="mt-2 mb-8 avoid-break rounded-lg overflow-hidden border border-gray-200" style={{ breakBefore: "avoid" }}>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="bg-emerald-50 border-b border-gray-200">
                      <td className="py-2.5 px-5 font-medium text-emerald-800">Total Income</td>
                      <td className="py-2.5 px-5 text-right font-bold text-emerald-900">{fmt(totalIncome)}</td>
                    </tr>
                    <tr className="bg-red-50 border-b border-gray-200">
                      <td className="py-2.5 px-5 font-medium text-red-800">Total Expenses</td>
                      <td className="py-2.5 px-5 text-right font-bold text-red-900">{fmt(totalExpenses)}</td>
                    </tr>
                    {adminFeeAmount != null && (
                      <>
                        <tr className="bg-red-50/60 border-b border-gray-200">
                          <td className="py-2.5 px-5 font-medium text-red-700">
                            Admin &amp; Other Fee
                            <span className="ml-2 text-red-400 font-normal text-xs">({adminFeePct}%)</span>
                          </td>
                          <td className="py-2.5 px-5 text-right font-bold text-red-800">{fmt(adminFeeAmount)}</td>
                        </tr>
                        <tr className="bg-red-100 border-b border-gray-200">
                          <td className="py-2.5 px-5 font-semibold text-red-900">Total Cost</td>
                          <td className="py-2.5 px-5 text-right font-bold text-red-900">{fmt(totalCost)}</td>
                        </tr>
                      </>
                    )}
                    <tr className={grossProfit >= 0 ? "bg-blue-50 border-b border-gray-200" : "bg-orange-50 border-b border-gray-200"}>
                      <td className={`py-2.5 px-5 font-medium ${grossProfit >= 0 ? "text-blue-800" : "text-orange-800"}`}>
                        Gross Profit
                      </td>
                      <td className={`py-2.5 px-5 text-right font-bold ${grossProfit >= 0 ? "text-blue-900" : "text-orange-900"}`}>
                        {fmt(grossProfit)}
                      </td>
                    </tr>
                    <tr className="bg-violet-50">
                      <td className="py-2.5 px-5 font-medium text-violet-800">
                        Gross Profit %
                        {totalIncome === 0 && (
                          <span className="ml-2 text-violet-400 font-normal text-xs">(no income)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-5 text-right font-bold text-violet-900">
                        {gpPct.toFixed(1)}%
                      </td>
                    </tr>
                    {retentionPct != null && (
                      <>
                        <tr className="bg-amber-50 border-t border-gray-200">
                          <td className="py-2.5 px-5 font-medium text-amber-800">
                            Retention Held
                            <span className="ml-2 text-amber-500 font-normal text-xs">({retentionPct}%)</span>
                          </td>
                          <td className="py-2.5 px-5 text-right font-bold text-amber-900">
                            {fmt(retentionHeld!)}
                          </td>
                        </tr>
                        <tr className="bg-amber-50/50">
                          <td className="py-2.5 px-5 font-medium text-amber-700">Retention Released</td>
                          <td className="py-2.5 px-5 text-right font-bold text-amber-800">
                            {fmt(retentionReleased)}
                          </td>
                        </tr>
                        <tr className="bg-slate-50 border-t border-gray-200">
                          <td className="py-2.5 px-5 font-medium text-slate-800">Net Receivable</td>
                          <td className="py-2.5 px-5 text-right font-bold text-slate-900">
                            {fmt(totalIncome - (retentionHeld! - retentionReleased))}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── Footer ────────────────────────────────────── */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                <span>{org?.name ?? params.orgSlug} · {project.name}</span>
                <span>Generated {today} · All amounts exclude GST</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Small shared primitives ────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  bg,
  border,
  labelColor,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  bg: string;
  border: string;
  labelColor: string;
  valueColor: string;
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${bg} ${border}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${labelColor}`}>
        {label}
      </div>
      <div className={`text-base font-bold leading-tight ${valueColor}`}>{value}</div>
      {sub && <div className={`text-[9px] mt-0.5 ${labelColor} opacity-70`}>{sub}</div>}
    </div>
  );
}

function Th({
  children,
  right,
}: {
  children?: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`py-1.5 px-2 font-semibold text-gray-500 ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  muted,
  small,
  pl4,
}: {
  children?: React.ReactNode;
  right?: boolean;
  muted?: boolean;
  small?: boolean;
  pl4?: boolean;
}) {
  return (
    <td
      className={[
        "py-1 px-2 break-words",
        right ? "text-right" : "text-left",
        muted ? "text-gray-500" : "text-gray-800 font-medium",
        small ? "text-[10px]" : "",
        pl4 ? "pl-4" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </td>
  );
}
