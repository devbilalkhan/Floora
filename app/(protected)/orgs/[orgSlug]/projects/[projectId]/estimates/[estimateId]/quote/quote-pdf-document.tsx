import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// ── Palette ───────────────────────────────────────────────────────────────────
const PURPLE  = "#7c3aed";
const G900    = "#111827";
const G700    = "#374151";
const G500    = "#6b7280";
const G400    = "#9ca3af";
const G200    = "#e5e7eb";
const G100    = "#f3f4f6";
const WHITE   = "#ffffff";

// ── Layout constants ──────────────────────────────────────────────────────────
const PAD_H       = 36;   // horizontal page padding
const STRIP_H     = 4;    // purple accent strip height
const FOOTER_H    = 28;   // footer height (incl. bottom strip)

// Column widths (pts, A4 content = 595 − 36×2 = 523pt)
const COL_QTY    = 38;
const COL_UNIT   = 32;
const COL_RATE   = 62;
const COL_AMT    = 72;
// Description fills the remainder

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: G700,
    backgroundColor: WHITE,
    paddingTop: 36,
    paddingBottom: FOOTER_H + 6,
    paddingHorizontal: PAD_H,
    lineHeight: 1.5,
  },

  // ── Fixed accent strips ───────────────────────────────────────────────────
  topStrip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: STRIP_H,
    backgroundColor: PURPLE,
  },
  bottomStrip: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: STRIP_H,
    backgroundColor: PURPLE,
  },

  // ── Fixed footer (all pages) ──────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: STRIP_H,
    left: PAD_H,
    right: PAD_H,
    height: FOOTER_H - STRIP_H,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: `0.5 solid ${G200}`,
    paddingTop: 5,
  },
  footerText: { fontSize: 7, color: G400 },

  // ── Page 1 header ─────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 4,
    paddingBottom: 16,
    minHeight: 84,   // 28mm minimum header zone
    borderBottom: `1 solid ${G200}`,
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",   // logo vertically centred relative to company text
    flex: 1,
    gap: 12,
  },
  logo: {
    width: 68,
    height: 34,
    objectFit: "contain",
  },
  companyBlock: { flex: 1 },
  companyName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: G900,
    marginBottom: 3,
  },
  companyMeta: { fontSize: 8.5, color: G500, lineHeight: 1.3, marginBottom: 2 },

  headerRight: { alignItems: "flex-end", width: 200 },
  quotationTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: G900,
    letterSpacing: 1,
    marginBottom: 12,
    lineHeight: 1,
  },
  metaRow: {
    flexDirection: "column",
    alignItems: "flex-end",
    marginBottom: 14,   // ~5mm between each datum
  },
  metaLabel: { fontSize: 7, color: G400, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  metaValue: { fontSize: 10, color: G700 },

  // ── Quote To / Project ref ────────────────────────────────────────────────
  twoCol: {
    flexDirection: "row",
    backgroundColor: G100,
    marginTop: 28,   // 28pt ≈ 10mm gap after header divider
    marginHorizontal: -PAD_H,   // bleed to page edges
    paddingHorizontal: PAD_H,
    paddingVertical: 16,
    gap: 40,
    marginBottom: 0,
  },
  toCol: { flex: 1 },
  sectionLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: G400,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  toName: {
    fontSize: 10,
    color: G900,
    marginBottom: 3,
  },
  toMeta: { fontSize: 8.5, color: G700, marginBottom: 2 },

  // ── Generic section ───────────────────────────────────────────────────────
  section: {
    paddingTop: 12,
    paddingBottom: 10,
    borderBottom: `0.5 solid ${G200}`,
  },
  sectionNoBorder: {
    paddingTop: 12,
    paddingBottom: 10,
  },

  // ── Scope ─────────────────────────────────────────────────────────────────
  scopeLine: { fontSize: 8, color: G700, marginBottom: 1.5 },

  // ── Table ─────────────────────────────────────────────────────────────────
  tableWrap: {
    borderTop: `0.5 solid ${G200}`,
    borderLeft: `0.5 solid ${G200}`,
    borderRight: `0.5 solid ${G200}`,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: G100,
    borderBottom: `0.5 solid ${G200}`,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `0.5 solid ${G200}`,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottom: `0.5 solid ${G200}`,
    backgroundColor: "#fafafa",
  },

  // Header cells
  thBase: {
    padding: "4 5",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: G500,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  thDesc: { flex: 1, padding: "4 5", fontSize: 7, fontFamily: "Helvetica-Bold", color: G500, textTransform: "uppercase", letterSpacing: 0.4 },
  thQty:  { width: COL_QTY,  padding: "4 5", fontSize: 7, fontFamily: "Helvetica-Bold", color: G500, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "right" },
  thUnit: { width: COL_UNIT, padding: "4 5", fontSize: 7, fontFamily: "Helvetica-Bold", color: G500, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "right" },
  thRate: { width: COL_RATE, padding: "4 5", fontSize: 7, fontFamily: "Helvetica-Bold", color: G500, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "right" },
  thAmt:  { width: COL_AMT,  padding: "4 5", fontSize: 7, fontFamily: "Helvetica-Bold", color: G500, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "right" },

  // Body cells
  tdDesc: { flex: 1,        padding: "5 5", fontSize: 8, color: G700 },
  tdQty:  { width: COL_QTY,  padding: "5 5", fontSize: 8, color: G700, textAlign: "right" },
  tdUnit: { width: COL_UNIT, padding: "5 5", fontSize: 8, color: G700, textAlign: "right" },
  tdRate: { width: COL_RATE, padding: "5 5", fontSize: 8, color: G700, textAlign: "right" },
  tdAmt:  { width: COL_AMT,  padding: "5 5", fontSize: 8, fontFamily: "Helvetica-Bold", color: G900, textAlign: "right" },

  // ── Totals ────────────────────────────────────────────────────────────────
  totalsOuter: {
    paddingTop: 10,
    alignItems: "flex-end",
  },
  totalsBox: { width: 210 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
  },
  totalLabel: { fontSize: 8, color: G500 },
  totalValue: { fontSize: 8, color: G700, fontFamily: "Helvetica-Bold" },
  grandDivider: {
    borderTop: `1 solid ${G700}`,
    marginTop: 5,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grandLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: G900,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grandValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: G900 },

  // ── Body text (notes/terms) ───────────────────────────────────────────────
  bodyText:  { fontSize: 8, color: G700, marginBottom: 2, lineHeight: 1.6 },
  termsText: { fontSize: 7.5, color: G500, marginBottom: 1.5, lineHeight: 1.6 },
});

