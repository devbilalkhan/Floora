import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Clock, CheckCircle2, Send, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { stripQuotedContent } from "@/lib/gmail";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ProductSnapshot = {
  finish_code: string;
  description: string | null;
  manufacturer: string | null;
  colour: string | null;
  scope_category: string;
  supply: Record<string, number>;
};

export default async function PriceRequestDetailPage({
  params,
}: {
  params: { orgSlug: string; projectId: string; requestId: string };
}) {
  const supabase = createClient();

  const { data: userRole } = await supabase.rpc("user_project_role", { proj_id: params.projectId });
  if (userRole === "viewer" || !userRole) {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }

  const [{ data: req }, { data: project }] = await Promise.all([
    supabase.from("price_requests").select("*").eq("id", params.requestId).single(),
    supabase.from("projects").select("name").eq("id", params.projectId).single(),
  ]);

  if (!req || !project) notFound();

  const products: ProductSnapshot[] = Array.isArray(req.products) ? req.products : [];
  const received = req.status === "received";
  const replyText = req.reply_body ? stripQuotedContent(req.reply_body) : null;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href={`/orgs/${params.orgSlug}/projects`} className="hover:text-foreground transition-colors">Projects</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/orgs/${params.orgSlug}/projects/${params.projectId}`} className="hover:text-foreground transition-colors">{project.name}</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/orgs/${params.orgSlug}/projects/${params.projectId}/price-requests`} className="hover:text-foreground transition-colors">Price Requests</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground truncate max-w-[180px]">{req.supplier_name || req.supplier_email}</span>
      </nav>

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-lg font-bold">{req.supplier_name || req.supplier_email}</h1>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
            received
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}>
            {received ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {received ? "Reply received" : "Awaiting reply"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{req.supplier_email}</p>
      </div>

      {/* Products */}
      {products.length > 0 && (
        <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl p-4 space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            {products.length} product{products.length !== 1 ? "s" : ""} requested
          </p>
          <div className="divide-y divide-border">
            {products.map((p) => (
              <div key={p.finish_code} className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <span className="text-xs font-mono font-semibold text-primary">{p.finish_code}</span>
                  {p.description && (
                    <span className="text-xs text-foreground/70 ml-2">{p.description}</span>
                  )}
                  {(p.manufacturer || p.colour) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {[p.manufacturer, p.colour].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {Object.entries(p.supply).map(([unit, qty]) => (
                    <p key={unit} className="text-xs tabular-nums font-medium text-foreground/80">
                      {Math.ceil(qty).toLocaleString()} {unit === "m2" ? "m²" : unit}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation — latest on top */}
      <div className="space-y-3">
        {/* Supplier reply */}
        {received && replyText ? (
          <div className="bg-card/65 backdrop-blur-xl border border-green-500/20 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-green-500/20 bg-green-500/5">
              <div className="flex items-center gap-2 text-xs">
                <MessageSquare className="h-3.5 w-3.5 text-green-500" />
                <span className="font-medium text-foreground/80">{req.reply_from || req.supplier_email}</span>
              </div>
              {req.reply_received_at && (
                <span className="text-[11px] text-muted-foreground/60 shrink-0 ml-3">{formatDate(req.reply_received_at)}</span>
              )}
            </div>
            <pre className="text-xs text-foreground/70 whitespace-pre-wrap font-sans leading-relaxed p-4">
              {replyText}
            </pre>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-dashed border-border text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            No reply yet. Floora will auto-detect when the supplier replies to your Gmail thread.
          </div>
        )}

        {/* Sent email */}
        <div className="bg-card/65 backdrop-blur-xl border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Send className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground/80">You</span>
              <span>·</span>
              <span className="truncate max-w-[240px]">{req.subject}</span>
            </div>
            {req.sent_at && (
              <span className="text-[11px] text-muted-foreground/60 shrink-0 ml-3">{formatDate(req.sent_at)}</span>
            )}
          </div>
          <pre className="text-xs text-foreground/70 whitespace-pre-wrap font-sans leading-relaxed p-4">
            {req.email_body}
          </pre>
        </div>
      </div>
    </div>
  );
}
