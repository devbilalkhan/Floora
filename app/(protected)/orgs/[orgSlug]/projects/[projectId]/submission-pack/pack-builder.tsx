"use client";

import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, X, Loader2, Plus, Trash2, ChevronUp, ChevronDown, FileText, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { pdf, usePDF } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { CoverPageDoc, type TocSection } from "@/components/pdf/submission-cover-page";
import { CoverLetterDoc, type RefNote } from "@/components/pdf/submission-cover-letter";
import { QuotePdfDocument, type QuotePdfLine } from "../estimates/[estimateId]/quote/quote-pdf-document";
import type { TakeoffRow } from "@/lib/takeoff-types";
import { cn } from "@/lib/utils";
import { toPdfSafeDataUrl } from "@/lib/pdf-utils";
import { RichEditor } from "@/components/rich-editor";
import { savePackDraft, type PackDraft } from "./actions";
import { ComposeModal } from "./compose-modal";
import { MarkSentDialog } from "./mark-sent-dialog";

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function buildComposeBody(opts: {
  contactName: string;
  projectName: string;
  clientCompany: string;
  packageName: string;
  selectedQuotes: QuoteRow[];
  combinedTotal: number;
  signatoryName: string;
  signatoryTitle: string;
  signatoryCompany: string;
  signatoryPhone: string;
  signatoryEmail: string;
}): string {
  const quoteBullets = opts.selectedQuotes
    .map((q) => {
      const site = q.project_loc || q.project_ref || q.quote_number;
      const total = q.total_ex_gst != null ? fmtMoney(q.total_ex_gst) : "TBC";
      return `• Conforming quote ${q.quote_number} — ${site} (${total} ex GST)`;
    })
    .join("\n");

  return `Dear ${opts.contactName},

Thank you for the opportunity to submit our pricing for ${opts.projectName}. Please find attached our full submission package for the ${opts.packageName} package, prepared for ${opts.clientCompany}.

Our submission includes the following:

• Cover letter and scope overview
${quoteBullets}
• Detailed flooring BOQs and plan markups
• Public & Product Liability Certificate of Currency
• Workers Insurance Certificate of Currency
• Inspection and Test Plan (ITP)

Our combined submission total is ${fmtMoney(opts.combinedTotal)} ex GST.

SPM brings over 10 years of experience delivering commercial flooring installations across education, healthcare, and government sectors throughout NSW. We hold ongoing contracts with School Infrastructure NSW, Hunter New England Health, BGIS Correctives, and other government agencies — giving us a deep understanding of the standards, sequencing, and documentation requirements that projects like ${opts.projectName} demand.

We are accredited on Buy NSW and our team is experienced working within live environments, coordinating with other trades to ensure minimal disruption to ongoing operations.

Should you have any questions regarding this submission or require any clarification on scope, pricing, or product specifications, please don't hesitate to reach out directly.

We look forward to the opportunity to work with ${opts.clientCompany} on this project.

Kind regards,

${opts.signatoryName}
${opts.signatoryTitle}
${opts.signatoryCompany}
${opts.signatoryPhone}
${opts.signatoryEmail}`;
}

