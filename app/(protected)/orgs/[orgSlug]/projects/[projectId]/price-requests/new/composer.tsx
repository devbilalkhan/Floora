"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical, X, Mail, Send, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/app/(protected)/orgs/[orgSlug]/projects/[projectId]/takeoff/constants";
import type { TakeoffRow } from "@/app/(protected)/orgs/[orgSlug]/projects/[projectId]/takeoff/takeoff-table";
import { sendPriceRequest } from "../actions";
import { renderEmailBody, DEFAULT_TEMPLATE, TEMPLATE_PLACEHOLDERS, type ProductSnapshot } from "@/lib/email-template";

// ── Code Summary computation ───────────────────────────────────────────────────

function buildCodeSummary(rows: TakeoffRow[]): ProductSnapshot[] {
  const map: Record<string, ProductSnapshot> = {};
  for (const r of rows) {
    if (!r.finish_code) continue;
    const k = r.finish_code;
    if (!map[k]) {
      map[k] = {
        finish_code: k,
        description: r.description,
        manufacturer: r.manufacturer,
        colour: r.colour,
        scope_category: r.scope_category,
        supply: {},
      };
    }
    if (r.qty > 0) {
      const pct = r.waste_pct ?? 10;
      map[k].supply[r.unit] = (map[k].supply[r.unit] ?? 0) + r.qty * (1 + pct / 100);
    }
  }
  return Object.values(map).sort((a, b) => a.finish_code.localeCompare(b.finish_code));
}

function formatSupply(supply: Record<string, number>) {
  return Object.entries(supply)
    .filter(([, qty]) => qty > 0)
    .map(([unit, qty]) => `${Math.ceil(qty).toLocaleString()} ${unit === "m2" ? "m²" : unit}`)
    .join(" · ");
}

// ── Draggable product card (left panel) ───────────────────────────────────────

function DraggableCard({
  product,
  added,
  onAdd,
}: {
  product: ProductSnapshot;
  added: boolean;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: product.finish_code,
    data: { product },
    disabled: added,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 border border-border rounded-sm bg-card/65 text-xs group",
        added ? "opacity-40 cursor-not-allowed" : "cursor-grab hover:border-primary/40 hover:bg-muted/20 transition-colors",
        isDragging && "opacity-30"
      )}
    >
      <span
        {...listeners}
        {...attributes}
        className={cn("text-muted-foreground/40 shrink-0", !added && "cursor-grab group-hover:text-muted-foreground/70")}
      >
        <GripVertical className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-primary text-[11px]">{product.finish_code}</span>
          <span className="text-muted-foreground/60 truncate">{product.description ?? "—"}</span>
        </div>
        {product.manufacturer && (
          <p className="text-[10px] text-muted-foreground/50 truncate">
            {product.manufacturer}{product.colour ? ` · ${product.colour}` : ""}
          </p>
        )}
      </div>
      <span className="text-[10px] tabular-nums text-primary shrink-0">{formatSupply(product.supply)}</span>
      {!added && (
        <button
          onClick={onAdd}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0 px-1.5 py-0.5 rounded border border-border hover:border-foreground/30"
        >
          Add
        </button>
      )}
    </div>
  );
}

// Compact card shown in DragOverlay while dragging
function OverlayCard({ product }: { product: ProductSnapshot }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border border-primary/40 rounded-sm bg-card shadow-xl text-xs opacity-95">
      <GripVertical className="h-3 w-3 text-muted-foreground/40" />
      <span className="font-mono font-medium text-primary">{product.finish_code}</span>
      <span className="text-muted-foreground/70 truncate">{product.description ?? "—"}</span>
      <span className="text-[10px] tabular-nums text-primary ml-auto">{formatSupply(product.supply)}</span>
    </div>
  );
}

// ── Sortable product card (right panel) ───────────────────────────────────────

function SortableEmailProduct({
  product,
  onRemove,
}: {
  product: ProductSnapshot;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.finish_code,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 border border-border rounded-sm bg-card/40 text-xs group"
    >
      <span
        {...listeners}
        {...attributes}
        className="cursor-grab text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0"
      >
        <GripVertical className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-primary text-[11px]">{product.finish_code}</span>
          <span className="text-muted-foreground/70 truncate">{product.description ?? "—"}</span>
        </div>
        {(product.manufacturer || product.colour) && (
          <p className="text-[10px] text-muted-foreground/50 truncate">
            {product.manufacturer}{product.colour ? ` · ${product.colour}` : ""}
          </p>
        )}
      </div>
      <span className="text-[10px] tabular-nums text-primary shrink-0">{formatSupply(product.supply)}</span>
      <button
        onClick={onRemove}
        className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100"
        title="Remove"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "email-products" });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[120px] rounded-sm border transition-colors",
        isOver
          ? "border-primary bg-primary/5"
          : isEmpty
          ? "border-dashed border-border bg-muted/10"
          : "border-border bg-transparent"
      )}
    >
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-28 gap-2 text-center">
          <Mail className="h-5 w-5 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground/50">
            Drag products here or use <span className="font-medium">Add</span>
          </p>
        </div>
      ) : (
        <div className="p-2 space-y-1.5">{children}</div>
      )}
    </div>
  );
}

