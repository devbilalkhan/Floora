import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { SwmsData } from "@/lib/swms-types";
import { RISK_COLORS as _unused } from "@/lib/swms-types";
void _unused;

// ── Styles ────────────────────────────────────────────────────────────────────

const BLUE = "#1a3c6e";
const LIGHT_BLUE = "#e8eef7";
const AMBER_BG = "#fffde7";
const RED_BG = "#ffebee";
const GREEN_BG = "#e8f5e9";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8, color: "#222", padding: "20 28 24 28", lineHeight: 1.4 },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, borderBottom: `1 solid ${BLUE}`, paddingBottom: 6 },
  headerLeft: { flex: 1 },
  headerOrgName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BLUE },
  headerMeta: { fontSize: 7, color: "#555", marginTop: 2, lineHeight: 1.5 },
  headerRight: { alignItems: "flex-end" },
  headerTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BLUE, textAlign: "right" },
  headerSubtitle: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right", marginTop: 2 },
  headerDocNum: { fontSize: 7, color: "#555", textAlign: "right", marginTop: 2 },
  footer: { position: "absolute", bottom: 14, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#888", borderTop: "0.5 solid #ddd", paddingTop: 4 },

  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 4, marginTop: 10 },
  table: { borderLeft: "0.5 solid #bbb", borderTop: "0.5 solid #bbb" },
  row: { flexDirection: "row" },
  cell: { borderRight: "0.5 solid #bbb", borderBottom: "0.5 solid #bbb", padding: "3 4", fontSize: 7.5, lineHeight: 1.4 },
  headerCell: { borderRight: "0.5 solid #bbb", borderBottom: "0.5 solid #bbb", padding: "3 4", fontSize: 7.5, backgroundColor: BLUE, color: "#fff", fontFamily: "Helvetica-Bold" },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontStyle: "italic" },
  muted: { color: "#666" },
  small: { fontSize: 7 },

  riskH1: { backgroundColor: "#ffcdd2", color: "#b71c1c" },
  riskH2: { backgroundColor: "#ffe0b2", color: "#bf360c" },
  riskM1: { backgroundColor: "#ffe0b2", color: "#bf360c" },
  riskM2: { backgroundColor: "#fff9c4", color: "#e65100" },
  riskM3: { backgroundColor: "#f9fbe7", color: "#558b2f" },
  riskL2: { backgroundColor: "#dcedc8", color: "#33691e" },
  riskL3: { backgroundColor: "#c8e6c9", color: "#1b5e20" },

  hrcwRow: { backgroundColor: AMBER_BG },
  preamble: { fontSize: 7, color: "#555", fontStyle: "italic", marginBottom: 8, lineHeight: 1.5 },
});

