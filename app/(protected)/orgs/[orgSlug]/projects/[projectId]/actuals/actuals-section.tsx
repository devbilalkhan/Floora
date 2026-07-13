"use client";

import { useState, useRef, useEffect, useMemo, memo } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, Copy, Eye, EyeOff, GripVertical, Loader2, MoreHorizontal, Plus, Receipt, SlidersHorizontal, Trash2, X, Zap } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  createLineItem,
  updateLineItem,
  deleteLineItem,
  duplicateLines,
  updateProjectAdminFee,
  updateAdminFeeEstimate,
} from "./actions";

const ExtractionDialog = dynamic(() => import("./extraction-dialog"), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────

export type ActualGroup = {
  id: string;
  type: "income" | "expense";
  name: string;
  sort_order: number;
  is_collapsed: boolean;
  notes: string | null;
};

export type ActualLineItem = {
  id: string;
  group_id: string;
  sort_order: number;
  invoice_date: string | null;
  invoice_number: string | null;
  supplier: string | null;
  description: string;
  qty: number | null;
  unit_price: number | null;
  subtotal: number;
  source: "manual" | "ai_extracted";
  retention_applied: boolean;
  included_in_totals: boolean;
  code: string | null;
};

// Cost codes let a line be tagged independent of which supplier/invoice it's
// under (e.g. a freight charge on an otherwise-material invoice). More codes
// can be added here later.
export const LINE_CODES: { value: string; label: string; bg: string; text: string }[] = [
  { value: "FR", label: "Freight", bg: "bg-sky-500/15", text: "text-sky-700 dark:text-sky-300" },
];

const NO_CODE = "none";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function effectiveSubtotal(item: ActualLineItem): number {
  return item.qty !== null && item.unit_price !== null
    ? item.qty * item.unit_price
    : item.subtotal;
}

function sumIncluded(items: ActualLineItem[]): number {
  return items.reduce((s, i) => s + (i.included_in_totals ? effectiveSubtotal(i) : 0), 0);
}

// Supplier badge colors — each distinct supplier on the page is assigned its
// own color from a fixed palette, in alphabetical order, so a color already
// claimed by one supplier is never reused for another. Colors only repeat
// once the palette is exhausted (more than SUPPLIER_BADGE_PALETTE.length
// distinct suppliers in one project).
const SUPPLIER_BADGE_PALETTE = [
  { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-violet-500/15", text: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-pink-500/15", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-teal-500/15", text: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-rose-500/15", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-300" },
  { bg: "bg-lime-500/15", text: "text-lime-700 dark:text-lime-300" },
  { bg: "bg-fuchsia-500/15", text: "text-fuchsia-700 dark:text-fuchsia-300" },
];

function buildSupplierColorMap(items: ActualLineItem[]): Map<string, string> {
  const uniqueSuppliers = Array.from(
    new Set(
      items
        .map(i => i.supplier?.trim())
        .filter((s): s is string => !!s)
        .map(s => s.toLowerCase())
    )
  ).sort((a, b) => a.localeCompare(b));

  const map = new Map<string, string>();
  uniqueSuppliers.forEach((supplier, i) => {
    const { bg, text } = SUPPLIER_BADGE_PALETTE[i % SUPPLIER_BADGE_PALETTE.length];
    map.set(supplier, cn(bg, text));
  });
  return map;
}

function supplierBadgeClass(supplierColorMap: Map<string, string>, supplier: string): string {
  return supplierColorMap.get(supplier.trim().toLowerCase()) ?? "";
}

// Invoices are ordered alphabetically by supplier name (blank suppliers last);
// ties broken by original insertion order.
function compareInvoiceBuckets(a: ActualLineItem[], b: ActualLineItem[]): number {
  const supplierA = a[0]?.supplier?.trim() || "";
  const supplierB = b[0]?.supplier?.trim() || "";
  if (supplierA && !supplierB) return -1;
  if (!supplierA && supplierB) return 1;
  const cmp = supplierA.localeCompare(supplierB, undefined, { sensitivity: "base" });
  if (cmp !== 0) return cmp;
  return Math.min(...a.map(x => x.sort_order)) - Math.min(...b.map(x => x.sort_order));
}

// ── Filters ────────────────────────────────────────────────────────────────────

type Filters = {
  dateFrom: string;
  dateTo: string;
  supplier: string;
  amountMin: string;
  amountMax: string;
};

const EMPTY_FILTERS: Filters = { dateFrom: "", dateTo: "", supplier: "", amountMin: "", amountMax: "" };

function countActiveFilters(f: Filters) {
  return [f.dateFrom, f.dateTo, f.supplier, f.amountMin, f.amountMax].filter(Boolean).length;
}

function matchesFilters(item: ActualLineItem, f: Filters): boolean {
  if (f.dateFrom && (item.invoice_date === null || item.invoice_date < f.dateFrom)) return false;
  if (f.dateTo && (item.invoice_date === null || item.invoice_date > f.dateTo)) return false;
  if (f.supplier && !item.supplier?.toLowerCase().includes(f.supplier.toLowerCase())) return false;
  const amount = effectiveSubtotal(item);
  if (f.amountMin !== "" && !isNaN(parseFloat(f.amountMin)) && amount < parseFloat(f.amountMin)) return false;
  if (f.amountMax !== "" && !isNaN(parseFloat(f.amountMax)) && amount > parseFloat(f.amountMax)) return false;
  return true;
}

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const inp =
    "h-7 px-2 text-[11px] bg-input border border-border rounded text-foreground/70 " +
    "placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40";
  const lbl = "text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 shrink-0";

  return (
    <div className="flex items-center gap-x-5 gap-y-2 flex-wrap rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className={lbl}>Date</span>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
          className={cn(inp, "w-[130px] tabular-nums")}
        />
        <span className="text-[10px] text-muted-foreground/40">–</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={e => onChange({ ...filters, dateTo: e.target.value })}
          className={cn(inp, "w-[130px] tabular-nums")}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className={lbl}>Supplier</span>
        <input
          type="text"
          value={filters.supplier}
          onChange={e => onChange({ ...filters, supplier: e.target.value })}
          placeholder="Search…"
          className={cn(inp, "w-36")}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className={lbl}>Amount</span>
        <input
          type="number"
          value={filters.amountMin}
          onChange={e => onChange({ ...filters, amountMin: e.target.value })}
          placeholder="Min"
          className={cn(inp, "w-20 tabular-nums")}
        />
        <span className="text-[10px] text-muted-foreground/40">–</span>
        <input
          type="number"
          value={filters.amountMax}
          onChange={e => onChange({ ...filters, amountMax: e.target.value })}
          placeholder="Max"
          className={cn(inp, "w-20 tabular-nums")}
        />
      </div>
    </div>
  );
}

// ── LineItemRow ────────────────────────────────────────────────────────────────

function evalArithmetic(expr: string): number | null {
  const s = expr.replace(/\s/g, "");
  if (!s || !/^[\d+\-*/().]+$/.test(s)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const r = Function('"use strict";return(' + s + ')')();
    return typeof r === "number" && isFinite(r) ? Math.round(r * 100) / 100 : null;
  } catch { return null; }
}

function LineItemRow({
  item,
  index,
  projectId,
  showRetention,
  onUpdate,
  onDelete,
}: {
  item: ActualLineItem;
  index: number;
  projectId: string;
  showRetention?: boolean;
  onUpdate: (id: string, patch: Partial<ActualLineItem>) => void;
  onDelete: (id: string) => void;
}) {
  const [local, setLocal] = useState(item);
  useEffect(() => {
    setLocal(prev => ({ ...prev, included_in_totals: item.included_in_totals }));
  }, [item.included_in_totals]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rawFields, setRawFields] = useState<Record<string, string>>({});

  const isComputed = local.qty !== null && local.unit_price !== null;
  const displaySubtotal = isComputed ? local.qty! * local.unit_price! : local.subtotal;

  function applyChange(field: keyof ActualLineItem, raw: string) {
    let value: string | number | null = raw;

    if (field === "qty" || field === "unit_price" || field === "subtotal") {
      value = raw === "" ? null : parseFloat(raw);
      if (typeof value === "number" && isNaN(value)) value = null;
      if (field === "subtotal" && value === null) value = 0;
    }
    if (field === "invoice_date" || field === "invoice_number") {
      value = raw.trim() === "" ? null : raw;
    }

    const next = { ...local, [field]: value } as ActualLineItem;
    if ((field === "qty" || field === "unit_price") && next.qty !== null && next.unit_price !== null) {
      next.subtotal = next.qty * next.unit_price;
    }

    setLocal(next);

    const patch: Partial<ActualLineItem> = { [field]: value };
    if (field === "qty" || field === "unit_price") patch.subtotal = next.subtotal;

    // Propagate to parent immediately so section totals stay live.
    // Exception: invoice_number is the bucket key in GroupRow — propagating on
    // every keystroke unmounts/remounts the InvoiceSubGroup and collapses it.
    if (field !== "invoice_number") {
      onUpdate(local.id, patch);
    }

    // Debounce server save
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateLineItem(local.id, projectId, patch);
        // Propagate invoice_number only after save so rebucketing happens once
        if (field === "invoice_number") {
          onUpdate(local.id, patch);
        }
        setSaving(false);
        setSaved(true);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save.");
        setLocal(item);
        onUpdate(local.id, item);
        setSaving(false);
      }
    }, 1500);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteLineItem(local.id, projectId);
      onDelete(local.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function toggleRetention() {
    const next = !local.retention_applied;
    setLocal(prev => ({ ...prev, retention_applied: next }));
    onUpdate(local.id, { retention_applied: next });
    try {
      await updateLineItem(local.id, projectId, { retention_applied: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update retention.");
      setLocal(prev => ({ ...prev, retention_applied: !next }));
      onUpdate(local.id, { retention_applied: !next });
    }
  }

  async function toggleIncluded() {
    const next = !local.included_in_totals;
    setLocal(prev => ({ ...prev, included_in_totals: next }));
    onUpdate(local.id, { included_in_totals: next });
    try {
      await updateLineItem(local.id, projectId, { included_in_totals: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update.");
      setLocal(prev => ({ ...prev, included_in_totals: !next }));
      onUpdate(local.id, { included_in_totals: !next });
    }
  }

  async function setCode(raw: string) {
    const next = raw === NO_CODE ? null : raw;
    const prev = local.code;
    setLocal(p => ({ ...p, code: next }));
    onUpdate(local.id, { code: next });
    try {
      await updateLineItem(local.id, projectId, { code: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update code.");
      setLocal(p => ({ ...p, code: prev }));
      onUpdate(local.id, { code: prev });
    }
  }

  function numericHandlers(field: "qty" | "unit_price" | "subtotal") {
    const numVal = local[field];
    const idle = field === "subtotal"
      ? (numVal ? String(numVal) : "")
      : (numVal !== null ? String(numVal) : "");
    return {
      value: field in rawFields ? rawFields[field] : idle,
      onFocus() { setRawFields(p => ({ ...p, [field]: idle })); },
      onChange(e: React.ChangeEvent<HTMLInputElement>) {
        const v = e.target.value;
        setRawFields(p => ({ ...p, [field]: v }));
        if (v === "") { applyChange(field, ""); return; }
        const n = evalArithmetic(v);
        if (n !== null) applyChange(field, String(n));
      },
      onBlur() {
        const v = rawFields[field] ?? idle;
        setRawFields(p => { const r = { ...p }; delete r[field]; return r; });
        if (!v) { applyChange(field, ""); return; }
        const n = evalArithmetic(v);
        if (n !== null) applyChange(field, String(n));
      },
    };
  }

  const cell =
    "h-full w-full px-2 py-1.5 text-[11px] bg-transparent border-0 outline-none " +
    "focus:ring-1 focus:ring-inset focus:ring-primary/40 rounded-none " +
    "placeholder:text-muted-foreground/40 text-foreground/85";

  return (
    <tr
      className={cn(
        "group border-t border-black/5 dark:border-white/5 hover:bg-muted/10 transition-colors",
        local.source === "ai_extracted" && "border-l-2 border-l-secondary/40",
        !local.included_in_totals && "opacity-45"
      )}
    >
      <td className="text-center py-1.5">
        <span className="text-[10px] text-muted-foreground/40 tabular-nums select-none">
          {local.source === "ai_extracted" ? "⚡" : index + 1}
        </span>
      </td>

      <td className="p-0">
        <input
          type="date"
          value={local.invoice_date ?? ""}
          onChange={e => applyChange("invoice_date", e.target.value)}
          className={cn(cell, "tabular-nums")}
        />
      </td>

      <td className="p-0">
        <input
          type="text"
          value={local.invoice_number ?? ""}
          onChange={e => applyChange("invoice_number", e.target.value)}
          placeholder="INV-0001"
          className={cn(cell, "font-mono uppercase tracking-wide")}
        />
      </td>

      <td className="p-0">
        <input
          type="text"
          value={local.supplier ?? ""}
          onChange={e => applyChange("supplier", e.target.value)}
          placeholder="Supplier…"
          className={cell}
        />
      </td>

      <td className="p-0">
        <input
          type="text"
          value={local.description}
          onChange={e => applyChange("description", e.target.value)}
          placeholder="Description…"
          className={cell}
        />
      </td>

      <td className="p-0">
        <input
          type="text"
          inputMode="decimal"
          {...numericHandlers("qty")}
          placeholder="—"
          className={cn(cell, "text-right tabular-nums")}
        />
      </td>

      <td className="p-0">
        <input
          type="text"
          inputMode="decimal"
          {...numericHandlers("unit_price")}
          placeholder="—"
          className={cn(cell, "text-right tabular-nums")}
        />
      </td>

      <td className="p-0">
        {isComputed ? (
          <div className="h-full px-2 py-1.5 text-right text-[11px] tabular-nums text-foreground/85 bg-primary/5 select-none">
            {fmt(displaySubtotal)}
          </div>
        ) : (
          <input
            type="text"
            inputMode="decimal"
            {...numericHandlers("subtotal")}
            placeholder="0.00"
            className={cn(cell, "text-right tabular-nums")}
          />
        )}
      </td>

      <td className="p-0 text-center">
        <Select value={local.code ?? NO_CODE} onValueChange={setCode}>
          <SelectTrigger
            title="Cost code"
            className="h-full w-full border-0 rounded-none shadow-none bg-transparent px-1 py-1 justify-center focus:ring-1 focus:ring-inset focus:ring-primary/40 hover:bg-muted/20 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-40 [&>svg]:shrink-0"
          >
            <SelectValue placeholder="—">
              {local.code ? (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                  LINE_CODES.find(c => c.value === local.code)?.bg,
                  LINE_CODES.find(c => c.value === local.code)?.text
                )}>
                  {local.code}
                </span>
              ) : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CODE} className="text-xs">—</SelectItem>
            {LINE_CODES.map(c => (
              <SelectItem key={c.value} value={c.value} className="text-xs">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1.5", c.bg, c.text)}>
                  {c.value}
                </span>
                <span className="text-muted-foreground">{c.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {showRetention && (
        <td className="p-0 text-center">
          <input
            type="checkbox"
            checked={local.retention_applied}
            onChange={toggleRetention}
            title="Apply retention to this line"
            className="h-3.5 w-3.5 accent-amber-500 cursor-pointer"
          />
        </td>
      )}

      <td className="p-0 text-center">
        {confirmDelete ? (
          <div className="flex items-center justify-center gap-1 px-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center justify-center text-[10px] font-medium text-destructive hover:text-destructive/70 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
            </button>
            <span className="text-muted-foreground/30 text-[10px]">·</span>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              No
            </button>
          </div>
        ) : saving ? (
          <div className="flex items-center justify-center">
            <Loader2 className="h-3 w-3 animate-spin text-primary/60" />
          </div>
        ) : saved ? (
          <div className="flex items-center justify-center">
            <Check className="h-3 w-3 text-primary" />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-0.5">
            <button
              onClick={toggleIncluded}
              title={local.included_in_totals ? "Exclude from totals" : "Include in totals"}
              className={cn(
                "p-1 rounded transition-colors",
                local.included_in_totals
                  ? "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  : "text-amber-500 hover:text-amber-600"
              )}
            >
              {local.included_in_totals ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── InvoiceSubGroup ────────────────────────────────────────────────────────────

function InvoiceSubGroup({
  invoiceNumber,
  groupId,
  items,
  projectId,
  type,
  supplierColorMap,
  onUpdateLine,
  onDeleteLine,
  onLineAdded,
  onLinesAdded,
}: {
  invoiceNumber: string;
  groupId: string;
  items: ActualLineItem[];
  projectId: string;
  type: "income" | "expense";
  supplierColorMap: Map<string, string>;
  onUpdateLine: (id: string, patch: Partial<ActualLineItem>) => void;
  onDeleteLine: (id: string) => void;
  onLineAdded: (item: ActualLineItem) => void;
  onLinesAdded: (items: ActualLineItem[]) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [addingLine, setAddingLine] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(false);
  const [localInvoiceNumber, setLocalInvoiceNumber] = useState(invoiceNumber);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const [editingSupplier, setEditingSupplier] = useState(false);
  const [localSupplier, setLocalSupplier] = useState(items[0]?.supplier ?? "");
  const [savingSupplier, setSavingSupplier] = useState(false);
  const supplierInputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `invoice-${groupId}-${invoiceNumber}`,
    data: { invoiceNumber, sourceGroupId: groupId },
  });

  const total = sumIncluded(items);
  const first = items[0];
  const colSpan = type === "income" ? 11 : 10;
  const allIncluded = items.every(i => i.included_in_totals);

  function fmtDate(iso: string | null) {
    if (!iso) return null;
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y.slice(2)}`;
  }

  async function saveInvoiceNumber() {
    const trimmed = localInvoiceNumber.trim() || invoiceNumber;
    setLocalInvoiceNumber(trimmed);
    setEditingInvoice(false);
    if (trimmed === invoiceNumber) return;
    setSavingInvoice(true);
    try {
      await Promise.all(items.map(item => updateLineItem(item.id, projectId, { invoice_number: trimmed })));
      items.forEach(item => onUpdateLine(item.id, { invoice_number: trimmed }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update invoice number.");
      setLocalInvoiceNumber(invoiceNumber);
    } finally {
      setSavingInvoice(false);
    }
  }

  async function saveSupplierName() {
    const trimmed = localSupplier.trim();
    const prevSupplier = items[0]?.supplier ?? "";
    const nextValue = trimmed === "" ? null : trimmed;
    setLocalSupplier(trimmed);
    setEditingSupplier(false);
    if (trimmed === prevSupplier) return;
    setSavingSupplier(true);
    try {
      await Promise.all(items.map(item => updateLineItem(item.id, projectId, { supplier: nextValue })));
      items.forEach(item => onUpdateLine(item.id, { supplier: nextValue }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update supplier.");
      setLocalSupplier(prevSupplier);
    } finally {
      setSavingSupplier(false);
    }
  }

  async function handleDeleteInvoice() {
    setDeleting(true);
    try {
      await Promise.all(items.map(item => deleteLineItem(item.id, projectId)));
      items.forEach(item => onDeleteLine(item.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice lines.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleAddLine() {
    setAddingLine(true);
    try {
      // Create blank line then immediately stamp it with this invoice's metadata
      const item = await createLineItem(groupId, projectId);
      const patch = {
        invoice_number: invoiceNumber,
        supplier: first.supplier ?? null,
        invoice_date: first.invoice_date ?? null,
      };
      await updateLineItem(item.id, projectId, patch);
      onLineAdded({ ...item, ...patch });
      if (collapsed) setCollapsed(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add line.");
    } finally {
      setAddingLine(false);
    }
  }

  async function toggleInvoiceIncluded() {
    const next = !allIncluded;
    items.forEach(item => onUpdateLine(item.id, { included_in_totals: next }));
    try {
      await Promise.all(items.map(item => updateLineItem(item.id, projectId, { included_in_totals: next })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update.");
      items.forEach(item => onUpdateLine(item.id, { included_in_totals: !next }));
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const copyNumber = invoiceNumber.replace(/ \(copy ?(\d*)\)$/, "");
      const newInvoiceNumber = `${copyNumber} (copy)`;
      const newItems = await duplicateLines(
        groupId,
        projectId,
        items.map(i => ({ ...i, invoice_number: newInvoiceNumber }))
      );
      onLinesAdded(newItems as ActualLineItem[]);
      toast.success(`Duplicated as ${newInvoiceNumber}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate invoice.");
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <>
      <tr
        ref={setDragRef}
        className={cn(
          "group/inv border-t border-black/[0.05] dark:border-white/[0.05] bg-muted/[0.04]",
          !allIncluded && "opacity-60"
        )}
        style={{ opacity: isDragging ? 0.4 : undefined }}
      >
        <td colSpan={colSpan} className="pl-3 pr-2 py-1">
          <div className="flex items-center gap-2">
            <button
              {...listeners}
              {...attributes}
              className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/60 transition-colors touch-none"
              tabIndex={-1}
            >
              <GripVertical className="h-3 w-3" />
            </button>
            {type !== "income" && (
              <button
                onClick={() => setCollapsed(c => !c)}
                className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                {collapsed
                  ? <ChevronRight className="h-2.5 w-2.5" />
                  : <ChevronDown className="h-2.5 w-2.5" />}
              </button>
            )}
            {editingInvoice ? (
              <input
                ref={invoiceInputRef}
                value={localInvoiceNumber}
                onChange={e => setLocalInvoiceNumber(e.target.value)}
                onBlur={saveInvoiceNumber}
                onKeyDown={e => {
                  if (e.key === "Enter") invoiceInputRef.current?.blur();
                  if (e.key === "Escape") { setLocalInvoiceNumber(invoiceNumber); setEditingInvoice(false); }
                }}
                autoFocus
                className="bg-transparent border-0 outline-none px-1 rounded text-[10px] font-mono font-semibold text-foreground/60 uppercase tracking-wide focus:ring-1 focus:ring-inset focus:ring-primary/40 w-32"
              />
            ) : (
              <button
                onClick={() => setEditingInvoice(true)}
                disabled={savingInvoice}
                className="text-[10px] font-mono font-semibold text-foreground/80 uppercase tracking-wide hover:text-foreground transition-colors disabled:opacity-50"
              >
                {localInvoiceNumber}{savingInvoice ? " …" : ""}
              </button>
            )}
            {editingSupplier ? (
              <input
                ref={supplierInputRef}
                value={localSupplier}
                onChange={e => setLocalSupplier(e.target.value)}
                onBlur={saveSupplierName}
                onKeyDown={e => {
                  if (e.key === "Enter") supplierInputRef.current?.blur();
                  if (e.key === "Escape") { setLocalSupplier(first.supplier ?? ""); setEditingSupplier(false); }
                }}
                placeholder="Supplier…"
                autoFocus
                className="bg-transparent border-0 outline-none px-1.5 py-0.5 rounded text-[10px] font-medium text-foreground/80 focus:ring-1 focus:ring-inset focus:ring-primary/40 w-32"
              />
            ) : localSupplier ? (
              <button
                onClick={() => setEditingSupplier(true)}
                disabled={savingSupplier}
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded truncate max-w-[160px] hover:opacity-80 transition-opacity disabled:opacity-50",
                  supplierBadgeClass(supplierColorMap, localSupplier)
                )}
              >
                {localSupplier}{savingSupplier ? " …" : ""}
              </button>
            ) : (
              <button
                onClick={() => setEditingSupplier(true)}
                className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors px-1.5 py-0.5"
              >
                + Supplier
              </button>
            )}
            {fmtDate(first.invoice_date) && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums bg-muted/40 text-muted-foreground">
                {fmtDate(first.invoice_date)}
              </span>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground/60 shrink-0">
              {items.length} {items.length === 1 ? "line" : "lines"}
            </span>
            <span className="text-[10px] tabular-nums font-medium text-foreground/80 shrink-0 min-w-[72px] text-right">
              {fmt(total)}
            </span>
            {!confirmDelete && (
              <button
                onClick={toggleInvoiceIncluded}
                title={allIncluded ? "Exclude invoice from totals" : "Include invoice in totals"}
                className={cn(
                  "p-0.5 rounded transition-colors shrink-0",
                  allIncluded
                    ? "opacity-0 group-hover/inv:opacity-100 text-muted-foreground hover:text-foreground"
                    : "text-amber-500 hover:text-amber-600"
                )}
              >
                {allIncluded ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
            )}
            {!confirmDelete && (
              <button
                onClick={handleDuplicate}
                disabled={duplicating}
                title="Duplicate invoice"
                className="opacity-0 group-hover/inv:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-40 shrink-0"
              >
                <Copy className="h-3 w-3" />
              </button>
            )}
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-muted-foreground/60">Delete all?</span>
                <button
                  onClick={handleDeleteInvoice}
                  disabled={deleting}
                  className="text-[10px] font-medium text-destructive hover:text-destructive/70 transition-colors disabled:opacity-50"
                >
                  {deleting ? "…" : "Yes"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="opacity-0 group-hover/inv:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {(type === "income" || !collapsed) && items.map((item, i) => (
        <LineItemRow
          key={item.id}
          item={item}
          index={i}
          projectId={projectId}
          showRetention={type === "income"}
          onUpdate={onUpdateLine}
          onDelete={onDeleteLine}
        />
      ))}

      {(type === "income" || !collapsed) && (
        <tr className="border-t border-black/[0.03] dark:border-white/[0.03]">
          <td colSpan={colSpan} className="pl-8 pr-2 py-1">
            <button
              onClick={handleAddLine}
              disabled={addingLine}
              className="flex items-center gap-1.5 text-[10px] text-primary/70 hover:text-primary transition-colors disabled:opacity-40"
            >
              <Plus className="h-2.5 w-2.5" />
              {addingLine ? "Adding…" : "Add line"}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

// ── GroupRow ───────────────────────────────────────────────────────────────────

function GroupRow({
  group,
  lineItems,
  projectId,
  type,
  supplierColorMap,
  onUpdateGroup,
  onDeleteGroup,
  onAddLine,
  onUpdateLine,
  onDeleteLine,
  onLineAdded,
  onLinesAdded,
}: {
  group: ActualGroup;
  lineItems: ActualLineItem[];
  projectId: string;
  type: "income" | "expense";
  supplierColorMap: Map<string, string>;
  onUpdateGroup: (id: string, patch: Partial<ActualGroup>) => void;
  onDeleteGroup: (id: string) => void;
  onAddLine: (groupId: string) => Promise<void>;
  onUpdateLine: (id: string, patch: Partial<ActualLineItem>) => void;
  onDeleteLine: (id: string) => void;
  onLineAdded: (item: ActualLineItem) => void;
  onLinesAdded: (items: ActualLineItem[]) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [localName, setLocalName] = useState(group.name);
  const [addingLine, setAddingLine] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `group-droppable-${group.id}` });

  const groupTotal = sumIncluded(lineItems);
  const colSpan = type === "income" ? 11 : 10;

  // Bucket by invoice_number; items without one render flat below invoice sub-groups
  const invoiceBuckets = new Map<string, ActualLineItem[]>();
  const ungroupedItems: ActualLineItem[] = [];
  for (const item of lineItems) {
    if (item.invoice_number) {
      if (!invoiceBuckets.has(item.invoice_number)) invoiceBuckets.set(item.invoice_number, []);
      invoiceBuckets.get(item.invoice_number)!.push(item);
    } else {
      ungroupedItems.push(item);
    }
  }
  const orderedBuckets = Array.from(invoiceBuckets.entries()).sort(
    ([, a], [, b]) => compareInvoiceBuckets(a, b)
  );

  async function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      await updateGroup(group.id, projectId, { is_collapsed: next });
      onUpdateGroup(group.id, { is_collapsed: next });
    } catch {
      setCollapsed(!next);
    }
  }

  async function saveName() {
    const trimmed = localName.trim() || "New group";
    setLocalName(trimmed);
    setEditingName(false);
    if (trimmed === group.name) return;
    try {
      await updateGroup(group.id, projectId, { name: trimmed });
      onUpdateGroup(group.id, { name: trimmed });
    } catch {
      setLocalName(group.name);
      toast.error("Failed to rename group.");
    }
  }

  async function handleAddLine() {
    setAddingLine(true);
    try {
      await onAddLine(group.id);
      if (collapsed) {
        setCollapsed(false);
        await updateGroup(group.id, projectId, { is_collapsed: false });
        onUpdateGroup(group.id, { is_collapsed: false });
      }
    } finally {
      setAddingLine(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteGroup(group.id, projectId);
      onDeleteGroup(group.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete group.");
    }
  }

  return (
    <>
      {/* Group header — also the drop target */}
      <tr
        ref={setDropRef}
        className={cn(
          "border-t border-b transition-colors",
          isOver
            ? "bg-primary/10 border-primary/30"
            : "bg-muted/20 border-black/10 dark:border-white/10"
        )}
      >
        <td colSpan={colSpan} className="px-2 py-1.5">
          <div className="flex items-center gap-2">
            {type !== "income" && (
              <button
                onClick={toggleCollapse}
                className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                {collapsed
                  ? <ChevronRight className="h-3 w-3" />
                  : <ChevronDown className="h-3 w-3" />}
              </button>
            )}

            {editingName ? (
              <input
                ref={nameRef}
                value={localName}
                onChange={e => setLocalName(e.target.value)}
                onBlur={saveName}
                onKeyDown={e => {
                  if (e.key === "Enter") nameRef.current?.blur();
                  if (e.key === "Escape") { setLocalName(group.name); setEditingName(false); }
                }}
                autoFocus
                className="flex-1 min-w-0 bg-transparent border-0 outline-none px-1 rounded text-[11px] font-medium text-foreground/70 focus:ring-1 focus:ring-inset focus:ring-primary/40"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="flex-1 min-w-0 text-left text-[11px] font-medium text-foreground/85 hover:text-foreground truncate transition-colors"
              >
                {localName}
              </button>
            )}

            <span className="shrink-0 text-[10px] text-muted-foreground/60">
              {lineItems.length} {lineItems.length === 1 ? "line" : "lines"}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums font-medium text-foreground/85">
              {fmt(groupTotal)}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 text-xs">
                <DropdownMenuItem onClick={handleAddLine} disabled={addingLine} className="text-xs cursor-pointer">
                  <Plus className="h-3 w-3 mr-1.5" />
                  Add line
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditingName(true)} className="text-xs cursor-pointer">
                  Rename group
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-xs text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="h-3 w-3 mr-1.5" />
                  Delete group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>

      {/* Invoice sub-groups */}
      {(type === "income" || !collapsed) && orderedBuckets.map(([invNum, items]) => (
        <InvoiceSubGroup
          key={invNum}
          invoiceNumber={invNum}
          groupId={group.id}
          items={items}
          projectId={projectId}
          type={type}
          supplierColorMap={supplierColorMap}
          onUpdateLine={onUpdateLine}
          onDeleteLine={onDeleteLine}
          onLineAdded={onLineAdded}
          onLinesAdded={onLinesAdded}
        />
      ))}

      {/* Ungrouped lines (no invoice number) */}
      {(type === "income" || !collapsed) && ungroupedItems.map((item, i) => (
        <LineItemRow
          key={item.id}
          item={item}
          index={i}
          projectId={projectId}
          showRetention={type === "income"}
          onUpdate={onUpdateLine}
          onDelete={onDeleteLine}
        />
      ))}

      {/* Add-line shortcut when group is expanded and empty */}
      {(type === "income" || !collapsed) && lineItems.length === 0 && (
        <tr>
          <td colSpan={colSpan} className="px-4 py-2">
            <button
              onClick={handleAddLine}
              disabled={addingLine}
              className="flex items-center gap-1.5 text-[11px] text-primary/70 hover:text-primary transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add line
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

// ── AdminFeeBlock ──────────────────────────────────────────────────────────────

function AdminFeeBlock({
  projectId,
  initialPct,
  initialEstimatedCost,
  totalExpenses,
  onAdminFeeChange,
}: {
  projectId: string;
  initialPct: number | null;
  initialEstimatedCost: number | null;
  totalExpenses: number;
  onAdminFeeChange?: (pct: number | null, estimatedCost: number | null) => void;
}) {
  const [rawPct, setRawPct] = useState(initialPct !== null ? String(initialPct) : "");
  const [rawEstimate, setRawEstimate] = useState(initialEstimatedCost !== null ? String(initialEstimatedCost) : "");
  const [savingPct, setSavingPct] = useState(false);
  const [savingEstimate, setSavingEstimate] = useState(false);

  const parsedPct = parseFloat(rawPct);
  const parsedEstimate = parseFloat(rawEstimate);
  const hasEstimate = rawEstimate.trim() !== "" && !isNaN(parsedEstimate) && parsedEstimate >= 0;
  const base = hasEstimate ? parsedEstimate : totalExpenses;
  const isValidPct = !isNaN(parsedPct) && parsedPct > 0;
  const feeAmount = isValidPct ? Math.round(base * (parsedPct / 100) * 100) / 100 : null;

  async function savePct() {
    const val = rawPct.trim() === "" ? null : parseFloat(rawPct);
    const resolved = val === null || isNaN(val) ? null : val;
    const estimate = rawEstimate.trim() === "" ? null : parseFloat(rawEstimate);
    const resolvedEstimate = estimate === null || isNaN(estimate) ? null : estimate;
    setSavingPct(true);
    try {
      await updateProjectAdminFee(projectId, resolved);
      onAdminFeeChange?.(resolved, resolvedEstimate);
    } catch {
      toast.error("Failed to save admin fee.");
      setRawPct(initialPct !== null ? String(initialPct) : "");
    } finally {
      setSavingPct(false);
    }
  }

  async function saveEstimate() {
    const val = rawEstimate.trim() === "" ? null : parseFloat(rawEstimate);
    const resolved = val === null || isNaN(val) ? null : val;
    const pct = rawPct.trim() === "" ? null : parseFloat(rawPct);
    const resolvedPct = pct === null || isNaN(pct) ? null : pct;
    setSavingEstimate(true);
    try {
      await updateAdminFeeEstimate(projectId, resolved);
      onAdminFeeChange?.(resolvedPct, resolved);
    } catch {
      toast.error("Failed to save estimated cost.");
      setRawEstimate(initialEstimatedCost !== null ? String(initialEstimatedCost) : "");
    } finally {
      setSavingEstimate(false);
    }
  }

  const inputCls = "h-6 px-2 text-[11px] text-right tabular-nums bg-input border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/40";

  return (
    <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/30 border-b border-black/10 dark:border-white/10">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Admin &amp; Other Fee
        </span>
        {feeAmount !== null && (
          <span className="ml-auto text-[10px] text-muted-foreground/50 tabular-nums">
            {parsedPct}% × {fmt(base)}{hasEstimate ? " (estimated)" : " (actual)"} = {fmt(feeAmount)}
          </span>
        )}
      </div>

      <table className="w-full table-fixed">
        <colgroup>
          <col />
          <col style={{ width: "150px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "100px" }} />
        </colgroup>
        <thead>
          <tr className="border-b border-black/5 dark:border-white/5">
            <th className="px-2 py-1 text-left text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide" />
            <th className="px-2 py-1 text-right text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">
              Estimated Cost
            </th>
            <th className="px-2 py-1 text-right text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">
              Rate
            </th>
            <th className="px-2 py-1 text-right text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-muted/10 transition-colors">
            <td className="px-2 py-1.5 text-[11px] text-foreground/50 italic">
              Administrative overhead and miscellaneous costs
              {!hasEstimate && (
                <span className="ml-1.5 text-[10px] not-italic text-muted-foreground/40">
                  · using actual {fmt(totalExpenses)}
                </span>
              )}
            </td>
            <td className="px-2 py-1.5 text-right">
              <div className="flex items-center justify-end gap-1">
                <span className="text-[11px] text-muted-foreground">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rawEstimate}
                  onChange={e => setRawEstimate(e.target.value)}
                  onBlur={saveEstimate}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  placeholder="—"
                  className={cn(inputCls, "w-24")}
                />
                {savingEstimate && <span className="text-[10px] text-muted-foreground/40">…</span>}
              </div>
            </td>
            <td className="px-2 py-1.5 text-right">
              <div className="flex items-center justify-end gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={rawPct}
                  onChange={e => setRawPct(e.target.value)}
                  onBlur={savePct}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  placeholder="0"
                  className={cn(inputCls, "w-14")}
                />
                <span className="text-[11px] text-muted-foreground">%</span>
                {savingPct && <span className="text-[10px] text-muted-foreground/40">…</span>}
              </div>
            </td>
            <td className={cn(
              "px-2 py-1.5 text-right text-[11px] tabular-nums",
              feeAmount !== null ? "font-medium text-foreground/85" : "text-muted-foreground/40",
            )}>
              {feeAmount !== null ? fmt(feeAmount) : "—"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── ActualsSection ─────────────────────────────────────────────────────────────

export const ActualsSection = memo(function ActualsSection({
  type,
  projectId,
  orgId,
  initialGroups,
  initialLineItems,
  retentionPct,
  adminFeePct,
  adminFeeEstimatedCost,
  onTotalsChange,
  onAdminFeeChange,
  onRetentionBaseChange,
  onFreightTotalChange,
}: {
  type: "income" | "expense";
  projectId: string;
  orgId: string;
  initialGroups: ActualGroup[];
  initialLineItems: ActualLineItem[];
  retentionPct: number | null;
  adminFeePct?: number | null;
  adminFeeEstimatedCost?: number | null;
  onTotalsChange?: (total: number) => void;
  onAdminFeeChange?: (pct: number | null, estimatedCost: number | null) => void;
  onRetentionBaseChange?: (base: number) => void;
  onFreightTotalChange?: (total: number) => void;
}) {
  const [groups, setGroups] = useState<ActualGroup[]>(initialGroups);
  const [lineItems, setLineItems] = useState<ActualLineItem[]>(
    initialLineItems.filter(i => initialGroups.some(g => g.id === i.group_id))
  );
  const [addingGroup, setAddingGroup] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draggingInvoice, setDraggingInvoice] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeFilterCount = countActiveFilters(filters);
  const isFiltering = activeFilterCount > 0;
  const filteredLineItems = isFiltering ? lineItems.filter(i => matchesFilters(i, filters)) : lineItems;

  const sectionTotal = sumIncluded(lineItems);
  const filteredTotal = isFiltering ? sumIncluded(filteredLineItems) : sectionTotal;
  const retentionBase = sumIncluded(lineItems.filter(i => i.retention_applied));
  const retentionHeld = retentionPct && retentionPct > 0 ? retentionBase * (retentionPct / 100) : 0;
  const freightTotal = sumIncluded(lineItems.filter(i => i.code === "FR"));
  const supplierColorMap = useMemo(() => buildSupplierColorMap(lineItems), [lineItems]);
  const label = type === "income" ? "INCOME" : "EXPENSES";
  const colSpan = type === "income" ? 11 : 10;

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    onTotalsChange?.(sectionTotal);
    onRetentionBaseChange?.(retentionBase);
    onFreightTotalChange?.(freightTotal);
  }, [sectionTotal, retentionBase, freightTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Group handlers ────────────────────────────────────────────────────────

  async function handleAddGroup() {
    setAddingGroup(true);
    try {
      const name = type === "income" ? "New income group" : "New expense group";
      const g = await createGroup(projectId, orgId, type, name);
      setGroups(prev => [...prev, g]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group.");
    } finally {
      setAddingGroup(false);
    }
  }

  function handleUpdateGroup(id: string, patch: Partial<ActualGroup>) {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  }

  function handleDeleteGroup(id: string) {
    setGroups(prev => prev.filter(g => g.id !== id));
    setLineItems(prev => prev.filter(i => i.group_id !== id));
  }

  // ── Line item handlers ────────────────────────────────────────────────────

  async function handleAddLine(groupId: string) {
    const item = await createLineItem(groupId, projectId);
    setLineItems(prev => [...prev, item]);
  }

  function handleUpdateLine(id: string, patch: Partial<ActualLineItem>) {
    setLineItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }

  function handleDeleteLine(id: string) {
    setLineItems(prev => prev.filter(i => i.id !== id));
  }

  function handleLineAdded(item: ActualLineItem) {
    setLineItems(prev => [...prev, item]);
  }

  function handleLinesAdded(items: ActualLineItem[]) {
    setLineItems(prev => [...prev, ...items]);
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingInvoice(event.active.data.current?.invoiceNumber ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingInvoice(null);
    const { active, over } = event;
    if (!over) return;

    const sourceGroupId: string = active.data.current?.sourceGroupId;
    const invoiceNum: string = active.data.current?.invoiceNumber;
    const targetGroupId = String(over.id).replace("group-droppable-", "");

    if (!sourceGroupId || !invoiceNum || targetGroupId === sourceGroupId) return;

    const affected = lineItems.filter(
      i => i.group_id === sourceGroupId && i.invoice_number === invoiceNum
    );
    if (affected.length === 0) return;

    // Optimistic update
    setLineItems(prev =>
      prev.map(i =>
        i.group_id === sourceGroupId && i.invoice_number === invoiceNum
          ? { ...i, group_id: targetGroupId }
          : i
      )
    );

    try {
      await Promise.all(
        affected.map(item => updateLineItem(item.id, projectId, { group_id: targetGroupId }))
      );
    } catch (err) {
      // Revert on failure
      setLineItems(prev =>
        prev.map(i =>
          i.group_id === targetGroupId && i.invoice_number === invoiceNum
            ? { ...i, group_id: sourceGroupId }
            : i
        )
      );
      toast.error(err instanceof Error ? err.message : "Failed to move invoice.");
    }
  }

  function handleImportLines(imported: ActualLineItem[]) {
    setLineItems(prev => [...prev, ...imported]);
  }

  function handleGroupCreated(group: ActualGroup) {
    setGroups(prev => [...prev, group]);
  }

  const lineCount = lineItems.length;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={cn(
          "text-[11px] font-semibold uppercase tracking-wider",
          type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
        )}>
          {label}
        </span>

        {lineCount > 0 && (
          <span className="text-[11px] tabular-nums text-foreground/70">
            {isFiltering ? fmt(filteredTotal) : fmt(sectionTotal)} ex-GST
            {isFiltering && (
              <>
                <span className="text-muted-foreground/40 mx-1.5">·</span>
                <span className="text-muted-foreground/60">
                  {filteredLineItems.length} of {lineCount} lines
                </span>
              </>
            )}
            {!isFiltering && retentionHeld > 0 && (
              <>
                <span className="text-muted-foreground/40 mx-1.5">·</span>
                <span className="text-amber-500 dark:text-amber-400">
                  {fmt(retentionHeld)} held ({retentionPct}%)
                </span>
                <span className="text-muted-foreground/40 mx-1.5">·</span>
                <span className="text-muted-foreground">
                  {fmt(sectionTotal - retentionHeld)} net
                </span>
              </>
            )}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] transition-colors",
              filtersOpen || activeFilterCount > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
          >
            <Zap className="h-3 w-3" />
            Upload Invoice
          </button>
          <button
            onClick={handleAddGroup}
            disabled={addingGroup}
            className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {addingGroup ? "Adding…" : "Add Group"}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {filtersOpen && (
        <div className="space-y-1.5">
          <FilterBar filters={filters} onChange={setFilters} />
          {isFiltering && (
            <div className="flex justify-end">
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-2.5 w-2.5" />
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {groups.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 py-10">
          <Receipt className="h-8 w-8 text-muted-foreground/20" />
          <div className="text-center space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              No {type === "income" ? "income" : "expenses"} recorded yet
            </p>
            <p className="text-[10px] text-muted-foreground/50">
              Add a group to start entering invoice lines.
            </p>
          </div>
          <button
            onClick={handleAddGroup}
            disabled={addingGroup}
            className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {addingGroup ? "Adding…" : "Add Group"}
          </button>
        </div>
      ) : (
        <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-6" />
              <col className="w-[100px]" />
              <col className="w-[100px]" />
              <col className="w-[120px]" />
              <col /> {/* description — absorbs remaining */}
              <col className="w-[88px]" />
              <col className="w-[88px]" />
              <col className="w-[100px]" />
              <col className="w-[56px]" />
              {type === "income" && <col className="w-[64px]" />}
              <col className="w-[72px]" />
            </colgroup>
            <thead>
              <tr className="bg-muted/40 border-b border-black/10 dark:border-white/10">
                <th className="py-1.5 text-[10px] font-medium text-muted-foreground text-center">#</th>
                <th className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left uppercase tracking-wide">Date</th>
                <th className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left uppercase tracking-wide">Invoice #</th>
                <th className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left uppercase tracking-wide">
                  {type === "income" ? "Builder/Customer" : "Supplier"}
                </th>
                <th className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left uppercase tracking-wide">Description</th>
                <th className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-right uppercase tracking-wide">Qty</th>
                <th className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-right uppercase tracking-wide">Unit Price</th>
                <th className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-right uppercase tracking-wide">Subtotal</th>
                <th className="px-1 py-1.5 text-[10px] font-medium text-muted-foreground text-center uppercase tracking-wide">Code</th>
                {type === "income" && (
                  <th className="px-1 py-1.5 text-[10px] font-medium text-muted-foreground text-center uppercase tracking-wide">Retention</th>
                )}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {groups.map(group => {
                const items = filteredLineItems
                  .filter(i => i.group_id === group.id)
                  .sort((a, b) => a.sort_order - b.sort_order);
                if (isFiltering && items.length === 0) return null;
                return (
                  <GroupRow
                    key={group.id}
                    group={group}
                    lineItems={items}
                    projectId={projectId}
                    type={type}
                    supplierColorMap={supplierColorMap}
                    onUpdateGroup={handleUpdateGroup}
                    onDeleteGroup={handleDeleteGroup}
                    onAddLine={handleAddLine}
                    onUpdateLine={handleUpdateLine}
                    onDeleteLine={handleDeleteLine}
                    onLineAdded={handleLineAdded}
                    onLinesAdded={handleLinesAdded}
                  />
                );
              })}
              {isFiltering && filteredLineItems.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-6 text-center text-[11px] text-muted-foreground/60">
                    No lines match the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-black/10 dark:border-white/10 bg-card/65 backdrop-blur-xl">
            <span className="text-[10px] text-muted-foreground">
              Total {type === "income" ? "income" : "expenses"} (ex-GST)
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {fmt(sectionTotal)}
            </span>
            {isFiltering ? (
              <span className="text-[11px] text-muted-foreground/60">
                {filteredLineItems.length} of {lineCount} lines · filtered {fmt(filteredTotal)}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground/60">
                {lineCount} {lineCount === 1 ? "line item" : "line items"}
              </span>
            )}
          </div>
        </div>
      )}

      {type === "expense" && (
        <AdminFeeBlock
          projectId={projectId}
          initialPct={adminFeePct ?? null}
          initialEstimatedCost={adminFeeEstimatedCost ?? null}
          totalExpenses={sectionTotal}
          onAdminFeeChange={onAdminFeeChange}
        />
      )}

      {dialogOpen && (
        <ExtractionDialog
          type={type}
          projectId={projectId}
          orgId={orgId}
          groups={groups}
          onImport={handleImportLines}
          onGroupCreated={handleGroupCreated}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>

    <DragOverlay dropAnimation={null}>
      {draggingInvoice && (
        <div className="flex items-center gap-2 rounded border border-primary/40 bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur text-[10px] font-mono font-semibold text-foreground/70 uppercase tracking-wide">
          <GripVertical className="h-3 w-3 text-muted-foreground/50" />
          {draggingInvoice}
        </div>
      )}
    </DragOverlay>
    </DndContext>
  );
});