// ── Main Composer ─────────────────────────────────────────────────────────────

export function Composer({
  orgSlug,
  projectId,
  projectName,
  projectAddress,
  projectSpecifier,
  takeoffs,
  allRows,
  hasGmail,
  template,
  signature,
  senderEmail,
}: {
  orgSlug: string;
  projectId: string;
  projectName: string;
  projectAddress: string;
  projectSpecifier: string;
  takeoffs: { id: string; name: string }[];
  allRows: TakeoffRow[];
  hasGmail: boolean;
  template: string;
  signature: string;
  senderEmail: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTakeoffId, setActiveTakeoffId] = useState(takeoffs[0]?.id ?? "");
  const [emailProducts, setEmailProducts] = useState<ProductSnapshot[]>([]);
  const [activeDrag, setActiveDrag] = useState<ProductSnapshot | null>(null);

  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [contactSuggestions, setContactSuggestions] = useState<{ name: string; email: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);

  useEffect(() => {
    if (!hasGmail || supplierEmail.trim().length < 2) {
      setContactSuggestions([]);
      setShowSuggestions(false);
      setContactsLoading(false);
      return;
    }
    setContactsLoading(true);
    setShowSuggestions(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/gmail/contacts?q=${encodeURIComponent(supplierEmail)}`);
        const data = await res.json();
        setContactSuggestions(data.contacts ?? []);
      } catch {
        setContactSuggestions([]);
      } finally {
        setContactsLoading(false);
      }
    }, 150);
    return () => { clearTimeout(t); };
  }, [supplierEmail, hasGmail]);
  const [subject, setSubject] = useState(
    `Price Request - ${projectName} - ${new Date().toLocaleDateString("en-AU")}`
  );
  const [error, setError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Code summary for currently selected takeoff
  const codeSummary = useMemo(() => {
    const rows = allRows.filter((r) => r.takeoff_id === activeTakeoffId);
    return buildCodeSummary(rows);
  }, [allRows, activeTakeoffId]);

  // Grouped by scope category
  const grouped = useMemo(() => {
    return CATEGORIES.map((cat) => ({
      cat,
      products: codeSummary.filter((p) => p.scope_category === cat.key),
    })).filter((g) => g.products.length > 0);
  }, [codeSummary]);

  const addedCodes = useMemo(() => new Set(emailProducts.map((p) => p.finish_code)), [emailProducts]);

  const emailPreview = useMemo(
    () =>
      renderEmailBody(
        template,
        {
          Name: supplierName.trim() || "Supplier",
          "Project name": projectName,
          Address: projectAddress,
          Specifier: projectSpecifier,
          "Sender name": senderEmail,
          Signature: signature,
        },
        emailProducts
      ),
    [template, supplierName, projectName, projectAddress, projectSpecifier, senderEmail, signature, emailProducts]
  );

  function addProduct(product: ProductSnapshot) {
    if (!addedCodes.has(product.finish_code)) {
      setEmailProducts((prev) => [...prev, product]);
    }
  }

  function removeProduct(code: string) {
    setEmailProducts((prev) => prev.filter((p) => p.finish_code !== code));
  }

  function handleDragStart(event: DragStartEvent) {
    const product = event.active.data.current?.product as ProductSnapshot | undefined;
    if (product) setActiveDrag(product);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;

    // Dropped onto the droppable zone from the left panel
    if (over.id === "email-products" && active.data.current?.product) {
      addProduct(active.data.current.product as ProductSnapshot);
      return;
    }

    // Reorder within the email products list
    if (active.id !== over.id) {
      setEmailProducts((prev) => {
        const oldIndex = prev.findIndex((p) => p.finish_code === active.id);
        const newIndex = prev.findIndex((p) => p.finish_code === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  async function handleSend() {
    if (!supplierEmail.trim()) { setError("Supplier email is required."); return; }
    if (emailProducts.length === 0) { setError("Add at least one product."); return; }
    setError("");

    startTransition(async () => {
      try {
        await sendPriceRequest({
          projectId,
          projectName,
          orgSlug,
          takeoffId: activeTakeoffId || null,
          supplierName: supplierName.trim(),
          supplierEmail: supplierEmail.trim(),
          subject: subject.trim(),
          emailBody: emailPreview,
          products: emailProducts,
        });
        toast.success("Price request sent.");
        router.push(`/orgs/${orgSlug}/projects/${projectId}/price-requests`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send email.");
      }
    });
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/80 backdrop-blur-xl shrink-0">
          <Link
            href={`/orgs/${orgSlug}/projects/${projectId}/price-requests`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-1">
            <Link href={`/orgs/${orgSlug}/projects`} className="hover:text-foreground transition-colors">Projects</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/orgs/${orgSlug}/projects/${projectId}`} className="hover:text-foreground transition-colors">{projectName}</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/orgs/${orgSlug}/projects/${projectId}/price-requests`} className="hover:text-foreground transition-colors">Price Requests</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">New</span>
          </nav>
        </div>

        {/* Split panels */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left: Product selector ── */}
          <div className="w-[360px] shrink-0 border-r border-border flex flex-col overflow-hidden bg-card/30">
            {/* Takeoff selector */}
            <div className="px-3 py-2 border-b border-border shrink-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Source takeoff</p>
              {takeoffs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No takeoffs on this project.</p>
              ) : (
                <select
                  value={activeTakeoffId}
                  onChange={(e) => setActiveTakeoffId(e.target.value)}
                  className="w-full text-xs bg-card border border-border rounded-sm px-2 py-1.5 text-foreground/80 outline-none focus:ring-1 focus:ring-primary/40"
                >
                  {takeoffs.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
              {grouped.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No products with finish codes in this takeoff.
                </p>
              ) : (
                grouped.map(({ cat, products }) => (
                  <div key={cat.key} className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                      {cat.label}
                    </p>
                    {products.map((p) => (
                      <DraggableCard
                        key={p.finish_code}
                        product={p}
                        added={addedCodes.has(p.finish_code)}
                        onAdd={() => addProduct(p)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Right: Email composer ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!hasGmail && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
                <Mail className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-600 dark:text-amber-400">Gmail not connected</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Link href="/login" className="underline underline-offset-2 hover:text-foreground">Sign in with Google</Link>
                    {" "}to send emails and auto-capture replies.
                  </p>
                </div>
              </div>
            )}

            {/* Supplier fields */}
            <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recipient</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Supplier name</Label>
                  <Input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Polyflor Australia"
                    className="h-8 text-xs rounded-sm"
                  />
                </div>
                <div className="space-y-1 relative">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Email address *</Label>
                  <Input
                    type="email"
                    value={supplierEmail}
                    onChange={(e) => { setSupplierEmail(e.target.value); }}
                    onFocus={() => supplierEmail.trim().length >= 2 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="supplier@example.com"
                    className="h-8 text-xs rounded-sm"
                    autoComplete="off"
                  />
                  {showSuggestions && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-sm shadow-lg overflow-hidden">
                      {contactsLoading ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Searching contacts…
                        </div>
                      ) : contactSuggestions.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No contacts found</p>
                      ) : (
                        contactSuggestions.map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={() => {
                              setSupplierEmail(c.email);
                              if (!supplierName && c.name) setSupplierName(c.name);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition-colors flex items-center gap-2 min-w-0"
                          >
                            {c.name && <span className="font-medium text-foreground/80 shrink-0">{c.name}</span>}
                            <span className="text-muted-foreground truncate">{c.email}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-8 text-xs rounded-sm"
                />
              </div>
            </div>

            {/* Products drop zone */}
            <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Products · {emailProducts.length}
                </p>
                {emailProducts.length > 0 && (
                  <button
                    onClick={() => setEmailProducts([])}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <DropZone isEmpty={emailProducts.length === 0}>
                <SortableContext
                  items={emailProducts.map((p) => p.finish_code)}
                  strategy={verticalListSortingStrategy}
                >
                  {emailProducts.map((p) => (
                    <SortableEmailProduct
                      key={p.finish_code}
                      product={p}
                      onRemove={() => removeProduct(p.finish_code)}
                    />
                  ))}
                </SortableContext>
              </DropZone>
            </div>

            {/* Email preview */}
            <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Email preview</p>
                <Link
                  href={`/orgs/${orgSlug}/settings`}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Edit template
                </Link>
              </div>
              <pre className="text-xs text-foreground/60 whitespace-pre-wrap font-sans leading-relaxed max-h-72 overflow-y-auto">
                {emailPreview}
              </pre>
            </div>

            {/* Error + Send */}
            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end pb-6">
              <Button
                onClick={handleSend}
                disabled={isPending || !hasGmail}
                className="gap-2"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isPending ? "Sending…" : "Send via Gmail"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDrag ? <OverlayCard product={activeDrag} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
