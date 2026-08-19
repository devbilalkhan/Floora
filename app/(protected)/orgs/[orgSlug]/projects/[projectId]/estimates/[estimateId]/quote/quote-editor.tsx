"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronRight, Sparkles, Loader2, Plus, Trash2, Download, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pdf } from "@react-pdf/renderer";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { QuotePdfDocument, type QuotePdfLine } from "./quote-pdf-document";
import { saveQuote } from "./actions";
import type { Summary } from "@/lib/estimate-types";
import { cn } from "@/lib/utils";
import { toPdfSafeDataUrl } from "@/lib/pdf-utils";

const QuoteScopeEditor = dynamic(
  () => import("./quote-scope-editor").then((m) => m.QuoteScopeEditor),
  { ssr: false, loading: () => <div className="min-h-[6rem] border border-gray-200 rounded" /> }
);

const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type QuoteLine = {
  id: string;
  type?: "item" | "header";
  description: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
};

// ── Input helpers ─────────────────────────────────────────────────────────────
const docInput = "bg-transparent border-0 outline-none w-full text-[11px] text-gray-800 placeholder:text-gray-300 focus:bg-gray-50 focus:ring-1 focus:ring-gray-200 rounded px-1 py-0.5 transition-colors";
const docInputSm = "bg-transparent border-0 outline-none w-full text-[11px] text-gray-800/80 placeholder:text-gray-300 focus:bg-gray-50 focus:ring-1 focus:ring-gray-200 rounded px-1 py-0.5 transition-colors";

