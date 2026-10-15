"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, MoreHorizontal, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumInput } from "./num-input";
import { CALC, DefaultField, IssueIcon, TD, TH, TextInput, money } from "./table-parts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { computeEstimate } from "@/lib/corner-guard-calc";
import type { CornerGuardDefaults, CornerGuardLine, LineIssue } from "@/lib/corner-guard-calc";
import { computeCostingSummary } from "@/lib/protection-summary";
import type { CostingInputs, TradeSubtotal } from "@/lib/protection-summary";
import { computeWallPanels } from "@/lib/wall-panel-calc";
import type { WallPanelDefaults, WallPanelLine, WeldRodLine } from "@/lib/wall-panel-calc";
import { CostingSummaryTab } from "./costing-summary";
import { WP_PASTE_FIELDS, WallPanelTab, parseWpPasted } from "./wall-panel-tab";
import type { WpPasteField } from "./wall-panel-tab";
import { computeRails } from "@/lib/rail-calc";
import type { RailDefaults, RailLine } from "@/lib/rail-calc";
import { HANDRAIL_PASTE_FIELDS, RAIL_PASTE_FIELDS, RailTab, parseRailPasted } from "./rail-tab";
import type { RailPasteField } from "./rail-tab";
import { computeDoorPanels } from "@/lib/door-panel-calc";
import type { DoorPanelLine } from "@/lib/door-panel-calc";
import { DP_PASTE_FIELDS, DoorPanelTab, parseDpPasted } from "./door-panel-tab";
import { ProtectionExcelExportButton } from "./protection-excel-export-button";
import { ProtectionNotesPanel } from "./protection-notes-panel";
import { deleteProtectionEstimate, renameProtectionEstimate, saveProtectionEstimate } from "../actions";

type SaveStatus = "saved" | "unsaved" | "saving" | "error";

const SAVE_DELAY_MS = 800;
const UNDO_MS = 8000;

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  error: "Save failed — retrying on next edit",
};

function blankDoorPanelLine(sortOrder: number): DoorPanelLine {
  return {
    id: crypto.randomUUID(),
    sort_order: sortOrder,
    item: null,
    sheets_qty: 0,
    price: null,
    panels_qty: 0,
    install_rate: null,
    cutting_enabled: false,
    cut_qty: null,
    cutting_rate: null,
    glue_rate: null,
    notes: null,
  };
}

function blankRailLine(sortOrder: number): RailLine {
  return {
    id: crypto.randomUUID(),
    sort_order: sortOrder,
    description: null,
    length_lm: null,
    order_lm: null,
    price: null,
    install_rate: null,
    brackets_qty: 0,
    bracket_price: null,
    screws_qty: 0,
    screw_price: null,
    returns_qty: 0,
    return_price: null,
    notes: null,
  };
}

