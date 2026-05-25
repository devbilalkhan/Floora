"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  FileText,
  FileSpreadsheet,
  Loader2,
  Upload,
  Zap,
  X,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createGroup, importExtractedLines } from "./actions";
import type { ActualGroup, ActualLineItem } from "./actuals-section";

// ── Types ──────────────────────────────────────────────────────────────────────

type ExtractedLine = {
  invoice_date: string | null;
  invoice_number: string | null;
  supplier: string | null;
  description: string;
  qty: number | null;
  unit_price: number | null;
  subtotal: number;
};

type ReviewLine = ExtractedLine & { selected: boolean };

type Step = "select" | "extracting" | "review" | "importing";

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.xlsx,.xls,.csv";

const SPREADSHEET_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
]);

function isSpreadsheet(mime: string) {
  return SPREADSHEET_MIMES.has(mime);
}

function fmt(n: number) {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isoToDisplay(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── File type helpers ──────────────────────────────────────────────────────────

function fileIcon(mime: string) {
  if (isSpreadsheet(mime)) return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  return <FileText className="h-4 w-4 text-primary" />;
}

// ── Parse spreadsheet client-side ─────────────────────────────────────────────

async function parseSpreadsheetToCSV(
  file: File,
  sheetName?: string
): Promise<{ csv: string; sheets: string[] }> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const targetSheet =
    sheetName ??
    wb.SheetNames.find((n) => /invoice|lines|items/i.test(n)) ??
    wb.SheetNames[0];
  const ws = wb.Sheets[targetSheet];
  const csv = XLSX.utils.sheet_to_csv(ws);
  return { csv, sheets: wb.SheetNames };
}

// ── Group selector ─────────────────────────────────────────────────────────────

function GroupSelect({
  groups,
  value,
  onChange,
  newGroupName,
  onNewGroupName,
}: {
  groups: ActualGroup[];
  value: string;
  onChange: (v: string) => void;
  newGroupName: string;
  onNewGroupName: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        Add to group
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-8 pl-2.5 pr-7 text-[11px] bg-input border border-border rounded-md text-foreground/70 appearance-none focus:outline-none focus:ring-1 focus:ring-primary/40"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          <option value="__new__">+ Create new group</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      {value === "__new__" && (
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => onNewGroupName(e.target.value)}
          placeholder="Group name…"
          autoFocus
          className="w-full h-8 px-2.5 text-[11px] bg-input border border-border rounded-md text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
        />
      )}
    </div>
  );
}

// ── Review table ───────────────────────────────────────────────────────────────

