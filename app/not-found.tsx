import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="space-y-1">
          <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
            404
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/orgs"
            className="inline-flex h-8 items-center px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex h-8 items-center px-3 text-xs font-medium rounded-md border border-border text-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