function plainToHtml(text: string): string {
  if (!text) return "";
  if (text.includes("<")) return text;
  return text
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const esc = l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<p>${esc}</p>`;
    })
    .join("");
}

function SortableQuoteLine({
  line,
  itemIdx,
  onUpdate,
  onRemove,
  hideZeros,
}: {
  line: QuoteLine;
  itemIdx: number;
  onUpdate: (id: string, field: keyof QuoteLine, value: string | number) => void;
  onRemove: (id: string) => void;
  hideZeros: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const descRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  const grip = (
    <td className="p-0 print:hidden w-6">
      <span
        {...listeners}
        {...attributes}
        className="cursor-grab flex items-center justify-center h-full w-6 py-1.5 text-gray-200 group-hover:text-gray-400 touch-none"
      >
        <GripVertical className="h-3 w-3" />
      </span>
    </td>
  );

  if (line.type === "header") {
    return (
      <tr ref={setNodeRef} style={style} className="bg-gray-100 border-b border-gray-200 group">
        {grip}
        <td colSpan={5} className="px-2 py-1.5">
          <input
            value={line.description}
            onChange={(e) => onUpdate(line.id, "description", e.target.value)}
            className="bg-transparent border-0 outline-none text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-full focus:bg-gray-50 rounded px-1 py-0.5 transition-colors"
            placeholder="Section label"
          />
        </td>
        <td className="p-0 print:hidden">
          <button
            onClick={() => onRemove(line.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-full flex items-center justify-center text-gray-300 hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-gray-100 last:border-b-0 group",
        itemIdx % 2 === 1 ? "bg-gray-50/40" : "bg-white"
      )}
    >
      {grip}
      <td className="p-0 border-r border-gray-100">
        <textarea
          ref={descRef}
          value={line.description}
          onChange={(e) => onUpdate(line.id, "description", e.target.value)}
          rows={1}
          className={cn(docInput, "px-2 py-1.5 resize-none overflow-hidden block leading-relaxed")}
          placeholder="Description"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
        />
      </td>
      <td className="p-0 border-r border-gray-100">
        <input
          type="number"
          value={hideZeros && Number(line.qty) === 0 ? "" : line.qty}
          onChange={(e) => onUpdate(line.id, "qty", parseFloat(e.target.value) || 0)}
          className={cn(docInput, "text-right tabular-nums px-2 py-1.5")}
        />
      </td>
      <td className="p-0 border-r border-gray-100">
        <input
          value={line.unit}
          onChange={(e) => onUpdate(line.id, "unit", e.target.value)}
          className={cn(docInput, "text-right px-2 py-1.5")}
        />
      </td>
      <td className="p-0 border-r border-gray-100">
        <input
          type="number"
          value={hideZeros && line.rate === 0 ? "" : line.rate.toFixed(2)}
          onChange={(e) => onUpdate(line.id, "rate", parseFloat(e.target.value) || 0)}
          className={cn(docInput, "text-right tabular-nums px-2 py-1.5")}
        />
      </td>
      <td className="p-0 border-r border-gray-100">
        <input
          type="number"
          value={hideZeros && line.amount === 0 ? "" : line.amount.toFixed(2)}
          onChange={(e) => onUpdate(line.id, "amount", parseFloat(e.target.value) || 0)}
          className={cn(docInput, "text-right tabular-nums font-medium px-2 py-1.5")}
        />
      </td>
      <td className="p-0 print:hidden">
        <button
          onClick={() => onRemove(line.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-full flex items-center justify-center text-gray-300 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

export function QuoteEditor({
  orgSlug,
  orgId,
  projectId,
  estimateId,
  orgName,
  orgLogoUrl,
  orgAbn,
  orgAddress,
  orgPhone,
  orgEmail,
  quoteTerms,
  quoteNotes,
  projectName,
  projectLocation,
  clientName,
  estimateName,
  summary,
  quoteNumber,
  today,
  initialQuoteId,
  initialLines,
  initialScopeText,
  initialToAddress,
  initialToContact,
  initialToEmail,
  initialProjectLoc,
  initialValidity,
  initialHideZeros,
  initialName,
}: {
  orgSlug: string;
  orgId: string;
  projectId: string;
  estimateId: string;
  orgName: string;
  orgLogoUrl: string | null;
  orgAbn: string;
  orgAddress: string;
  orgPhone: string;
  orgEmail: string;
  quoteTerms: string;
  quoteNotes: string;
  projectName: string;
  projectLocation: string;
  clientName: string;
  estimateName: string;
  summary: Summary;
  quoteNumber: string;
  today: string;
  initialQuoteId?: string;
  initialLines?: QuotePdfLine[];
  initialScopeText?: string;
  initialToAddress?: string;
  initialToContact?: string;
  initialToEmail?: string;
  initialProjectLoc?: string;
  initialValidity?: string;
  initialHideZeros?: boolean;
  initialName?: string;
}) {
  const [quoteName, setQuoteName] = useState(initialName ?? "");
  const [companyName, setCompanyName] = useState(orgName);
  const [companyAbn, setCompanyAbn] = useState(orgAbn);
  const [companyAddress, setCompanyAddress] = useState(orgAddress);
  const [companyPhone, setCompanyPhone] = useState(orgPhone);
  const [companyEmail, setCompanyEmail] = useState(orgEmail);

  const [qNumber, setQNumber] = useState(quoteNumber);
  const [qDate, setQDate] = useState(today);
  const [qValidity, setQValidity] = useState(initialValidity ?? "30 days from date of issue");

  const [toName, setToName] = useState(clientName);
  const [toAddress, setToAddress] = useState(initialToAddress ?? "");
  const [toContact, setToContact] = useState(initialToContact ?? "");
  const [toEmail, setToEmail] = useState(initialToEmail ?? "");

  const [projectRef, setProjectRef] = useState(projectName);
  const [projectLoc, setProjectLoc] = useState(initialProjectLoc ?? projectLocation);

  const [userPrompt, setUserPrompt] = useState("");
  const [scopeText, setScopeText] = useState(initialScopeText ?? "");
  const [scopeEditorKey, setScopeEditorKey] = useState(0);
  const [scopeLoading, setScopeLoading] = useState(false);

  const [hideZeros, setHideZeros] = useState(initialHideZeros ?? false);

  const defaultLine: QuoteLine = {
    id: "default-total",
    type: "item",
    description: "Supply and install flooring works as per scope",
    qty: 1,
    unit: "Lump Sum",
    rate: summary.totalExGst,
    amount: summary.totalExGst,
  };

  const [lines, setLines] = useState<QuoteLine[]>(() =>
    initialLines && initialLines.length > 0
      ? (initialLines as QuoteLine[])
      : [defaultLine]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLines((prev) => {
      const oldIndex = prev.findIndex((l) => l.id === active.id);
      const newIndex = prev.findIndex((l) => l.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  const totalExGst = lines
    .filter((l) => l.type !== "header")
    .reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const gst = totalExGst * 0.1;
  const grandTotal = totalExGst + gst;

  const [notes, setNotes] = useState(quoteNotes);
  const [terms, setTerms] = useState(quoteTerms);

  const [quoteId, setQuoteId] = useState<string | undefined>(initialQuoteId);
  const [saving, setSaving] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // react-pdf's <Image> can't embed webp — pre-convert the logo to a PDF-safe
  // (png/jpeg/svg) data URL. The raw orgLogoUrl is still used for on-screen <img> tags.
  const [pdfLogoUrl, setPdfLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!orgLogoUrl) return;
    toPdfSafeDataUrl(orgLogoUrl).then(setPdfLogoUrl);
  }, [orgLogoUrl]);

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const blob = await pdf(
        <QuotePdfDocument
          companyName={companyName} companyAbn={companyAbn}
          companyAddress={companyAddress} companyPhone={companyPhone}
          companyEmail={companyEmail} orgLogoUrl={pdfLogoUrl}
          qNumber={qNumber} qDate={qDate} qValidity={qValidity}
          toName={toName} toAddress={toAddress} toContact={toContact} toEmail={toEmail}
          projectRef={projectRef} projectLoc={projectLoc}
          scopeText={scopeText} lines={lines}
          totalExGst={totalExGst} gst={gst} grandTotal={grandTotal}
          notes={notes} terms={terms}
          hideZeros={hideZeros}
        />
      ).toBlob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewOpen(true);
    } catch {
      toast.error("Failed to generate PDF preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleDownload() {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `${qNumber}.pdf`;
    a.click();
  }

  function handleClosePreview() {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const id = await saveQuote(orgSlug, {
        orgId,
        projectId,
        estimateId,
        name: quoteName || undefined,
        quoteNumber: qNumber,
        quoteDate: qDate,
        validFor: qValidity,
        companyName,
        companyAbn,
        companyAddress,
        companyPhone,
        companyEmail,
        toName,
        toAddress,
        toContact,
        toEmail,
        projectRef,
        projectLoc,
        scopeText,
        notes,
        terms,
        lines,
        totalExGst,
        gst,
        grandTotal,
        hideZeros,
      }, quoteId);
      setQuoteId(id);
      toast.success("Quote saved.");
    } catch {
      toast.error("Failed to save quote.");
    } finally {
      setSaving(false);
    }
  }

  const generateScope = useCallback(async () => {
    setScopeLoading(true);
    try {
      const res = await fetch("/api/quote-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          estimateId,
          userPrompt: userPrompt.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const { summary: text } = await res.json();
      const html = plainToHtml(text ?? "");
      setScopeText(html);
      setScopeEditorKey((k) => k + 1);
      toast.success("Scope of works generated.");
    } catch {
      toast.error("Failed to generate scope. Try again.");
    } finally {
      setScopeLoading(false);
    }
  }, [projectName, estimateId, userPrompt]);

  function updateLine(id: string, field: keyof QuoteLine, value: string | number) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        if (field === "qty" || field === "rate") {
          updated.amount = Number(updated.qty) * Number(updated.rate);
        }
        return updated;
      })
    );
  }

  function addLine() {
    const id = crypto.randomUUID();
    setLines((prev) => [...prev, { id, type: "item", description: "", qty: 1, unit: "m²", rate: 0, amount: 0 }]);
  }

  function addHeader() {
    const id = crypto.randomUUID();
    setLines((prev) => [...prev, { id, type: "header", description: "Section", qty: 0, unit: "", rate: 0, amount: 0 }]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="max-w-[67rem] mx-auto py-6 px-4 space-y-4 print:py-0 print:px-0 print:max-w-none">
      {/* ── App toolbar ────────────────────────────────────────────────────── */}
      <div className="print:hidden space-y-4">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href={`/orgs/${orgSlug}/projects`} className="hover:text-foreground transition-colors">Projects</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/orgs/${orgSlug}/projects/${projectId}`} className="hover:text-foreground transition-colors">{projectName}</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/orgs/${orgSlug}/projects/${projectId}/estimates/${estimateId}/costing`} className="hover:text-foreground transition-colors">{estimateName}</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Quote</span>
        </nav>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Client Quote</h1>
            <input
              value={quoteName}
              onChange={(e) => setQuoteName(e.target.value)}
              placeholder="Untitled"
              className="text-sm text-muted-foreground bg-transparent border-0 border-b border-border/40 outline-none focus:border-primary/60 px-1 py-0.5 w-48 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {saving ? "Saving…" : quoteId ? "Save changes" : "Save quote"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePreview}
              disabled={previewLoading}
              className="gap-1.5 text-xs border border-border"
            >
              {previewLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Download className="h-3.5 w-3.5" />}
              {previewLoading ? "Building…" : "Preview & Download"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideZeros}
              onChange={(e) => setHideZeros(e.target.checked)}
              className="rounded border-border"
            />
            Hide zero values
          </label>
        </div>
      </div>

      {/* ── Quote document ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-xl shadow-black/20 overflow-hidden print:shadow-none print:rounded-none">

        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-violet-400" />

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-8">
            <div className="flex items-start gap-4 min-w-0">
              {orgLogoUrl && (
                <img src={orgLogoUrl} alt={orgName} className="h-14 w-auto object-contain flex-shrink-0" />
              )}
              <div className="min-w-0 space-y-2">
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-transparent border-0 outline-none text-gray-900 font-bold text-sm w-full placeholder:text-gray-300 focus:bg-gray-50 rounded px-1 py-0.5 transition-colors"
                  placeholder="Company Name"
                />
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide flex-shrink-0">ABN</span>
                  <input
                    value={companyAbn}
                    onChange={(e) => setCompanyAbn(e.target.value)}
                    className="bg-transparent border-0 outline-none text-[11px] text-gray-800/80 placeholder:text-gray-300 focus:bg-gray-50 rounded px-1 py-0.5 transition-colors"
                    placeholder="—"
                  />
                </div>
                <input
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="bg-transparent border-0 outline-none text-[11px] text-gray-800/80 w-full placeholder:text-gray-300 focus:bg-gray-50 rounded px-1 py-0.5 transition-colors"
                  placeholder="Address"
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    className="bg-transparent border-0 outline-none text-[11px] text-gray-500 placeholder:text-gray-300 focus:bg-gray-50 rounded px-1 py-0.5 transition-colors"
                    placeholder="Phone"
                  />
                  <input
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="bg-transparent border-0 outline-none text-[11px] text-gray-500 placeholder:text-gray-300 focus:bg-gray-50 rounded px-1 py-0.5 w-52 transition-colors"
                    placeholder="Email"
                  />
                </div>
              </div>
            </div>

            <div className="text-right flex-shrink-0 space-y-3">
              <div className="text-3xl font-extrabold text-gray-800 tracking-tight">QUOTATION</div>
              <div className="space-y-1">
                <div className="flex items-center gap-3 justify-end">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest">Quote No.</span>
                  <input
                    value={qNumber}
                    onChange={(e) => setQNumber(e.target.value)}
                    className="bg-transparent border-0 outline-none text-[11px] text-gray-800/80 text-right font-mono placeholder:text-gray-300 focus:bg-gray-50 rounded px-1 py-0 w-32 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-3 justify-end">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest">Date</span>
                  <input
                    value={qDate}
                    onChange={(e) => setQDate(e.target.value)}
                    className="bg-transparent border-0 outline-none text-[11px] text-gray-800/80 text-right placeholder:text-gray-300 focus:bg-gray-50 rounded px-1 py-0 w-32 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-3 justify-end">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest">Valid for</span>
                  <input
                    value={qValidity}
                    onChange={(e) => setQValidity(e.target.value)}
                    className="bg-transparent border-0 outline-none text-[11px] text-gray-800/80 text-right placeholder:text-gray-300 focus:bg-gray-50 rounded px-1 py-0 w-44 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quote to + Project ref */}
        <div className="border-y border-gray-200 bg-gray-50/60">
          <div className="px-5 py-6 grid grid-cols-2 gap-8">
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Quote To</div>
              <input value={toName} onChange={(e) => setToName(e.target.value)} className={cn(docInput, "font-semibold text-gray-800")} placeholder="Client / Company Name" />
              <input value={toAddress} onChange={(e) => setToAddress(e.target.value)} className={docInputSm} placeholder="Address" />
              <input value={toContact} onChange={(e) => setToContact(e.target.value)} className={docInputSm} placeholder="Contact name" />
              <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} className={docInputSm} placeholder="Email" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Project Reference</div>
              <input value={projectRef} onChange={(e) => setProjectRef(e.target.value)} className={cn(docInput, "font-semibold text-gray-800")} placeholder="Project name" />
              <input value={projectLoc} onChange={(e) => setProjectLoc(e.target.value)} className={docInputSm} placeholder="Location / site address" />
            </div>
          </div>
        </div>

        {/* Scope of works */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Scope of Works</div>

          {/* AI prompt input */}
          <div className="print:hidden mb-3 flex gap-2 items-start">
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              rows={2}
              placeholder="Optional: describe any additions or exclusions (e.g. 'exclude stair nosings, add 2 rooms of carpet tiles')"
              className="flex-1 text-[11px] text-gray-700 placeholder:text-gray-300 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 resize-none outline-none focus:ring-1 focus:ring-violet-200 transition-colors leading-relaxed"
            />
            <button
              onClick={generateScope}
              disabled={scopeLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors flex-shrink-0 self-stretch"
            >
              {scopeLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {scopeLoading ? "Generating…" : "Generate with AI"}
            </button>
          </div>

          <QuoteScopeEditor
            key={scopeEditorKey}
            value={scopeText}
            onChange={setScopeText}
            disabled={scopeLoading}
          />
        </div>

        {/* Line items table */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Line Items</div>
          <div className="border border-gray-200 rounded-sm overflow-hidden">
            <table className="w-full">
              <colgroup>
                <col className="w-6 print:hidden" />
                <col className="w-auto" />
                <col className="w-20" />
                <col className="w-16" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-8 print:hidden" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="print:hidden" />
                  {["Description", "Qty", "Unit", "Rate (AUD)", "Amount (AUD)", ""].map((h, i) => (
                    <th
                      key={i}
                      className={cn(
                        "px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 last:border-r-0",
                        i >= 2 ? "text-right" : "text-left",
                        i === 5 && "print:hidden"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {lines.map((line, i) => (
                      <SortableQuoteLine
                        key={line.id}
                        line={line}
                        itemIdx={i}
                        onUpdate={updateLine}
                        onRemove={removeLine}
                        hideZeros={hideZeros}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </DndContext>
            </table>
          </div>

          <div className="print:hidden mt-2 flex items-center gap-4">
            <button
              onClick={addLine}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-violet-500 transition-colors py-1"
            >
              <Plus className="h-3 w-3" />
              Add line item
            </button>
            <button
              onClick={addHeader}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-violet-500 transition-colors py-1"
            >
              <Plus className="h-3 w-3" />
              Add section header
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex justify-end">
            <div className="w-72 space-y-0.5">
              <div className="flex justify-between items-center py-1.5">
                <span className="text-[11px] text-gray-500">Total (ex GST)</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-gray-400">$</span>
                  <span className="text-[11px] text-gray-800/80 tabular-nums font-mono text-right w-28 px-1 py-0.5">
                    {fmt(totalExGst)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-[11px] text-gray-500">GST (10%)</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-gray-400">$</span>
                  <span className="text-[11px] text-gray-800/80 tabular-nums font-mono text-right w-28 px-1 py-0.5">
                    {fmt(gst)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2.5 mt-1 border-t border-gray-300">
                <span className="text-[11px] font-bold text-gray-800 uppercase tracking-wide">Total (incl. GST)</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[11px] text-gray-700 font-semibold">$</span>
                  <span className="text-[13px] text-gray-900 font-bold tabular-nums font-mono text-right w-28 px-1 py-0.5">
                    {fmt(grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Additional Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="bg-transparent border-0 outline-none w-full text-[11px] text-gray-800/80 placeholder:text-gray-300 focus:bg-gray-50 focus:ring-1 focus:ring-gray-200 rounded px-1 py-0.5 resize-none transition-colors leading-relaxed print:overflow-visible"
            placeholder="Any additional notes or conditions specific to this quote…"
          />
        </div>

        {/* Terms & Conditions */}
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Terms &amp; Conditions</div>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={Math.max(4, terms.split("\n").length + 1)}
            className="bg-transparent border-0 outline-none w-full text-[11px] text-gray-800/80 placeholder:text-gray-300 focus:bg-gray-50 focus:ring-1 focus:ring-gray-200 rounded px-1 py-0.5 resize-none transition-colors leading-relaxed print:overflow-visible text-gray-500"
            placeholder="Payment terms, warranty details, and other conditions of this quote…"
          />

          <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between">
            {orgLogoUrl && (
              <img src={orgLogoUrl} alt={companyName} className="h-6 w-auto object-contain opacity-30" />
            )}
            <p className="text-[10px] text-gray-400">{companyName} · {companyEmail} · {companyPhone}</p>
          </div>
        </div>

        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-violet-400" />
      </div>

      {/* ── PDF preview modal ───────────────────────────────────────────────── */}
      {previewOpen && previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
          <div className="flex-none flex items-center justify-between px-4 h-12 bg-card/95 backdrop-blur-xl border-b border-border shadow-lg">
            <span className="text-sm font-medium text-foreground">PDF Preview</span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleDownload} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClosePreview} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
                Close
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <iframe src={previewUrl} className="w-full h-full border-0" title="PDF Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