function ReviewTable({
  lines,
  onChange,
}: {
  lines: ReviewLine[];
  onChange: (updated: ReviewLine[]) => void;
}) {
  const allSelected = lines.every((l) => l.selected);

  function toggleAll() {
    onChange(lines.map((l) => ({ ...l, selected: !allSelected })));
  }

  function toggleRow(i: number) {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, selected: !l.selected } : l)));
  }

  function updateCell(i: number, field: keyof ExtractedLine, raw: string) {
    onChange(
      lines.map((l, idx) => {
        if (idx !== i) return l;
        let value: string | number | null = raw;
        if (field === "qty" || field === "unit_price" || field === "subtotal") {
          value = raw === "" ? null : parseFloat(raw);
          if (typeof value === "number" && isNaN(value)) value = null;
          if (field === "subtotal" && value === null) value = 0;
        }
        if (field === "invoice_date" || field === "invoice_number" || field === "supplier") {
          value = raw.trim() === "" ? null : raw;
        }
        const next = { ...l, [field]: value } as ReviewLine;
        if (
          (field === "qty" || field === "unit_price") &&
          next.qty !== null &&
          next.unit_price !== null
        ) {
          next.subtotal = next.qty * next.unit_price;
        }
        return next;
      })
    );
  }

  const selectedTotal = lines
    .filter((l) => l.selected)
    .reduce((s, l) => {
      const st =
        l.qty !== null && l.unit_price !== null ? l.qty * l.unit_price : l.subtotal;
      return s + st;
    }, 0);

  const cell =
    "h-full w-full px-1.5 py-1 text-[11px] bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-primary/40 rounded-none placeholder:text-muted-foreground/40 text-foreground/70";

  return (
    <div className="flex-1 min-h-0 overflow-auto rounded-sm border border-black/10 dark:border-white/10">
      <table className="w-full table-fixed text-[11px]">
        <colgroup>
          <col className="w-6" />
          <col className="w-[90px]" />
          <col className="w-[88px]" />
          <col className="w-[110px]" />
          <col />
          <col className="w-[72px]" />
          <col className="w-[72px]" />
          <col className="w-[84px]" />
        </colgroup>
        <thead className="bg-muted/40 border-b border-black/10 dark:border-white/10 sticky top-0">
          <tr>
            <th className="py-1.5 text-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-3 w-3 accent-primary cursor-pointer"
              />
            </th>
            {["Date", "Invoice #", "Supplier", "Description", "Qty", "Unit Price", "Subtotal"].map(
              (h) => (
                <th
                  key={h}
                  className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              className={cn(
                "border-t border-black/5 dark:border-white/5 transition-colors",
                line.selected ? "hover:bg-muted/10" : "opacity-40 bg-muted/5"
              )}
            >
              <td className="text-center py-1.5">
                <input
                  type="checkbox"
                  checked={line.selected}
                  onChange={() => toggleRow(i)}
                  className="h-3 w-3 accent-primary cursor-pointer"
                />
              </td>
              <td className="p-0">
                <input
                  type="date"
                  value={line.invoice_date ?? ""}
                  onChange={(e) => updateCell(i, "invoice_date", e.target.value)}
                  className={cn(cell, "tabular-nums")}
                />
              </td>
              <td className="p-0">
                <input
                  type="text"
                  value={line.invoice_number ?? ""}
                  onChange={(e) => updateCell(i, "invoice_number", e.target.value)}
                  placeholder="—"
                  className={cn(cell, "font-mono uppercase")}
                />
              </td>
              <td className="p-0">
                <input
                  type="text"
                  value={line.supplier ?? ""}
                  onChange={(e) => updateCell(i, "supplier", e.target.value)}
                  placeholder="—"
                  className={cell}
                />
              </td>
              <td className="p-0">
                <input
                  type="text"
                  value={line.description}
                  onChange={(e) => updateCell(i, "description", e.target.value)}
                  className={cell}
                />
              </td>
              <td className="p-0">
                <input
                  type="number"
                  value={line.qty ?? ""}
                  onChange={(e) => updateCell(i, "qty", e.target.value)}
                  placeholder="—"
                  className={cn(cell, "text-right tabular-nums")}
                />
              </td>
              <td className="p-0">
                <input
                  type="number"
                  step="0.01"
                  value={line.unit_price ?? ""}
                  onChange={(e) => updateCell(i, "unit_price", e.target.value)}
                  placeholder="—"
                  className={cn(cell, "text-right tabular-nums")}
                />
              </td>
              <td className="p-0">
                {line.qty !== null && line.unit_price !== null ? (
                  <div className="px-1.5 py-1 text-right tabular-nums text-foreground/70 bg-primary/5">
                    {fmt(line.qty * line.unit_price)}
                  </div>
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    value={line.subtotal || ""}
                    onChange={(e) => updateCell(i, "subtotal", e.target.value)}
                    placeholder="0.00"
                    className={cn(cell, "text-right tabular-nums")}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Review footer */}
      <div className="flex items-center gap-4 px-3 py-2 border-t border-black/10 dark:border-white/10 bg-card/65">
        <span className="text-[10px] text-muted-foreground">
          {lines.filter((l) => l.selected).length} of {lines.length} lines selected
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-foreground/75 ml-auto">
          {fmt(selectedTotal)}
        </span>
        <span className="text-[10px] text-muted-foreground/60">ex-GST</span>
      </div>
    </div>
  );
}

// ── Main dialog ────────────────────────────────────────────────────────────────

export default function ExtractionDialog({
  type,
  projectId,
  orgId,
  groups,
  onImport,
  onGroupCreated,
  onClose,
}: {
  type: "income" | "expense";
  projectId: string;
  orgId: string;
  groups: ActualGroup[];
  onImport: (lines: ActualLineItem[]) => void;
  onGroupCreated: (group: ActualGroup) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("select");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [invoiceType, setInvoiceType] = useState(type);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    groups[0]?.id ?? "__new__"
  );
  const [newGroupName, setNewGroupName] = useState(
    type === "income" ? "New income group" : "New expense group"
  );
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [reviewLines, setReviewLines] = useState<ReviewLine[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── File selection ─────────────────────────────────────────────────────────

  async function processFile(f: File) {
    setFile(f);
    setExtractError(null);

    // Pre-parse Excel to detect sheets
    if (
      f.type.includes("spreadsheet") ||
      f.type.includes("excel") ||
      f.name.match(/\.(xlsx|xls)$/i)
    ) {
      try {
        const { sheets: foundSheets } = await parseSpreadsheetToCSV(f);
        if (foundSheets.length > 1) {
          setSheets(foundSheets);
          setSelectedSheet(
            foundSheets.find((n) => /invoice|lines|items/i.test(n)) ?? foundSheets[0]
          );
        } else {
          setSheets([]);
          setSelectedSheet(foundSheets[0] ?? "");
        }
      } catch {
        setSheets([]);
        setSelectedSheet("");
      }
    } else {
      setSheets([]);
      setSelectedSheet("");
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) processFile(f);
    },
    []
  );

  // ── Extraction ─────────────────────────────────────────────────────────────

  async function handleExtract() {
    if (!file) return;
    setStep("extracting");
    setExtractError(null);

    try {
      let body: Record<string, unknown>;
      const mime =
        file.type ||
        (file.name.endsWith(".csv") ? "text/csv" : "application/octet-stream");

      if (isSpreadsheet(mime) || file.name.match(/\.(xlsx|xls|csv)$/i)) {
        // Spreadsheet — parse client-side, send CSV text
        const effectiveMime = file.name.match(/\.(xlsx|xls)$/i)
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv";

        let csvText: string;
        if (file.name.match(/\.(csv)$/i) || file.type === "text/csv") {
          csvText = await file.text();
        } else {
          const { csv } = await parseSpreadsheetToCSV(file, selectedSheet || undefined);
          csvText = csv;
        }

        body = {
          structured_text: csvText,
          file_name: file.name,
          file_mime_type: effectiveMime,
          type: invoiceType,
          org_id: orgId,
          project_id: projectId,
          group_id: selectedGroupId !== "__new__" ? selectedGroupId : null,
        };
      } else {
        // Image / PDF — base64 encode
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        body = {
          file_base64: base64,
          file_name: file.name,
          file_mime_type: mime,
          type: invoiceType,
          org_id: orgId,
          project_id: projectId,
          group_id: selectedGroupId !== "__new__" ? selectedGroupId : null,
        };
      }

      const res = await fetch("/api/actuals/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Extraction failed");
      }

      if (!data.lines || data.lines.length === 0) {
        setExtractError(
          isSpreadsheet(mime)
            ? "No line items found — the sheet may not contain a recognisable invoice structure. Try selecting a different sheet, or add lines manually."
            : "No line items found — the invoice may be unclear. Try a clearer photo, or add lines manually."
        );
        setStep("select");
        return;
      }

      setRunId(data.run_id);
      setReviewLines(
        (data.lines as ExtractedLine[]).map((l) => ({ ...l, selected: true }))
      );
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed";
      setExtractError(msg);
      setStep("select");
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async function handleImport() {
    const selected = reviewLines.filter((l) => l.selected);
    if (selected.length === 0) {
      toast.error("Select at least one line to import.");
      return;
    }
    if (!runId) return;

    setStep("importing");

    try {
      // Create new group if needed
      let targetGroupId = selectedGroupId;
      if (selectedGroupId === "__new__") {
        const name = newGroupName.trim() || (type === "income" ? "New income group" : "New expense group");
        const newGroup = await createGroup(projectId, orgId, invoiceType, name);
        targetGroupId = newGroup.id;
        onGroupCreated(newGroup);
      }

      const lines = selected.map(({ selected: _, ...l }) => l);
      const imported = await importExtractedLines(targetGroupId, projectId, lines, runId);
      onImport(imported as ActualLineItem[]);
      toast.success(`${imported.length} line${imported.length === 1 ? "" : "s"} imported.`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
      setStep("review");
    }
  }

  const selectedCount = reviewLines.filter((l) => l.selected).length;
  const isExtracting = step === "extracting";
  const isImporting = step === "importing";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isExtracting && !isImporting) onClose(); }}>
      <DialogContent
        className={cn(
          "bg-card/85 backdrop-blur-xl flex flex-col gap-4",
          step === "review" ? "sm:max-w-3xl h-[80vh]" : "sm:max-w-md"
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-3.5 w-3.5 text-secondary" />
            {step === "review"
              ? `Review extracted lines — ${file?.name}`
              : "Extract invoice data"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: File select ── */}
        {(step === "select" || step === "extracting") && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => !file && fileRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors cursor-pointer py-8 px-4",
                isDragging
                  ? "border-primary/60 bg-primary/5"
                  : file
                  ? "border-border bg-muted/20 cursor-default"
                  : "border-border hover:border-primary/40 hover:bg-muted/10"
              )}
            >
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
              />

              {file ? (
                <div className="flex items-center gap-2 w-full">
                  {fileIcon(file.type || "")}
                  <span className="flex-1 min-w-0 text-[11px] text-foreground/70 truncate">
                    {file.name}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setSheets([]); setExtractError(null); }}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-[11px] text-muted-foreground text-center">
                    Drop invoice here or{" "}
                    <span className="text-primary underline underline-offset-2">browse</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/50">
                    PDF · JPG · PNG · Excel · CSV — max 20 MB
                  </p>
                </>
              )}
            </div>

            {/* Sheet selector (Excel multi-sheet) */}
            {sheets.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Sheet
                </label>
                <div className="relative">
                  <select
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="w-full h-8 pl-2.5 pr-7 text-[11px] bg-input border border-border rounded-md text-foreground/70 appearance-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    {sheets.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                </div>
              </div>
            )}

            {/* Group selector */}
            <GroupSelect
              groups={groups}
              value={selectedGroupId}
              onChange={setSelectedGroupId}
              newGroupName={newGroupName}
              onNewGroupName={setNewGroupName}
            />

            {/* Invoice type toggle */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Invoice type
              </label>
              <div className="flex items-center gap-4">
                {(["income", "expense"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="invoiceType"
                      value={t}
                      checked={invoiceType === t}
                      onChange={() => setInvoiceType(t)}
                      className="accent-primary h-3.5 w-3.5"
                    />
                    <span className="text-[11px] text-foreground/70 capitalize">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Error banner */}
            {extractError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive mt-0.5" />
                <p className="text-[11px] text-destructive/90">{extractError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={isExtracting}
                className="px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExtract}
                disabled={!file || isExtracting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/15 border border-secondary/30 text-[11px] text-secondary font-medium hover:bg-secondary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Claude is reading the invoice…
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3" />
                    {extractError ? "Retry" : "Extract"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {(step === "review" || step === "importing") && (
          <>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/70">{reviewLines.length} lines found</span>
              <span className="text-muted-foreground/40">·</span>
              <span>Edit any cell before importing — all amounts are ex-GST.</span>
            </div>

            <ReviewTable lines={reviewLines} onChange={setReviewLines} />

            <div className="flex items-center gap-3 pt-1">
              <p className="text-[10px] text-warning/70 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Verify amounts against the original invoice before importing.
              </p>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setStep("select")}
                  disabled={isImporting}
                  className="px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={onClose}
                  disabled={isImporting}
                  className="px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || selectedCount === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/15 border border-secondary/30 text-[11px] text-secondary font-medium hover:bg-secondary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3" />
                      Import {selectedCount} {selectedCount === 1 ? "line" : "lines"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
