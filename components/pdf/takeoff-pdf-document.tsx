import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { CATEGORIES, type TakeoffRow } from "@/lib/takeoff-types";

type S = any;

const HEADER_BG   = "#0f172a";
const CAT_BG      = "#f1f5f9";
const STRIPE      = "#f8fafc";
const BORDER      = "#e2e8f0";
const RULE        = "#cbd5e1";
const TEXT        = "#0f172a";
const TEXT2       = "#475569";
const MUTED       = "#94a3b8";
const SUPPLY_BLUE = "#1e40af";

// Usable width ~774pt (A4 landscape minus 34pt padding each side).
// # / Code / Notes are narrow fixed; Manufacturer–Wastage (7 cols) are equal at 50pt each;
// Description takes the remaining flex space (~200pt).
const C = { num: 18, code: 46, mid: 40, notes: 190 };

// Code summary columns
const CS = { code: 36, cat: 55, mfr: 70, col: 55, m2n: 34, m2s: 36, lmn: 34, lms: 36, blmn: 36, blms: 38, ea: 24, locs: 26 };

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: TEXT,
    backgroundColor: "#ffffff",
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 34,
  },
  topRule: { height: 4, backgroundColor: HEADER_BG },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderBottom: `0.5 solid ${BORDER}`,
    marginBottom: 6,
  },
  headerLeft:  { flexDirection: "column" },
  headerRight: { flexDirection: "column", alignItems: "flex-end" },
  brandLabel:  { fontSize: 7, color: MUTED, letterSpacing: 1.2, marginBottom: 3 },
  projectName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: TEXT, letterSpacing: 0.5, marginBottom: 1 },
  subText:     { fontSize: 8, color: TEXT2, marginTop: 1 },
  metaLabel:   { fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXT },
  metaValue:   { fontSize: 8, color: TEXT2 },
  metaRow:     { flexDirection: "row", marginBottom: 2 },
  metaRowSep:  { flexDirection: "row", marginTop: 5, paddingTop: 4, borderTop: `1 solid ${BORDER}` },

  // Table rows — cells provide their own horizontal padding and right border
  thead: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
    borderLeft: `0.5 solid ${BORDER}`,
  },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 0.4 },
  catRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderTop: `1 solid ${RULE}`,
    borderBottom: `0.5 solid ${BORDER}`,
    borderLeft: `3 solid ${RULE}`,
    backgroundColor: CAT_BG,
  },
  catLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#1e293b", flex: 1, letterSpacing: 0.5 },
  catTotal: { fontSize: 7, color: TEXT2 },
  dataRow: {
    flexDirection: "row",
    borderLeft: `0.5 solid ${BORDER}`,
    borderBottom: `0.5 solid ${BORDER}`,
  },

  cell:      { fontSize: 8, color: TEXT },
  cellMuted: { fontSize: 8, color: TEXT2 },
  cellFaint: { fontSize: 8, color: MUTED },
  cellMono:  { fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXT },
  cellBlue:  { fontSize: 8, fontFamily: "Helvetica-Bold", color: SUPPLY_BLUE },

  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 6,
    paddingHorizontal: 2,
    marginTop: 3,
    borderTop: `2 solid ${HEADER_BG}`,
  },
  grandTotalLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXT2, letterSpacing: 0.5, marginRight: 10 },
  grandTotalValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: TEXT, marginLeft: 12 },
  grandTotalUnit:  { fontSize: 8, color: TEXT2 },

  sectionTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: TEXT2,
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 4,
    paddingTop: 4,
    borderTop: `1 solid ${RULE}`,
  },
  sectionNote: { fontSize: 7, color: MUTED },

  footer: {
    position: "absolute",
    bottom: 12,
    left: 34,
    right: 34,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: MUTED },
});

function fmt(n: number) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function uLabel(u: string) { return u === "m2" ? "m²" : u; }

// Each header cell gets a right border and inner padding
function ColHeader({ w, align = "flex-start", flex, children }: {
  w?: number; align?: string; flex?: number; children: string;
}) {
  return (
    <View style={[
      flex !== undefined ? { flex } : { width: w },
      { paddingHorizontal: 3, paddingVertical: 4, borderRight: `0.5 solid #334155` },
    ] as S}>
      <Text style={[s.th, { textAlign: align as S }]}>{children}</Text>
    </View>
  );
}

// Each data cell gets a right border and inner padding
function Cell({ w, flex, align, style, children }: {
  w?: number; flex?: number; align?: string; style?: S; children?: string | null;
}) {
  return (
    <View style={[
      flex !== undefined ? { flex } : { width: w },
      { paddingHorizontal: 3, paddingVertical: 2, borderRight: `0.5 solid ${BORDER}` },
    ] as S}>
      <Text style={[style, align ? { textAlign: align as S } : {}] as S}>{children ?? ""}</Text>
    </View>
  );
}

