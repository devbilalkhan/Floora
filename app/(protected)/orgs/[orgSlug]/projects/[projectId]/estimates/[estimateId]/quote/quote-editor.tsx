"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles, Loader2, Plus, Trash2, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pdf } from "@react-pdf/renderer";
import { QuotePdfDocument, type QuotePdfLine } from "./quote-pdf-document";
import { saveQuote } from "./actions";
import type { EstimateItem, Summary } from "@/lib/estimate-types";
import { itemTotal } from "@/lib/estimate-types";
import { cn } from "@/lib/utils";

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SCOPE_LABELS: Record<string, string> = {
  vinyl: "Vinyl Flooring",
  carpet: "Carpet",
  coving_skirting: "Coving / Skirting",
  transition: "Transition Strips",
  stairs: "Stair Nosings",
  wall_vinyl: "Wall Vinyl",
  matting: "Entrance Matting",
  other: "Other",
};

type QuoteLine = {
  id: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
};

function buildLines(items: EstimateItem[]): QuoteLine[] {
  return items.map((item) => {
    const label = SCOPE_LABELS[item.scope_category] ?? item.scope_category;
    const code = item.finish_code ? `${item.finish_code} — ` : "";
    const desc = item.description ?? label;
    const qty = Number(item.qty) || 0;
    const total = itemTotal(item);
    const rate = qty > 0 ? total / qty : 0;
    return {
      id: item.id,
      description: `${code}${desc}`,
      qty,
      unit: item.unit,
      rate,
      amount: total,
    };
  });
}

