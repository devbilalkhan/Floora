"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronRight,
  RotateCcw,
  Save,
  CheckSquare2,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TEMPLATE_PLACEHOLDERS, DEFAULT_TEMPLATE } from "@/lib/email-template";
import { Skeleton } from "@/components/ui/skeleton";
import {
  saveEmailSettings,
  saveOrgDetails,
  addOrgWorker,
  updateOrgWorker,
  deleteOrgWorker,
} from "./actions";
import { MembersTab } from "./members-tab";
import type { OrgWorker } from "@/lib/swms-types";

const DEFAULT_SIGNATURE = `Bilal Khan
Business Development Manager
Specialised Preventative Maintenance
Commercial Flooring | Sports Flooring | Wall & Door Protection Systems | Acoustic Panels | HandRails | Corner Guards | Damp Course Injection
M: +61 497 134 012
E: bilal.khan@spmprotect.com
W: DFO Flooring - www.dfoflooring.au
W: SPM - www.dfoflooring.au/spm-specialised-preventative-maintenance`;

type Tab = "general" | "members" | "email" | "team" | "shortcuts";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "members", label: "Members" },
  { id: "email", label: "Email" },
  { id: "team", label: "Team" },
  { id: "shortcuts", label: "Shortcuts" },
];

const inputCls =
  "w-full text-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl px-4 py-2.5 text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50";

const cellInput =
  "w-full text-xs bg-input border border-border rounded px-2 py-1 text-foreground/80 outline-none focus:ring-1 focus:ring-primary/40";

