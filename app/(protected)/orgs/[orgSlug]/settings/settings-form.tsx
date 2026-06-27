"use client";

import { useState, useTransition } from "react";
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
  ImageIcon,
  Upload,
  Mic,
  Copy,
  KeyRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TEMPLATE_PLACEHOLDERS, DEFAULT_TEMPLATE } from "@/lib/email-template";
import {
  saveEmailSettings,
  saveOrgDetails,
  saveOrgLogo,
  saveDefaultRates,
  addOrgWorker,
  updateOrgWorker,
  deleteOrgWorker,
  generateVoiceToken,
  revokeVoiceToken,
} from "./actions";
import { MAT, LAB } from "@/lib/default-rates";
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

type Tab = "general" | "members" | "email" | "team" | "shortcuts" | "rates" | "voice";

const BASE_TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "members", label: "Members" },
  { id: "email", label: "Email" },
  { id: "team", label: "Team" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "rates", label: "Default Rates" },
  { id: "voice", label: "Voice" },
];

const inputCls =
  "w-full text-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl px-4 py-2.5 text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50";

const cellInput =
  "w-full text-xs bg-input border border-border rounded px-2 py-1 text-foreground/80 outline-none focus:ring-1 focus:ring-primary/40";

type InitialData = {
  org_code: string;
  abn: string;
  address: string;
  phone: string;
  org_email: string;
  logo_url: string | null;
  quote_terms: string;
  quote_notes: string;
  quote_prefix: string;
  quote_number_seq: number;
  price_request_template: string | null;
  price_request_signature: string | null;
  default_rates: { mat?: Record<string, number>; lab?: Record<string, number> };
};