const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Types ─────────────────────────────────────────────────────────────────────
export type QuotePdfLine = {
  id: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
};

export type QuotePdfProps = {
  companyName: string;
  companyAbn: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  orgLogoUrl: string | null;
  qNumber: string;
  qDate: string;
  qValidity: string;
  toName: string;
  toAddress: string;
  toContact: string;
  toEmail: string;
  projectRef: string;
  projectLoc: string;
  scopeText: string;
  lines: QuotePdfLine[];
  totalExGst: number;
  gst: number;
  grandTotal: number;
  notes: string;
  terms: string;
};

// ── Document ──────────────────────────────────────────────────────────────────
export function QuotePdfDocument({
  companyName, companyAbn, companyAddress, companyPhone, companyEmail,
  orgLogoUrl, qNumber, qDate, qValidity,
  toName, toAddress, toContact, toEmail,
  projectRef, projectLoc,
  scopeText, lines,
  totalExGst, gst, grandTotal,
  notes, terms,
}: QuotePdfProps) {
  const scopeLines = scopeText.split("\n").filter(Boolean);
  const noteLines  = notes.split("\n").filter(Boolean);
  const termLines  = terms.split("\n").filter(Boolean);

  const footerLabel = [companyName, companyEmail, companyPhone].filter(Boolean).join("  ·  ");

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Fixed: top purple strip (all pages) ─────────────────────────── */}
        <View fixed style={s.topStrip} />

        {/* ── Fixed: bottom purple strip (all pages) ──────────────────────── */}
        <View fixed style={s.bottomStrip} />

        {/* ── Fixed: footer (all pages) ───────────────────────────────────── */}
        <View fixed style={s.footer}>
          <Text style={s.footerText}>{footerLabel}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `${qNumber}   ${pageNumber} / ${totalPages}`
          } />
        </View>

        {/* ── Page 1 header ───────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {orgLogoUrl ? (
              <Image src={orgLogoUrl} style={s.logo} />
            ) : null}
            <View style={s.companyBlock}>
              <Text style={s.companyName}>{companyName}</Text>
              {companyAbn     ? <Text style={s.companyMeta}>ABN {companyAbn}</Text> : null}
              {companyAddress ? <Text style={s.companyMeta}>{companyAddress}</Text> : null}
              {(companyPhone || companyEmail) ? (
                <Text style={s.companyMeta}>
                  {[companyPhone, companyEmail].filter(Boolean).join("  ·  ")}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={s.headerRight}>
            <Text style={s.quotationTitle}>QUOTATION</Text>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Quote No.</Text>
              <Text style={s.metaValue}>{qNumber}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Date</Text>
              <Text style={s.metaValue}>{qDate}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Valid for</Text>
              <Text style={s.metaValue}>{qValidity}</Text>
            </View>
          </View>
        </View>

        {/* ── Quote To / Project (grey band, bleeds to page edges) ────────── */}
        <View style={s.twoCol}>
          <View style={s.toCol}>
            <Text style={s.sectionLabel}>Quote To</Text>
            {toName    ? <Text style={s.toName}>{toName}</Text>    : <Text style={s.toMeta}>—</Text>}
            {toAddress ? <Text style={s.toMeta}>{toAddress}</Text> : null}
            {toContact ? <Text style={s.toMeta}>{toContact}</Text> : null}
            {toEmail   ? <Text style={s.toMeta}>{toEmail}</Text>   : null}
          </View>
          <View style={s.toCol}>
            <Text style={s.sectionLabel}>Project Reference</Text>
            {projectRef ? <Text style={s.toName}>{projectRef}</Text>   : <Text style={s.toMeta}>—</Text>}
            {projectLoc ? <Text style={s.toMeta}>{projectLoc}</Text>   : null}
          </View>
        </View>

        {/* ── Scope of works ───────────────────────────────────────────────── */}
        {scopeLines.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { marginBottom: 5 }]}>Scope of Works</Text>
            {scopeLines.map((line, i) => (
              <Text key={i} style={s.scopeLine}>{line}</Text>
            ))}
          </View>
        )}

        {/* ── Line items ───────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { marginBottom: 6 }]}>Line Items</Text>
          <View style={s.tableWrap}>
            {/* Header */}
            <View style={s.tableHeaderRow}>
              <Text style={s.thDesc}>Description</Text>
              <Text style={s.thQty}>Qty</Text>
              <Text style={s.thUnit}>Unit</Text>
              <Text style={s.thRate}>Rate</Text>
              <Text style={s.thAmt}>Amount (AUD)</Text>
            </View>
            {/* Rows */}
            {lines.map((line, i) => (
              <View key={line.id} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow} wrap={false}>
                <Text style={s.tdDesc}>{line.description || "—"}</Text>
                <Text style={s.tdQty}>{line.qty}</Text>
                <Text style={s.tdUnit}>{line.unit}</Text>
                <Text style={s.tdRate}>${fmt(line.rate)}</Text>
                <Text style={s.tdAmt}>${fmt(line.amount)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Totals (keep together, don't split across pages) ─────────────── */}
        <View style={s.totalsOuter} wrap={false}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total (ex GST)</Text>
              <Text style={s.totalValue}>${fmt(totalExGst)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>GST (10%)</Text>
              <Text style={s.totalValue}>${fmt(gst)}</Text>
            </View>
            <View style={s.grandDivider}>
              <Text style={s.grandLabel}>Total (incl. GST)</Text>
              <Text style={s.grandValue}>${fmt(grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* ── Additional notes ─────────────────────────────────────────────── */}
        {noteLines.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { marginBottom: 5 }]}>Additional Notes</Text>
            {noteLines.map((line, i) => (
              <Text key={i} style={s.bodyText}>{line}</Text>
            ))}
          </View>
        )}

        {/* ── Terms & Conditions ───────────────────────────────────────────── */}
        {termLines.length > 0 && (
          <View style={s.sectionNoBorder}>
            <Text style={[s.sectionLabel, { marginBottom: 5 }]}>Terms &amp; Conditions</Text>
            {termLines.map((line, i) => (
              <Text key={i} style={s.termsText}>{line}</Text>
            ))}
          </View>
        )}

      </Page>
    </Document>
  );
}
