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

type Step = "upload" | "extracting" | "preview" | "creating" | "done";

type ExtractedPayload = {
  project_name: string;
  project_address?: string;
  specifier_name?: string;
  takeoff_name: string;
  rows: {
    scope_category: string;
    finish_code?: string;
    description?: string;
    manufacturer?: string;
    colour?: string;
    location?: string;
    level?: string;
    qty: number;
    unit: string;
    waste_pct?: number;
    notes?: string;
  }[];
};

export function ImportTakeoffDialog({
  orgId,
  orgSlug,
  trigger,
}: {
  orgId: string;
  orgSlug: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [payload, setPayload] = useState<ExtractedPayload | null>(null);
  const [projectName, setProjectName] = useState("");
  const [takeoffName, setTakeoffName] = useState("");

  const reset = () => {
    setStep("upload");
    setError(null);
    setPayload(null);
    setProjectName("");
    setTakeoffName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    setOpen(v);
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

      const data: ExtractedPayload = await res.json();
      setPayload(data);
      setProjectName(data.project_name || file.name.replace(/\.[^.]+$/, ""));
      setTakeoffName(data.takeoff_name || data.project_name || "Takeoff 1");
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process file");
      setStep("upload");
    }
  };

  const handleConfirm = async () => {
    if (!payload || !projectName.trim()) return;
    setStep("creating");
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setError("Not authenticated"); setStep("preview"); return; }

    // 1. Create project
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .insert({
        organization_id: orgId,
        created_by: userData.user.id,
        name: projectName.trim(),
        location: payload.project_address ?? null,
        head_client: payload.specifier_name ?? null,
        brand: "spm",
        status: "active",
      })
      .select("id")
      .single();

    if (pErr || !project) { setError(pErr?.message ?? "Failed to create project"); setStep("preview"); return; }

    // 2. Create takeoff
    const { data: takeoff, error: tErr } = await supabase
      .from("takeoffs")
      .insert({
        project_id: project.id,
        name: takeoffName.trim() || takeoffName,
        sort_order: 0,
        created_by: userData.user.id,
      })
      .select("id")
      .single();

    if (tErr || !takeoff) { setError(tErr?.message ?? "Failed to create takeoff"); setStep("preview"); return; }

    // 3. Insert rows
    const insertRows = payload.rows.map((r, i) => ({
      takeoff_id: takeoff.id,
      created_by: userData.user!.id,
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
    if (rErr) { setError(rErr.message); setStep("preview"); return; }

    setStep("done");
    setTimeout(() => {
      handleClose(false);
      router.push(`/orgs/${orgSlug}/projects/${project.id}/takeoff?takeoffId=${takeoff.id}`);
      router.refresh();
    }, 900);
  };

  return (
    <>
      <div onClick={() => setOpen(true)}>{trigger}</div>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className={cn("transition-all duration-200", step === "preview" ? "sm:max-w-lg" : "sm:max-w-md")}>
          <DialogHeader>
            <DialogTitle>Import from Spreadsheet</DialogTitle>
          </DialogHeader>

          {/* Upload / extracting */}
          {(step === "upload" || step === "extracting") && (
            <div className="space-y-4 pt-1">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
                onClick={() => step === "upload" && fileRef.current?.click()}
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
                      <p className="text-sm font-medium">Drop your BoQ spreadsheet here</p>
                      <p className="text-xs text-muted-foreground mt-0.5">.xlsx · .xls · .csv</p>
                    </div>
                    <Button variant="ghost" size="sm" className="pointer-events-none">
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Browse file
                    </Button>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
              {error && (
                <div className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{error}
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {step === "preview" && payload && (
            <div className="space-y-4 pt-1">
              {/* Extracted metadata */}
              <div className="rounded-sm border border-border bg-muted/20 px-3 py-2.5 space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Project name</Label>
                  <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" />
                </div>
                {payload.project_address && (
                  <p className="text-xs"><span className="text-muted-foreground">Address: </span><span className="text-foreground/70">{payload.project_address}</span></p>
                )}
                {payload.specifier_name && (
                  <p className="text-xs"><span className="text-muted-foreground">Specifier: </span><span className="text-foreground/70">{payload.specifier_name}</span></p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Takeoff name</Label>
                <Input value={takeoffName} onChange={(e) => setTakeoffName(e.target.value)} placeholder="e.g. Booragul Public School" />
              </div>

              <p className="text-xs text-muted-foreground">{payload.rows.length} rows extracted</p>

              {error && (
                <div className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{error}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={reset}>← Try another file</Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleConfirm} disabled={!projectName.trim() || payload.rows.length === 0}>
                    Create project & import
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Creating / done */}
          {(step === "creating" || step === "done") && (
            <div className="flex flex-col items-center gap-3 py-8">
              {step === "creating" ? (
                <>
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Creating project and importing rows…</p>
                </>
              ) : (
                <>
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Project created successfully</p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