export function TakeoffPdfDocument({
  projectName,
  projectLocation,
  orgName,
  headClient,
  brand,
  packDate,
  preparedBy,
  rows,
}: {
  projectName: string;
  projectLocation: string;
  orgName: string;
  headClient?: string;
  brand?: string;
  packDate: string;
  preparedBy?: string;
  rows: TakeoffRow[];
}) {
  const grandTotal = rows.reduce((acc, r) => {
    if (r.qty > 0) acc[r.unit] = (acc[r.unit] || 0) + Number(r.qty);
    return acc;
  }, {} as Record<string, number>);

  const codeMap: Record<string, {
    finish_code: string; description: string | null; manufacturer: string | null;
    colour: string | null; scope_category: string;
    totals: Record<string, number>; supply: Record<string, number>; locations: string[];
  }> = {};
  rows.forEach((r) => {
    if (!r.finish_code) return;
    if (!codeMap[r.finish_code]) {
      codeMap[r.finish_code] = {
        finish_code: r.finish_code, description: r.description,
        manufacturer: r.manufacturer, colour: r.colour,
        scope_category: r.scope_category, totals: {}, supply: {}, locations: [],
      };
    }
    const e = codeMap[r.finish_code];
    if (r.qty > 0) {
      e.totals[r.unit] = (e.totals[r.unit] || 0) + Number(r.qty);
      e.supply[r.unit] = (e.supply[r.unit] || 0) + Number(r.qty) * (1 + r.waste_pct / 100);
    }
    if (r.location && !e.locations.includes(r.location)) e.locations.push(r.location);
  });
  const codeSummary = Object.values(codeMap).sort((a, b) => a.finish_code.localeCompare(b.finish_code));

  const brandLabel = brand === "dfo" ? "DFO Flooring" : "SPM Flooring";

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Top colour bar */}
        <View style={s.topRule} />

        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.brandLabel}>{brandLabel.toUpperCase()} · QUANTITY TAKEOFF</Text>
            <Text style={s.projectName}>{projectName.toUpperCase()}</Text>
            {projectLocation ? <Text style={s.subText}>{projectLocation}</Text> : null}
            {headClient ? <Text style={s.subText}>Client: {headClient}</Text> : null}
          </View>
          <View style={s.headerRight}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Date: </Text><Text style={s.metaValue}>{packDate}</Text>
            </View>
            {preparedBy ? (
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Prepared by: </Text><Text style={s.metaValue}>{preparedBy}</Text>
              </View>
            ) : null}
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Status: </Text><Text style={s.metaValue}>Preliminary</Text>
            </View>
            <View style={s.metaRowSep}>
              <Text style={s.metaLabel}>Total rows: </Text><Text style={s.metaValue}>{rows.length}</Text>
            </View>
          </View>
        </View>

        {/* Column headers */}
        <View style={s.thead}>
          <ColHeader w={C.num}  align="center">#</ColHeader>
          <ColHeader w={C.code}>Code</ColHeader>
          <ColHeader flex={1}>Description</ColHeader>
          <ColHeader w={C.mid}>Manufacturer</ColHeader>
          <ColHeader w={C.mid}>Colour</ColHeader>
          <ColHeader w={C.mid}>Location</ColHeader>
          <ColHeader w={C.mid} align="center">Lvl</ColHeader>
          <ColHeader w={C.mid} align="right">Qty</ColHeader>
          <ColHeader w={C.mid}>Unit</ColHeader>
          <ColHeader w={C.mid} align="right">Wastage</ColHeader>
          <ColHeader w={C.notes}>Notes / Ref</ColHeader>
        </View>

        {/* Category groups */}
        {CATEGORIES.map((cat) => {
          const catRows = rows
            .filter((r) => r.scope_category === cat.key)
            .sort((a, b) => a.sort_order - b.sort_order);
          if (catRows.length === 0) return null;

          const catTotals = catRows.reduce((acc, r) => {
            if (r.qty > 0) acc[r.unit] = (acc[r.unit] || 0) + Number(r.qty);
            return acc;
          }, {} as Record<string, number>);

          const totalStr = Object.entries(catTotals)
            .map(([u, t]) => `${fmt(t)} ${uLabel(u)}`)
            .join("  ·  ");

          return (
            <View key={cat.key}>
              <View style={s.catRow}>
                <Text style={s.catLabel}>{cat.label.toUpperCase()}</Text>
                <Text style={s.catTotal}>{totalStr}</Text>
              </View>
              {catRows.map((row, i) => (
                <View key={row.id} style={[s.dataRow, i % 2 !== 0 ? { backgroundColor: STRIPE } : {}]}>
                  <Cell w={C.num}   align="center" style={s.cellFaint}>{String(i + 1)}</Cell>
                  <Cell w={C.code}  style={s.cellMono}>{row.finish_code}</Cell>
                  <Cell flex={1}    style={s.cell}>{row.description}</Cell>
                  <Cell w={C.mid}   style={s.cellMuted}>{row.manufacturer}</Cell>
                  <Cell w={C.mid}   style={s.cellMuted}>{row.colour}</Cell>
                  <Cell w={C.mid}   style={s.cellMuted}>{row.location}</Cell>
                  <Cell w={C.mid}   align="center" style={s.cellMuted}>{row.level}</Cell>
                  <Cell w={C.mid}   align="right" style={s.cell}>{row.qty > 0 ? fmt(row.qty) : ""}</Cell>
                  <Cell w={C.mid}   style={s.cellMuted}>{uLabel(row.unit)}</Cell>
                  <Cell w={C.mid}   align="right" style={s.cellBlue}>
                    {row.qty > 0 ? fmt(row.qty * (1 + (row.waste_pct ?? 10) / 100)) : ""}
                  </Cell>
                  <Cell w={C.notes} style={s.cellFaint}>{(row as S).notes ?? ""}</Cell>
                </View>
              ))}
            </View>
          );
        })}

        {/* Grand total */}
        <View style={s.grandTotalRow}>
          <Text style={s.grandTotalLabel}>GRAND TOTAL</Text>
          {Object.entries(grandTotal).map(([unit, total]) => (
            <View key={unit} style={{ flexDirection: "row", marginLeft: 12 } as S}>
              <Text style={s.grandTotalValue}>{fmt(total)}</Text>
              <Text style={s.grandTotalUnit}> {uLabel(unit)}</Text>
            </View>
          ))}
        </View>

        {/* Code Summary */}
        {codeSummary.length > 0 && (
          <View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" } as S}>
              <Text style={s.sectionTitle}>CODE SUMMARY</Text>
              <Text style={[s.sectionNote, { marginTop: 10, marginBottom: 4 }]}>
                Consolidated quantities by finish code — for estimate costing
              </Text>
            </View>
            <View style={s.thead}>
              <ColHeader w={CS.code}>Code</ColHeader>
              <ColHeader w={CS.cat}>Category</ColHeader>
              <ColHeader flex={1}>Description</ColHeader>
              <ColHeader w={CS.mfr}>Manufacturer</ColHeader>
              <ColHeader w={CS.col}>Colour</ColHeader>
              <ColHeader w={CS.m2n}  align="right">Net m²</ColHeader>
              <ColHeader w={CS.m2s}  align="right">Sup m²</ColHeader>
              <ColHeader w={CS.lmn}  align="right">Net lm</ColHeader>
              <ColHeader w={CS.lms}  align="right">Sup lm</ColHeader>
              <ColHeader w={CS.blmn} align="right">Net blm</ColHeader>
              <ColHeader w={CS.blms} align="right">Sup blm</ColHeader>
              <ColHeader w={CS.ea}   align="right">ea</ColHeader>
              <ColHeader w={CS.locs} align="right">Locs</ColHeader>
            </View>
            {codeSummary.map((entry, i) => {
              const catLabel = CATEGORIES.find((c) => c.key === entry.scope_category)?.label ?? entry.scope_category;
              return (
                <View key={entry.finish_code} style={[s.dataRow, i % 2 !== 0 ? { backgroundColor: STRIPE } : {}]}>
                  <Cell w={CS.code} style={s.cellMono}>{entry.finish_code}</Cell>
                  <Cell w={CS.cat}  style={s.cellMuted}>{catLabel}</Cell>
                  <Cell flex={1}    style={s.cell}>{entry.description}</Cell>
                  <Cell w={CS.mfr}  style={s.cellMuted}>{entry.manufacturer}</Cell>
                  <Cell w={CS.col}  style={s.cellMuted}>{entry.colour}</Cell>
                  <Cell w={CS.m2n}  align="right" style={s.cellFaint}>{entry.totals["m2"]  ? fmt(entry.totals["m2"])  : ""}</Cell>
                  <Cell w={CS.m2s}  align="right" style={s.cellBlue}>{entry.supply["m2"]  ? fmt(entry.supply["m2"])  : ""}</Cell>
                  <Cell w={CS.lmn}  align="right" style={s.cellFaint}>{entry.totals["lm"]  ? fmt(entry.totals["lm"])  : ""}</Cell>
                  <Cell w={CS.lms}  align="right" style={s.cellBlue}>{entry.supply["lm"]  ? fmt(entry.supply["lm"])  : ""}</Cell>
                  <Cell w={CS.blmn} align="right" style={s.cellFaint}>{entry.totals["blm"] ? fmt(entry.totals["blm"]) : ""}</Cell>
                  <Cell w={CS.blms} align="right" style={s.cellBlue}>{entry.supply["blm"] ? fmt(entry.supply["blm"]) : ""}</Cell>
                  <Cell w={CS.ea}   align="right" style={s.cell}>{entry.totals["ea"]  ? String(entry.totals["ea"]) : ""}</Cell>
                  <Cell w={CS.locs} align="right" style={s.cellMuted}>{String(entry.locations.length)}</Cell>
                </View>
              );
            })}
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{brandLabel} · Quantity Takeoff · {projectName}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Generated ${packDate} · Preliminary — not for construction · Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