// ── Input helpers ─────────────────────────────────────────────────────────────
const docInput = "bg-transparent border-0 outline-none w-full text-[11px] text-gray-800 placeholder:text-gray-300 focus:bg-gray-50 focus:ring-1 focus:ring-gray-200 rounded px-1 py-0.5 transition-colors";
const docInputSm = "bg-transparent border-0 outline-none w-full text-[11px] text-gray-800/80 placeholder:text-gray-300 focus:bg-gray-50 focus:ring-1 focus:ring-gray-200 rounded px-1 py-0.5 transition-colors";
const docTextarea = "bg-transparent border-0 outline-none w-full text-[11px] text-gray-800/80 placeholder:text-gray-300 focus:bg-gray-50 focus:ring-1 focus:ring-gray-200 rounded px-1 py-0.5 resize-none transition-colors leading-relaxed print:overflow-visible";

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
  primaryItems,
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
  primaryItems: EstimateItem[];
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
}) {
  // ── Editable state ────────────────────────────────────────────────────────
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

  const [scopeText, setScopeText] = useState(initialScopeText ?? "");
  const [scopeLoading, setScopeLoading] = useState(false);

  const [lines, setLines] = useState<QuoteLine[]>(() =>
    initialLines && initialLines.length > 0 ? initialLines : buildLines(primaryItems)
  );

  const [totalExGst, setTotalExGst] = useState(summary.totalExGst);
  const [gst, setGst] = useState(summary.gst);
  const [grandTotal, setGrandTotal] = useState(summary.grandTotal);

  const [notes, setNotes] = useState(quoteNotes);
  const [terms, setTerms] = useState(quoteTerms);

  const [quoteId, setQuoteId] = useState<string | undefined>(initialQuoteId);
  const [saving, setSaving] = useState(false);

  // ── PDF preview state ─────────────────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const blob = await pdf(
        <QuotePdfDocument
          companyName={companyName} companyAbn={companyAbn}
          companyAddress={companyAddress} companyPhone={companyPhone}
          companyEmail={companyEmail} orgLogoUrl={orgLogoUrl}
          qNumber={qNumber} qDate={qDate} qValidity={qValidity}
          toName={toName} toAddress={toAddress} toContact={toContact} toEmail={toEmail}
          projectRef={projectRef} projectLoc={projectLoc}
          scopeText={scopeText} lines={lines}
          totalExGst={totalExGst} gst={gst} grandTotal={grandTotal}
          notes={notes} terms={terms}
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

  // ── Save quote ────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const id = await saveQuote(orgSlug, {
        orgId,
        projectId,
        estimateId,
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
      }, quoteId);
      setQuoteId(id);
      toast.success("Quote saved.");
    } catch {
      toast.error("Failed to save quote.");
    } finally {
      setSaving(false);
    }
  }

  // ── Scope of works generation ─────────────────────────────────────────────
  const generateScope = useCallback(async () => {
    if (primaryItems.length === 0) {
      toast.error("No estimate items to summarise.");
      return;
    }
    setScopeLoading(true);
    try {
      const res = await fetch("/api/quote-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          items: primaryItems.map((i) => ({
            scope_category: i.scope_category,
            finish_code: i.finish_code,
            description: i.description,
            qty: i.qty,
            unit: i.unit,
          })),
        }),
      });
      if (!res.ok) throw new Error("API error");
      const { summary: text } = await res.json();
      setScopeText(text ?? "");
      toast.success("Scope of works generated.");
    } catch {
      toast.error("Failed to generate scope. Try again.");
    } finally {
      setScopeLoading(false);
    }
  }, [primaryItems, projectName]);

  // ── Line item helpers ─────────────────────────────────────────────────────
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
    setLines((prev) => [...prev, { id, description: "", qty: 1, unit: "m²", rate: 0, amount: 0 }]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const lineSubtotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  // ── GST sync when totalExGst changes ─────────────────────────────────────
  function handleTotalExGstChange(val: number) {
    setTotalExGst(val);
    const g = val * 0.1;
    setGst(g);
    setGrandTotal(val + g);
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
          <h1 className="text-lg font-semibold">Client Quote</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 text-xs"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {saving ? "Saving…" : quoteId ? "Save changes" : "Save quote"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={generateScope}
              disabled={scopeLoading}
              className="gap-1.5 text-xs"
            >
              {scopeLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              )}
              {scopeLoading ? "Generating…" : "Generate scope with AI"}
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

        <p className="text-xs text-muted-foreground">
          Click any field to edit. Use &ldquo;Generate scope with AI&rdquo; to auto-populate the scope of works.
        </p>
      </div>

      {/* ── Quote document ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-xl shadow-black/20 overflow-hidden print:shadow-none print:rounded-none">

        {/* Accent strip */}
        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-violet-400" />

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-8">
            {/* Logo + company */}
            <div className="flex items-start gap-4 min-w-0">
              {orgLogoUrl && (
                <img
                  src={orgLogoUrl}
                  alt={orgName}
                  className="h-14 w-auto object-contain flex-shrink-0"
                />
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

            {/* Quote title + meta */}
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
            <input
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              className={cn(docInput, "font-semibold text-gray-800")}
              placeholder="Client / Company Name"
            />
            <input
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              className={docInputSm}
              placeholder="Address"
            />
            <input
              value={toContact}
              onChange={(e) => setToContact(e.target.value)}
              className={docInputSm}
              placeholder="Contact name"
            />
            <input
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className={docInputSm}
              placeholder="Email"
            />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Project Reference</div>
            <input
              value={projectRef}
              onChange={(e) => setProjectRef(e.target.value)}
              className={cn(docInput, "font-semibold text-gray-800")}
              placeholder="Project name"
            />
            <input
              value={projectLoc}
              onChange={(e) => setProjectLoc(e.target.value)}
              className={docInputSm}
              placeholder="Location / site address"
            />
          </div>
          </div>
        </div>

        {/* Scope of works */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3" style={{ width: "70%" }}>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Scope of Works</div>
            <button
              onClick={generateScope}
              disabled={scopeLoading}
              className="print:hidden flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-600 transition-colors disabled:opacity-50"
            >
              {scopeLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {scopeLoading ? "Generating…" : "Generate with AI"}
            </button>
          </div>
          {!scopeText && !scopeLoading && (
            <p className="text-[10px] text-gray-400 italic mb-1" style={{ width: "70%" }}>
              Type scope below or use &ldquo;Generate with AI&rdquo; above to auto-populate.
            </p>
          )}
          <textarea
            value={scopeText}
            onChange={(e) => setScopeText(e.target.value)}
            rows={Math.max(4, scopeText.split("\n").length + 1)}
            className={cn(docTextarea)}
            style={{ width: "70%" }}
            placeholder={scopeLoading ? "Generating scope of works…" : "• Supply and install flooring throughout the project…"}
            disabled={scopeLoading}
          />
        </div>

        {/* Line items table */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Line Items</div>
          <div className="border border-gray-200 rounded-sm overflow-hidden">
            <table className="w-full">
              <colgroup>
                <col className="w-auto" />
                <col className="w-20" />
                <col className="w-16" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-8 print:hidden" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
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
              <tbody>
                {lines.map((line, idx) => (
                  <tr
                    key={line.id}
                    className={cn(
                      "border-b border-gray-100 last:border-b-0 group",
                      idx % 2 === 1 ? "bg-gray-50/40" : "bg-white"
                    )}
                  >
                    <td className="p-0 border-r border-gray-100">
                      <input
                        value={line.description}
                        onChange={(e) => updateLine(line.id, "description", e.target.value)}
                        className={cn(docInput, "px-2 py-1.5")}
                        placeholder="Description"
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <input
                        type="number"
                        value={line.qty}
                        onChange={(e) => updateLine(line.id, "qty", parseFloat(e.target.value) || 0)}
                        className={cn(docInput, "text-right tabular-nums px-2 py-1.5")}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <input
                        value={line.unit}
                        onChange={(e) => updateLine(line.id, "unit", e.target.value)}
                        className={cn(docInput, "text-right px-2 py-1.5")}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <input
                        type="number"
                        value={line.rate.toFixed(2)}
                        onChange={(e) => updateLine(line.id, "rate", parseFloat(e.target.value) || 0)}
                        className={cn(docInput, "text-right tabular-nums px-2 py-1.5")}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <input
                        type="number"
                        value={line.amount.toFixed(2)}
                        onChange={(e) => updateLine(line.id, "amount", parseFloat(e.target.value) || 0)}
                        className={cn(docInput, "text-right tabular-nums font-medium px-2 py-1.5")}
                      />
                    </td>
                    <td className="p-0 print:hidden">
                      <button
                        onClick={() => removeLine(line.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-full flex items-center justify-center text-gray-300 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add line */}
          <button
            onClick={addLine}
            className="print:hidden mt-2 flex items-center gap-1 text-[11px] text-gray-400 hover:text-violet-500 transition-colors py-1"
          >
            <Plus className="h-3 w-3" />
            Add line item
          </button>
        </div>

        {/* Totals */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex justify-end">
            <div className="w-72 space-y-0.5">
              {/* Line subtotal (informational) */}
              {Math.abs(lineSubtotal - totalExGst) > 1 && (
                <div className="flex justify-between items-center py-1 text-[11px] text-gray-400 border-b border-gray-100 mb-1">
                  <span>Line items subtotal</span>
                  <span className="tabular-nums font-mono">${fmt(lineSubtotal)}</span>
                </div>
              )}

              <div className="flex justify-between items-center py-1.5">
                <span className="text-[11px] text-gray-500">Total (ex GST)</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-gray-400">$</span>
                  <input
                    type="number"
                    value={totalExGst.toFixed(2)}
                    onChange={(e) => handleTotalExGstChange(parseFloat(e.target.value) || 0)}
                    className="text-[11px] text-gray-800/80 tabular-nums font-mono text-right bg-transparent border-0 outline-none w-28 focus:bg-gray-50 rounded px-1 py-0.5 transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center py-1.5">
                <span className="text-[11px] text-gray-500">GST (10%)</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-gray-400">$</span>
                  <input
                    type="number"
                    value={gst.toFixed(2)}
                    onChange={(e) => setGst(parseFloat(e.target.value) || 0)}
                    className="text-[11px] text-gray-800/80 tabular-nums font-mono text-right bg-transparent border-0 outline-none w-28 focus:bg-gray-50 rounded px-1 py-0.5 transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2.5 mt-1 border-t border-gray-300">
                <span className="text-[11px] font-bold text-gray-800 uppercase tracking-wide">Total (incl. GST)</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[11px] text-gray-700 font-semibold">$</span>
                  <input
                    type="number"
                    value={grandTotal.toFixed(2)}
                    onChange={(e) => setGrandTotal(parseFloat(e.target.value) || 0)}
                    className="text-[13px] text-gray-900 font-bold tabular-nums font-mono text-right bg-transparent border-0 outline-none w-28 focus:bg-gray-50 rounded px-1 py-0.5 transition-colors"
                  />
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
            className={cn(docTextarea, "w-full")}
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
            className={cn(docTextarea, "w-full text-gray-500")}
            placeholder="Payment terms, warranty details, and other conditions of this quote…"
          />

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between">
            {orgLogoUrl && (
              <img
                src={orgLogoUrl}
                alt={companyName}
                className="h-6 w-auto object-contain opacity-30"
              />
            )}
            <p className="text-[10px] text-gray-400">{companyName} · {companyEmail} · {companyPhone}</p>
          </div>
        </div>

        {/* Bottom accent strip */}
        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-violet-400" />
      </div>

      {/* ── PDF preview modal ───────────────────────────────────────────────── */}
      {previewOpen && previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
          {/* Modal toolbar */}
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

          {/* PDF iframe */}
          <div className="flex-1 min-h-0">
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
