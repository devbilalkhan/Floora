"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  FileText,
  Save,
  CheckCircle2,
  Users,
  X,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RISK_OPTIONS,
  RISK_COLORS,
  type SwmsData,
  type HrcwRow,
  type PersonRow,
  type HazardRow,
  type EmergencyProcedure,
  type EmergencyContact,
  type WorkerRow,
  type OrgWorker,
} from "@/lib/swms-types";
import { createSwms, updateSwms, publishSwmsVersion } from "./actions";

const SWMSPdfButton = dynamic(
  () => import("./swms-pdf-button").then((m) => ({ default: m.SWMSPdfButton })),
  { ssr: false, loading: () => <Button size="sm" variant="outline" disabled className="gap-1.5">Loading PDF…</Button> }
);

// ── Shared field primitives ───────────────────────────────────────────────────

const labelCls = "block text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5";
const inputCls = "w-full text-[11px] bg-input border border-border rounded px-2 py-1 text-foreground/80 outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/30";
const areaCls = `${inputCls} resize-y leading-relaxed`;
const cellInputCls = "w-full text-[11px] bg-input border border-border rounded px-2 py-0.5 text-foreground/80 outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function RiskBadge({ code }: { code: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${RISK_COLORS[code] ?? "bg-muted/50 text-muted-foreground border-black/10 dark:border-white/10"}`}>
      {code}
    </span>
  );
}

function RiskSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none text-[10px] font-bold pl-2 pr-6 py-0.5 rounded border cursor-pointer outline-none focus:ring-1 focus:ring-primary/40 ${RISK_COLORS[value] ?? "bg-muted/50 text-muted-foreground border-black/10 dark:border-white/10"}`}
      >
        {RISK_OPTIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 h-2.5 w-2.5 opacity-60" />
    </div>
  );
}

// ── Section accordion wrapper ─────────────────────────────────────────────────

function Section({
  number,
  title,
  open,
  onToggle,
  children,
  badge,
}: {
  number: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-card/65 hover:bg-card/80 transition-colors text-left"
      >
        <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5 min-w-[24px] text-center">
          {number}
        </span>
        <span className="text-sm font-semibold flex-1">{title}</span>
        {badge}
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && <div className="px-4 pb-4 pt-2 bg-card/40 space-y-4">{children}</div>}
    </div>
  );
}

// ── Worker picker dialog ──────────────────────────────────────────────────────

function WorkerPickerDialog({
  orgWorkers,
  onPick,
  onClose,
}: {
  orgWorkers: OrgWorker[];
  onPick: (workers: { name: string; role: string }[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAdd() {
    const picked = orgWorkers
      .filter((w) => selected.has(w.id))
      .map((w) => ({ name: w.name, role: w.role }));
    onPick(picked);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Pick from team</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {orgWorkers.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              No team members configured.{" "}
              <Link href="#" className="text-primary underline">Add them in Settings → Team</Link>.
            </p>
          )}
          {orgWorkers.map((w) => (
            <label key={w.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={selected.has(w.id)}
                onChange={() => toggle(w.id)}
                className="rounded border-border accent-primary"
              />
              <div>
                <p className="text-sm font-medium">{w.name}</p>
                <p className="text-xs text-muted-foreground">{w.role}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleAdd} disabled={selected.size === 0}>
            Add {selected.size > 0 ? `${selected.size} ` : ""}selected
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Section 5: static risk matrix ─────────────────────────────────────────────

function RiskMatrix() {
  const cell = (content: string, color: string) => (
    <td className={`border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-center text-sm font-bold ${color}`}>
      {content}
    </td>
  );

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="border border-gray-300 dark:border-gray-600 bg-muted/60 px-3 py-1.5 text-left font-semibold">Consequence</th>
            <th className="border border-gray-300 dark:border-gray-600 bg-muted/60 px-3 py-1.5 font-semibold">Description</th>
            <th className="border border-gray-300 dark:border-gray-600 bg-muted/60 px-3 py-1.5 font-semibold">Likely (L)</th>
            <th className="border border-gray-300 dark:border-gray-600 bg-muted/60 px-3 py-1.5 font-semibold">Moderate (M)</th>
            <th className="border border-gray-300 dark:border-gray-600 bg-muted/60 px-3 py-1.5 font-semibold">Unlikely (U)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 font-semibold">H (1) — High</td>
            <td className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-muted-foreground">Potential death, permanent disability or major property/environmental damage.</td>
            {cell("1", "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400")}
            {cell("1", "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400")}
            {cell("2", "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400")}
          </tr>
          <tr>
            <td className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 font-semibold">M (2) — Medium</td>
            <td className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-muted-foreground">Potential temporary disability, lost-time injury or minor property/environmental damage.</td>
            {cell("1", "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400")}
            {cell("2", "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400")}
            {cell("3", "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400")}
          </tr>
          <tr>
            <td className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 font-semibold">L (3) — Low</td>
            <td className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-muted-foreground">First-aid injury only; on-site environmental release immediately contained.</td>
            {cell("2", "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400")}
            {cell("3", "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400")}
            {cell("3", "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400")}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-muted-foreground italic">
        Likelihood: Likely = could happen frequently / known to occur on similar work. Moderate = could happen occasionally. Unlikely = may occur only in exceptional circumstances.
      </p>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

export function SwmsEditor({
  existingSwms,
  orgWorkers,
  estimate,
  project,
  org,
  params,
}: {
  existingSwms: SwmsData | null;
  orgWorkers: OrgWorker[];
  estimate: { id: string; name: string };
  project: { id: string; name: string; location: string | null };
  org: {
    id: string;
    name: string;
    slug: string;
    org_code: string | null;
    abn: string | null;
    address: string | null;
    phone: string | null;
    org_email: string | null;
    logo_url: string | null;
  };
  params: { orgSlug: string; projectId: string; estimateId: string };
}) {
  const [swms, setSwms] = useState<SwmsData | null>(existingSwms);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [sections, setSections] = useState({
    s1: true, s2: false, s3: false, s4: false,
    s5: false, s6: false, s7: false, s8: false,
  });
  const [workerPicker, setWorkerPicker] = useState<"s3" | "s8" | null>(null);
  const [expandedHazard, setExpandedHazard] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  const timerRef = useRef<NodeJS.Timeout>();
  const swmsRef = useRef<SwmsData | null>(swms);
  swmsRef.current = swms;

  // Auto-create SWMS on first visit
  useEffect(() => {
    if (existingSwms || swms) return;
    setCreating(true);
    createSwms(estimate.id, org.id, {
      projectName: project.name,
      projectLocation: project.location,
      estimateName: estimate.name,
      orgCode: org.org_code,
      orgSlug: org.slug,
    })
      .then((created) => setSwms(created))
      .catch(() => toast.error("Failed to create SWMS. Please refresh."))
      .finally(() => setCreating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!swmsRef.current?.id) return;
      setSaving(true);
      try {
        await updateSwms(swmsRef.current.id, swmsRef.current);
        setLastSaved(new Date());
      } catch {
        toast.error("Auto-save failed.");
      } finally {
        setSaving(false);
      }
    }, 1500);
  }, []);

  function set<K extends keyof SwmsData>(key: K, value: SwmsData[K]) {
    setSwms((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
    scheduleSave();
  }

  function toggleSection(key: keyof typeof sections) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handlePublish() {
    if (!swms) return;
    setPublishing(true);
    try {
      const result = await publishSwmsVersion(swms.id, swms.version);
      setSwms((prev) => prev ? { ...prev, ...result, status: "approved" } : prev);
      toast.success(`SWMS published as v${result.version}`);
    } catch {
      toast.error("Failed to publish.");
    } finally {
      setPublishing(false);
    }
  }

  // ── Hazard row helpers
  function updateHazard(idx: number, patch: Partial<HazardRow>) {
    set("s6_hazards", (swms?.s6_hazards ?? []).map((h, i) => i === idx ? { ...h, ...patch } : h));
  }

  function addHazard() {
    const newRow: HazardRow = { task: "", hrcw: false, hazards: "", initial_risk: "M2", controls: "", residual_risk: "L3" };
    set("s6_hazards", [...(swms?.s6_hazards ?? []), newRow]);
    setExpandedHazard((swms?.s6_hazards ?? []).length);
  }

  function removeHazard(idx: number) {
    set("s6_hazards", (swms?.s6_hazards ?? []).filter((_, i) => i !== idx));
    if (expandedHazard === idx) setExpandedHazard(null);
  }

  // ── Person row helpers (shared for s3 and s8)
  function addPersonsToS3(picked: { name: string; role: string }[]) {
    const existing = swms?.s3_persons ?? [];
    set("s3_persons", [...existing, ...picked.map((p) => ({ name: p.name, role: p.role }))]);
    setWorkerPicker(null);
  }

  function addWorkersToS8(picked: { name: string; role: string }[]) {
    const existing = swms?.s8_workers ?? [];
    set("s8_workers", [...existing, ...picked.map((p) => ({ name: p.name, quals: p.role }))]);
    setWorkerPicker(null);
  }

  // ── Loading / creating state
  if (creating) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Creating SWMS…
      </div>
    );
  }

  if (!swms) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-destructive">
        Failed to load SWMS. Please refresh the page.
      </div>
    );
  }

  const hrcwApplied = swms.s2_hrcw.filter((r) => r.apply).length;

  return (
    <>
      {workerPicker && (
        <WorkerPickerDialog
          orgWorkers={orgWorkers}
          onPick={workerPicker === "s3" ? addPersonsToS3 : addWorkersToS8}
          onClose={() => setWorkerPicker(null)}
        />
      )}

      {/* ── Header bar ── */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold">Safe Work Method Statement</h1>
            <Badge className={swms.status === "approved" ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" : "bg-muted/50 text-muted-foreground border-black/10 dark:border-white/10"}>
              {swms.status === "approved" ? "Approved" : "Draft"}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">v{swms.version}</span>
          </div>
          {swms.document_number && (
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{swms.document_number}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {saving ? "Saving…" : lastSaved ? `Saved ${lastSaved.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
          <SWMSPdfButton swms={swms} org={org} project={project} estimate={estimate} />
          <Button size="sm" variant="outline" onClick={handlePublish} disabled={publishing} className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            {publishing ? "Publishing…" : "Publish new version"}
          </Button>
        </div>
      </div>

      {/* ── Regulatory preamble ── */}
      <p className="text-xs text-muted-foreground italic px-1">
        This SWMS is a site-specific statement that must be prepared and reviewed before any High-Risk Construction Work (HRCW) is commenced and must be available for inspection at the workplace at all times. Prepared in accordance with WHS Act 2011 (NSW) and WHS Regulation 2017 (NSW) Clause 291.
      </p>

      {/* ── Sections ── */}
      <div className="space-y-3">

        {/* Section 1 */}
        <Section number="1" title="SWMS Cover & Approval" open={sections.s1} onToggle={() => toggleSection("s1")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Business Name / Address / ABN">
              <div className="text-sm text-foreground/70 bg-muted/30 rounded-lg px-3 py-2 space-y-0.5">
                <p className="font-medium">{org.name}</p>
                {org.address && <p className="text-muted-foreground">{org.address}</p>}
                {org.abn && <p className="text-muted-foreground">ABN: {org.abn}</p>}
              </div>
            </Field>

            <Field label="Principal Contractor (PC)">
              <input value={swms.s1_pc_name ?? ""} onChange={(e) => set("s1_pc_name", e.target.value)} className={inputCls} placeholder="e.g. Richard Crookes Constructions" />
            </Field>

            <Field label="Works Manager / Contact">
              <input value={swms.s1_works_manager ?? ""} onChange={(e) => set("s1_works_manager", e.target.value)} className={inputCls} placeholder="Name — Role M: 04xx Email: ..." />
            </Field>
            <Field label="Works Manager Contact Details">
              <input value={swms.s1_works_manager_contact ?? ""} onChange={(e) => set("s1_works_manager_contact", e.target.value)} className={inputCls} placeholder="Phone, email" />
            </Field>

            <Field label="Date SWMS Provided to PC">
              <input type="date" value={swms.s1_date_provided_to_pc ?? ""} onChange={(e) => set("s1_date_provided_to_pc", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Workplace Location">
              <input value={swms.s1_workplace_location ?? ""} onChange={(e) => set("s1_workplace_location", e.target.value)} className={inputCls} placeholder="Project name, address" />
            </Field>

            <Field label="Work Activity">
              <textarea value={swms.s1_work_activity ?? ""} onChange={(e) => set("s1_work_activity", e.target.value)} rows={3} className={areaCls} placeholder="Brief description of work activities" />
            </Field>
            <Field label="Project Reference / Estimate #">
              <input value={swms.s1_project_reference ?? ""} onChange={(e) => set("s1_project_reference", e.target.value)} className={inputCls} />
            </Field>

            <Field label="Principal Contractor Contact">
              <input value={swms.s1_pc_contact ?? ""} onChange={(e) => set("s1_pc_contact", e.target.value)} className={inputCls} placeholder="Name — Contact details" />
            </Field>
            <Field label="Person Responsible for Development & Implementation">
              <input value={swms.s1_dev_responsible ?? ""} onChange={(e) => set("s1_dev_responsible", e.target.value)} className={inputCls} placeholder="Name — Role, M: …" />
            </Field>

            <Field label="Person Responsible for On-Site Compliance">
              <input value={swms.s1_compliance_person ?? ""} onChange={(e) => set("s1_compliance_person", e.target.value)} className={inputCls} placeholder="Role (allocated per shift)" />
            </Field>
            <Field label="How Will Compliance Be Ensured?">
              <textarea value={swms.s1_compliance_measures ?? ""} onChange={(e) => set("s1_compliance_measures", e.target.value)} rows={3} className={areaCls} />
            </Field>

            <Field label="Person Responsible for Reviewing Control Measures">
              <input value={swms.s1_reviewer ?? ""} onChange={(e) => set("s1_reviewer", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Date SWMS Received by Reviewer">
              <input type="date" value={swms.s1_date_received_by_reviewer ?? ""} onChange={(e) => set("s1_date_received_by_reviewer", e.target.value)} className={inputCls} />
            </Field>

            <Field label="How Will Control Measures Be Reviewed?">
              <textarea value={swms.s1_review_triggers ?? ""} onChange={(e) => set("s1_review_triggers", e.target.value)} rows={3} className={areaCls} />
            </Field>
            <Field label="Next Scheduled Review Date">
              <input type="date" value={swms.s1_next_review_date ?? ""} onChange={(e) => set("s1_next_review_date", e.target.value)} className={inputCls} />
            </Field>

            <Field label="Document Number">
              <input value={swms.document_number ?? ""} onChange={(e) => set("document_number", e.target.value)} className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Section 2 */}
        <Section
          number="2"
          title="High-Risk Construction Work (HRCW) Classification"
          open={sections.s2}
          onToggle={() => toggleSection("s2")}
          badge={
            hrcwApplied > 0 ? (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
                {hrcwApplied} applicable
              </Badge>
            ) : undefined
          }
        >
          <p className="text-xs text-muted-foreground">
            Tick all categories of HRCW that apply to this scope, as defined in WHS Regulation 2017 (NSW) Clause 291.
          </p>
          <div className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/40 border-b border-black/10 dark:border-white/10">
                  <th className="w-10 px-3 py-2 text-[10px] font-medium text-muted-foreground text-center">Apply?</th>
                  <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-left">HRCW Category — WHS Reg 2017 (NSW) Cl 291</th>
                  <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-left">Applicability to this scope</th>
                </tr>
              </thead>
              <tbody>
                {swms.s2_hrcw.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-black/10 dark:border-white/10 last:border-0 ${row.apply ? "bg-amber-500/5" : ""}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.apply}
                        onChange={(e) => {
                          const updated = swms.s2_hrcw.map((r, i) =>
                            i === idx ? { ...r, apply: e.target.checked } : r
                          );
                          set("s2_hrcw", updated);
                        }}
                        className="rounded accent-primary"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs ${row.apply ? "font-semibold" : "text-muted-foreground"}`}>
                        {row.category}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        value={row.applicability}
                        onChange={(e) => {
                          const updated = swms.s2_hrcw.map((r, i) =>
                            i === idx ? { ...r, applicability: e.target.value } : r
                          );
                          set("s2_hrcw", updated);
                        }}
                        rows={2}
                        className={`${cellInputCls} resize-none`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Section 3 */}
        <Section
          number="3"
          title="Persons Consulted in Development of this SWMS"
          open={sections.s3}
          onToggle={() => toggleSection("s3")}
          badge={
            swms.s3_persons.length > 0 ? (
              <Badge variant="outline" className="text-[10px]">{swms.s3_persons.length} persons</Badge>
            ) : undefined
          }
        >
          <p className="text-xs text-muted-foreground">
            WHS Act 2011 (NSW) requires consultation with workers who carry out the work or are directly affected by it.
          </p>
          <div className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/40 border-b border-black/10 dark:border-white/10">
                  <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-left">Name</th>
                  <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-left">Role / Qualifications & Experience</th>
                  <th className="w-8 px-2" />
                </tr>
              </thead>
              <tbody>
                {swms.s3_persons.map((p, idx) => (
                  <tr key={idx} className="border-b border-black/10 dark:border-white/10 last:border-0">
                    <td className="px-2 py-1.5">
                      <input
                        value={p.name}
                        onChange={(e) => set("s3_persons", swms.s3_persons.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                        className={cellInputCls}
                        placeholder="Full name"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={p.role}
                        onChange={(e) => set("s3_persons", swms.s3_persons.map((r, i) => i === idx ? { ...r, role: e.target.value } : r))}
                        className={cellInputCls}
                        placeholder="Role — description (X years experience)"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => set("s3_persons", swms.s3_persons.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {swms.s3_persons.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-4 text-xs text-muted-foreground text-center">No persons added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => set("s3_persons", [...swms.s3_persons, { name: "", role: "" }])}>
              <Plus className="h-3.5 w-3.5" /> Add row
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setWorkerPicker("s3")}>
              <Users className="h-3.5 w-3.5" /> Pick from team
            </Button>
          </div>
        </Section>

        {/* Section 4 */}
        <Section number="4" title="Project Details, Plant, PPE, Legislation & Codes" open={sections.s4} onToggle={() => toggleSection("s4")}>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Project">
                <input value={swms.s4_project ?? ""} onChange={(e) => set("s4_project", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Principal Contractor">
                <input value={swms.s4_pc ?? ""} onChange={(e) => set("s4_pc", e.target.value)} className={inputCls} placeholder="Name · Contact: ..." />
              </Field>
            </div>
            <Field label="Activity Description">
              <textarea value={swms.s4_activity_description ?? ""} onChange={(e) => set("s4_activity_description", e.target.value)} rows={4} className={areaCls} />
            </Field>
            <Field label="Plant & Equipment">
              <textarea value={swms.s4_plant_equipment ?? ""} onChange={(e) => set("s4_plant_equipment", e.target.value)} rows={3} className={areaCls} />
            </Field>
            <Field label="Materials">
              <textarea value={swms.s4_materials ?? ""} onChange={(e) => set("s4_materials", e.target.value)} rows={3} className={areaCls} />
            </Field>
            <Field label="PPE Required">
              <textarea value={swms.s4_ppe ?? ""} onChange={(e) => set("s4_ppe", e.target.value)} rows={4} className={areaCls} />
            </Field>
            <Field label="Training & Competency">
              <textarea value={swms.s4_training ?? ""} onChange={(e) => set("s4_training", e.target.value)} rows={3} className={areaCls} />
            </Field>
            <Field label="Permit to Work Required">
              <textarea value={swms.s4_permits ?? ""} onChange={(e) => set("s4_permits", e.target.value)} rows={3} className={areaCls} />
            </Field>
            <Field label="Maintenance & Pre-start Checks">
              <textarea value={swms.s4_maintenance ?? ""} onChange={(e) => set("s4_maintenance", e.target.value)} rows={3} className={areaCls} />
            </Field>
            <Field label="Legislation">
              <textarea value={swms.s4_legislation ?? ""} onChange={(e) => set("s4_legislation", e.target.value)} rows={2} className={areaCls} />
            </Field>
            <Field label="Codes of Practice (SafeWork NSW / Safe Work Australia)">
              <textarea value={swms.s4_codes ?? ""} onChange={(e) => set("s4_codes", e.target.value)} rows={3} className={areaCls} />
            </Field>
            <Field label="Australian Standards">
              <textarea value={swms.s4_standards ?? ""} onChange={(e) => set("s4_standards", e.target.value)} rows={2} className={areaCls} />
            </Field>
          </div>
        </Section>

        {/* Section 5 — static */}
        <Section number="5" title="Risk Assessment Matrix" open={sections.s5} onToggle={() => toggleSection("s5")}>
          <RiskMatrix />
        </Section>

        {/* Section 6 */}
        <Section
          number="6"
          title="Hazards, Risks & Controls"
          open={sections.s6}
          onToggle={() => toggleSection("s6")}
          badge={
            <Badge variant="outline" className="text-[10px]">{swms.s6_hazards.length} tasks</Badge>
          }
        >
          <p className="text-xs text-muted-foreground">
            Tasks listed in logical order. HRCW activities are highlighted. Controls follow hierarchy: Eliminate → Substitute → Isolate → Engineer → Administrative → PPE.
          </p>

          <div className="space-y-2">
            {swms.s6_hazards.map((h, idx) => (
              <div
                key={idx}
                className={`border rounded-lg overflow-hidden ${h.hrcw ? "border-amber-500/40 bg-amber-500/5" : "border-black/10 dark:border-white/10"}`}
              >
                {/* Row header */}
                <div className="flex items-center gap-2 px-3 py-2">
                  {h.hrcw && <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />}
                  <button
                    className="flex-1 text-left text-xs font-medium text-foreground/80 hover:text-foreground transition-colors truncate"
                    onClick={() => setExpandedHazard(expandedHazard === idx ? null : idx)}
                  >
                    {h.task || <span className="text-muted-foreground italic">Untitled task</span>}
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <RiskBadge code={h.initial_risk} />
                    <span className="text-muted-foreground text-[10px]">→</span>
                    <RiskBadge code={h.residual_risk} />
                    <button onClick={() => setExpandedHazard(expandedHazard === idx ? null : idx)} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
                      {expandedHazard === idx ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => removeHazard(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded edit */}
                {expandedHazard === idx && (
                  <div className="border-t border-black/10 dark:border-white/10 px-3 pb-3 pt-2 space-y-3 bg-card/40">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Task / Activity">
                        <textarea value={h.task} onChange={(e) => updateHazard(idx, { task: e.target.value })} rows={2} className={areaCls} placeholder="Describe the work task" />
                      </Field>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`hrcw-${idx}`}
                            checked={h.hrcw}
                            onChange={(e) => updateHazard(idx, { hrcw: e.target.checked })}
                            className="rounded accent-amber-500"
                          />
                          <label htmlFor={`hrcw-${idx}`} className="text-xs font-medium text-amber-700 dark:text-amber-400">HRCW activity</label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls}>Initial Risk</label>
                            <RiskSelect value={h.initial_risk} onChange={(v) => updateHazard(idx, { initial_risk: v })} />
                          </div>
                          <div>
                            <label className={labelCls}>Residual Risk</label>
                            <RiskSelect value={h.residual_risk} onChange={(v) => updateHazard(idx, { residual_risk: v })} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <Field label="Hazards & Risks">
                      <textarea value={h.hazards} onChange={(e) => updateHazard(idx, { hazards: e.target.value })} rows={4} className={areaCls} placeholder="• List hazards…" />
                    </Field>
                    <Field label="Control Measures (hierarchy of controls)">
                      <textarea value={h.controls} onChange={(e) => updateHazard(idx, { controls: e.target.value })} rows={8} className={areaCls} placeholder="• ELIMINATION: …&#10;• SUBSTITUTION: …&#10;• ISOLATION: …&#10;• ENGINEERING: …&#10;• ADMINISTRATIVE: …&#10;• PPE: …" />
                    </Field>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button size="sm" variant="outline" className="gap-1.5" onClick={addHazard}>
            <Plus className="h-3.5 w-3.5" /> Add task
          </Button>
        </Section>

        {/* Section 7 */}
        <Section number="7" title="Emergency Procedures" open={sections.s7} onToggle={() => toggleSection("s7")}>
          <div className="space-y-4">
            {/* Procedures table */}
            <div className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40 border-b border-black/10 dark:border-white/10">
                    <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-left w-1/3">Emergency type</th>
                    <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-left">Response</th>
                    <th className="w-8 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {swms.s7_procedures.map((proc, idx) => (
                    <tr key={idx} className="border-b border-black/10 dark:border-white/10 last:border-0 align-top">
                      <td className="px-2 py-1.5">
                        <textarea
                          value={proc.type}
                          onChange={(e) => set("s7_procedures", swms.s7_procedures.map((r, i) => i === idx ? { ...r, type: e.target.value } : r))}
                          rows={2}
                          className={`${cellInputCls} resize-none`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <textarea
                          value={proc.response}
                          onChange={(e) => set("s7_procedures", swms.s7_procedures.map((r, i) => i === idx ? { ...r, response: e.target.value } : r))}
                          rows={4}
                          className={`${cellInputCls} resize-none`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => set("s7_procedures", swms.s7_procedures.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => set("s7_procedures", [...swms.s7_procedures, { type: "", response: "" }])}>
              <Plus className="h-3.5 w-3.5" /> Add procedure
            </Button>

            {/* Emergency contacts */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Emergency contact numbers</p>
              <div className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/40 border-b border-black/10 dark:border-white/10">
                      <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-left">Service</th>
                      <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-left w-40">Number</th>
                      <th className="w-8 px-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {swms.s7_contacts.map((c, idx) => (
                      <tr key={idx} className="border-b border-black/10 dark:border-white/10 last:border-0">
                        <td className="px-2 py-1.5">
                          <input value={c.service} onChange={(e) => set("s7_contacts", swms.s7_contacts.map((r, i) => i === idx ? { ...r, service: e.target.value } : r))} className={cellInputCls} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={c.number} onChange={(e) => set("s7_contacts", swms.s7_contacts.map((r, i) => i === idx ? { ...r, number: e.target.value } : r))} className={cellInputCls} />
                        </td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => set("s7_contacts", swms.s7_contacts.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 mt-2" onClick={() => set("s7_contacts", [...swms.s7_contacts, { service: "", number: "" }])}>
                <Plus className="h-3.5 w-3.5" /> Add contact
              </Button>
            </div>
          </div>
        </Section>

        {/* Section 8 */}
        <Section
          number="8"
          title="Acknowledgement & Worker Sign-On"
          open={sections.s8}
          onToggle={() => toggleSection("s8")}
          badge={
            swms.s8_workers.length > 0 ? (
              <Badge variant="outline" className="text-[10px]">{swms.s8_workers.length} workers</Badge>
            ) : undefined
          }
        >
          {/* Responsible person */}
          <div className="bg-muted/20 rounded-lg p-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              I, the undersigned Director of {org.name} acknowledge that it is my responsibility to ensure all persons engaged in this work execute their duties in a safe manner in accordance with this Safe Work Method Statement.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Person Responsible (Director / Principal)">
                <input value={swms.s8_responsible_person ?? ""} onChange={(e) => set("s8_responsible_person", e.target.value)} className={inputCls} placeholder="Name — Role" />
              </Field>
              <Field label="Qualifications & Experience">
                <input value={swms.s8_responsible_quals ?? ""} onChange={(e) => set("s8_responsible_quals", e.target.value)} className={inputCls} placeholder="X years on-site and industry experience…" />
              </Field>
            </div>
          </div>

          {/* Worker sign-on table */}
          <p className="text-xs text-muted-foreground">
            I have been consulted, have read and fully understood this Safe Work Method Statement. I agree to carry out my duties in a safe manner in accordance with the controls set out above.
          </p>

          <div className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/40 border-b border-black/10 dark:border-white/10">
                  <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-left">Worker Name</th>
                  <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-left">Qualifications & Experience</th>
                  <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-center w-32">Signature</th>
                  <th className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-center w-24">Date</th>
                  <th className="w-8 px-2" />
                </tr>
              </thead>
              <tbody>
                {swms.s8_workers.map((w, idx) => (
                  <tr key={idx} className="border-b border-black/10 dark:border-white/10 last:border-0">
                    <td className="px-2 py-1.5">
                      <input
                        value={w.name}
                        onChange={(e) => set("s8_workers", swms.s8_workers.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                        className={cellInputCls}
                        placeholder="Full name"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={w.quals}
                        onChange={(e) => set("s8_workers", swms.s8_workers.map((r, i) => i === idx ? { ...r, quals: e.target.value } : r))}
                        className={cellInputCls}
                        placeholder="Role — experience"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="text-[10px] text-muted-foreground border-b border-muted-foreground/40 inline-block w-24">_________________________</span>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="text-[10px] text-muted-foreground font-mono">___ / ___ / ____</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => set("s8_workers", swms.s8_workers.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {swms.s8_workers.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-xs text-muted-foreground text-center">No workers added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => set("s8_workers", [...swms.s8_workers, { name: "", quals: "" }])}>
              <Plus className="h-3.5 w-3.5" /> Add row
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setWorkerPicker("s8")}>
              <Users className="h-3.5 w-3.5" /> Pick from team
            </Button>
          </div>

          {/* End marker */}
          <p className="text-center text-xs text-muted-foreground pt-2 font-mono">
            End of SWMS · {swms.document_number ?? "—"} · issued {swms.created_at ? new Date(swms.created_at).toLocaleDateString("en-AU") : ""}
          </p>
        </Section>

      </div>
    </>
  );
}
