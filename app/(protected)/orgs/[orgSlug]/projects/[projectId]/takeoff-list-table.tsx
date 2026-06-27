"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Copy, FileSpreadsheet, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NewTakeoffDialog } from "./takeoff/new-takeoff-dialog";
import { ImportExcelDialog } from "./takeoff/import-excel-dialog";

type TakeoffItem = {
  id: string;
  name: string;
  row_count: number;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function TakeoffListTable({
  takeoffs,
  projectId,
  orgSlug,
  canWrite,
}: {
  takeoffs: TakeoffItem[];
  projectId: string;
  orgSlug: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState(takeoffs);
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEdit = (id: string, name: string) => {
    setConfirmDeleteId(null);
    setEditingId(id);
    setEditName(name);
  };

  const commitEdit = async (id: string) => {
    const trimmed = editName.trim();
    setEditingId(null);
    if (!trimmed) return;
    const item = items.find((t) => t.id === id);
    if (item?.name === trimmed) return;
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
    await supabase.from("takeoffs").update({ name: trimmed }).eq("id", id);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from("takeoffs").delete().eq("id", id);
    setItems((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(null);
    setConfirmDeleteId(null);
    router.refresh();
  };

  const handleDuplicate = async (id: string, name: string) => {
    setDuplicatingId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: newTakeoff, error: takeoffErr } = await supabase
        .from("takeoffs")
        .insert({ project_id: projectId, name: `Copy of ${name}`, sort_order: items.length, created_by: user.id })
        .select("id")
        .single();
      if (takeoffErr || !newTakeoff) throw takeoffErr ?? new Error("Insert failed");

      const { data: rows, error: rowsErr } = await supabase
        .from("project_takeoff")
        .select("sort_order, scope_category, finish_code, description, manufacturer, colour, location, level, product_type, qty, unit, waste_pct, notes, parent_finish_code, cove_height_mm")
        .eq("takeoff_id", id);
      if (rowsErr) throw rowsErr;

      if (rows && rows.length > 0) {
        const { error: insertErr } = await supabase
          .from("project_takeoff")
          .insert(rows.map((r) => ({ ...r, takeoff_id: newTakeoff.id, created_by: user.id })));
        if (insertErr) throw insertErr;
      }

      setItems((prev) => [...prev, {
        id: newTakeoff.id,
        name: `Copy of ${name}`,
        row_count: rows?.length ?? 0,
        created_at: new Date().toISOString(),
      }]);
      toast.success("Takeoff duplicated.");
      router.refresh();
    } catch {
      toast.error("Failed to duplicate takeoff.");
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Takeoffs</h2>
        {canWrite && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Import BoQ
            </Button>
            <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New takeoff
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl flex items-center justify-center h-32">
          <div className="text-center space-y-1.5">
            <p className="text-sm font-medium">No takeoffs yet</p>
            <p className="text-xs text-muted-foreground">Create a takeoff to start measuring quantities.</p>
            {canWrite && (
              <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                New takeoff
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Rows
                </th>
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Created
                </th>
                <th className="w-8 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((t) => {
                const href = `/orgs/${orgSlug}/projects/${projectId}/takeoff?takeoffId=${t.id}`;

                if (confirmDeleteId === t.id) {
                  return (
                    <tr key={t.id} className="bg-destructive/5">
                      <td colSpan={4} className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-destructive flex-1">
                            Delete &ldquo;{t.name}&rdquo;?
                          </span>
                          <button
                            onClick={() => handleDelete(t.id)}
                            disabled={deletingId === t.id}
                            className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
                          >
                            {deletingId === t.id ? "Deleting…" : "Yes"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            No
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={t.id} className="group hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      {editingId === t.id ? (
                        <input
                          ref={inputRef}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={() => commitEdit(t.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitEdit(t.id); }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="text-xs text-foreground/70 bg-transparent border-b border-primary/50 outline-none w-full py-0.5"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Link
                            href={href}
                            className="text-xs font-medium text-foreground/70 hover:text-primary transition-colors"
                          >
                            {t.name}
                          </Link>
                          {canWrite && (
                            <button
                              onClick={() => startEdit(t.id, t.name)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded-sm text-muted-foreground hover:text-foreground transition-all shrink-0"
                              title="Rename"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                      {t.row_count}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {formatDate(t.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      {canWrite && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleDuplicate(t.id, t.name)}
                            disabled={duplicatingId === t.id}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                            title="Duplicate takeoff"
                          >
                            {duplicatingId === t.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Copy className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setConfirmDeleteId(t.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-sm text-muted-foreground hover:text-destructive transition-all"
                            title="Delete takeoff"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NewTakeoffDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        projectId={projectId}
        orgSlug={orgSlug}
        nextSortOrder={items.length}
      />

      <ImportExcelDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
        orgSlug={orgSlug}
        existingTakeoffCount={items.length}
      />
    </>
  );
}