export default function OrgSettingsPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [isPending, startTransition] = useTransition();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // General tab
  const [orgCode, setOrgCode] = useState("");
  const [abn, setAbn] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [orgEmail, setOrgEmail] = useState("");

  // Email tab
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [signature, setSignature] = useState(DEFAULT_SIGNATURE);

  // Team tab
  const [workers, setWorkers] = useState<OrgWorker[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState({ name: "", role: "", phone: "", email: "" });
  const [addingNew, setAddingNew] = useState(false);
  const [newBuf, setNewBuf] = useState({ name: "", role: "", phone: "", email: "" });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });

    supabase
      .from("organizations")
      .select("id, price_request_template, price_request_signature, org_code, abn, address, phone, org_email")
      .eq("slug", params.orgSlug)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setOrgId(data.id);
        setTemplate(data.price_request_template ?? DEFAULT_TEMPLATE);
        setSignature(data.price_request_signature ?? DEFAULT_SIGNATURE);
        setOrgCode(data.org_code ?? "");
        setAbn(data.abn ?? "");
        setAddress(data.address ?? "");
        setPhone(data.phone ?? "");
        setOrgEmail(data.org_email ?? "");
        setLoading(false);

        // Load workers
        supabase
          .from("org_workers")
          .select("*")
          .eq("org_id", data.id)
          .order("sort_order")
          .order("created_at")
          .then(({ data: ws }) => setWorkers((ws as OrgWorker[]) ?? []));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleSaveGeneral() {
    if (!orgId) return;
    setError("");
    startTransition(async () => {
      try {
        await saveOrgDetails(params.orgSlug, orgId, { org_code: orgCode, abn, address, phone, org_email: orgEmail });
        flash();
        toast.success("Details saved.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save.");
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  function handleSaveEmail() {
    if (!orgId) return;
    setError("");
    startTransition(async () => {
      try {
        await saveEmailSettings(params.orgSlug, orgId, template, signature);
        flash();
        toast.success("Email settings saved.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save.");
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  function startEdit(w: OrgWorker) {
    setEditingId(w.id);
    setEditBuf({ name: w.name, role: w.role, phone: w.phone ?? "", email: w.email ?? "" });
  }

  async function saveEdit(workerId: string) {
    try {
      await updateOrgWorker(workerId, params.orgSlug, editBuf);
      setWorkers((prev) =>
        prev.map((w) => (w.id === workerId ? { ...w, ...editBuf, phone: editBuf.phone || null, email: editBuf.email || null } : w))
      );
      setEditingId(null);
      toast.success("Worker updated.");
    } catch {
      toast.error("Failed to update worker.");
      setError("Failed to update worker.");
    }
  }

  async function handleDelete(workerId: string) {
    try {
      await deleteOrgWorker(workerId, params.orgSlug);
      setWorkers((prev) => prev.filter((w) => w.id !== workerId));
      toast.success("Worker deleted.");
    } catch {
      toast.error("Failed to delete worker.");
      setError("Failed to delete worker.");
    }
  }

  async function handleAddWorker() {
    if (!orgId || !newBuf.name.trim() || !newBuf.role.trim()) return;
    try {
      const created = await addOrgWorker(orgId, params.orgSlug, newBuf);
      setWorkers((prev) => [...prev, created as OrgWorker]);
      setNewBuf({ name: "", role: "", phone: "", email: "" });
      setAddingNew(false);
      toast.success("Team member added.");
    } catch {
      toast.error("Failed to add worker.");
      setError("Failed to add worker.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href={`/orgs/${params.orgSlug}/projects`} className="hover:text-foreground transition-colors">
          Projects
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Settings</span>
      </nav>

      <h1 className="text-lg font-bold">Organisation Settings</h1>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setError(""); setSaved(false); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* ── General tab ──────────────────────────────────────────────────────── */}
      {activeTab === "general" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold">Organisation Details</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Used in SWMS document headers and automated document numbering.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Organisation Code
              </label>
              <input
                value={loading ? "" : orgCode}
                onChange={(e) => setOrgCode(e.target.value.toUpperCase().slice(0, 10))}
                disabled={loading}
                placeholder="e.g. SPM"
                className={inputCls}
              />
              <p className="text-[10px] text-muted-foreground/60">Short identifier used in document numbers (max 10 chars)</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ABN</label>
              <input
                value={loading ? "" : abn}
                onChange={(e) => setAbn(e.target.value)}
                disabled={loading}
                placeholder="e.g. 85 614 157 596"
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</label>
            <input
              value={loading ? "" : address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={loading}
              placeholder="e.g. 119 Floraville Road, Floraville NSW 2280"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</label>
              <input
                value={loading ? "" : phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                placeholder="e.g. 0406 311 144"
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={loading ? "" : orgEmail}
                onChange={(e) => setOrgEmail(e.target.value)}
                disabled={loading}
                placeholder="e.g. admin@example.com"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveGeneral} disabled={isPending || loading} size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {saved ? "Saved!" : isPending ? "Saving…" : "Save details"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Members tab ──────────────────────────────────────────────────────── */}
      {activeTab === "members" && orgId && (
        <MembersTab orgSlug={params.orgSlug} orgId={orgId} currentUserId={currentUserId} />
      )}
      {activeTab === "members" && !orgId && (
        <div className="space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-3">
              <Skeleton className="h-10 flex-1 rounded-xl" />
              <Skeleton className="h-10 w-32 rounded-xl" />
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      )}

      {/* ── Email tab ────────────────────────────────────────────────────────── */}
      {activeTab === "email" && (
        <div className="space-y-8">
          {/* Signature */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Email Signature</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Appended to every price request email via the{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{Signature}}"}</code> placeholder.
              </p>
            </div>
            <textarea
              value={loading ? "" : signature}
              onChange={(e) => setSignature(e.target.value)}
              disabled={loading}
              rows={8}
              spellCheck={false}
              placeholder="Loading…"
              className="w-full text-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl px-4 py-3 text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-primary/40 resize-y font-mono leading-relaxed disabled:opacity-50"
            />
          </div>

          <Separator />

          {/* Template */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Price Request Email Template</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Applied to all price request emails. Use{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{placeholders}}"}</code> for dynamic values.
              </p>
            </div>

            <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Available placeholders</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_PLACEHOLDERS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    title={`Insert ${p.key}`}
                    onClick={() => setTemplate((t) => t + p.key)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-primary/30 bg-primary/5 text-primary text-xs font-mono hover:bg-primary/10 transition-colors"
                  >
                    {p.key}
                    <span className="text-[10px] text-muted-foreground font-sans">— {p.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={loading ? "" : template}
              onChange={(e) => setTemplate(e.target.value)}
              disabled={loading}
              rows={18}
              spellCheck={false}
              placeholder="Loading…"
              className="w-full text-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl px-4 py-3 text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-primary/40 resize-y font-mono leading-relaxed disabled:opacity-50"
            />

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setTemplate(DEFAULT_TEMPLATE)} className="gap-1.5 text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset template to default
              </Button>
              <Button onClick={handleSaveEmail} disabled={isPending || loading} size="sm" className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {saved ? "Saved!" : isPending ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Team tab ─────────────────────────────────────────────────────────── */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Team Members</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your organisation&apos;s installers and staff. Pick from this list when building a SWMS.
            </p>
          </div>

          <div className="border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 bg-muted/40">
                  {["Name", "Role / Qualifications", "Phone", "Email", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workers.map((w) =>
                  editingId === w.id ? (
                    <tr key={w.id} className="border-b border-black/10 dark:border-white/10 bg-primary/5">
                      <td className="px-2 py-1.5">
                        <input value={editBuf.name} onChange={(e) => setEditBuf((b) => ({ ...b, name: e.target.value }))} className={cellInput} autoFocus />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={editBuf.role} onChange={(e) => setEditBuf((b) => ({ ...b, role: e.target.value }))} className={cellInput} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={editBuf.phone} onChange={(e) => setEditBuf((b) => ({ ...b, phone: e.target.value }))} className={cellInput} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={editBuf.email} onChange={(e) => setEditBuf((b) => ({ ...b, email: e.target.value }))} className={cellInput} />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveEdit(w.id)} className="text-green-600 hover:text-green-500 transition-colors">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={w.id} className="group border-b border-black/10 dark:border-white/10 last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="px-3 py-2 text-sm font-medium text-foreground/80">{w.name}</td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{w.role}</td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{w.phone ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{w.email ?? "—"}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(w)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(w.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}

                {/* Add new row */}
                {addingNew && (
                  <tr className="border-t border-black/10 dark:border-white/10 bg-primary/5">
                    <td className="px-2 py-1.5">
                      <input
                        value={newBuf.name}
                        onChange={(e) => setNewBuf((b) => ({ ...b, name: e.target.value }))}
                        placeholder="Name"
                        className={cellInput}
                        autoFocus
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={newBuf.role}
                        onChange={(e) => setNewBuf((b) => ({ ...b, role: e.target.value }))}
                        placeholder="Role / experience"
                        className={cellInput}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={newBuf.phone}
                        onChange={(e) => setNewBuf((b) => ({ ...b, phone: e.target.value }))}
                        placeholder="Phone"
                        className={cellInput}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={newBuf.email}
                        onChange={(e) => setNewBuf((b) => ({ ...b, email: e.target.value }))}
                        placeholder="Email"
                        className={cellInput}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleAddWorker}
                          disabled={!newBuf.name.trim() || !newBuf.role.trim()}
                          className="text-green-600 hover:text-green-500 disabled:opacity-40 transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setAddingNew(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {workers.length === 0 && !addingNew && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No team members yet. Add your first team member below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!addingNew && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setAddingNew(true); setNewBuf({ name: "", role: "", phone: "", email: "" }); }}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add team member
            </Button>
          )}
        </div>
      )}

      {/* ── Shortcuts tab ────────────────────────────────────────────────────── */}
      {activeTab === "shortcuts" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Quick reference for all keyboard shortcuts in the app.</p>
          </div>

          <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl divide-y divide-border overflow-hidden">
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center gap-2">
                <CheckSquare2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tasks panel</span>
              </div>
              <div className="grid gap-2">
                {[
                  { keys: ["⌘", "J"], desc: "Open / close the Tasks panel from anywhere" },
                  { keys: ["Enter"], desc: "Add task (when cursor is in the task input)" },
                  { keys: ["@"], desc: "Trigger @mention autocomplete for projects & people" },
                  { keys: ["↑", "↓"], desc: "Navigate through mention suggestions" },
                  { keys: ["Tab"], desc: "Select the highlighted suggestion" },
                  { keys: ["Esc"], desc: "Dismiss the suggestion dropdown" },
                ].map(({ keys, desc }) => (
                  <div key={desc} className="flex items-center gap-4 justify-between">
                    <span className="text-sm text-muted-foreground">{desc}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {keys.map((k, i) => (
                        <kbd key={i} className="inline-flex items-center justify-center rounded border border-border bg-muted px-2 py-0.5 text-xs font-mono text-foreground/70 min-w-[24px]">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
