import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchReportData } from "@/app/(protected)/orgs/[orgSlug]/reports/actions";
import { ConsolidatedPrintToolbar } from "@/components/report/consolidated-print-toolbar";

function fmt(n: number) {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default async function ConsolidatedReportPrintPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string };
  searchParams: { ids?: string };
}) {
  const ids = (searchParams.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) notFound();

  const supabase = createClient();
  const [{ data: org }, { reports }] = await Promise.all([
    supabase.from("organizations").select("name, logo_url").eq("slug", params.orgSlug).single(),
    fetchReportData(ids),
  ]);

  if (!org || reports.length === 0) notFound();

  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Estimate totals
  const estRevenue = reports.reduce((s, p) => s + p.estRevenue, 0);
  const estCostBase = reports.reduce((s, p) => s + p.estCostBase, 0);
  const estOtherCosts = reports.reduce((s, p) => s + p.estOtherCosts, 0);
  const estMargin = reports.reduce((s, p) => s + p.estMargin, 0);
  const estMarginPct = estRevenue > 0 ? (estMargin / estRevenue) * 100 : 0;

  // Actuals totals
  const actIncome = reports.reduce((s, p) => s + p.actIncome, 0);
  const actExpenses = reports.reduce((s, p) => s + p.actCost, 0);
  const actAdminFees = reports.reduce((s, p) => s + p.actAdminFee, 0);
  const actMargin = reports.reduce((s, p) => s + p.actMargin, 0);
  const actMarginPct = actIncome > 0 ? (actMargin / actIncome) * 100 : 0;
  const hasActuals = reports.some((p) => p.actIncome > 0 || p.actCost > 0);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm 14mm; }
          body { background: white !important; }
          .avoid-break { break-inside: avoid; }
          .page-break { break-before: page; }
        }
        table { border-collapse: collapse; }
        th, td { vertical-align: top; }
      `}</style>

      <ConsolidatedPrintToolbar projectCount={reports.length} />

      <div className="min-h-screen bg-zinc-900 pt-14 pb-16 print:bg-white print:pt-0 print:pb-0">
        <div className="max-w-[80rem] mx-auto py-6 px-4 print:py-0 print:px-0 print:max-w-none">
          <div className="bg-white rounded-xl shadow-2xl print:shadow-none print:rounded-none">
            <div className="px-10 py-9 print:px-0 print:py-0">

              {/* ── Document header ─────────────────────────────── */}
              <div className="flex items-start justify-between pb-7 border-b-2 border-gray-200 mb-8 avoid-break">
                <div>
                  {org.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={org.logo_url}
                      alt={org.name ?? ""}
                      className="h-10 mb-3 object-contain object-left"
                    />
                  )}
                  <p className="text-sm text-gray-500 leading-none">{org.name ?? params.orgSlug}</p>
                  <h1 className="text-2xl font-bold text-gray-900 mt-1 leading-tight">
                    Consolidated Report
                  </h1>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">
                    {reports.length} project{reports.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">{today}</p>
                  <p className="text-xs text-gray-400 mt-0.5">All amounts exclude GST</p>
                </div>
              </div>

              {/* ── Estimates KPI cards ──────────────────────────── */}
              <div className="mb-6 avoid-break">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                  Estimates Summary
                </h2>
                <div className="grid grid-cols-4 gap-3">
                  <SummaryCard
                    label="Total Revenue"
                    value={fmt(estRevenue)}
                    bg="bg-emerald-50"
                    border="border-emerald-200"
                    labelColor="text-emerald-700"
                    valueColor="text-emerald-900"
                  />
                  <SummaryCard
                    label="Total Cost"
                    value={fmt(estCostBase + estOtherCosts)}
                    sub="mat · lab · overhead · other"
                    bg="bg-red-50"
                    border="border-red-200"
                    labelColor="text-red-700"
                    valueColor="text-red-900"
                  />
                  <SummaryCard
                    label="Est. Margin"
                    value={fmt(estMargin)}
                    bg={estMargin >= 0 ? "bg-blue-50" : "bg-orange-50"}
                    border={estMargin >= 0 ? "border-blue-200" : "border-orange-200"}
                    labelColor={estMargin >= 0 ? "text-blue-700" : "text-orange-700"}
                    valueColor={estMargin >= 0 ? "text-blue-900" : "text-orange-900"}
                  />
                  <SummaryCard
                    label="Est. GP %"
                    value={`${estMarginPct.toFixed(1)}%`}
                    bg="bg-violet-50"
                    border="border-violet-200"
                    labelColor="text-violet-700"
                    valueColor="text-violet-900"
                  />
                </div>
              </div>

              {/* ── Estimates table ──────────────────────────────── */}
              <div className="mb-10 avoid-break">
                <table className="w-full text-[11px] text-gray-700">
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      <Th>Project</Th>
                      <Th>Client</Th>
                      <Th>Estimate</Th>
                      <Th right>Revenue</Th>
                      <Th right>Cost</Th>
                      <Th right>Other</Th>
                      <Th right>Margin</Th>
                      <Th right>GP %</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((p, idx) => {
                      const gpPct = p.estMarginPct * 100;
                      return (
                        <tr
                          key={p.id}
                          style={{
                            backgroundColor: idx % 2 === 1 ? "#f8fafc" : "white",
                            borderBottom: "1px solid #f1f5f9",
                          }}
                        >
                          <Td bold>{p.name}</Td>
                          <Td muted>{p.head_client ?? "—"}</Td>
                          <Td muted>{p.estimateName ?? "—"}</Td>
                          <Td right>{p.estRevenue > 0 ? fmt(p.estRevenue) : "—"}</Td>
                          <Td right muted>{p.estCostBase > 0 ? fmt(p.estCostBase) : "—"}</Td>
                          <Td right muted>{p.estOtherCosts > 0 ? fmt(p.estOtherCosts) : "—"}</Td>
                          <Td right color={p.estRevenue > 0 ? (p.estMargin >= 0 ? "blue" : "orange") : undefined}>
                            {p.estRevenue > 0 ? fmt(p.estMargin) : "—"}
                          </Td>
                          <Td right color={p.estRevenue > 0 ? (gpPct >= 15 ? "green" : undefined) : undefined}>
                            {p.estRevenue > 0 ? `${gpPct.toFixed(1)}%` : "—"}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: "#eff6ff", borderTop: "2px solid #bfdbfe" }}>
                      <td
                        colSpan={3}
                        className="py-2 px-3 font-bold text-gray-700 text-[10px] uppercase tracking-wider"
                      >
                        Total ({reports.length})
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-gray-800">
                        {fmt(estRevenue)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-600">
                        {fmt(estCostBase)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-600">
                        {estOtherCosts > 0 ? fmt(estOtherCosts) : "—"}
                      </td>
                      <td
                        className={`py-2 px-3 text-right tabular-nums font-bold ${
                          estMargin >= 0 ? "text-blue-700" : "text-orange-700"
                        }`}
                      >
                        {fmt(estMargin)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right tabular-nums font-bold ${
                          estMarginPct >= 15 ? "text-emerald-700" : "text-gray-700"
                        }`}
                      >
                        {estMarginPct.toFixed(1)}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <p className="text-[9px] text-gray-400 mt-1.5">
                  Cost = materials + labour + overhead &nbsp;·&nbsp; Other = freight · accommodation · travel · bailing
                </p>
              </div>

              {/* ── Actuals section (conditional) ───────────────── */}
              {hasActuals && (
                <>
                  <div className="mb-6 avoid-break page-break">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                      Actuals Summary
                    </h2>
                    <div className="grid grid-cols-4 gap-3">
                      <SummaryCard
                        label="Total Income"
                        value={fmt(actIncome)}
                        bg="bg-emerald-50"
                        border="border-emerald-200"
                        labelColor="text-emerald-700"
                        valueColor="text-emerald-900"
                      />
                      <SummaryCard
                        label="Total Cost"
                        value={fmt(actExpenses + actAdminFees)}
                        sub={actAdminFees > 0 ? "incl. admin fees" : "expenses only"}
                        bg="bg-red-50"
                        border="border-red-200"
                        labelColor="text-red-700"
                        valueColor="text-red-900"
                      />
                      <SummaryCard
                        label="Act. Margin"
                        value={fmt(actMargin)}
                        bg={actMargin >= 0 ? "bg-blue-50" : "bg-orange-50"}
                        border={actMargin >= 0 ? "border-blue-200" : "border-orange-200"}
                        labelColor={actMargin >= 0 ? "text-blue-700" : "text-orange-700"}
                        valueColor={actMargin >= 0 ? "text-blue-900" : "text-orange-900"}
                      />
                      <SummaryCard
                        label="Act. GP %"
                        value={`${actMarginPct.toFixed(1)}%`}
                        bg="bg-violet-50"
                        border="border-violet-200"
                        labelColor="text-violet-700"
                        valueColor="text-violet-900"
                      />
                    </div>
                  </div>

                  <div className="mb-10 avoid-break">
                    <table className="w-full text-[11px] text-gray-700">
                      <thead>
                        <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                          <Th>Project</Th>
                          <Th>Client</Th>
                          <Th right>Income</Th>
                          <Th right>Expenses</Th>
                          <Th right>Admin Fee</Th>
                          <Th right>Margin</Th>
                          <Th right>Margin %</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((p, idx) => {
                          const hasData = p.actIncome > 0 || p.actCost > 0;
                          return (
                            <tr
                              key={p.id}
                              style={{
                                backgroundColor: idx % 2 === 1 ? "#f8fafc" : "white",
                                borderBottom: "1px solid #f1f5f9",
                              }}
                            >
                              <Td bold>{p.name}</Td>
                              <Td muted>{p.head_client ?? "—"}</Td>
                              <Td right>{p.actIncome > 0 ? fmt(p.actIncome) : "—"}</Td>
                              <Td right muted>{p.actCost > 0 ? fmt(p.actCost) : "—"}</Td>
                              <Td right muted>{p.actAdminFee > 0 ? fmt(p.actAdminFee) : "—"}</Td>
                              <Td
                                right
                                color={
                                  !hasData
                                    ? undefined
                                    : p.actMargin >= 0
                                    ? "blue"
                                    : "orange"
                                }
                              >
                                {hasData ? fmt(p.actMargin) : "—"}
                              </Td>
                              <Td
                                right
                                color={
                                  hasData && p.actMarginPct != null && p.actMarginPct >= 15
                                    ? "green"
                                    : undefined
                                }
                              >
                                {hasData && p.actMarginPct != null
                                  ? `${p.actMarginPct.toFixed(1)}%`
                                  : "—"}
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: "#eff6ff", borderTop: "2px solid #bfdbfe" }}>
                          <td
                            colSpan={2}
                            className="py-2 px-3 font-bold text-gray-700 text-[10px] uppercase tracking-wider"
                          >
                            Total ({reports.length})
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-gray-800">
                            {fmt(actIncome)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-gray-600">
                            {fmt(actExpenses)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-gray-600">
                            {actAdminFees > 0 ? fmt(actAdminFees) : "—"}
                          </td>
                          <td
                            className={`py-2 px-3 text-right tabular-nums font-bold ${
                              actMargin >= 0 ? "text-blue-700" : "text-orange-700"
                            }`}
                          >
                            {fmt(actMargin)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right tabular-nums font-bold ${
                              actMarginPct >= 15 ? "text-emerald-700" : "text-gray-700"
                            }`}
                          >
                            {actMarginPct.toFixed(1)}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}

              {/* ── Footer ──────────────────────────────────────── */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                <span>
                  {org.name ?? params.orgSlug} · Consolidated Report ·{" "}
                  {reports.length} project{reports.length !== 1 ? "s" : ""}
                </span>
                <span>Generated {today} · All amounts exclude GST</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Primitives ───────────────────────────────────────────────────────────────

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

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`py-2 px-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  muted,
  bold,
  color,
}: {
  children?: React.ReactNode;
  right?: boolean;
  muted?: boolean;
  bold?: boolean;
  color?: "blue" | "orange" | "green";
}) {
  const colorClass =
    color === "blue"
      ? "text-blue-700 font-semibold"
      : color === "orange"
      ? "text-orange-700 font-semibold"
      : color === "green"
      ? "text-emerald-700 font-semibold"
      : "";

  return (
    <td
      className={[
        "py-1.5 px-3 break-words",
        right ? "text-right tabular-nums" : "text-left",
        muted ? "text-gray-500" : bold ? "text-gray-800 font-medium" : "text-gray-700",
        colorClass,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </td>
  );
}