function blankLine(sortOrder: number, group: string | null): CornerGuardLine {
  return {
    id: crypto.randomUUID(),
    sort_order: sortOrder,
    group_name: group,
    description: null,
    wall_height_mm: null,
    coving_mm: null,
    qty_std: 0,
    qty_nib: 0,
    price_std: null,
    price_nib: null,
    install_rate: null,
    cutting_enabled: null,
    cuts_qty: 0,
    cutting_rate: null,
    notes: null,
  };
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="tabular-nums text-[10px] opacity-60">{n}</span>;
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-10 shrink-0 pt-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

type PasteField = Exclude<keyof CornerGuardLine, "id" | "sort_order" | "cutting_enabled">;

const TEXT_FIELDS: PasteField[] = ["group_name", "description", "notes"];
const NON_NULL_FIELDS: PasteField[] = ["qty_std", "qty_nib", "cuts_qty"];
const INTEGER_FIELDS: PasteField[] = ["wall_height_mm", "coving_mm", "qty_std", "qty_nib", "cuts_qty"];

/** Converts one pasted cell to the field's type. Non-numbers ("n/a", blank) become null, or 0 for quantities. */
function parsePasted(field: PasteField, raw: string): string | number | null {
  const value = raw.trim();
  if (TEXT_FIELDS.includes(field)) return value === "" ? null : value;
  const n = Number(value.replace(/[$,\s]/g, ""));
  const ok = value !== "" && Number.isFinite(n) && n >= 0;
  if (!ok) return NON_NULL_FIELDS.includes(field) ? 0 : null;
  return INTEGER_FIELDS.includes(field) ? Math.round(n) : n;
}

export function CornerGuardEditor({
  estimateId,
  projectId,
  orgSlug,
  orgName,
  projectName,
  initialName,
  initialNotes,
  initialDefaults,
  initialCosting,
  initialLines,
  initialWpDefaults,
  initialWpLines,
  initialWeldRods,
  initialHrDefaults,
  initialHrLines,
  initialCrDefaults,
  initialCrLines,
  initialDpLines,
}: {
  estimateId: string;
  projectId: string;
  orgSlug: string;
  orgName: string;
  projectName: string;
  initialName: string;
  initialNotes: string | null;
  initialDefaults: CornerGuardDefaults;
  initialCosting: CostingInputs;
  initialLines: CornerGuardLine[];
  initialWpDefaults: WallPanelDefaults;
  initialWpLines: WallPanelLine[];
  initialWeldRods: WeldRodLine[];
  initialHrDefaults: RailDefaults;
  initialHrLines: RailLine[];
  initialCrDefaults: RailDefaults;
  initialCrLines: RailLine[];
  initialDpLines: DoorPanelLine[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const notesRef = useRef(initialNotes);
  const savedName = useRef(initialName);
  const [defaults, setDefaults] = useState(initialDefaults);
  const [costing, setCostingState] = useState(initialCosting);
  const [tab, setTab] = useState("summary");
  const [lines, setLines] = useState(initialLines);
  const [wpDefaults, setWpDefaults] = useState(initialWpDefaults);
  const [wpLines, setWpLines] = useState(initialWpLines);
  const [rods, setRods] = useState(initialWeldRods);
  const [hrDefaults, setHrDefaults] = useState(initialHrDefaults);
  const [hrLines, setHrLines] = useState(initialHrLines);
  const [crDefaults, setCrDefaults] = useState(initialCrDefaults);
  const [crLines, setCrLines] = useState(initialCrLines);
  const [dpLines, setDpLines] = useState(initialDpLines);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Filters (view only — totals always cover the whole job) ───────────────
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null); // "" = lines without a group
  const [wallFilter, setWallFilter] = useState<number | null>(null);
  const [issuesOnly, setIssuesOnly] = useState(false);
  // Lines added/pasted while filtered stay visible until the filters change
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  useEffect(() => setPinned(new Set()), [search, groupFilter, wallFilter, issuesOnly]);

  function clearFilters() {
    setSearch("");
    setGroupFilter(null);
    setWallFilter(null);
    setIssuesOnly(false);
  }

  // ── Auto-save: track what changed since the last save ─────────────────────
  const latest = useRef({ defaults, costing, lines, wpDefaults, wpLines, rods, hrDefaults, hrLines, crDefaults, crLines, dpLines });
  const dirtyIds = useRef(new Set<string>());
  const deletedIds = useRef(new Set<string>());
  const wp = useRef({ dirty: new Set<string>(), deleted: new Set<string>() });
  const rod = useRef({ dirty: new Set<string>(), deleted: new Set<string>() });
  const hr = useRef({ dirty: new Set<string>(), deleted: new Set<string>() });
  const cr = useRef({ dirty: new Set<string>(), deleted: new Set<string>() });
  const dp = useRef({ dirty: new Set<string>(), deleted: new Set<string>() });
  const defaultsDirty = useRef(false);
  const saving = useRef(false);
  const saveAgain = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    latest.current = { defaults, costing, lines, wpDefaults, wpLines, rods, hrDefaults, hrLines, crDefaults, crLines, dpLines };
  }, [defaults, costing, lines, wpDefaults, wpLines, rods, hrDefaults, hrLines, crDefaults, crLines, dpLines]);

  async function flush() {
    if (saving.current) {
      saveAgain.current = true;
      return;
    }
    const upsertIds = new Set(dirtyIds.current);
    const deletes = Array.from(deletedIds.current);
    const sendDefaults = defaultsDirty.current;
    const wpUpsertIds = new Set(wp.current.dirty);
    const wpDeletes = Array.from(wp.current.deleted);
    const rodUpsertIds = new Set(rod.current.dirty);
    const rodDeletes = Array.from(rod.current.deleted);
    const hrUpsertIds = new Set(hr.current.dirty);
    const hrDeletes = Array.from(hr.current.deleted);
    const crUpsertIds = new Set(cr.current.dirty);
    const crDeletes = Array.from(cr.current.deleted);
    const dpUpsertIds = new Set(dp.current.dirty);
    const dpDeletes = Array.from(dp.current.deleted);
    dirtyIds.current.clear();
    deletedIds.current.clear();
    defaultsDirty.current = false;
    wp.current.dirty.clear();
    wp.current.deleted.clear();
    rod.current.dirty.clear();
    rod.current.deleted.clear();
    hr.current.dirty.clear();
    hr.current.deleted.clear();
    cr.current.dirty.clear();
    cr.current.deleted.clear();
    dp.current.dirty.clear();
    dp.current.deleted.clear();

    saving.current = true;
    setStatus("saving");
    try {
      await saveProtectionEstimate(estimateId, projectId, {
        settings: sendDefaults
          ? {
              ...latest.current.defaults,
              ...latest.current.costing,
              ...latest.current.wpDefaults,
              hr_default_price: latest.current.hrDefaults.default_price,
              hr_install_rate: latest.current.hrDefaults.install_rate,
              cr_default_price: latest.current.crDefaults.default_price,
              cr_install_rate: latest.current.crDefaults.install_rate,
            }
          : null,
        upserts: latest.current.lines.filter((l) => upsertIds.has(l.id)),
        deletes,
        wallPanels: { upserts: latest.current.wpLines.filter((l) => wpUpsertIds.has(l.id)), deletes: wpDeletes },
        weldRods: { upserts: latest.current.rods.filter((r) => rodUpsertIds.has(r.id)), deletes: rodDeletes },
        handrails: { upserts: latest.current.hrLines.filter((l) => hrUpsertIds.has(l.id)), deletes: hrDeletes },
        crashRails: { upserts: latest.current.crLines.filter((l) => crUpsertIds.has(l.id)), deletes: crDeletes },
        doorPanels: { upserts: latest.current.dpLines.filter((l) => dpUpsertIds.has(l.id)), deletes: dpDeletes },
      });
      setStatus(saveAgain.current ? "unsaved" : "saved");
    } catch {
      // Put the changes back so the next edit retries them
      upsertIds.forEach((id) => dirtyIds.current.add(id));
      deletes.forEach((id) => deletedIds.current.add(id));
      defaultsDirty.current ||= sendDefaults;
      wpUpsertIds.forEach((id) => wp.current.dirty.add(id));
      wpDeletes.forEach((id) => wp.current.deleted.add(id));
      rodUpsertIds.forEach((id) => rod.current.dirty.add(id));
      rodDeletes.forEach((id) => rod.current.deleted.add(id));
      hrUpsertIds.forEach((id) => hr.current.dirty.add(id));
      hrDeletes.forEach((id) => hr.current.deleted.add(id));
      crUpsertIds.forEach((id) => cr.current.dirty.add(id));
      crDeletes.forEach((id) => cr.current.deleted.add(id));
      dpUpsertIds.forEach((id) => dp.current.dirty.add(id));
      dpDeletes.forEach((id) => dp.current.deleted.add(id));
      setStatus("error");
    } finally {
      saving.current = false;
    }
    if (saveAgain.current) {
      saveAgain.current = false;
      flush();
    }
  }

  function scheduleSave() {
    setStatus("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  useEffect(() => {
    if (status === "saved") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  // ── Edits ──────────────────────────────────────────────────────────────────
  function setCosting<K extends keyof CostingInputs>(key: K, value: CostingInputs[K]) {
    setCostingState((c) => ({ ...c, [key]: value }));
    defaultsDirty.current = true;
    scheduleSave();
  }

  function setDefault<K extends keyof CornerGuardDefaults>(key: K, value: CornerGuardDefaults[K]) {
    setDefaults((d) => ({ ...d, [key]: value }));
    defaultsDirty.current = true;
    scheduleSave();
  }

  function setLine<K extends keyof CornerGuardLine>(id: string, key: K, value: CornerGuardLine[K]) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
    // Keep an edited line on screen even if the edit stops it matching the filters
    if (!pinned.has(id)) setPinned((p) => new Set(p).add(id));
    dirtyIds.current.add(id);
    scheduleSave();
  }

  /** A new line — takes the filtered group / wall height so it stays in view, else the last line's group. */
  function newLine(sortOrder: number) {
    const group = groupFilter !== null ? groupFilter || null : lines[lines.length - 1]?.group_name ?? null;
    return { ...blankLine(sortOrder, group), wall_height_mm: wallFilter };
  }

  function addLine() {
    const line = newLine(Math.max(0, ...lines.map((l) => l.sort_order)) + 1);
    setLines((ls) => [...ls, line]);
    setPinned((p) => new Set(p).add(line.id));
    dirtyIds.current.add(line.id);
    scheduleSave();
  }

  function deleteLine(id: string) {
    const idx = lines.findIndex((l) => l.id === id);
    const line = lines[idx];
    setLines((ls) => ls.filter((l) => l.id !== id));
    dirtyIds.current.delete(id);
    deletedIds.current.add(id);
    scheduleSave();
    toast(`Line ${idx + 1} deleted`, {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          // sort_order is kept, so the line lands back in the same place
          setLines((ls) => [...ls.slice(0, idx), line, ...ls.slice(idx)]);
          deletedIds.current.delete(id);
          dirtyIds.current.add(id);
          scheduleSave();
        },
      },
    });
  }

  // ── Wall panels + weld rods ────────────────────────────────────────────────
  function setWpDefault<K extends keyof WallPanelDefaults>(key: K, value: WallPanelDefaults[K]) {
    setWpDefaults((d) => ({ ...d, [key]: value }));
    defaultsDirty.current = true;
    scheduleSave();
  }

  function setWpLine<K extends keyof WallPanelLine>(id: string, key: K, value: WallPanelLine[K]) {
    setWpLines((ls) => ls.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
    wp.current.dirty.add(id);
    scheduleSave();
  }

  function setRod<K extends keyof WeldRodLine>(id: string, key: K, value: WeldRodLine[K]) {
    setRods((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    rod.current.dirty.add(id);
    scheduleSave();
  }

  function blankWpLine(sortOrder: number): WallPanelLine {
    return {
      id: crypto.randomUUID(),
      sort_order: sortOrder,
      item_code: null,
      product: null,
      gross_m2: null,
      net_m2: null,
      sheet_width_mm: null,
      sheet_length_mm: null,
      sheets_override: null,
      wastage_pct: null,
      price: null,
      install_rate: null,
      glue_rate: null,
      cutouts_qty: 0,
      cutout_rate: null,
      notes: null,
    };
  }

  function addWpLine() {
    const line = blankWpLine(Math.max(0, ...wpLines.map((l) => l.sort_order)) + 1);
    setWpLines((ls) => [...ls, line]);
    wp.current.dirty.add(line.id);
    scheduleSave();
  }

  /** Pastes a tab/newline-separated block (copied from Excel) into a line table, from the given line and field. */
  function pasteRows<T extends { id: string; sort_order: number }, F extends keyof T>(
    rows: T[],
    setRows: React.Dispatch<React.SetStateAction<T[]>>,
    track: React.MutableRefObject<{ dirty: Set<string>; deleted: Set<string> }>,
    blank: (sortOrder: number) => T,
    fields: readonly F[],
    parse: (field: F, raw: string) => string | number | null,
    lineId: string,
    field: F
  ) {
    return (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text.includes("\t") && !text.includes("\n")) return; // single value — normal paste
      e.preventDefault();
      e.currentTarget.blur(); // a focused NumInput keeps its own text — release it so pasted values show

      const block = text
        .replace(/\r\n?/g, "\n")
        .replace(/\n$/, "")
        .split("\n")
        .map((row) => row.split("\t"));
      const startCol = fields.indexOf(field);
      const startRow = rows.findIndex((l) => l.id === lineId);
      const before = rows;
      const next = [...rows];
      const added: string[] = [];
      let sortOrder = Math.max(0, ...rows.map((l) => l.sort_order));

      block.forEach((cells, i) => {
        const row = startRow + i;
        if (!next[row]) {
          next[row] = blank(++sortOrder);
          added.push(next[row].id);
        }
        const updated = { ...next[row] };
        cells.forEach((raw, j) => {
          const key = fields[startCol + j];
          if (key) Object.assign(updated, { [key]: parse(key, raw) });
        });
        next[row] = updated;
        track.current.dirty.add(updated.id);
      });

      setRows(next);
      scheduleSave();
      toast(`Pasted ${block.length} ${block.length === 1 ? "row" : "rows"}`, {
        duration: UNDO_MS,
        action: {
          label: "Undo",
          onClick: () => {
            setRows(before);
            before.forEach((l) => track.current.dirty.add(l.id));
            added.forEach((id) => {
              track.current.dirty.delete(id);
              track.current.deleted.add(id);
            });
            scheduleSave();
          },
        },
      });
    };
  }

  const pasteWp = (lineId: string, field: WpPasteField) =>
    pasteRows(wpLines, setWpLines, wp, blankWpLine, WP_PASTE_FIELDS, parseWpPasted, lineId, field);

  /** Edit / add / delete / paste handlers for one line table (door panels, handrails, crash rail). */
  function lineHandlers<T extends { id: string; sort_order: number }, F extends keyof T>(
    rows: T[],
    setRows: React.Dispatch<React.SetStateAction<T[]>>,
    track: React.MutableRefObject<{ dirty: Set<string>; deleted: Set<string> }>,
    blank: (sortOrder: number) => T,
    fields: readonly F[],
    parse: (field: F, raw: string) => string | number | null
  ) {
    return {
      onLine: <K extends keyof T>(id: string, key: K, value: T[K]) => {
        setRows((ls) => ls.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
        track.current.dirty.add(id);
        scheduleSave();
      },
      onAddLine: () => {
        const line = blank(Math.max(0, ...rows.map((l) => l.sort_order)) + 1);
        setRows((ls) => [...ls, line]);
        track.current.dirty.add(line.id);
        scheduleSave();
      },
      onDeleteLine: (id: string) => deleteRow(rows, setRows, track, id, "Line"),
      onPaste: (lineId: string, field: F) => pasteRows(rows, setRows, track, blank, fields, parse, lineId, field),
    };
  }

  /** Handlers for a rail tab — Handrails and Crash rail work identically, each with its own state. */
  function railHandlers(
    rows: RailLine[],
    setRows: React.Dispatch<React.SetStateAction<RailLine[]>>,
    setDefs: React.Dispatch<React.SetStateAction<RailDefaults>>,
    track: React.MutableRefObject<{ dirty: Set<string>; deleted: Set<string> }>,
    fields: readonly RailPasteField[] = RAIL_PASTE_FIELDS
  ) {
    return {
      onDefault: <K extends keyof RailDefaults>(key: K, value: RailDefaults[K]) => {
        setDefs((d) => ({ ...d, [key]: value }));
        defaultsDirty.current = true;
        scheduleSave();
      },
      ...lineHandlers<RailLine, RailPasteField>(rows, setRows, track, blankRailLine, fields, parseRailPasted),
    };
  }

  function addRod() {
    const r: WeldRodLine = {
      id: crypto.randomUUID(),
      sort_order: Math.max(0, ...rods.map((x) => x.sort_order)) + 1,
      description: "Weld rod",
      qty: 0,
      unit: null,
      unit_cost: null,
      wastage_pct: 0,
      labour: null,
      notes: null,
    };
    setRods((rs) => [...rs, r]);
    rod.current.dirty.add(r.id);
    scheduleSave();
  }

  /** Deletes a wall panel line or weld rod, with the same undo toast as corner guards. */
  function deleteRow<T extends { id: string }>(
    rows: T[],
    setRows: React.Dispatch<React.SetStateAction<T[]>>,
    track: React.MutableRefObject<{ dirty: Set<string>; deleted: Set<string> }>,
    id: string,
    label: string
  ) {
    const idx = rows.findIndex((r) => r.id === id);
    const row = rows[idx];
    setRows((rs) => rs.filter((r) => r.id !== id));
    track.current.dirty.delete(id);
    track.current.deleted.add(id);
    scheduleSave();
    toast(`${label} ${idx + 1} deleted`, {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          setRows((rs) => [...rs.slice(0, idx), row, ...rs.slice(idx)]);
          track.current.deleted.delete(id);
          track.current.dirty.add(id);
          scheduleSave();
        },
      },
    });
  }

  async function commitName() {
    const trimmed = name.trim();
    if (!trimmed) return setName(savedName.current);
    if (trimmed === savedName.current) return;
    try {
      await renameProtectionEstimate(estimateId, projectId, orgSlug, trimmed);
      savedName.current = trimmed;
      router.refresh();
    } catch {
      toast.error("Failed to rename estimate.");
      setName(savedName.current);
    }
  }

  async function handleDelete() {
    try {
      await deleteProtectionEstimate(estimateId, projectId, orgSlug);
      toast.success("Estimate deleted.");
      router.push(`/orgs/${orgSlug}/projects/${projectId}`);
    } catch {
      toast.error("Failed to delete estimate.");
    }
  }

  const totals = computeEstimate(lines, defaults);
  const wpTotals = computeWallPanels(wpLines, rods, wpDefaults);
  const hrTotals = computeRails(hrLines, hrDefaults);
  const crTotals = computeRails(crLines, crDefaults);
  const dpTotals = computeDoorPanels(dpLines);
  const trades: TradeSubtotal[] = [
    {
      key: "corner-guards",
      label: "Corner guards",
      subtotal: lines.length ? totals.total : null,
      lines: lines.length,
      blockedLines: totals.blockedLines,
    },
    {
      key: "wall-panels",
      label: "Wall panels",
      subtotal: wpLines.length || rods.length ? wpTotals.total : null,
      lines: wpLines.length + rods.length,
      blockedLines: wpTotals.blockedLines,
    },
    {
      key: "door-panels",
      label: "Door panels",
      subtotal: dpLines.length ? dpTotals.total : null,
      lines: dpLines.length,
      blockedLines: dpTotals.blockedLines,
    },
    {
      key: "crash-rail",
      label: "Crash rail",
      subtotal: crLines.length ? crTotals.total : null,
      lines: crLines.length,
      blockedLines: crTotals.blockedLines,
    },
    {
      key: "handrails",
      label: "Handrails",
      subtotal: hrLines.length ? hrTotals.total : null,
      lines: hrLines.length,
      blockedLines: hrTotals.blockedLines,
    },
  ];
  const summary = computeCostingSummary(trades, costing);
  const cuttingCols = defaults.cutting_enabled;
  const namedGroups = totals.groups.some((g) => g.name !== "");
  const has = (issues: LineIssue[], code: LineIssue["code"]) => issues.some((i) => i.code === code);

  const lineNo = new Map(lines.map((l, i) => [l.id, i + 1]));
  const q = search.trim().toLowerCase();
  const filtering = q !== "" || groupFilter !== null || wallFilter !== null || issuesOnly;
  const visible = lines.filter(
    (l) =>
      pinned.has(l.id) ||
      ((groupFilter === null || (l.group_name?.trim() ?? "") === groupFilter) &&
        (wallFilter === null || l.wall_height_mm === wallFilter) &&
        (!issuesOnly || totals.results.get(l.id)!.issues.length > 0) &&
        (!q || [l.description, l.group_name, l.notes].some((v) => v?.toLowerCase().includes(q))))
  );
  const visibleSubtotal = visible.reduce((sum, l) => sum + totals.results.get(l.id)!.total, 0);
  const countBy = <K,>(key: (l: CornerGuardLine) => K) =>
    lines.reduce((m, l) => m.set(key(l), (m.get(key(l)) ?? 0) + 1), new Map<K, number>());
  const groupCounts = countBy((l) => l.group_name?.trim() ?? "");
  const wallCounts = countBy((l) => l.wall_height_mm);
  const wallHeights = Array.from(wallCounts.keys())
    .filter((h): h is number => h !== null)
    .sort((a, b) => a - b);
  const issueCount = lines.filter((l) => totals.results.get(l.id)!.issues.length > 0).length;

  // Editable columns in on-screen order — a pasted Excel block fills these left to right
  const pasteFields: PasteField[] = [
    "group_name",
    "description",
    "wall_height_mm",
    "coving_mm",
    "qty_std",
    "qty_nib",
    "price_std",
    "price_nib",
    "install_rate",
    ...(cuttingCols ? (["cuts_qty", "cutting_rate"] as const) : []),
    "notes",
  ];

  /** Pastes a tab/newline-separated block (copied from Excel) starting at the given line and field. */
  function pasteAt(lineId: string, field: PasteField) {
    return (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text.includes("\t") && !text.includes("\n")) return; // single value — normal paste
      e.preventDefault();
      e.currentTarget.blur(); // a focused NumInput keeps its own text — release it so pasted values show

      const block = text
        .replace(/\r\n?/g, "\n")
        .replace(/\n$/, "")
        .split("\n")
        .map((row) => row.split("\t"));
      // Fill the rows on screen (respecting filters) from the pasted line down; add lines past the end
      const startCol = pasteFields.indexOf(field);
      const startRow = visible.findIndex((l) => l.id === lineId);
      const before = lines;
      const updatedById = new Map<string, CornerGuardLine>();
      const addedLines: CornerGuardLine[] = [];
      let sortOrder = Math.max(0, ...lines.map((l) => l.sort_order));

      block.forEach((cells, i) => {
        let line = visible[startRow + i];
        if (!line) {
          line = newLine(++sortOrder);
          addedLines.push(line);
        }
        const updated = { ...line };
        cells.forEach((raw, j) => {
          const key = pasteFields[startCol + j];
          if (key) Object.assign(updated, { [key]: parsePasted(key, raw) });
        });
        if (addedLines.includes(line)) addedLines[addedLines.indexOf(line)] = updated;
        else updatedById.set(updated.id, updated);
        dirtyIds.current.add(updated.id);
      });
      const added = addedLines.map((l) => l.id);

      setLines([...lines.map((l) => updatedById.get(l.id) ?? l), ...addedLines]);
      setPinned((p) => new Set([...Array.from(p), ...added]));
      scheduleSave();
      toast(`Pasted ${block.length} ${block.length === 1 ? "row" : "rows"}`, {
        duration: UNDO_MS,
        action: {
          label: "Undo",
          onClick: () => {
            setLines(before);
            before.forEach((l) => dirtyIds.current.add(l.id));
            added.forEach((id) => {
              dirtyIds.current.delete(id);
              deletedIds.current.add(id);
            });
            scheduleSave();
          },
        },
      });
    };
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="flex-1 min-w-0 bg-transparent text-xl font-semibold outline-none rounded px-1 -mx-1 hover:bg-muted/30 focus:bg-muted/40"
          aria-label="Estimate name"
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
            {STATUS_LABEL[status]}
          </span>
          <ProtectionExcelExportButton
            getArgs={() => ({
              orgName,
              projectName,
              estimateName: name,
              costing,
              cornerGuards: { defaults, lines },
              wallPanels: { defaults: wpDefaults, lines: wpLines, rods },
              doorPanels: { lines: dpLines },
              crashRail: { defaults: crDefaults, lines: crLines },
              handrails: { defaults: hrDefaults, lines: hrLines },
            })}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Estimate actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete estimate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* One tab per product — corner guards first, more trades to follow */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="summary">Costing summary</TabsTrigger>
          <TabsTrigger value="corner-guards">Corner guards</TabsTrigger>
          <TabsTrigger value="wall-panels">Wall panels</TabsTrigger>
          <TabsTrigger value="door-panels">Door panels</TabsTrigger>
          <TabsTrigger value="crash-rail">Crash rail</TabsTrigger>
          <TabsTrigger value="handrails">Handrails</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4">
          <CostingSummaryTab
            summary={summary}
            trades={trades}
            inputs={costing}
            onChange={setCosting}
            onOpenTab={setTab}
            notes={<ProtectionNotesPanel estimateId={estimateId} notesRef={notesRef} />}
          />
        </TabsContent>
        <TabsContent value="corner-guards" className="mt-4 space-y-4">
          {/* Job defaults */}
          <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Job defaults — used by every line unless the line enters its own value.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <DefaultField label="Standard 75×75 $">
                <NumInput ariaLabel="Default standard price" value={defaults.default_price_std} onChange={(v) => setDefault("default_price_std", v)} />
              </DefaultField>
              <DefaultField label="Nib 50×50 $">
                <NumInput ariaLabel="Default nib price" value={defaults.default_price_nib} onChange={(v) => setDefault("default_price_nib", v)} />
              </DefaultField>
              <DefaultField label="Install $ each">
                <NumInput ariaLabel="Default install rate" value={defaults.default_install_rate} onChange={(v) => setDefault("default_install_rate", v)} />
              </DefaultField>
              <DefaultField label="Coving mm">
                <NumInput
                  ariaLabel="Default coving"
                  integer
                  value={defaults.default_coving_mm}
                  onChange={(v) => setDefault("default_coving_mm", v ?? 0)}
                />
              </DefaultField>
              <label className="flex items-center gap-2 pb-1.5">
                <Switch checked={defaults.cutting_enabled} onCheckedChange={(v) => setDefault("cutting_enabled", v)} />
                <span className="text-xs text-foreground/70">Cutting</span>
              </label>
              {cuttingCols && (
                <DefaultField label="Cutting $ per cut">
                  <NumInput ariaLabel="Default cutting rate" value={defaults.default_cutting_rate} onChange={(v) => setDefault("default_cutting_rate", v)} />
                </DefaultField>
              )}
            </div>
          </div>

          {/* Filters */}
          {lines.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search description, group, notes"
                    aria-label="Search lines"
                    className="w-full rounded-md border border-border bg-card/60 py-1 pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-primary/50"
                  />
                </div>
                {issueCount > 0 && (
                  <Chip active={issuesOnly} onClick={() => setIssuesOnly((v) => !v)}>
                    <AlertTriangle className="h-3 w-3" />
                    Issues only <Count n={issueCount} />
                  </Chip>
                )}
                {filtering && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                    Clear filters
                  </button>
                )}
              </div>
              {namedGroups && (
                <FilterRow label="Group">
                  {totals.groups.map((g) => (
                    <Chip
                      key={g.name}
                      active={groupFilter === g.name}
                      onClick={() => setGroupFilter((f) => (f === g.name ? null : g.name))}
                    >
                      {g.name || <span className="italic">No group</span>} <Count n={groupCounts.get(g.name) ?? 0} />
                    </Chip>
                  ))}
                </FilterRow>
              )}
              {wallHeights.length > 1 && (
                <FilterRow label="Wall">
                  {wallHeights.map((h) => (
                    <Chip key={h} active={wallFilter === h} onClick={() => setWallFilter((f) => (f === h ? null : h))}>
                      {h} mm <Count n={wallCounts.get(h) ?? 0} />
                    </Chip>
                  ))}
                </FilterRow>
              )}
            </div>
          )}

          {/* Lines */}
          <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead className="bg-muted/40">
                <tr>
                  <th className={`${TH} w-8 text-center`}>#</th>
                  <th className={`${TH} w-6`} />
                  <th className={`${TH} text-left min-w-[120px]`}>Group</th>
                  <th className={`${TH} text-left min-w-[180px]`}>Location / description</th>
                  <th className={`${TH} text-right w-20`}>Wall mm</th>
                  <th className={`${TH} text-right w-20`}>Coving mm</th>
                  <th className={`${TH} text-right w-20`}>Guard mm</th>
                  <th className={`${TH} text-right w-16`}>Std qty</th>
                  <th className={`${TH} text-right w-16`}>Nib qty</th>
                  <th className={`${TH} text-right w-20`}>Std $</th>
                  <th className={`${TH} text-right w-20`}>Nib $</th>
                  <th className={`${TH} text-right w-20`}>Install $</th>
                  {cuttingCols && (
                    <>
                      <th className={`${TH} text-center w-12`}>Cut</th>
                      <th className={`${TH} text-right w-16`}>Cuts</th>
                      <th className={`${TH} text-right w-20`}>Cut $</th>
                    </>
                  )}
                  <th className={`${TH} text-right`}>Material</th>
                  <th className={`${TH} text-right`}>Install</th>
                  {cuttingCols && <th className={`${TH} text-right`}>Cutting</th>}
                  <th className={`${TH} text-right`}>Line total</th>
                  <th className={`${TH} text-left min-w-[160px]`}>Notes</th>
                  <th className="border-b border-black/10 dark:border-white/10 w-8" />
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={99} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {lines.length === 0 ? (
                        "No lines yet — add the first corner guard line."
                      ) : (
                        <>
                          No lines match the filters.{" "}
                          <button onClick={clearFilters} className="text-primary hover:underline">
                            Clear filters
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )}
                {visible.map((line) => {
                  const idx = lineNo.get(line.id)! - 1;
                  const r = totals.results.get(line.id)!;
                  const blocked = has(r.issues, "missing_install");
                  return (
                    <tr key={line.id} className="group border-b border-black/5 dark:border-white/5">
                      <td className="border-r border-black/10 dark:border-white/10 bg-muted/20 px-1.5 text-center text-[10px] tabular-nums text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="border-r border-black/10 dark:border-white/10 px-1 text-center">
                        <IssueIcon issues={r.issues} />
                      </td>
                      <td className={TD}>
                        <TextInput ariaLabel={`Line ${idx + 1} group`} value={line.group_name} onPaste={pasteAt(line.id, "group_name")}
                          onChange={(v) => setLine(line.id, "group_name", v)} placeholder="—" />
                      </td>
                      <td className={TD}>
                        <TextInput ariaLabel={`Line ${idx + 1} description`} value={line.description} onPaste={pasteAt(line.id, "description")}
                          onChange={(v) => setLine(line.id, "description", v)} />
                      </td>
                      <td className={TD}>
                        <NumInput ariaLabel="Wall height" integer value={line.wall_height_mm} onPaste={pasteAt(line.id, "wall_height_mm")}
                          onChange={(v) => setLine(line.id, "wall_height_mm", v)} />
                      </td>
                      <td className={TD}>
                        <NumInput
                          ariaLabel="Coving"
                          integer
                          value={line.coving_mm}
                          inherited={defaults.default_coving_mm}
                          onPaste={pasteAt(line.id, "coving_mm")}
                          onChange={(v) => setLine(line.id, "coving_mm", v)}
                          tone={has(r.issues, "coving_exceeds_wall") ? "error" : undefined}
                        />
                      </td>
                      <td className={`${CALC} border-r border-black/10 dark:border-white/10`}>{r.guardHeight ?? "—"}</td>
                      <td className={TD}>
                        <NumInput ariaLabel="Standard qty" integer value={line.qty_std} onPaste={pasteAt(line.id, "qty_std")}
                          onChange={(v) => setLine(line.id, "qty_std", v ?? 0)} />
                      </td>
                      <td className={TD}>
                        <NumInput ariaLabel="Nib qty" integer value={line.qty_nib} onPaste={pasteAt(line.id, "qty_nib")}
                          onChange={(v) => setLine(line.id, "qty_nib", v ?? 0)} />
                      </td>
                      <td className={TD}>
                        <NumInput
                          ariaLabel="Standard price"
                          value={line.price_std}
                          inherited={defaults.default_price_std}
                          onPaste={pasteAt(line.id, "price_std")}
                          onChange={(v) => setLine(line.id, "price_std", v)}
                          tone={has(r.issues, "missing_price_std") ? "warn" : undefined}
                        />
                      </td>
                      <td className={TD}>
                        <NumInput
                          ariaLabel="Nib price"
                          value={line.price_nib}
                          inherited={defaults.default_price_nib}
                          onPaste={pasteAt(line.id, "price_nib")}
                          onChange={(v) => setLine(line.id, "price_nib", v)}
                          tone={has(r.issues, "missing_price_nib") ? "warn" : undefined}
                        />
                      </td>
                      <td className={TD}>
                        <NumInput
                          ariaLabel="Install rate"
                          value={line.install_rate}
                          inherited={defaults.default_install_rate}
                          onPaste={pasteAt(line.id, "install_rate")}
                          onChange={(v) => setLine(line.id, "install_rate", v)}
                          tone={blocked ? "error" : has(r.issues, "install_rate_mismatch") ? "outline" : undefined}
                        />
                      </td>
                      {cuttingCols && (
                        <>
                          <td className={`${TD} text-center`}>
                            <input
                              type="checkbox"
                              aria-label="Cutting on this line"
                              checked={r.cuttingOn}
                              onChange={(e) => setLine(line.id, "cutting_enabled", e.target.checked ? null : false)}
                              className="h-3.5 w-3.5 accent-primary align-middle"
                            />
                          </td>
                          <td className={TD}>
                            <NumInput
                              ariaLabel="Cuts"
                              integer
                              value={line.cuts_qty}
                              onPaste={pasteAt(line.id, "cuts_qty")}
                          onChange={(v) => setLine(line.id, "cuts_qty", v ?? 0)}
                              tone={has(r.issues, "no_cuts") ? "warn" : undefined}
                            />
                          </td>
                          <td className={TD}>
                            <NumInput
                              ariaLabel="Cutting rate"
                              value={line.cutting_rate}
                              inherited={defaults.default_cutting_rate}
                              onPaste={pasteAt(line.id, "cutting_rate")}
                          onChange={(v) => setLine(line.id, "cutting_rate", v)}
                              tone={has(r.issues, "missing_cutting_rate") ? "warn" : undefined}
                            />
                          </td>
                        </>
                      )}
                      <td className={`${CALC} border-r border-black/10 dark:border-white/10`}>{money(r.materialStd + r.materialNib)}</td>
                      <td className={`${CALC} border-r border-black/10 dark:border-white/10`}>{blocked ? "—" : money(r.installStd + r.installNib)}</td>
                      {cuttingCols && <td className={`${CALC} border-r border-black/10 dark:border-white/10`}>{money(r.cutting)}</td>}
                      <td className={`${CALC} border-r border-black/10 dark:border-white/10 font-medium ${blocked ? "text-destructive" : "text-foreground"}`}>
                        {blocked ? "No install rate" : money(r.total)}
                      </td>
                      <td className={TD}>
                        <TextInput ariaLabel={`Line ${idx + 1} notes`} value={line.notes} onPaste={pasteAt(line.id, "notes")}
                          onChange={(v) => setLine(line.id, "notes", v)} />
                      </td>
                      <td className="p-0 text-center">
                        <button
                          onClick={() => deleteLine(line.id)}
                          className="p-1.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-destructive transition-opacity"
                          aria-label={`Delete line ${idx + 1}`}
                          title="Delete line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" />
              Add line
            </Button>
            <span className="text-xs text-muted-foreground">
              {filtering ? (
                <>
                  Showing {visible.length} of {lines.length} lines ·{" "}
                  <span className="tabular-nums text-foreground/70">{money(visibleSubtotal)}</span>
                </>
              ) : (
                <>
                  {lines.length} {lines.length === 1 ? "line" : "lines"}
                </>
              )}
            </span>
          </div>

          {/* Sundries — estimate-level cost lines, added to the corner guards total */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold">Sundries</h3>
            <div className="w-fit max-w-full border border-black/10 dark:border-white/10 rounded-sm overflow-x-auto">
              <table className="min-w-max border-collapse">
                <thead className="bg-muted/40">
                  <tr>
                    <th className={`${TH} w-8 text-center`}>#</th>
                    <th className={`${TH} text-left min-w-[220px]`}>Description</th>
                    <th className={`${TH} text-right w-20`}>Qty</th>
                    <th className={`${TH} text-right w-20`}>$ each</th>
                    <th className={`${TH} text-right w-24`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Builders mastic", "cg_mastic_qty", "cg_mastic_price", totals.mastic],
                      ["Silicone", "cg_silicone_qty", "cg_silicone_price", totals.silicone],
                    ] as const
                  ).map(([label, qtyKey, priceKey, amount], idx) => (
                    <tr key={label} className="border-b border-black/5 dark:border-white/5">
                      <td className="border-r border-black/10 dark:border-white/10 bg-muted/20 px-1.5 text-center text-[10px] tabular-nums text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className={`${TD} px-2 text-xs text-foreground/70`}>{label}</td>
                      <td className={TD}>
                        <NumInput ariaLabel={`${label} qty`} value={defaults[qtyKey]} onChange={(v) => setDefault(qtyKey, v ?? 0)} />
                      </td>
                      <td className={TD}>
                        <NumInput
                          ariaLabel={`${label} price each`}
                          value={defaults[priceKey]}
                          onChange={(v) => setDefault(priceKey, v)}
                          tone={defaults[qtyKey] > 0 && defaults[priceKey] === null ? "warn" : undefined}
                        />
                      </td>
                      <td className={`${CALC} font-medium text-foreground`}>{money(amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex flex-col items-end gap-3">
            {namedGroups && (
              <div className="w-full max-w-sm border border-black/10 dark:border-white/10 rounded-sm">
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium border-b border-black/10 dark:border-white/10 bg-muted/40">
                  Group subtotals
                </p>
                {totals.groups.map((g) => (
                  <button
                    key={g.name}
                    onClick={() => setGroupFilter((f) => (f === g.name ? null : g.name))}
                    title="Show only this group"
                    className={`flex w-full justify-between gap-4 px-3 py-1.5 text-xs border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-muted/30 ${
                      groupFilter === g.name ? "bg-primary/10" : ""
                    }`}
                  >
                    <span className={g.name ? "text-foreground/70" : "text-muted-foreground italic"}>{g.name || "No group"}</span>
                    <span className={`tabular-nums ${g.blocked ? "text-destructive" : "text-foreground/70"}`}>
                      {g.blocked ? "Incomplete" : money(g.total)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="w-full max-w-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Quantity</span>
                <span className="tabular-nums">
                  {totals.qtyStd} standard · {totals.qtyNib} nib
                </span>
              </div>
              {(
                [
                  ["Material", totals.materialStd, totals.materialNib],
                  ["Install", totals.installStd, totals.installNib],
                ] as const
              ).map(([label, std, nib]) => (
                <div key={label} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="tabular-nums text-foreground/70">{money(std + nib)}</span>
                  </div>
                  <div className="flex justify-between pl-3 text-[11px] text-muted-foreground/70">
                    <span>Standard {money(std)} · Nib {money(nib)}</span>
                  </div>
                </div>
              ))}
              {totals.cutting > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cutting</span>
                  <span className="tabular-nums text-foreground/70">{money(totals.cutting)}</span>
                </div>
              )}
              {totals.mastic + totals.silicone > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sundries</span>
                  <span className="tabular-nums text-foreground/70">{money(totals.mastic + totals.silicone)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 text-sm font-semibold">
                <span>Corner guards total</span>
                {totals.blockedLines > 0 ? (
                  <span className="text-destructive text-xs font-medium">
                    Incomplete — {totals.blockedLines} {totals.blockedLines === 1 ? "line" : "lines"} missing install rate
                  </span>
                ) : (
                  <span className="tabular-nums">{money(totals.total)}</span>
                )}
              </div>
              {totals.defaultPriceLines > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  {totals.defaultPriceLines} {totals.defaultPriceLines === 1 ? "line uses" : "lines use"} the job default
                  material price — shown in light blue.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/50">Cost only — admin, markup and extra costs are added in the Costing summary tab.</p>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="wall-panels" className="mt-4">
          <WallPanelTab
            defaults={wpDefaults}
            lines={wpLines}
            rods={rods}
            totals={wpTotals}
            adminPct={costing.admin_pct}
            markupPct={costing.markup_pct}
            onDefault={setWpDefault}
            onLine={setWpLine}
            onAddLine={addWpLine}
            onDeleteLine={(id) => deleteRow(wpLines, setWpLines, wp, id, "Line")}
            onPaste={pasteWp}
            onRod={setRod}
            onAddRod={addRod}
            onDeleteRod={(id) => deleteRow(rods, setRods, rod, id, "Weld rod")}
          />
        </TabsContent>
        <TabsContent value="door-panels" className="mt-4">
          <DoorPanelTab
            lines={dpLines}
            totals={dpTotals}
            {...lineHandlers(dpLines, setDpLines, dp, blankDoorPanelLine, DP_PASTE_FIELDS, parseDpPasted)}
          />
        </TabsContent>
        <TabsContent value="crash-rail" className="mt-4">
          <RailTab
            label="Crash rail"
            defaults={crDefaults}
            lines={crLines}
            totals={crTotals}
            {...railHandlers(crLines, setCrLines, setCrDefaults, cr)}
          />
        </TabsContent>
        <TabsContent value="handrails" className="mt-4">
          <RailTab
            label="Handrails"
            wallReturns
            defaults={hrDefaults}
            lines={hrLines}
            totals={hrTotals}
            {...railHandlers(hrLines, setHrLines, setHrDefaults, hr, HANDRAIL_PASTE_FIELDS)}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the estimate and all its lines.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
