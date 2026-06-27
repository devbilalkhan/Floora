"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function ProtectedNotFound() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3rem)] px-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="space-y-1">
          <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
            404
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Not found
          </h1>
          <p className="text-sm text-muted-foreground">
            This org, project, or estimate doesn&apos;t exist or you don&apos;t have access.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium rounded-md border border-border text-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go back
          </button>
          <Link
            href="/orgs"
            className="inline-flex h-8 items-center px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