function textToHtml(text: string): string {
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((p) => `<p>${p.trim().replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ── Default text constants (from SPM example letter) ─────────────────────────

const DEFAULT_CAPABILITIES = `SPM specialises in the supply and installation of a broad range of internal finishes, with particular strength across education, healthcare, government, and commercial projects throughout NSW. Our key areas of expertise include commercial flooring (carpet, vinyl, and sports flooring), floor preparation including industrial grinding, concrete sealing, wall and door protection, corner guards, acoustic panels, and handrails and bumper rails.

We are experienced in managing projects of varying scale and offer competitive supply pricing through our strong relationships with leading manufacturers. We are also accredited on Buy NSW and regularly deliver works for School Infrastructure, Hunter New England Health, Housing NSW, and other government agencies.`;

const DEFAULT_APPROACH_INTRO = `SPM specializes in commercial flooring installations with a focus on quality workmanship and attention to detail. Our team brings more than 10 years experience in executing projects in commercial and residential venues.

Upon acceptance of this quotation, we will:`;

const DEFAULT_APPROACH_POINTS = [
  "Schedule a site inspection to confirm measurements and assess existing site conditions.",
  "Review substrates and surfaces to ensure suitability for flooring, wall panel, and associated installations.",
  "Coordinate with relevant trades to confirm service requirements and installation sequencing.",
  "Coordinate material delivery with lead times from the supplier(s).",
  "Work with your project management team to establish an efficient installation timeline.",
  "Ensure minimal disruption if there are other stakeholders at the site.",
  "Complete the installation to manufacturer specifications complying with School standards and EFSG guidelines.",
];

const DEFAULT_CLOSING = `We look forward to the opportunity to work with you on this project. Should you have any questions or require additional information, please don't hesitate to contact me.`;

const DEFAULT_EXCLUSIONS = [
  "Floor preparation",
  "Grinding",
  "Ramping",
  "Floor protection",
  "Removal & disposal of existing floor coverings",
  "Furniture removal & reinstatement",
  "Asbestos removal / hazardous materials",
  "Out of hours works",
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Org = {
  id: string;
  name: string;
  abn: string | null;
  address: string | null;
  phone: string | null;
  org_email: string | null;
  logo_url: string | null;
};

type Project = {
  id: string;
  name: string;
  location: string | null;
  head_client: string | null;
  brand: string | null;
};

type QuoteRow = {
  id: string;
  quote_number: string;
  quote_date: string;
  valid_for: string | null;
  company_name: string | null;
  company_abn: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  to_name: string | null;
  to_address: string | null;
  to_contact: string | null;
  to_email: string | null;
  project_ref: string | null;
  project_loc: string | null;
  scope_text: string | null;
  notes: string | null;
  terms: string | null;
  lines: QuotePdfLine[] | null;
  total_ex_gst: number | null;
  gst: number | null;
  grand_total: number | null;
  status: string;
};

type AttachedDoc = { id: string; file: File; title: string };

type SentRecord = {
  id: string;
  recipient_name: string;
  recipient_email: string | null;
  sent_at: string;
  manual: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function slugify(s: string) {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function formatSentAt(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSentDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ── Section input ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
      {children}
    </p>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
}) {
  const sharedClass =
    "w-full bg-background/60 border border-border rounded-md text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors";
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows ?? 4}
          className={cn(sharedClass, "px-3 py-1.5 resize-y leading-relaxed")}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(sharedClass, "px-2.5 h-7")}
        />
      )}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

// ── PackBuilder ───────────────────────────────────────────────────────────────

export function PackBuilder({
  orgSlug,
  project,
  org,
  quotes,
  takeoffs,
  takeoffRows,
  today,
  draft,
  hasGmail,
  sends,
}: {
  orgSlug: string;
  project: Project;
  org: Org;
  quotes: QuoteRow[];
  takeoffs: { id: string; name: string }[];
  takeoffRows: TakeoffRow[];
  today: string;
  draft: PackDraft | null;
  hasGmail: boolean;
  sends: SentRecord[];
}) {
  const router = useRouter();

  // Derive sensible defaults from quote data (used only when no draft)
  const firstQuote = quotes[0];
  const defaultClient = firstQuote?.to_name ?? project.head_client ?? "";
  const defaultContactName = firstQuote?.to_contact ?? "";
  const defaultContactTitle = "";
  const defaultClientCompany = firstQuote?.to_name ?? project.head_client ?? "";

  // ── State ──────────────────────────────────────────────────────────────────

  // Pack metadata
  const [clientName, setClientName] = useState(draft?.clientName ?? defaultClient);
  const [projectNameState, setProjectNameState] = useState(draft?.projectName ?? project.name);
  const [packageName, setPackageName] = useState(draft?.packageName ?? "Floor Coverings");
  const [packDate, setPackDate] = useState(draft?.packDate ?? today);

  // Cover letter header
  const [contactName, setContactName] = useState(draft?.contactName ?? defaultContactName);
  const [contactTitle, setContactTitle] = useState(draft?.contactTitle ?? defaultContactTitle);
  const [clientCompany, setClientCompany] = useState(defaultClientCompany);
  const [reSubject, setReSubject] = useState(draft?.reSubject ?? "");
  const [reSubjectEdited, setReSubjectEdited] = useState(draft?.reSubjectEdited ?? false);

  // Cover letter body — reference notes table
  const [refRows, setRefRows] = useState<{ id: number; type: "drawing" | "min_order" | "other"; reference: string; note: string }[]>(
    () => draft?.refRows ?? []
  );
  const nextRefId = useRef((draft?.refRows?.length ?? 0));
  function addRefRow() {
    setRefRows((prev) => [...prev, { id: nextRefId.current++, type: "drawing", reference: "", note: "" }]);
  }
  function removeRefRow(id: number) {
    setRefRows((prev) => prev.filter((r) => r.id !== id));
  }
  function updateRefRow(id: number, field: "type" | "reference" | "note", value: string) {
    setRefRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }
  const refNotes: RefNote[] = refRows
    .filter((r) => r.reference || r.note)
    .map(({ type, reference, note }) => ({ type, reference, note }));

  // Exclusions — an editable checklist of common items plus free-form custom rows
  const [exclusionRows, setExclusionRows] = useState<{ id: number; label: string; checked: boolean }[]>(
    () => {
      if (draft?.exclusionRows) return draft.exclusionRows;
      const legacySelected = (draft as unknown as { selectedExclusions?: string[] } | null)?.selectedExclusions ?? [];
      return DEFAULT_EXCLUSIONS.map((label, i) => ({
        id: i,
        label,
        checked: legacySelected.includes(label),
      }));
    }
  );
  function toggleExclusionRow(id: number) {
    setExclusionRows((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  }
  function updateExclusionLabel(id: number, label: string) {
    setExclusionRows((prev) => prev.map((r) => (r.id === id ? { ...r, label } : r)));
  }
  const [customExclusions, setCustomExclusions] = useState<{ id: number; text: string }[]>(
    () => draft?.customExclusions ?? []
  );
  const nextExclusionId = useRef(draft?.customExclusions?.length ?? 0);
  function addCustomExclusion() {
    setCustomExclusions((prev) => [...prev, { id: nextExclusionId.current++, text: "" }]);
  }
  function updateCustomExclusion(id: number, text: string) {
    setCustomExclusions((prev) => prev.map((r) => (r.id === id ? { ...r, text } : r)));
  }
  function removeCustomExclusion(id: number) {
    setCustomExclusions((prev) => prev.filter((r) => r.id !== id));
  }
  const exclusions = useMemo(
    () => [
      ...exclusionRows.filter((r) => r.checked && r.label.trim()).map((r) => r.label.trim()),
      ...customExclusions.map((r) => r.text.trim()).filter(Boolean),
    ],
    [exclusionRows, customExclusions]
  );
  const [capabilitiesText, setCapabilitiesText] = useState(
    () => draft?.capabilitiesText ?? textToHtml(DEFAULT_CAPABILITIES)
  );
  const [approachIntro, setApproachIntro] = useState(draft?.approachIntro ?? DEFAULT_APPROACH_INTRO);
  const [approachPointsText, setApproachPointsText] = useState(
    draft?.approachPointsText ?? DEFAULT_APPROACH_POINTS.join("\n")
  );
  const [closingText, setClosingText] = useState(draft?.closingText ?? DEFAULT_CLOSING);

  // Signatory
  const [signatoryName, setSignatoryName] = useState(draft?.signatoryName ?? "");
  const [signatoryTitle, setSignatoryTitle] = useState(draft?.signatoryTitle ?? "Business Development Manager");
  const [signatoryCompany, setSignatoryCompany] = useState(draft?.signatoryCompany ?? org.name);
  const [signatoryPhone, setSignatoryPhone] = useState(draft?.signatoryPhone ?? (org.phone ?? ""));
  const [signatoryEmail, setSignatoryEmail] = useState(draft?.signatoryEmail ?? (org.org_email ?? ""));

  // Quote selection (ordered)
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>(
    draft?.selectedQuoteIds ?? quotes.map((q) => q.id)
  );

  // Which selected quotes to show pricing for in the cover letter
  const [pricedQuoteIds, setPricedQuoteIds] = useState<string[]>(
    draft?.pricedQuoteIds ?? quotes.map((q) => q.id)
  );

  // Per-quote conforming/non-conforming + level settings
  const [quoteSettings, setQuoteSettings] = useState<Record<string, { type: "conforming" | "non-conforming"; level: string }>>(
    draft?.quoteSettings ?? {}
  );

  function updateQuoteSetting(id: string, field: "type" | "level", value: string) {
    setQuoteSettings((prev) => ({
      ...prev,
      [id]: { ...{ type: "conforming" as const, level: "" }, ...prev[id], [field]: value },
    }));
  }

  // Takeoff selection
  const [selectedTakeoffIds, setSelectedTakeoffIds] = useState<string[]>(
    draft?.selectedTakeoffIds ?? []
  );

  function toggleTakeoff(id: string) {
    setSelectedTakeoffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Notes & terms deduplication
  const [dedupeNotesTerms, setDedupeNotesTerms] = useState(draft?.dedupeNotesTerms ?? true);

  // ── Auto-save ──────────────────────────────────────────────────────────────

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draftSnapshot = useMemo<PackDraft>(() => ({
    clientName, projectName: projectNameState, packageName, packDate,
    contactName, contactTitle, clientCompany,
    reSubject, reSubjectEdited,
    refRows, capabilitiesText, approachIntro, approachPointsText, closingText,
    signatoryName, signatoryTitle, signatoryCompany, signatoryPhone, signatoryEmail,
    selectedQuoteIds, pricedQuoteIds, quoteSettings, selectedTakeoffIds, dedupeNotesTerms,
    exclusionRows, customExclusions,
  }), [
    clientName, projectNameState, packageName, packDate,
    contactName, contactTitle, clientCompany,
    reSubject, reSubjectEdited,
    refRows, capabilitiesText, approachIntro, approachPointsText, closingText,
    signatoryName, signatoryTitle, signatoryCompany, signatoryPhone, signatoryEmail,
    selectedQuoteIds, pricedQuoteIds, quoteSettings, selectedTakeoffIds, dedupeNotesTerms,
    exclusionRows, customExclusions,
  ]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("idle");
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await savePackDraft(project.id, draftSnapshot);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("idle");
      }
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [draftSnapshot, project.id]);

  // Attached docs
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState<null | "preview" | "send">(null);

  // Pre-fetch org logo as a PDF-safe (png/jpeg/svg) base64 URL so react-pdf can
  // embed it without making cross-origin requests or choking on formats like webp
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!org.logo_url) return;
    toPdfSafeDataUrl(org.logo_url).then(setLogoDataUrl);
  }, [org.logo_url]);

  // Live cover letter preview
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [liveInstance, updateLivePDF] = usePDF({
    document: <CoverLetterDoc
      orgLogoUrl={logoDataUrl} orgName={org.name} orgAbn={org.abn ?? ""}
      orgAddress={org.address ?? ""} orgPhone={org.phone ?? ""} orgEmail={org.org_email ?? ""}
      packDate={packDate} contactName={contactName} contactTitle={contactTitle}
      clientCompany={clientCompany} reSubject="" refNotes={[]} exclusions={[]} quotePricing={[]}
      capabilitiesText={capabilitiesText} approachIntro={approachIntro}
      approachPoints={approachPointsText.split("\n").map((l) => l.trim()).filter(Boolean)}
      closingText={closingText} signatoryName={signatoryName} signatoryTitle={signatoryTitle}
      signatoryCompany={signatoryCompany} signatoryPhone={signatoryPhone} signatoryEmail={signatoryEmail}
    />,
  });


  // Compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePdfBlob, setComposePdfBlob] = useState<Blob | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Computed ───────────────────────────────────────────────────────────────

  const selectedQuotes = useMemo(
    () =>
      selectedQuoteIds
        .map((id) => quotes.find((q) => q.id === id))
        .filter((q): q is QuoteRow => q !== undefined),
    [selectedQuoteIds, quotes]
  );

  const pricedQuotes = useMemo(
    () => quotes.filter((q) => pricedQuoteIds.includes(q.id) && q.total_ex_gst != null),
    [quotes, pricedQuoteIds]
  );

  function togglePricedQuote(id: string) {
    setPricedQuoteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const sections = useMemo<TocSection[]>(() => {
    let n = 1;
    const secs: TocSection[] = [];
    secs.push({ number: n++, title: "SPM COVER LETTER" });
    if (selectedQuoteIds.length > 0) {
      secs.push({ number: n++, title: "CONFORMING QUOTES" });
    }
    if (selectedTakeoffIds.length > 0) {
      secs.push({ number: n++, title: "QUANTITY TAKEOFF SCHEDULE" });
    }
    for (const doc of attachedDocs) {
      secs.push({
        number: n++,
        title: (doc.title || "UNTITLED DOCUMENT").toUpperCase(),
      });
    }
    return secs;
  }, [selectedQuoteIds, selectedTakeoffIds, attachedDocs]);

  // Auto-update RE subject when key fields change
  const derivedRe = useMemo(() => {
    const sites = selectedQuotes
      .map((q) => q.project_loc || q.project_ref || q.quote_number)
      .filter(Boolean);
    const siteList =
      sites.length > 1
        ? sites.slice(0, -1).join(", ") + " & " + sites[sites.length - 1]
        : sites[0] ?? "";
    return `Quotation for ${packageName} — ${projectNameState}${siteList ? ` — ${siteList}` : ""}`;
  }, [selectedQuotes, packageName, projectNameState]);

  // Use derived RE unless user has manually edited it
  const effectiveRe = reSubjectEdited ? reSubject : derivedRe;

  // Debounced live cover letter preview update
  useEffect(() => {
    const t = setTimeout(() => {
      updateLivePDF(<CoverLetterDoc
        orgLogoUrl={logoDataUrl} orgName={org.name} orgAbn={org.abn ?? ""}
        orgAddress={org.address ?? ""} orgPhone={org.phone ?? ""} orgEmail={org.org_email ?? ""}
        packDate={packDate} contactName={contactName} contactTitle={contactTitle}
        clientCompany={clientCompany} reSubject={effectiveRe} refNotes={refNotes}
        exclusions={exclusions}
        quotePricing={pricedQuotes.map((q) => ({
          quoteNumber: q.quote_number,
          site: q.project_loc || q.project_ref || "",
          totalExGst: q.total_ex_gst!,
          grandTotal: q.grand_total ?? q.total_ex_gst! * 1.1,
          quoteType: quoteSettings[q.id]?.type ?? "conforming",
          quoteLevel: quoteSettings[q.id]?.level ?? "",
        }))}
        capabilitiesText={capabilitiesText} approachIntro={approachIntro}
        approachPoints={approachPointsText.split("\n").map((l) => l.trim()).filter(Boolean)}
        closingText={closingText} signatoryName={signatoryName} signatoryTitle={signatoryTitle}
        signatoryCompany={signatoryCompany} signatoryPhone={signatoryPhone} signatoryEmail={signatoryEmail}
      />);
    }, 500);
    return () => clearTimeout(t);
  }, [
    org, logoDataUrl, packDate, contactName, contactTitle, clientCompany, effectiveRe, refNotes,
    exclusions, pricedQuotes, quoteSettings, capabilitiesText, approachIntro, approachPointsText, closingText,
    signatoryName, signatoryTitle, signatoryCompany, signatoryPhone, signatoryEmail,
    updateLivePDF,
  ]);

  // ── Quote selection helpers ────────────────────────────────────────────────

  function toggleQuote(id: string) {
    setSelectedQuoteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function moveQuote(id: string, dir: "up" | "down") {
    setSelectedQuoteIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  // ── Attached docs helpers ──────────────────────────────────────────────────

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const pdfs = files.filter((f) => f.type === "application/pdf");
    if (pdfs.length < files.length) {
      toast.error("Only PDF files can be attached.");
    }
    const newDocs: AttachedDoc[] = pdfs.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      title: f.name.replace(/\.pdf$/i, ""),
    }));
    setAttachedDocs((prev) => [...prev, ...newDocs]);
    e.target.value = "";
  }

  function updateDocTitle(id: string, title: string) {
    setAttachedDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title } : d))
    );
  }

  function removeDoc(id: string) {
    setAttachedDocs((prev) => prev.filter((d) => d.id !== id));
  }

  function moveDoc(id: string, dir: "up" | "down") {
    setAttachedDocs((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  // Pure PDF generation — returns the merged Blob with all documents included.
  // Used by both the preview flow and the send flow so attached docs are never lost.
  const generatePdfBlob = useCallback(async (): Promise<Blob> => {
    const { PDFDocument } = await import("pdf-lib");

    const approachPoints = approachPointsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const coverBlob = await pdf(
      <CoverPageDoc
        orgLogoUrl={logoDataUrl}
        clientName={clientName}
        projectName={projectNameState}
        packageName={packageName}
        sections={sections}
      />
    ).toBlob();

    const letterBlob = await pdf(
      <CoverLetterDoc
        orgLogoUrl={logoDataUrl}
        orgName={org.name}
        orgAbn={org.abn ?? ""}
        orgAddress={org.address ?? ""}
        orgPhone={org.phone ?? ""}
        orgEmail={org.org_email ?? ""}
        packDate={packDate}
        contactName={contactName}
        contactTitle={contactTitle}
        clientCompany={clientCompany}
        reSubject={effectiveRe}
        refNotes={refNotes}
        exclusions={exclusions}
        quotePricing={pricedQuotes.map((q) => ({
          quoteNumber: q.quote_number,
          site: q.project_loc || q.project_ref || "",
          totalExGst: q.total_ex_gst!,
          grandTotal: q.grand_total ?? q.total_ex_gst! * 1.1,
          quoteType: quoteSettings[q.id]?.type ?? "conforming",
          quoteLevel: quoteSettings[q.id]?.level ?? "",
        }))}
        capabilitiesText={capabilitiesText}
        approachIntro={approachIntro}
        approachPoints={approachPoints}
        closingText={closingText}
        signatoryName={signatoryName}
        signatoryTitle={signatoryTitle}
        signatoryCompany={signatoryCompany}
        signatoryPhone={signatoryPhone}
        signatoryEmail={signatoryEmail}
      />
    ).toBlob();

    const quoteBlobs = await Promise.all(
      selectedQuotes.map((q, i) =>
        pdf(
          <QuotePdfDocument
            companyName={q.company_name ?? org.name}
            companyAbn={q.company_abn ?? org.abn ?? ""}
            companyAddress={q.company_address ?? org.address ?? ""}
            companyPhone={q.company_phone ?? org.phone ?? ""}
            companyEmail={q.company_email ?? org.org_email ?? ""}
            orgLogoUrl={logoDataUrl}
            qNumber={q.quote_number}
            qDate={q.quote_date}
            qValidity={q.valid_for ?? "30 days from date of issue"}
            toName={q.to_name ?? ""}
            toAddress={q.to_address ?? ""}
            toContact={q.to_contact ?? ""}
            toEmail={q.to_email ?? ""}
            projectRef={q.project_ref ?? ""}
            projectLoc={q.project_loc ?? ""}
            scopeText={q.scope_text ?? ""}
            lines={(q.lines as QuotePdfLine[]) ?? []}
            totalExGst={q.total_ex_gst ?? 0}
            gst={q.gst ?? 0}
            grandTotal={q.grand_total ?? 0}
            notes={q.notes ?? ""}
            terms={q.terms ?? ""}
            omitNotesAndTerms={dedupeNotesTerms && i < selectedQuotes.length - 1}
          />
        ).toBlob()
      )
    );

    const takeoffBlob =
      selectedTakeoffIds.length > 0
        ? await fetch(
            `/api/takeoff-pdf?projectId=${project.id}&orgSlug=${orgSlug}&takeoffIds=${selectedTakeoffIds.join(",")}`
          ).then((r) => {
            if (!r.ok) throw new Error("Failed to fetch takeoff PDF");
            return r.blob();
          })
        : null;

    const mergedDoc = await PDFDocument.create();

    const addPages = async (blob: Blob) => {
      const bytes = await blob.arrayBuffer();
      const src = await PDFDocument.load(bytes);
      const copied = await mergedDoc.copyPages(src, src.getPageIndices());
      copied.forEach((p) => mergedDoc.addPage(p));
    };

    await addPages(coverBlob);
    await addPages(letterBlob);
    for (const b of quoteBlobs) await addPages(b);
    if (takeoffBlob) await addPages(takeoffBlob);

    for (const { file } of attachedDocs) {
      try {
        const bytes = await file.arrayBuffer();
        const src = await PDFDocument.load(bytes);
        const copied = await mergedDoc.copyPages(src, src.getPageIndices());
        copied.forEach((p) => mergedDoc.addPage(p));
      } catch {
        toast.error(`Could not read "${file.name}" — it may be password-protected.`);
      }
    }

    const finalBytes = await mergedDoc.save();
    return new Blob([finalBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  }, [
    org, orgSlug, logoDataUrl, clientName, projectNameState, packageName, sections, packDate,
    contactName, contactTitle, clientCompany, effectiveRe, refNotes, exclusions,
    selectedQuotes, pricedQuotes, capabilitiesText, approachIntro, approachPointsText,
    closingText, signatoryName, signatoryTitle, signatoryCompany,
    signatoryPhone, signatoryEmail, selectedTakeoffIds, attachedDocs,
  ]);

  const handleGenerate = useCallback(async () => {
    setGenerating("preview");
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate submission pack.");
    } finally {
      setGenerating(null);
    }
  }, [generatePdfBlob, previewUrl]);

  // Opens compose modal — reuses the already-previewed blob if available,
  // otherwise generates fresh so attached docs are always included.
  const handleOpenCompose = useCallback(async () => {
    setGenerating("send");
    try {
      let blob: Blob;
      if (previewUrl) {
        blob = await fetch(previewUrl).then((r) => r.blob());
      } else {
        blob = await generatePdfBlob();
      }
      setComposePdfBlob(blob);
      setPreviewOpen(false);
      setComposeOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate submission pack.");
    } finally {
      setGenerating(null);
    }
  }, [generatePdfBlob, previewUrl]);

  function handleDownload() {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `SPM_${slugify(clientName)}_${slugify(projectNameState)}_Submission.pdf`;
    a.click();
  }

  function handleClosePreview() {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1400px] mx-auto py-6 px-4 space-y-5 text-[11px]">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link
          href={`/orgs/${orgSlug}/projects`}
          className="hover:text-foreground transition-colors"
        >
          Projects
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/orgs/${orgSlug}/projects/${project.id}`}
          className="hover:text-foreground transition-colors"
        >
          {project.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/orgs/${orgSlug}/projects/${project.id}/quotes`}
          className="hover:text-foreground transition-colors"
        >
          Quotes
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Submission Pack</span>
      </nav>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Generate Submission Pack</h1>
          {saveStatus === "saving" && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-[10px] text-muted-foreground">Saved</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <MarkSentDialog projectId={project.id} defaultRecipientName={clientName} />
          <Button
            onClick={handleOpenCompose}
            disabled={generating !== null}
            variant="outline"
            className="gap-1.5 text-xs"
          >
            {generating === "send" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send Email
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating !== null}
            className="gap-1.5 text-xs"
          >
            {generating === "preview" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {generating === "preview" ? "Building pack…" : "Preview & Download"}
          </Button>
        </div>
      </div>

      {/* Sent history — record of who this pack has been sent to */}
      {sends.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {sends.map((s) => (
            <span
              key={s.id}
              title={
                s.manual
                  ? `Marked as sent on ${formatSentDate(s.sent_at)}`
                  : `Sent to ${s.recipient_email} on ${formatSentAt(s.sent_at)}`
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-700 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              {s.manual ? "Marked as sent to" : "Sent to"} {s.recipient_name} ·{" "}
              {s.manual ? formatSentDate(s.sent_at) : formatSentAt(s.sent_at)}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-6 items-start">
        {/* Left: form cards */}
        <div className="space-y-5">

      {/* Pack Details */}
      <Card title="Pack Details">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Client name" value={clientName} onChange={setClientName} placeholder="e.g. Connex Management & Constructions" />
          <Field label="Project name" value={projectNameState} onChange={setProjectNameState} placeholder="e.g. PPS 4 Stream Newcastle" />
          <Field label="Package name" value={packageName} onChange={setPackageName} placeholder="e.g. Floor Coverings" />
          <Field label="Date" value={packDate} onChange={setPackDate} />
        </div>
      </Card>

      {/* Cover Letter */}
      <Card title="Cover Letter">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact name (ATTN)" value={contactName} onChange={setContactName} placeholder="e.g. Simon Smith" />
          <Field label="Contact title" value={contactTitle} onChange={setContactTitle} placeholder="e.g. Contract Administrator" />
          <Field label="Client company" value={clientCompany} onChange={setClientCompany} placeholder="e.g. Connex Management & Construction" />
          <div>
            <SectionLabel>RE subject line</SectionLabel>
            <input
              value={effectiveRe}
              onChange={(e) => {
                setReSubject(e.target.value);
                setReSubjectEdited(true);
              }}
              placeholder="Auto-generated from quotes"
              className="w-full bg-background/60 border border-border rounded-md px-2.5 h-7 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
            />
            {reSubjectEdited && (
              <button
                className="text-[10px] text-muted-foreground hover:text-primary mt-1"
                onClick={() => setReSubjectEdited(false)}
              >
                Reset to auto
              </button>
            )}
          </div>
        </div>

        {/* Reference Notes table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionLabel>Reference notes (drawings, minimum order notes, etc.)</SectionLabel>
            <button
              type="button"
              onClick={addRefRow}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" /> Add row
            </button>
          </div>
          {refRows.length === 0 ? (
            <button
              type="button"
              onClick={addRefRow}
              className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-md text-xs text-muted-foreground/60 hover:text-muted-foreground hover:border-border/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add drawing or note
            </button>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left pb-1.5 pr-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-[110px]">Type</th>
                  <th className="text-left pb-1.5 pr-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-[38%]">Reference / Drawing No.</th>
                  <th className="text-left pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Note / Description</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {refRows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-1 pr-2 align-middle">
                      <select
                        value={row.type}
                        onChange={(e) => updateRefRow(row.id, "type", e.target.value)}
                        className="w-full bg-background/60 border border-border rounded-sm px-1.5 h-7 text-[11px] text-foreground/80 outline-none focus:ring-1 focus:ring-primary/50"
                      >
                        <option value="drawing">Drawing</option>
                        <option value="min_order">Min Order</option>
                        <option value="other">Other</option>
                      </select>
                    </td>
                    <td className="py-1 pr-2 align-middle">
                      <input
                        value={row.reference}
                        onChange={(e) => updateRefRow(row.id, "reference", e.target.value)}
                        placeholder={row.type === "drawing" ? "e.g. DR-A-0220" : row.type === "min_order" ? "e.g. Carpet tile" : ""}
                        className="w-full bg-background/60 border border-border rounded-sm px-2 h-7 text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </td>
                    <td className="py-1 align-middle">
                      <input
                        value={row.note}
                        onChange={(e) => updateRefRow(row.id, "note", e.target.value)}
                        placeholder={row.type === "drawing" ? "e.g. FINISHES PLANS — Rev E" : row.type === "min_order" ? "e.g. Min 50 m² per colour" : ""}
                        className="w-full bg-background/60 border border-border rounded-sm px-2 h-7 text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </td>
                    <td className="py-1 pl-1.5 align-middle">
                      <button
                        type="button"
                        onClick={() => removeRefRow(row.id)}
                        className="text-muted-foreground/40 hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Exclusions */}
        <div className="space-y-2">
          <SectionLabel>Exclusions (shown as a table in the cover letter)</SectionLabel>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {exclusionRows.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={() => toggleExclusionRow(row.id)}
                  className="h-3.5 w-3.5 accent-primary flex-shrink-0"
                />
                <input
                  value={row.label}
                  onChange={(e) => updateExclusionLabel(row.id, e.target.value)}
                  className="flex-1 bg-background/60 border border-border rounded-sm px-2 h-7 text-[11px] text-foreground/70 outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            ))}
          </div>

          {customExclusions.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {customExclusions.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    value={row.text}
                    onChange={(e) => updateCustomExclusion(row.id, e.target.value)}
                    placeholder="e.g. Skirting & coving"
                    className="flex-1 bg-background/60 border border-border rounded-sm px-2 h-7 text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomExclusion(row.id)}
                    className="text-muted-foreground/40 hover:text-destructive transition-colors flex-shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addCustomExclusion}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" /> Add custom exclusion
          </button>
        </div>

        {quotes.length > 0 && (
          <div>
            <SectionLabel>Quotation pricing (shown in cover letter before capabilities)</SectionLabel>
            <div className="space-y-1.5">
              {quotes.map((q) => {
                const checked = pricedQuoteIds.includes(q.id);
                const settings = quoteSettings[q.id] ?? { type: "conforming", level: "" };
                return (
                  <div
                    key={q.id}
                    className={cn(
                      "rounded-lg border transition-colors",
                      checked ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20 opacity-60"
                    )}
                  >
                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePricedQuote(q.id)}
                        className="h-3.5 w-3.5 accent-primary flex-shrink-0"
                      />
                      <span className="text-[11px] font-mono text-foreground/80">{q.quote_number}</span>
                      {(q.project_loc || q.project_ref) && (
                        <span className="text-[11px] text-muted-foreground">— {q.project_loc || q.project_ref}</span>
                      )}
                      <span className="ml-auto text-[11px] tabular-nums text-muted-foreground flex-shrink-0">
                        {q.total_ex_gst != null ? `$${fmt(q.total_ex_gst)} ex GST` : "no price"}
                      </span>
                    </label>
                    {checked && (
                      <div className="flex items-center gap-2 px-3 pb-2">
                        <select
                          value={settings.type}
                          onChange={(e) => updateQuoteSetting(q.id, "type", e.target.value)}
                          className="bg-background/60 border border-border rounded-sm px-2 h-6 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/50"
                        >
                          <option value="conforming">Conforming</option>
                          <option value="non-conforming">Non-conforming</option>
                        </select>
                        <input
                          value={settings.level}
                          onChange={(e) => updateQuoteSetting(q.id, "level", e.target.value)}
                          placeholder="Level (e.g. Level 3/4) — optional"
                          className="flex-1 bg-background/60 border border-border rounded-sm px-2 h-6 text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <SectionLabel>Capabilities paragraph</SectionLabel>
          <RichEditor value={capabilitiesText} onChange={setCapabilitiesText} rows={6} />
        </div>

        <Field
          label="Our approach — intro paragraph(s)"
          value={approachIntro}
          onChange={setApproachIntro}
          textarea
          rows={4}
        />

        <Field
          label="Approach bullet points (one per line)"
          value={approachPointsText}
          onChange={setApproachPointsText}
          textarea
          rows={8}
        />

        <Field
          label="Closing paragraph"
          value={closingText}
          onChange={setClosingText}
          textarea
          rows={2}
        />

        <div className="pt-2 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Sign-off
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Signatory name" value={signatoryName} onChange={setSignatoryName} placeholder="e.g. Bilal Khan" />
            <Field label="Signatory title" value={signatoryTitle} onChange={setSignatoryTitle} placeholder="e.g. Business Development Manager" />
            <Field label="Company" value={signatoryCompany} onChange={setSignatoryCompany} />
            <Field label="Phone" value={signatoryPhone} onChange={setSignatoryPhone} />
            <Field label="Email" value={signatoryEmail} onChange={setSignatoryEmail} />
          </div>
        </div>
      </Card>

      {/* Documents to include */}
      <Card title="Documents to include">
        {/* Conforming Quotes subsection */}
        <div>
          <p className="text-[11px] font-medium text-foreground/70 mb-1.5">
            Conforming Quotes{" "}
            <span className="text-muted-foreground font-normal">
              ({selectedQuoteIds.length} of {quotes.length} selected)
            </span>
          </p>
          {quotes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-1">
              No quotes saved yet.{" "}
              <Link
                href={`/orgs/${orgSlug}/projects/${project.id}`}
                className="text-primary hover:underline"
              >
                Create quotes from an estimate
              </Link>{" "}
              first.
            </p>
          ) : (
            <div className="space-y-1.5">
              {quotes.map((q) => {
                const selected = selectedQuoteIds.includes(q.id);
                const idx = selectedQuoteIds.indexOf(q.id);
                return (
                  <div
                    key={q.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors",
                      selected
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-muted/20 opacity-60"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleQuote(q.id)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-mono text-foreground/80">
                        {q.quote_number}
                      </span>
                      {(q.project_loc || q.project_ref) && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          — {q.project_loc || q.project_ref}
                        </span>
                      )}
                    </div>
                    {q.total_ex_gst != null && (
                      <span className="text-xs tabular-nums text-muted-foreground flex-shrink-0">
                        ${fmt(q.total_ex_gst)} ex GST
                      </span>
                    )}
                    {selected && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => moveQuote(q.id, "up")}
                          disabled={idx === 0}
                          className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveQuote(q.id, "down")}
                          disabled={idx === selectedQuoteIds.length - 1}
                          className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedQuoteIds.length > 1 && (
          <label className="flex items-center gap-2.5 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={dedupeNotesTerms}
              onChange={(e) => setDedupeNotesTerms(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            <span className="text-[11px] text-foreground/70">
              Include notes &amp; terms on last quote only
            </span>
          </label>
        )}

        <div className="h-px bg-border/50 my-3" />

        {/* Quantity Takeoff subsection */}
        <div>
          <p className="text-[11px] font-medium text-foreground/70 mb-1.5">
            Quantity Takeoff Schedule{" "}
            <span className="text-muted-foreground font-normal">
              ({selectedTakeoffIds.length} of {takeoffs.length} selected)
            </span>
          </p>
          {takeoffs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-1">
              No takeoffs for this project.
            </p>
          ) : (
            <div className="space-y-1.5">
              {takeoffs.map((t) => {
                const selected = selectedTakeoffIds.includes(t.id);
                const rowCount = takeoffRows.filter((r) => r.takeoff_id === t.id).length;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors",
                      selected
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-muted/20 opacity-60"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleTakeoff(t.id)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-foreground/80">{t.name}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        — {rowCount} item{rowCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <Link
                      href={`/orgs/${orgSlug}/projects/${project.id}/takeoff/print?takeoffId=${t.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                    >
                      Preview ↗
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-px bg-border/50 my-3" />

        {/* Additional documents subsection */}
        <div>
          <p className="text-[11px] font-medium text-foreground/70 mb-1.5">
            Additional Documents
            <span className="ml-1.5 text-muted-foreground font-normal">
              BOQ markups, ITP, insurance certificates, etc.
            </span>
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileAdd}
            className="hidden"
          />

          {attachedDocs.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {attachedDocs.map((doc, i) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20"
                >
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <input
                    value={doc.title}
                    onChange={(e) => updateDocTitle(doc.id, e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-[11px] text-foreground outline-none focus:bg-background/60 rounded px-1 py-0.5 transition-colors"
                    placeholder="Section title"
                  />
                  <span className="text-[10px] text-muted-foreground/50 flex-shrink-0 hidden sm:block">
                    {doc.file.name}
                  </span>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => moveDoc(doc.id, "up")}
                      disabled={i === 0}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveDoc(doc.id, "down")}
                      disabled={i === attachedDocs.length - 1}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeDoc(doc.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Attach PDF
          </button>
        </div>
      </Card>

      {/* Section structure preview */}
      <Card title="Pack structure">
        <div className="space-y-1">
          {sections.map((sec) => (
            <div key={sec.number} className="flex items-center gap-3 py-1">
              <span className="w-6 text-center text-xs font-mono text-muted-foreground">
                {sec.number}
              </span>
              <span className="text-[11px] text-foreground/70">{sec.title}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Generate button (bottom) */}
      <div className="flex justify-end pb-6">
        <Button
          onClick={handleGenerate}
          disabled={generating !== null}
          size="lg"
          className="gap-2"
        >
          {generating === "preview" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {generating === "preview" ? "Building pack…" : "Preview & Download"}
        </Button>
      </div>

        </div>{/* end left column */}

        {/* Right: live cover letter preview */}
        <div className="sticky top-4">
          <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Cover Letter Preview
              </h2>
              <span className="text-[10px] text-muted-foreground/60">Updates after 0.5s pause</span>
            </div>
            {mounted && liveInstance.url ? (
              <iframe
                src={`${liveInstance.url}#zoom=60`}
                className="w-full border-0"
                style={{ height: "88vh" }}
                title="Cover Letter Preview"
              />
            ) : (
              <div className="h-[88vh] flex items-center justify-center text-xs text-muted-foreground">
                {liveInstance.loading ? "Rendering…" : "Loading preview…"}
              </div>
            )}
          </div>
        </div>
      </div>{/* end grid */}

      {/* PDF preview modal */}
      {/* Compose modal — rendered in same page so attached docs blob survives */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => router.refresh()}
        pdfBlob={composePdfBlob}
        filename={`SPM_${slugify(clientName)}_${slugify(projectNameState)}_Submission.pdf`}
        hasGmail={hasGmail}
        projectId={project.id}
        recipientName={clientName}
        defaultTo={selectedQuotes[0]?.to_email ?? ""}
        defaultSubject={`SPM Submission — ${packageName} — ${projectNameState}`}
        defaultBody={buildComposeBody({
          contactName,
          projectName: projectNameState,
          clientCompany,
          packageName,
          selectedQuotes,
          combinedTotal: selectedQuotes.reduce((s, q) => s + (q.total_ex_gst ?? 0), 0),
          signatoryName,
          signatoryTitle,
          signatoryCompany,
          signatoryPhone,
          signatoryEmail,
        })}
      />

      {previewOpen && previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-card">
          <div className="flex-none flex items-center justify-between px-4 pt-6 pb-3 bg-card/95 backdrop-blur-xl">
            <span className="text-sm font-medium text-foreground">
              Submission Pack Preview
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleOpenCompose}
                disabled={generating !== null}
                className="gap-1.5 text-xs"
              >
                {generating === "send" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send Email
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClosePreview}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Close
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title="Submission Pack Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