function riskStyle(code: string) {
  const map: Record<string, object> = {
    H1: s.riskH1, H2: s.riskH2, M1: s.riskM1, M2: s.riskM2,
    M3: s.riskM3, L2: s.riskL2, L3: s.riskL3,
  };
  return map[code] ?? {};
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function PageFooter({ org, docNum }: { org: OrgProps; docNum: string | null }) {
  return (
    <View style={s.footer} fixed>
      <Text>{org.name}{org.abn ? ` — ABN ${org.abn}` : ""}</Text>
      <Text render={({ pageNumber, totalPages }) => `${docNum ?? "SWMS"} · Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function PageHeader({ org, docNum }: { org: OrgProps; docNum: string | null }) {
  return (
    <View style={s.headerBar} fixed>
      <View style={s.headerLeft}>
        <Text style={s.headerOrgName}>{org.name}</Text>
        <Text style={s.headerMeta}>
          {[org.abn ? `ABN: ${org.abn}` : null, org.address, org.phone, org.org_email].filter(Boolean).join("  |  ")}
        </Text>
      </View>
      <View style={s.headerRight}>
        <Text style={s.headerTitle}>SAFE WORK METHOD STATEMENT</Text>
        <Text style={s.headerSubtitle}>High-Risk Construction Work — Flooring</Text>
        <Text style={s.headerDocNum}>Document #: {docNum ?? "Draft"}</Text>
      </View>
    </View>
  );
}

// ── Prop types ─────────────────────────────────────────────────────────────────

interface OrgProps {
  name: string;
  abn: string | null;
  address: string | null;
  phone: string | null;
  org_email: string | null;
}

// ── PDF Document ──────────────────────────────────────────────────────────────

export function SWMSDocument({
  swms,
  org,
}: {
  swms: SwmsData;
  org: OrgProps & { org_code: string | null; slug: string; id: string };
}) {
  const dn = swms.document_number;

  return (
    <Document>
      {/* ── Page 1: Cover ── */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <PageHeader org={org} docNum={dn} />

        <Text style={s.preamble}>
          This SWMS is a site-specific statement that must be prepared and reviewed before any High-Risk Construction Work (HRCW) is commenced and must be available for inspection at the workplace at all times. Prepared in accordance with WHS Act 2011 (NSW) and WHS Regulation 2017 (NSW) Clause 291.
        </Text>

        <Text style={s.sectionTitle}>Section 1 — SWMS Cover &amp; Approval</Text>

        <View style={s.table}>
          {/* Row 1 */}
          <View style={s.row}>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Business Name / Address / ABN:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text style={s.bold}>{org.name}</Text>
              {org.address ? <Text>{org.address}</Text> : null}
              {org.abn ? <Text>ABN: {org.abn}</Text> : null}
              {org.phone ? <Text>Phone: {org.phone}</Text> : null}
              {org.org_email ? <Text>Email: {org.org_email}</Text> : null}
            </View>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Principal Contractor (PC):</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text>{swms.s1_pc_name ?? ""}</Text>
              <Text style={s.muted}>{swms.s1_pc_contact ?? ""}</Text>
            </View>
          </View>
          {/* Row 2 */}
          <View style={s.row}>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>SPM Works Manager / Contact:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text>{swms.s1_works_manager ?? ""}</Text>
              <Text style={s.muted}>{swms.s1_works_manager_contact ?? ""}</Text>
            </View>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Date SWMS provided to PC:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text style={[s.bold, { fontSize: 10 }]}>{fmtDate(swms.s1_date_provided_to_pc)}</Text>
            </View>
          </View>
          {/* Row 3 */}
          <View style={s.row}>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Work Activity:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text>{swms.s1_work_activity ?? ""}</Text>
            </View>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Workplace Location:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text>{swms.s1_workplace_location ?? ""}</Text>
            </View>
          </View>
          {/* Row 4 */}
          <View style={s.row}>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Principal Contractor Contact:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text>{swms.s1_pc_contact ?? ""}</Text>
            </View>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Project Reference / Estimate #:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text>{swms.s1_project_reference ?? ""}</Text>
            </View>
          </View>
          {/* Row 5 */}
          <View style={s.row}>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Person responsible for development &amp; implementation of this SWMS:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text>{swms.s1_dev_responsible ?? ""}</Text>
            </View>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Person responsible for ensuring on-site compliance:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text>{swms.s1_compliance_person ?? ""}</Text>
            </View>
          </View>
          {/* Row 6 */}
          <View style={s.row}>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>How will compliance with the SWMS be ensured?</Text>
            </View>
            <View style={[s.cell, { width: "80%" }]}>
              <Text>{swms.s1_compliance_measures ?? ""}</Text>
            </View>
          </View>
          {/* Row 7 */}
          <View style={s.row}>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Person responsible for reviewing SWMS control measures:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text>{swms.s1_reviewer ?? ""}</Text>
            </View>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Date SWMS received by reviewer:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text>{fmtDate(swms.s1_date_received_by_reviewer)}</Text>
            </View>
          </View>
          {/* Row 8 */}
          <View style={s.row}>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>How will SWMS control measures be reviewed?</Text>
            </View>
            <View style={[s.cell, { width: "80%" }]}>
              <Text>{swms.s1_review_triggers ?? ""}</Text>
            </View>
          </View>
          {/* Row 9 */}
          <View style={s.row}>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>Next scheduled review date:</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text>{fmtDate(swms.s1_next_review_date)}</Text>
            </View>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}>
              <Text style={s.bold}>{"Reviewer's signature:"}</Text>
            </View>
            <View style={[s.cell, { width: "30%" }]}>
              <Text style={{ height: 20 }}> </Text>
            </View>
          </View>
        </View>

        <PageFooter org={org} docNum={dn} />
      </Page>

      {/* ── Page 2: HRCW Classification ── */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <PageHeader org={org} docNum={dn} />

        <Text style={s.sectionTitle}>Section 2 — High-Risk Construction Work (HRCW) Classification</Text>
        <Text style={[s.small, s.muted, { marginBottom: 4 }]}>
          Tick (☑) all categories of HRCW that apply to this scope, as defined in WHS Regulation 2017 (NSW) Clause 291. Categories ticked below are addressed in the hazard table in Section 6.
        </Text>

        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.headerCell, { width: "8%" }]}><Text>Apply?</Text></View>
            <View style={[s.headerCell, { width: "36%" }]}><Text>HRCW Category — WHS Reg 2017 (NSW) Cl 291</Text></View>
            <View style={[s.headerCell, { width: "56%" }]}><Text>Applicability to this scope</Text></View>
          </View>
          {swms.s2_hrcw.map((row, idx) => (
            <View key={idx} style={[s.row, row.apply ? { backgroundColor: AMBER_BG } : {}]}>
              <View style={[s.cell, { width: "8%", alignItems: "center" }]}>
                <Text>{row.apply ? "☑" : "☐"}</Text>
              </View>
              <View style={[s.cell, { width: "36%" }]}>
                <Text style={row.apply ? s.bold : {}}>{row.category}</Text>
              </View>
              <View style={[s.cell, { width: "56%" }]}>
                <Text>{row.applicability}</Text>
              </View>
            </View>
          ))}
        </View>

        <PageFooter org={org} docNum={dn} />
      </Page>

      {/* ── Page 3: Persons Consulted + Section 4 ── */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <PageHeader org={org} docNum={dn} />

        <Text style={s.sectionTitle}>Section 3 — Persons Consulted in Development of this SWMS</Text>
        <Text style={[s.small, s.muted, { marginBottom: 4 }]}>
          WHS Act 2011 (NSW) requires consultation with workers who carry out the work or are directly affected by it. The persons listed below have been consulted in the development of this SWMS and are required to sign on prior to commencing works (see Section 8).
        </Text>

        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.headerCell, { width: "30%" }]}><Text>Name</Text></View>
            <View style={[s.headerCell, { width: "70%" }]}><Text>Role / Qualifications &amp; Experience</Text></View>
          </View>
          {swms.s3_persons.map((p, idx) => (
            <View key={idx} style={s.row}>
              <View style={[s.cell, { width: "30%" }]}><Text style={s.bold}>{p.name}</Text></View>
              <View style={[s.cell, { width: "70%" }]}><Text>{p.role}</Text></View>
            </View>
          ))}
          {swms.s3_persons.length === 0 && (
            <View style={s.row}>
              <View style={[s.cell, { width: "100%" }]}><Text style={s.muted}>(No persons listed)</Text></View>
            </View>
          )}
        </View>

        <Text style={s.sectionTitle}>Section 4 — Project Details, Plant, PPE, Legislation &amp; Codes</Text>

        <View style={s.table}>
          {[
            ["Project:", swms.s4_project],
            ["Principal Contractor:", swms.s4_pc],
            ["Activity Description:", swms.s4_activity_description],
            ["Plant &amp; Equipment:", swms.s4_plant_equipment],
            ["Materials:", swms.s4_materials],
            ["PPE Required:", swms.s4_ppe],
            ["Training &amp; Competency:", swms.s4_training],
            ["Permit to Work Required:", swms.s4_permits],
            ["Maintenance &amp; Pre-start Checks:", swms.s4_maintenance],
            ["Legislation:", swms.s4_legislation],
            ["Codes of Practice:", swms.s4_codes],
            ["Australian Standards:", swms.s4_standards],
          ].map(([label, value], idx) => (
            <View key={idx} style={s.row}>
              <View style={[s.headerCell, { width: "22%", backgroundColor: "#f5f5f5", color: "#222" }]}>
                <Text style={s.bold}>{label}</Text>
              </View>
              <View style={[s.cell, { width: "78%" }]}>
                <Text>{value ?? ""}</Text>
              </View>
            </View>
          ))}
        </View>

        <PageFooter org={org} docNum={dn} />
      </Page>

      {/* ── Page 4: Risk Matrix + Hazards intro ── */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <PageHeader org={org} docNum={dn} />

        <Text style={s.sectionTitle}>Section 5 — Risk Assessment Matrix</Text>
        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.headerCell, { width: "16%" }]}><Text>Consequence</Text></View>
            <View style={[s.headerCell, { width: "50%" }]}><Text>Description</Text></View>
            <View style={[s.headerCell, { width: "12%" }]}><Text>Likely (L)</Text></View>
            <View style={[s.headerCell, { width: "12%" }]}><Text>Moderate (M)</Text></View>
            <View style={[s.headerCell, { width: "10%" }]}><Text>Unlikely (U)</Text></View>
          </View>
          <View style={s.row}>
            <View style={[s.cell, s.bold, { width: "16%" }]}><Text>H (1) — High</Text></View>
            <View style={[s.cell, { width: "50%" }]}><Text>Potential death, permanent disability or major property/environmental damage.</Text></View>
            <View style={[s.cell, { width: "12%", ...s.riskH1, textAlign: "center" }]}><Text style={s.bold}>1</Text></View>
            <View style={[s.cell, { width: "12%", ...s.riskH1, textAlign: "center" }]}><Text style={s.bold}>1</Text></View>
            <View style={[s.cell, { width: "10%", ...s.riskM2, textAlign: "center" }]}><Text style={s.bold}>2</Text></View>
          </View>
          <View style={s.row}>
            <View style={[s.cell, s.bold, { width: "16%" }]}><Text>M (2) — Medium</Text></View>
            <View style={[s.cell, { width: "50%" }]}><Text>Potential temporary disability, lost-time injury or minor property/environmental damage.</Text></View>
            <View style={[s.cell, { width: "12%", ...s.riskH1, textAlign: "center" }]}><Text style={s.bold}>1</Text></View>
            <View style={[s.cell, { width: "12%", ...s.riskM2, textAlign: "center" }]}><Text style={s.bold}>2</Text></View>
            <View style={[s.cell, { width: "10%", ...s.riskL3, textAlign: "center" }]}><Text style={s.bold}>3</Text></View>
          </View>
          <View style={s.row}>
            <View style={[s.cell, s.bold, { width: "16%" }]}><Text>L (3) — Low</Text></View>
            <View style={[s.cell, { width: "50%" }]}><Text>First-aid injury only; on-site environmental release immediately contained.</Text></View>
            <View style={[s.cell, { width: "12%", ...s.riskM2, textAlign: "center" }]}><Text style={s.bold}>2</Text></View>
            <View style={[s.cell, { width: "12%", ...s.riskL3, textAlign: "center" }]}><Text style={s.bold}>3</Text></View>
            <View style={[s.cell, { width: "10%", ...s.riskL3, textAlign: "center" }]}><Text style={s.bold}>3</Text></View>
          </View>
        </View>
        <Text style={[s.small, s.muted, s.italic, { marginTop: 3 }]}>
          Likelihood: Likely = could happen frequently / known to occur on similar work. Moderate = could happen occasionally / has occurred at some point on similar work. Unlikely = may occur only in exceptional circumstances.
        </Text>

        <Text style={s.sectionTitle}>Section 6 — Hazards, Risks &amp; Controls</Text>
        <Text style={[s.small, s.muted, { marginBottom: 4 }]}>
          Tasks listed in logical order from preparation through to clean-up. HRCW activities (per WHS Reg 2017 Cl 291) are highlighted and called out at the start of each task. Controls follow the hierarchy of controls: Eliminate → Substitute → Isolate → Engineering → Administrative → PPE.
        </Text>

        {/* Hazard table header */}
        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.headerCell, { width: "22%" }]}><Text>Task / Activity (HRCW activities flagged)</Text></View>
            <View style={[s.headerCell, { width: "22%" }]}><Text>Hazards &amp; Risks</Text></View>
            <View style={[s.headerCell, { width: "8%" }]}><Text>Initial Risk</Text></View>
            <View style={[s.headerCell, { width: "40%" }]}><Text>Control Measures (hierarchy of controls)</Text></View>
            <View style={[s.headerCell, { width: "8%" }]}><Text>Residual Risk</Text></View>
          </View>
          {swms.s6_hazards.slice(0, 2).map((h, idx) => (
            <View key={idx} style={[s.row, h.hrcw ? { backgroundColor: AMBER_BG } : {}]}>
              <View style={[s.cell, { width: "22%" }]}><Text style={h.hrcw ? s.bold : {}}>{h.task}</Text></View>
              <View style={[s.cell, { width: "22%" }]}><Text>{h.hazards}</Text></View>
              <View style={[s.cell, { width: "8%", ...riskStyle(h.initial_risk), textAlign: "center" }]}><Text style={s.bold}>{h.initial_risk}</Text></View>
              <View style={[s.cell, { width: "40%" }]}><Text>{h.controls}</Text></View>
              <View style={[s.cell, { width: "8%", ...riskStyle(h.residual_risk), textAlign: "center" }]}><Text style={s.bold}>{h.residual_risk}</Text></View>
            </View>
          ))}
        </View>

        <PageFooter org={org} docNum={dn} />
      </Page>

      {/* ── Hazard pages (remaining tasks) ── */}
      {swms.s6_hazards.length > 2 && (
        <Page size="A4" orientation="landscape" style={s.page}>
          <PageHeader org={org} docNum={dn} />
          <View style={s.table}>
            <View style={s.row}>
              <View style={[s.headerCell, { width: "22%" }]}><Text>Task / Activity (HRCW activities flagged)</Text></View>
              <View style={[s.headerCell, { width: "22%" }]}><Text>Hazards &amp; Risks</Text></View>
              <View style={[s.headerCell, { width: "8%" }]}><Text>Initial Risk</Text></View>
              <View style={[s.headerCell, { width: "40%" }]}><Text>Control Measures (hierarchy of controls)</Text></View>
              <View style={[s.headerCell, { width: "8%" }]}><Text>Residual Risk</Text></View>
            </View>
            {swms.s6_hazards.slice(2).map((h, idx) => (
              <View key={idx} style={[s.row, h.hrcw ? { backgroundColor: AMBER_BG } : {}]}>
                <View style={[s.cell, { width: "22%" }]}><Text style={h.hrcw ? s.bold : {}}>{h.task}</Text></View>
                <View style={[s.cell, { width: "22%" }]}><Text>{h.hazards}</Text></View>
                <View style={[s.cell, { width: "8%", ...riskStyle(h.initial_risk), textAlign: "center" }]}><Text style={s.bold}>{h.initial_risk}</Text></View>
                <View style={[s.cell, { width: "40%" }]}><Text>{h.controls}</Text></View>
                <View style={[s.cell, { width: "8%", ...riskStyle(h.residual_risk), textAlign: "center" }]}><Text style={s.bold}>{h.residual_risk}</Text></View>
              </View>
            ))}
          </View>
          <PageFooter org={org} docNum={dn} />
        </Page>
      )}

      {/* ── Emergency Procedures ── */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <PageHeader org={org} docNum={dn} />

        <Text style={s.sectionTitle}>Section 7 — Emergency Procedures</Text>
        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.headerCell, { width: "30%" }]}><Text>Emergency type</Text></View>
            <View style={[s.headerCell, { width: "70%" }]}><Text>Response</Text></View>
          </View>
          {swms.s7_procedures.map((p, idx) => (
            <View key={idx} style={s.row}>
              <View style={[s.cell, s.bold, { width: "30%" }]}><Text>{p.type}</Text></View>
              <View style={[s.cell, { width: "70%" }]}><Text>{p.response}</Text></View>
            </View>
          ))}
        </View>

        <Text style={[s.bold, { marginTop: 8, marginBottom: 4, fontSize: 8 }]}>Emergency contact numbers</Text>
        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.headerCell, { width: "60%" }]}><Text>Emergency services</Text></View>
            <View style={[s.headerCell, { width: "40%" }]}><Text>Number</Text></View>
          </View>
          {swms.s7_contacts.map((c, idx) => (
            <View key={idx} style={s.row}>
              <View style={[s.cell, { width: "60%" }]}><Text>{c.service}</Text></View>
              <View style={[s.cell, s.bold, { width: "40%" }]}><Text>{c.number}</Text></View>
            </View>
          ))}
        </View>

        <PageFooter org={org} docNum={dn} />
      </Page>

      {/* ── Worker Sign-On ── */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <PageHeader org={org} docNum={dn} />

        <Text style={s.sectionTitle}>Section 8 — Acknowledgement &amp; Worker Sign-On</Text>
        <Text style={[s.small, { marginBottom: 6 }]}>
          I, the undersigned Director of {org.name} acknowledge that it is my responsibility to ensure all persons engaged in this work execute their duties in a safe manner in accordance with this Safe Work Method Statement, and to ensure this SWMS is reviewed when site conditions, scope, plant, products or personnel change.
        </Text>

        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.headerCell, { width: "30%", backgroundColor: "#f5f5f5", color: "#222" }]}><Text style={s.bold}>Person Responsible</Text></View>
            <View style={[s.headerCell, { width: "40%", backgroundColor: "#f5f5f5", color: "#222" }]}><Text style={s.bold}>Qualifications &amp; Experience</Text></View>
            <View style={[s.headerCell, { width: "20%", backgroundColor: "#f5f5f5", color: "#222" }]}><Text style={s.bold}>Signature</Text></View>
            <View style={[s.headerCell, { width: "10%", backgroundColor: "#f5f5f5", color: "#222" }]}><Text style={s.bold}>Date</Text></View>
          </View>
          <View style={s.row}>
            <View style={[s.cell, s.bold, { width: "30%" }]}><Text>{swms.s8_responsible_person ?? ""}</Text></View>
            <View style={[s.cell, { width: "40%" }]}><Text>{swms.s8_responsible_quals ?? ""}</Text></View>
            <View style={[s.cell, { width: "20%" }]}><Text> </Text></View>
            <View style={[s.cell, { width: "10%" }]}><Text> </Text></View>
          </View>
        </View>

        <Text style={[s.small, { marginTop: 8, marginBottom: 4 }]}>
          I have been consulted, have read and fully understood this Safe Work Method Statement. I have had the opportunity to ask questions and to contribute to its development. I agree to carry out my duties in a safe manner in accordance with the controls set out above. I understand that work must stop and the SWMS reviewed if conditions change or if I become aware of a hazard not addressed below.
        </Text>

        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.headerCell, { width: "25%" }]}><Text>Worker Name</Text></View>
            <View style={[s.headerCell, { width: "40%" }]}><Text>Qualifications &amp; Experience</Text></View>
            <View style={[s.headerCell, { width: "25%" }]}><Text>Signature</Text></View>
            <View style={[s.headerCell, { width: "10%" }]}><Text>Date</Text></View>
          </View>
          {swms.s8_workers.map((w, idx) => (
            <View key={idx} style={s.row}>
              <View style={[s.cell, s.bold, { width: "25%" }]}><Text>{w.name}</Text></View>
              <View style={[s.cell, { width: "40%" }]}><Text>{w.quals}</Text></View>
              <View style={[s.cell, { width: "25%", minHeight: 20 }]}><Text> </Text></View>
              <View style={[s.cell, { width: "10%", minHeight: 20 }]}><Text style={[s.small, s.muted]}>{" ___ / ___ / ____"}</Text></View>
            </View>
          ))}
          {/* Blank rows for extras */}
          {Array.from({ length: Math.max(0, 4 - swms.s8_workers.length) }).map((_, i) => (
            <View key={`blank-${i}`} style={s.row}>
              <View style={[s.cell, { width: "25%", minHeight: 20 }]}><Text> </Text></View>
              <View style={[s.cell, { width: "40%", minHeight: 20 }]}><Text> </Text></View>
              <View style={[s.cell, { width: "25%", minHeight: 20 }]}><Text> </Text></View>
              <View style={[s.cell, { width: "10%", minHeight: 20 }]}><Text style={[s.small, s.muted]}>{" ___ / ___ / ____"}</Text></View>
            </View>
          ))}
        </View>

        <Text style={[s.small, s.muted, { marginTop: 10, textAlign: "center" }]}>
          End of SWMS · {swms.document_number ?? "Draft"} · issued {swms.created_at ? new Date(swms.created_at).toLocaleDateString("en-AU") : ""}
        </Text>

        <PageFooter org={org} docNum={dn} />
      </Page>
    </Document>
  );
}