export function SettingsForm({
  params,
  orgId,
  currentUserId,
  userRole,
  voiceTokenMeta,
  initialData,
  initialWorkers,
}: {
  params: { orgSlug: string };
  orgId: string;
  currentUserId: string;
  userRole: string;
  voiceTokenMeta: { id: string; label: string | null; last_used: string | null; created_at: string } | null;
  initialData: InitialData;
  initialWorkers: OrgWorker[];
}) {
  // Only used for client-side storage uploads (logo)
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [isPending, startTransition] = useTransition();

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // General tab
  const [orgCode, setOrgCode] = useState(initialData.org_code);
  const [abn, setAbn] = useState(initialData.abn);
  const [address, setAddress] = useState(initialData.address);
  const [phone, setPhone] = useState(initialData.phone);
  const [orgEmail, setOrgEmail] = useState(initialData.org_email);

  // Quote settings
  const [quoteTerms, setQuoteTerms] = useState(initialData.quote_terms);
  const [quoteNotes, setQuoteNotes] = useState(initialData.quote_notes);
  const [quotePrefix, setQuotePrefix] = useState(initialData.quote_prefix);
  const [quoteNumberSeq, setQuoteNumberSeq] = useState(initialData.quote_number_seq);

  // Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(initialData.logo_url);
  const [logoTs, setLogoTs] = useState(0);
  const [logoUploading, setLogoUploading] = useState(false);

  // Email tab
  const [template, setTemplate] = useState(initialData.price_request_template ?? DEFAULT_TEMPLATE);
  const [signature, setSignature] = useState(initialData.price_request_signature ?? DEFAULT_SIGNATURE);

  // Rates tab — merged with hardcoded defaults so all keys are always present
  const [matRates, setMatRates] = useState<Record<string, number>>({
    ...MAT, ...(initialData.default_rates.mat ?? {}),
  });
  const [labRates, setLabRates] = useState<Record<string, number>>({
    ...LAB, ...(initialData.default_rates.lab ?? {}),
  });

  // Team tab
  const [workers, setWorkers] = useState<OrgWorker[]>(initialWorkers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState({ name: "", role: "", phone: "", email: "" });
  const [addingNew, setAddingNew] = useState(false);
  const [newBuf, setNewBuf] = useState({ name: "", role: "", phone: "", email: "" });

  // Voice tab
  const canUseVoice = userRole === "admin" || userRole === "project_manager";
  const [voiceRawToken, setVoiceRawToken] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(!!voiceTokenMeta);
  const [tokenCreatedAt, setTokenCreatedAt] = useState(voiceTokenMeta?.created_at ?? null);
  const [tokenLastUsed, setTokenLastUsed] = useState(voiceTokenMeta?.last_used ?? null);
  const [voicePending, setVoicePending] = useState(false);

  const TABS = canUseVoice ? BASE_TABS : BASE_TABS.filter((t) => t.id !== "voice");

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleGenerateVoiceToken() {
    setVoicePending(true);
    try {
      const raw = await generateVoiceToken(params.orgSlug, orgId);
      setVoiceRawToken(raw);
      setHasToken(true);
      setTokenCreatedAt(new Date().toISOString());
      setTokenLastUsed(null);
      toast.success("Token generated. Copy it now — it won't be shown again.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate token.");
    } finally {
      setVoicePending(false);
    }
  }

  async function handleRevokeVoiceToken() {
    setVoicePending(true);
    try {
      await revokeVoiceToken(params.orgSlug, orgId);
      setHasToken(false);
      setVoiceRawToken(null);
      setTokenCreatedAt(null);
      toast.success("Token revoked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke token.");
    } finally {
      setVoicePending(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2 MB.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${orgId}/logo.${ext}`;
    setLogoUploading(true);
    try {
      const { error: uploadErr } = await supabase.storage
        .from("org-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage
        .from("org-logos")
        .getPublicUrl(path);
      await saveOrgLogo(params.orgSlug, orgId, publicUrl);
      setLogoUrl(publicUrl);
      setLogoTs(Date.now());
      toast.success("Logo uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleRemoveLogo() {
    if (!logoUrl) return;
    try {
      await saveOrgLogo(params.orgSlug, orgId, null);
      setLogoUrl(null);
      toast.success("Logo removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove logo.");
    }
  }

  function handleSaveGeneral() {
    setError("");
    startTransition(async () => {
      try {
        await saveOrgDetails(params.orgSlug, orgId, { org_code: orgCode, abn, address, phone, org_email: orgEmail, quote_terms: quoteTerms, quote_notes: quoteNotes, quote_prefix: quotePrefix, quote_number_seq: quoteNumberSeq });
        flash();
        toast.success("Details saved.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save.");
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  function handleSaveEmail() {
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

  function handleSaveRates() {
    setError("");
    startTransition(async () => {
      try {
        await saveDefaultRates(params.orgSlug, orgId, { mat: matRates, lab: labRates });
        flash();
        toast.success("Default rates saved.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save.");
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  function handleResetRates() {
    setMatRates({ ...MAT });
    setLabRates({ ...LAB });
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
    if (!newBuf.name.trim() || !newBuf.role.trim()) return;
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
          {/* Logo */}
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Company Logo</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Appears on SWMS documents and printed reports.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-28 h-16 border border-border rounded-xl bg-card/65 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoUrl ? (
                  <img
                    src={logoTs ? `${logoUrl}?v=${logoTs}` : logoUrl}
                    alt="Company logo"
                    className="max-h-full max-w-full object-contain p-1.5"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground/25" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    className="hidden"
                    disabled={logoUploading}
                    onChange={handleLogoUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 pointer-events-none"
                    disabled={logoUploading}
                    asChild
                  >
                    <span>
                      <Upload className="h-3.5 w-3.5" />
                      {logoUploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
                    </span>
                  </Button>
                </label>
                {logoUrl && !logoUploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="gap-1.5 text-destructive hover:text-destructive justify-start px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground/60">PNG, JPG, SVG or WebP — max 2 MB</p>
              </div>
            </div>
          </div>

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
                value={orgCode}
                onChange={(e) => setOrgCode(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="e.g. SPM"
                className={inputCls}
              />
              <p className="text-[10px] text-muted-foreground/60">Short identifier used in document numbers (max 10 chars)</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ABN</label>
              <input
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                placeholder="e.g. 85 614 157 596"
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 119 Floraville Road, Floraville NSW 2280"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0406 311 144"
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={orgEmail}
                onChange={(e) => setOrgEmail(e.target.value)}
                placeholder="e.g. admin@example.com"
                className={inputCls}
              />
            </div>
          </div>

          <Separator />

          <div>
            <h2 className="text-base font-semibold">Quote Defaults</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pre-populated on every new quote. Editable per-quote before printing.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quote number prefix</label>
              <input
                value={quotePrefix}
                onChange={(e) => setQuotePrefix(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="e.g. SPM"
                className={inputCls}
              />
              <p className="text-[10px] text-muted-foreground/60">
                Prefix for sequential quote numbers (e.g. <span className="font-mono">SPM-0100</span>)
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last quote number</label>
              <input
                type="number"
                value={quoteNumberSeq}
                onChange={(e) => setQuoteNumberSeq(Math.max(0, parseInt(e.target.value) || 0))}
                className={inputCls}
              />
              <p className="text-[10px] text-muted-foreground/60">
                Next quote will be <span className="font-mono">{quotePrefix}-{String(quoteNumberSeq + 1).padStart(4, "0")}</span>
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Additional Notes</label>
            <textarea
              value={quoteNotes}
              onChange={(e) => setQuoteNotes(e.target.value)}
              rows={4}
              placeholder="e.g. All prices are in AUD. Quote valid for 30 days from date of issue."
              className="w-full text-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl px-4 py-2.5 text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-primary/40 resize-y disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Terms &amp; Conditions</label>
            <textarea
              value={quoteTerms}
              onChange={(e) => setQuoteTerms(e.target.value)}
              rows={6}
              placeholder="e.g. Payment is due within 14 days of invoice. All work carries a 12-month workmanship warranty…"
              className="w-full text-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl px-4 py-2.5 text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-primary/40 resize-y disabled:opacity-50"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveGeneral} disabled={isPending} size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {saved ? "Saved!" : isPending ? "Saving…" : "Save details"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Members tab ──────────────────────────────────────────────────────── */}
      {activeTab === "members" && (
        <MembersTab orgSlug={params.orgSlug} orgId={orgId} currentUserId={currentUserId} />
      )}

      {/* ── Email tab ────────────────────────────────────────────────────────── */}
      {activeTab === "email" && (
        <div className="space-y-8">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Email Signature</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Appended to every price request email via the{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{Signature}}"}</code> placeholder.
              </p>
            </div>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder="Your email signature…"
              className="w-full text-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl px-4 py-3 text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-primary/40 resize-y font-mono leading-relaxed disabled:opacity-50"
            />
          </div>

          <Separator />

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
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={18}
              spellCheck={false}
              placeholder="Your email template…"
              className="w-full text-sm bg-card/65 backdrop-blur-xl border border-border rounded-xl px-4 py-3 text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-primary/40 resize-y font-mono leading-relaxed disabled:opacity-50"
            />

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setTemplate(DEFAULT_TEMPLATE)} className="gap-1.5 text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset template to default
              </Button>
              <Button onClick={handleSaveEmail} disabled={isPending} size="sm" className="gap-1.5">
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

      {/* ── Voice tab ─────────────────────────────────────────────────────────── */}
      {activeTab === "voice" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold">Voice Task Assistant</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Record a voice memo on your iPhone and create tasks automatically via iOS Shortcuts.
            </p>
          </div>

          {/* Token management */}
          <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl divide-y divide-border overflow-hidden">
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Voice Token</span>
              </div>

              {voiceRawToken ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-400">Copy this token now — it won't be shown again.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-muted/60 border border-border px-3 py-2 text-xs font-mono text-foreground/80 break-all select-all">
                      {voiceRawToken}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(voiceRawToken); toast.success("Copied!"); }}
                      className="flex-shrink-0 rounded-lg border border-border bg-muted/40 hover:bg-muted/70 p-2 transition-colors"
                      title="Copy token"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : hasToken ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    An active token exists. Token value is hidden for security.
                  </p>
                  {tokenCreatedAt && (
                    <p className="text-xs text-muted-foreground/60">
                      Created {new Date(tokenCreatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      {tokenLastUsed && ` · Last used ${new Date(tokenLastUsed).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No token yet. Generate one to set up your Shortcut.</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleGenerateVoiceToken}
                  disabled={voicePending}
                  className="gap-1.5"
                >
                  <Mic className="h-3.5 w-3.5" />
                  {voicePending ? "Working…" : hasToken ? "Regenerate Token" : "Generate Token"}
                </Button>
                {hasToken && !voiceRawToken && (
                  <button
                    onClick={handleRevokeVoiceToken}
                    disabled={voicePending}
                    className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>

            {/* Setup guide */}
            <div className="px-4 py-4 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">iOS Shortcut Setup</span>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Open the <strong className="text-foreground/80">Shortcuts</strong> app on your iPhone.</li>
                <li>Create a new Shortcut and add a <strong className="text-foreground/80">Record Audio</strong> action.</li>
                <li>Add a <strong className="text-foreground/80">Get Contents of URL</strong> action:
                  <ul className="mt-1.5 ml-4 space-y-1 text-xs list-disc list-inside">
                    <li>URL: <code className="bg-muted/50 px-1 rounded text-foreground/70">{typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"}/api/voice-tasks</code></li>
                    <li>Method: <code className="bg-muted/50 px-1 rounded text-foreground/70">POST</code></li>
                    <li>Header — <code className="bg-muted/50 px-1 rounded text-foreground/70">Authorization</code>: <code className="bg-muted/50 px-1 rounded text-foreground/70">Bearer &lt;your token&gt;</code></li>
                    <li>Header — <code className="bg-muted/50 px-1 rounded text-foreground/70">X-Org-Slug</code>: <code className="bg-muted/50 px-1 rounded text-foreground/70">{params.orgSlug}</code></li>
                    <li>Body: multipart/form-data, field <code className="bg-muted/50 px-1 rounded text-foreground/70">audio</code> = the recorded file</li>
                  </ul>
                </li>
                <li>Add a <strong className="text-foreground/80">Show Notification</strong> action using the URL result as the message.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ── Rates tab ─────────────────────────────────────────────────────────── */}
      {activeTab === "rates" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold">Default Rates</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              These rates are applied automatically when new estimate rows are created. Changing them does not affect any existing estimates.
            </p>
          </div>

          {/* Labour rates */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Labour Rates</h3>
            <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40 border-b border-black/10 dark:border-white/10">
                    <th className="text-left px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Scope</th>
                    <th className="text-left px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Unit</th>
                    <th className="text-right px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide w-32">Rate ($)</th>
                    <th className="text-right px-3 py-1.5 text-[11px] font-medium text-muted-foreground/45 uppercase tracking-wide w-24">Default</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["vinyl",          "Vinyl Flooring",                    "$/m²"],
                    ["wallVinyl",      "Wall Vinyl",                        "$/m²"],
                    ["carpet",         "Carpet (m²)",                       "$/m²"],
                    ["carpetBlm",      "Carpet (broadloom lm)",             "$/blm"],
                    ["coving",         "Coving / Coved Skirting",           "$/lm"],
                    ["vinylSkirting",  "Vinyl Skirting (flat)",             "$/lm"],
                    ["featherFinish",  "Feather Finish Labour",             "$/m²"],
                    ["stairs",         "Stairs & Nosings",                  "$/ea"],
                    ["transition",     "Floor Transitions",                 "$/lm"],
                    ["wallVinylSemi",  "Wet Area Wall Vinyl (≤1500mm)",     "$/m²"],
                    ["wallVinylFull",  "Wet Area Wall Vinyl (2000mm)",      "$/m²"],
                    ["wallVinylAbove", "Wet Area Wall Vinyl (>2000mm)",     "$/m²"],
                  ] as [string, string, string][]).map(([key, label, unit]) => (
                    <tr key={key} className="border-b border-black/10 dark:border-white/10 last:border-0 hover:bg-muted/10">
                      <td className="px-3 py-1.5 text-[11px] text-foreground/70">{label}</td>
                      <td className="px-3 py-1.5 text-[11px] text-muted-foreground">{unit}</td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={labRates[key] ?? 0}
                          onChange={(e) => setLabRates((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                          className="w-full text-xs text-right tabular-nums bg-input border border-black/10 dark:border-white/10 rounded px-2 py-1 text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right text-[11px] text-muted-foreground/45 tabular-nums">
                        {(LAB as Record<string, number>)[key]?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Material (consumable) rates */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Material / Consumable Rates</h3>
            <div className="border border-black/10 dark:border-white/10 rounded-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40 border-b border-black/10 dark:border-white/10">
                    <th className="text-left px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Consumable</th>
                    <th className="text-left px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Unit</th>
                    <th className="text-right px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide w-32">Rate ($)</th>
                    <th className="text-right px-3 py-1.5 text-[11px] font-medium text-muted-foreground/45 uppercase tracking-wide w-24">Default</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["glueSheet",        "Glue Sheet/Plank (Vinyl Adhesive)",    "$/drum"],
                    ["glueCarpet",       "Glue Carpet (Carpet Adhesive)",        "$/drum"],
                    ["featherFinish",    "Feather Finish 20kg",                  "$/bag"],
                    ["contactBrushable", "Contact Brushable (Max Bond 102)",     "$/drum"],
                    ["coveFillet",       "Cove Fillet",                          "$/coil"],
                    ["vinylSkirting",    "Vinyl Skirting (default mat rate)",    "$/lm"],
                    ["trims",            "Floor Trims / Transitions (default)",  "$/ea"],
                    ["weldRod",          "Weld Rod",                             "$/lm"],
                    ["underlay",         "Carpet Underlay",                      "$/m²"],
                  ] as [string, string, string][]).map(([key, label, unit]) => (
                    <tr key={key} className="border-b border-black/10 dark:border-white/10 last:border-0 hover:bg-muted/10">
                      <td className="px-3 py-1.5 text-[11px] text-foreground/70">{label}</td>
                      <td className="px-3 py-1.5 text-[11px] text-muted-foreground">{unit}</td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={matRates[key] ?? 0}
                          onChange={(e) => setMatRates((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                          className="w-full text-xs text-right tabular-nums bg-input border border-black/10 dark:border-white/10 rounded px-2 py-1 text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right text-[11px] text-muted-foreground/45 tabular-nums">
                        {(MAT as Record<string, number>)[key]?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveRates} disabled={isPending} size="sm">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {isPending ? "Saving…" : "Save Rates"}
            </Button>
            <button
              onClick={handleResetRates}
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to defaults
            </button>
            {saved && <span className="text-xs text-green-500 flex items-center gap-1"><CheckSquare2 className="h-3.5 w-3.5" /> Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}
