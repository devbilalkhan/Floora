"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ArrowLeft,
  Send,
  Loader2,
  Mail,
  Plus,
  Trash2,
  FileText,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { CoverPageDoc, type TocSection } from "@/components/pdf/submission-cover-page";
import { CoverLetterDoc, type RefNote } from "@/components/pdf/submission-cover-letter";
import { QuotePdfDocument, type QuotePdfLine } from "../../estimates/[estimateId]/quote/quote-pdf-document";
import type { TakeoffRow } from "@/lib/takeoff-types";
import { cn } from "@/lib/utils";
import type { PackDraft } from "../actions";

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function slugify(s: string) {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function buildEmailBody(opts: {
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

  const combined = fmtMoney(opts.combinedTotal);

  return `Dear ${opts.contactName},

Thank you for the opportunity to submit our pricing for ${opts.projectName}. Please find attached our full submission package for the ${opts.packageName} package, prepared for ${opts.clientCompany}.

Our submission includes the following:

• Cover letter and scope overview
${quoteBullets}
• Detailed flooring BOQs and plan markups
• Public & Product Liability Certificate of Currency
• Workers Insurance Certificate of Currency
• Inspection and Test Plan (ITP)

Our combined submission total is ${combined} ex GST.

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

// ── SendEmailComposer ─────────────────────────────────────────────────────────

export function SendEmailComposer({
  orgSlug,
  project,
  org,
  quotes,
  takeoffRows,
  today,
  draft,
  hasGmail,
  senderEmail,
}: {
  orgSlug: string;
  project: Project;
  org: Org;
  quotes: QuoteRow[];
  takeoffRows: TakeoffRow[];
  today: string;
  draft: PackDraft | null;
  hasGmail: boolean;
  senderEmail: string;
}) {
  const router = useRouter();

  // Restore draft state (mirrors pack-builder)
  const firstQuote = quotes[0];
  const d = draft;

  const clientName = d?.clientName ?? firstQuote?.to_name ?? project.head_client ?? "";
  const projectName = d?.projectName ?? project.name;
  const packageName = d?.packageName ?? "Floor Coverings";
  const packDate = d?.packDate ?? today;
  const contactName = d?.contactName ?? firstQuote?.to_contact ?? "";
  const contactTitle = d?.contactTitle ?? "";
  const clientCompany = d?.clientCompany ?? firstQuote?.to_name ?? project.head_client ?? "";
  const reSubjectEdited = d?.reSubjectEdited ?? false;
  const reSubjectSaved = d?.reSubject ?? "";
  const capabilitiesText = d?.capabilitiesText ?? "";
  const approachIntro = d?.approachIntro ?? "";
  const approachPointsText = d?.approachPointsText ?? "";
  const closingText = d?.closingText ?? "";
  const signatoryName = d?.signatoryName ?? "";
  const signatoryTitle = d?.signatoryTitle ?? "Business Development Manager";
  const signatoryCompany = d?.signatoryCompany ?? org.name;
  const signatoryPhone = d?.signatoryPhone ?? org.phone ?? "";
  const signatoryEmail = d?.signatoryEmail ?? org.org_email ?? "";
  const selectedQuoteIds = d?.selectedQuoteIds ?? quotes.map((q) => q.id);
  const selectedTakeoffIds = d?.selectedTakeoffIds ?? [];
  const dedupeNotesTerms = d?.dedupeNotesTerms ?? true;
  const refRows = d?.refRows ?? [];

  const selectedQuotes = useMemo(
    () =>
      selectedQuoteIds
        .map((id) => quotes.find((q) => q.id === id))
        .filter((q): q is QuoteRow => q !== undefined),
    [selectedQuoteIds, quotes]
  );

  const combinedTotal = useMemo(
    () => selectedQuotes.reduce((sum, q) => sum + (q.total_ex_gst ?? 0), 0),
    [selectedQuotes]
  );

  // Derived RE subject (same logic as pack-builder)
  const derivedRe = useMemo(() => {
    const sites = selectedQuotes
      .map((q) => q.project_loc || q.project_ref || q.quote_number)
      .filter(Boolean);
    const siteList =
      sites.length > 1
        ? sites.slice(0, -1).join(", ") + " & " + sites[sites.length - 1]
        : sites[0] ?? "";
    return `Quotation for ${packageName} — ${projectName}${siteList ? ` — ${siteList}` : ""}`;
  }, [selectedQuotes, packageName, projectName]);

  const effectiveRe = reSubjectEdited ? reSubjectSaved : derivedRe;

  const refNotes: RefNote[] = refRows
    .filter((r) => r.reference || r.note)
    .map(({ type, reference, note }) => ({ type, reference, note }));

  // ── Email form state ───────────────────────────────────────────────────────

  const [to, setTo] = useState(firstQuote?.to_email ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(
    `SPM Submission — ${packageName} — ${projectName}`
  );
  const [body, setBody] = useState(() =>
    buildEmailBody({
      contactName,
      projectName,
      clientCompany,
      packageName,
      selectedQuotes,
      combinedTotal,
      signatoryName,
      signatoryTitle,
      signatoryCompany,
      signatoryPhone,
      signatoryEmail,
    })
  );

  // ── Attached docs ──────────────────────────────────────────────────────────

  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const pdfs = files.filter((f) => f.type === "application/pdf");
    if (pdfs.length < files.length) toast.error("Only PDF files can be attached.");
    setAttachedDocs((prev) => [
      ...prev,
      ...pdfs.map((f) => ({ id: crypto.randomUUID(), file: f, title: f.name.replace(/\.pdf$/i, "") })),
    ]);
    e.target.value = "";
  }

  function updateDocTitle(id: string, title: string) {
    setAttachedDocs((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)));
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

  // ── People API autocomplete ────────────────────────────────────────────────

  const [contactSuggestions, setContactSuggestions] = useState<
    { name: string; email: string }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);

  useEffect(() => {
    if (!hasGmail || to.trim().length < 2) {
      setContactSuggestions([]);
      setShowSuggestions(false);
      setContactsLoading(false);
      return;
    }
    setContactsLoading(true);
    setShowSuggestions(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/gmail/contacts?q=${encodeURIComponent(to)}`);
        const data = await res.json();
        setContactSuggestions(data.contacts ?? []);
      } catch {
        setContactSuggestions([]);
      } finally {
        setContactsLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [to, hasGmail]);

  // ── Send ───────────────────────────────────────────────────────────────────

  const [sending, setSending] = useState(false);

  const sections = useMemo<TocSection[]>(() => {
    let n = 1;
    const secs: TocSection[] = [];
    secs.push({ number: n++, title: "SPM COVER LETTER" });
    if (selectedQuoteIds.length > 0) secs.push({ number: n++, title: "CONFORMING QUOTES" });
    if (selectedTakeoffIds.length > 0)
      secs.push({ number: n++, title: "QUANTITY TAKEOFF SCHEDULE" });
    return secs;
  }, [selectedQuoteIds, selectedTakeoffIds]);

  const handleSend = useCallback(async () => {
    if (!to.trim()) {
      toast.error("Recipient email is required.");
      return;
    }
    setSending(true);
    try {
      const { PDFDocument } = await import("pdf-lib");

      const approachPoints = approachPointsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      // 1. Cover page
      const coverBlob = await pdf(
        <CoverPageDoc
          orgLogoUrl={org.logo_url}
          clientName={clientName}
          projectName={projectName}
          packageName={packageName}
          sections={sections}
        />
      ).toBlob();

      // 2. Cover letter
      const letterBlob = await pdf(
        <CoverLetterDoc
          orgLogoUrl={org.logo_url}
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

      // 3. Quotes
      const quoteBlobs = await Promise.all(
        selectedQuotes.map((q, i) =>
          pdf(
            <QuotePdfDocument
              companyName={q.company_name ?? org.name}
              companyAbn={q.company_abn ?? org.abn ?? ""}
              companyAddress={q.company_address ?? org.address ?? ""}
              companyPhone={q.company_phone ?? org.phone ?? ""}
              companyEmail={q.company_email ?? org.org_email ?? ""}
              orgLogoUrl={org.logo_url}
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

      // 4. Takeoff (if included)
      const takeoffBlob =
        selectedTakeoffIds.length > 0
          ? await fetch(
              `/api/takeoff-pdf?projectId=${project.id}&orgSlug=${orgSlug}&takeoffIds=${selectedTakeoffIds.join(",")}`
            ).then((r) => {
              if (!r.ok) throw new Error("Failed to fetch takeoff PDF");
              return r.blob();
            })
          : null;

      // 5. Merge
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

      // 5b. Additional attached PDFs
      for (const { file, title } of attachedDocs) {
        try {
          await addPages(file);
        } catch {
          toast.error(`Could not read "${title}" — it may be password-protected.`);
        }
      }

      // 6. Base64 encode
      const finalBytes = await mergedDoc.save();
      const pdfBase64 = Buffer.from(finalBytes).toString("base64");
      const filename = `SPM_${slugify(clientName)}_${slugify(projectName)}_Submission.pdf`;

      // 7. Send via API
      const res = await fetch("/api/gmail/send-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject: subject.trim(),
          body,
          pdfBase64,
          filename,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send");
      }

      toast.success("Submission pack sent successfully.");
      router.push(
        `/orgs/${orgSlug}/projects/${project.id}/submission-pack`
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  }, [
    to, cc, subject, body, org, orgSlug, project, clientName, projectName,
    packageName, sections, packDate, contactName, contactTitle, clientCompany,
    effectiveRe, refNotes, capabilitiesText, approachIntro, approachPointsText,
    closingText, signatoryName, signatoryTitle, signatoryCompany, signatoryPhone,
    signatoryEmail, selectedQuotes, selectedTakeoffIds, attachedDocs,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const sharedInput =
    "w-full bg-background/60 border border-border rounded-md text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors px-2.5 h-7";

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-5 text-[11px]">
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
          href={`/orgs/${orgSlug}/projects/${project.id}/submission-pack`}
          className="hover:text-foreground transition-colors"
        >
          Submission Pack
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Send Email</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/orgs/${orgSlug}/projects/${project.id}/submission-pack`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Send Submission Pack</h1>
        </div>
        <Button
          onClick={handleSend}
          disabled={sending || !hasGmail}
          className="gap-1.5 text-xs"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {sending ? "Generating & sending…" : "Send via Gmail"}
        </Button>
      </div>

      {!hasGmail && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
          <Mail className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-600 dark:text-amber-400">
              Gmail not connected
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Link
                href="/login"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Sign in with Google
              </Link>{" "}
              to send emails directly from this app.
            </p>
          </div>
        </div>
      )}

      {/* Recipients */}
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Recipients
          </h2>
        </div>
        <div className="p-4 space-y-3">
          {/* To */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              To *
            </p>
            <div className="relative">
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                onFocus={() => to.trim().length >= 2 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="recipient@example.com"
                className={sharedInput}
                autoComplete="off"
              />
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                  {contactsLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Searching contacts…
                    </div>
                  ) : contactSuggestions.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      No contacts found
                    </p>
                  ) : (
                    contactSuggestions.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={() => {
                          setTo(c.email);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition-colors flex items-center gap-2 min-w-0"
                      >
                        {c.name && (
                          <span className="font-medium text-foreground/80 shrink-0">
                            {c.name}
                          </span>
                        )}
                        <span className="text-muted-foreground truncate">{c.email}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* CC */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              CC
            </p>
            <input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com (optional)"
              className={sharedInput}
            />
          </div>

          {/* Subject */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              Subject
            </p>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={sharedInput}
            />
          </div>
        </div>
      </div>

      {/* Email body */}
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Email body
          </h2>
          <span className="text-[10px] text-muted-foreground">
            Submission pack PDF will be attached automatically
          </span>
        </div>
        <div className="p-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={28}
            className="w-full bg-background/60 border border-border rounded-md text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors px-3 py-2 resize-y leading-relaxed font-mono"
          />
        </div>
      </div>

      {/* Additional documents */}
      <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Additional documents
          </h2>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Re-attach any supplementary PDFs (BOQ markups, insurance certificates, ITP, etc.) to include in the sent pack.
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
            <div className="space-y-1.5">
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
      </div>

      {/* Attachment note */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border">
        <span className="text-muted-foreground text-[11px]">
          Attachment:
        </span>
        <span className="text-[11px] text-foreground/70 font-mono">
          SPM_{slugify(clientName)}_{slugify(projectName)}_Submission.pdf
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          Generated on send
        </span>
      </div>

      {/* Send button (bottom) */}
      <div className="flex justify-end pb-6">
        <Button
          onClick={handleSend}
          disabled={sending || !hasGmail}
          size="lg"
          className="gap-2"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {sending ? "Generating & sending…" : "Send via Gmail"}
        </Button>
      </div>
    </div>
  );
}
