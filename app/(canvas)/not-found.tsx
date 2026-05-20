import Link from "next/link";

export default function CanvasNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="space-y-1">
          <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
            404
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Drawing not found
          </h1>
          <p className="text-sm text-muted-foreground">
            This drawing or takeoff no longer exists.
          </p>
        </div>

        <Link
          href="/orgs"
          className="inline-flex h-8 items-center px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
