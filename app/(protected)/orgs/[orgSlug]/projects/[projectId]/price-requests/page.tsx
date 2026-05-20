import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Mail, Plus, Clock, CheckCircle2, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ReplyChecker } from "./reply-checker";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type ProductSnapshot = { finish_code: string };

export default async function PriceRequestsPage({
  params,
}: {
  params: { orgSlug: string; projectId: string };
}) {
  const supabase = createClient();

  const { data: userRole } = await supabase.rpc("user_project_role", { proj_id: params.projectId });
  if (userRole === "viewer" || !userRole) {
    redirect(`/orgs/${params.orgSlug}/projects/${params.projectId}`);
  }

  const [
    { data: project },
    { data: requests },
    { data: { user } },
  ] = await Promise.all([
    supabase.from("projects").select("name").eq("id", params.projectId).single(),
    supabase
      .from("price_requests")
      .select("id, supplier_name, supplier_email, subject, products, status, sent_at")
      .eq("project_id", params.projectId)
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  if (!project) notFound();

  const { data: gmailToken } = user
    ? await supabase
        .from("user_gmail_tokens")
        .select("user_id")
        .eq("user_id", user.id)
        .single()
    : { data: null };

  const hasGmail = Boolean(gmailToken);
  const list = requests ?? [];
  const sentCount     = list.filter((r) => r.status === "sent").length;
  const receivedCount = list.filter((r) => r.status === "received").length;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-5">
      <ReplyChecker projectId={params.projectId} orgSlug={params.orgSlug} hasGmail={hasGmail} />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href={`/orgs/${params.orgSlug}/projects`} className="hover:text-foreground transition-colors">Projects</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/orgs/${params.orgSlug}/projects/${params.projectId}`} className="hover:text-foreground transition-colors">{project.name}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Price Requests</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <h1 className="text-lg font-bold">Price Requests</h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/orgs/${params.orgSlug}/settings`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Edit template
          </Link>
          <Button asChild size="sm">
            <Link href={`/orgs/${params.orgSlug}/projects/${params.projectId}/price-requests/new`}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Request
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {list.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {list.length} total
          </span>
          {sentCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              {sentCount} awaiting reply
            </span>
          )}
          {receivedCount > 0 && (
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {receivedCount} replied
            </span>
          )}
        </div>
      )}

      {/* Gmail notice */}
      {!hasGmail && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm">
          <Mail className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-600 dark:text-amber-400">Gmail not connected</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              <Link href="/login" className="underline underline-offset-2 hover:text-foreground transition-colors">
                Sign in with Google
              </Link>
              {" "}to send price requests and auto-capture supplier replies.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {list.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center h-56 gap-3">
          <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
            <Mail className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">No price requests yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Drag products from your takeoff into the email composer and send a quote request to a supplier.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/orgs/${params.orgSlug}/projects/${params.projectId}/price-requests/new`}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Request
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((req) => {
            const products: ProductSnapshot[] = Array.isArray(req.products) ? req.products : [];
            const received = req.status === "received";

            return (
              <Link
                key={req.id}
                href={`/orgs/${params.orgSlug}/projects/${params.projectId}/price-requests/${req.id}`}
                className="group block bg-card/65 backdrop-blur-xl border border-border rounded-xl px-4 py-3.5 hover:border-primary/30 hover:bg-card/80 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left */}
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground/90 group-hover:text-foreground transition-colors truncate">
                      {req.supplier_name || req.supplier_email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{req.supplier_email}</p>
                    {products.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {products.slice(0, 6).map((p) => (
                          <span
                            key={p.finish_code}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground"
                          >
                            {p.finish_code}
                          </span>
                        ))}
                        {products.length > 6 && (
                          <span className="text-[10px] text-muted-foreground/60 py-0.5">
                            +{products.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right */}
                  <div className="shrink-0 text-right space-y-1.5">
                    <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      received
                        ? "text-green-600 dark:text-green-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}>
                      {received
                        ? <CheckCircle2 className="h-3.5 w-3.5" />
                        : <Clock className="h-3.5 w-3.5" />
                      }
                      {received ? "Reply received" : "Awaiting reply"}
                    </div>
                    {req.sent_at && (
                      <p className="text-[11px] text-muted-foreground/60">
                        {formatDate(req.sent_at)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
