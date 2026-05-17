"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, Loader2, Upload, AlertCircle, Check } from "lucide-react";
import { CATEGORIES } from "./constants";
import type { TakeoffRow } from "./constants";

type ExtractedRow = Omit<TakeoffRow, "id" | "sort_order">;

type Step = "upload" | "extracting" | "preview" | "importing" | "done";

export function ImportExcelDialog({
  open,
  onOpenChange,
  projectId,
  orgSlug,
  existingTakeoffCount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  orgSlug: string;
  existingTakeoffCount: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [takeoffName, setTakeoffName] = useState("");
  const [projectMeta, setProjectMeta] = useState<{ name?: string; address?: string; specifier?: string }>({});
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setStep("upload");
    setError(null);
    setTakeoffName("");
    setProjectMeta({});
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const processFile = async (file: File) => {
    setError(null);
    setStep("extracting");

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      const sheets = wb.SheetNames.map((name) => ({
        name,
        csv: XLSX.utils.sheet_to_csv(wb.Sheets[name]),
      }));

      const res = await fetch("/api/extract-takeoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheets, fileName: file.name }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? "Extraction failed");
      }

      const { project_name, project_address, specifier_name, takeoff_name, rows: extracted } = await res.json();

      setProjectMeta({ name: project_name, address: project_address, specifier: specifier_name });
      setTakeoffName(takeoff_name || file.name.replace(/\.[^.]+$/, ""));
      setRows(
        (extracted as ExtractedRow[]).map((r, i) => ({
          ...r,
          waste_pct: r.waste_pct ?? 10,
          sort_order: i,
        }))
      );
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process file");
      setStep("upload");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (!takeoffName.trim() || rows.length === 0) return;
    setStep("importing");
    setError(null);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setError("Not authenticated"); setStep("preview"); return; }

    const { data: takeoff, error: tErr } = await supabase
      .from("takeoffs")
      .insert({
        project_id: projectId,
        name: takeoffName.trim(),
        sort_order: existingTakeoffCount,
        created_by: user.user.id,
      })
      .select()
      .single();

    if (tErr || !takeoff) {
      setError(tErr?.message ?? "Failed to create takeoff");
      setStep("preview");
      return;
    }

    const insertRows = rows.map((r, i) => ({
      takeoff_id: takeoff.id,
      created_by: user.user!.id,
      scope_category: r.scope_category,
      finish_code: r.finish_code ?? null,
      description: r.description ?? null,
      manufacturer: r.manufacturer ?? null,
      colour: r.colour ?? null,
      location: r.location ?? null,
      level: r.level ?? null,
      qty: r.qty,
      unit: r.unit,
      waste_pct: r.waste_pct ?? 10,
      notes: r.notes ?? null,
      sort_order: i,
    }));

    const { error: rErr } = await supabase.from("project_takeoff").insert(insertRows);

    if (rErr) {
      setError(rErr.message);
      setStep("preview");
      return;
    }

    setStep("done");
    setTimeout(() => {
      handleClose(false);
      router.push(`/orgs/${orgSlug}/projects/${projectId}/takeoff?takeoffId=${takeoff.id}`);
      router.refresh();
    }, 900);
  };

  const fmt = (n: number) => n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const catLabel = (key: string) => CATEGORIES.find((c) => c.key === key)?.label ?? key;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn("transition-all duration-200", step === "preview" ? "sm:max-w-4xl" : "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle>Import from Spreadsheet</DialogTitle>
        </DialogHeader>

        {/* ── Step: upload ── */}
        {(step === "upload" || step === "extracting") && (
          <div className="space-y-4 pt-1">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-md p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"
              )}
            >
              {step === "extracting" ? (
                <>
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Extracting with AI…</p>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Drop your spreadsheet here</p>
                    <p className="text-xs text-muted-foreground mt-0.5">.xlsx · .xls · .csv</p>
                  </div>
                  <Button variant="ghost" size="sm" className="pointer-events-none">
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Browse file
                  </Button>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            {error && (
              <div className="flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── Step: preview ── */}
        {step === "preview" && (
          <div className="space-y-4 pt-1">
            {/* Extracted project metadata */}
            {(projectMeta.name || projectMeta.address || projectMeta.specifier) && (
              <div className="rounded-sm border border-border bg-muted/20 px-3 py-2 space-y-0.5">
                {projectMeta.name && (
                  <p className="text-xs"><span className="text-muted-foreground">Project: </span><span className="text-foreground/70">{projectMeta.name}</span></p>
                )}
                {projectMeta.address && (
                  <p className="text-xs"><span className="text-muted-foreground">Address: </span><span className="text-foreground/70">{projectMeta.address}</span></p>
                )}
                {projectMeta.specifier && (
                  <p className="text-xs"><span className="text-muted-foreground">Specifier: </span><span className="text-foreground/70">{projectMeta.specifier}</span></p>
                )}
              </div>
            )}

            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Takeoff name
                </Label>
                <Input
                  value={takeoffName}
                  onChange={(e) => setTakeoffName(e.target.value)}
                  placeholder="e.g. Broadmeadow Public School"
                />
              </div>
              <p className="text-xs text-muted-foreground mb-2 shrink-0">
                {rows.length} rows extracted
              </p>
            </div>

            {/* Preview table */}
            <div className="border border-border rounded-sm overflow-hidden bg-card/65">
              <div className="overflow-auto max-h-[420px]">
                <table className="w-full border-collapse text-xs" style={{ minWidth: 800 }}>
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
                    <tr className="border-b border-border">
                      {["Category", "Code", "Description", "Location", "Qty", "Unit", "Waste %", "Notes"].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide border-r border-border last:border-r-0 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0 hover:bg-muted/10">
                        <td className="px-2 py-1 text-muted-foreground border-r border-border whitespace-nowrap">{catLabel(r.scope_category)}</td>
                        <td className="px-2 py-1 font-mono text-foreground/70 border-r border-border">{r.finish_code ?? <span className="text-muted-foreground/40">—</span>}</td>
                        <td className="px-2 py-1 text-foreground/70 border-r border-border max-w-[200px] truncate">{r.description ?? <span className="text-muted-foreground/40">—</span>}</td>
                        <td className="px-2 py-1 text-foreground/70 border-r border-border">{r.location ?? <span className="text-muted-foreground/40">—</span>}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-foreground/70 border-r border-border">{fmt(r.qty)}</td>
                        <td className="px-2 py-1 text-muted-foreground border-r border-border">{r.unit}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-foreground/70 border-r border-border">{r.waste_pct ?? 10}</td>
                        <td className="px-2 py-1 text-muted-foreground/70 max-w-[160px] truncate">{r.notes ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={reset}>
                ← Try another file
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>Cancel</Button>
                <Button size="sm" onClick={handleImport} disabled={!takeoffName.trim() || rows.length === 0}>
                  Import {rows.length} rows
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: importing / done ── */}
        {(step === "importing" || step === "done") && (
          <div className="flex flex-col items-center gap-3 py-8">
            {step === "importing" ? (
              <>
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Saving {rows.length} rows…</p>
              </>
            ) : (
              <>
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Imported successfully</p>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
