"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-base font-medium text-destructive">Something went wrong</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={reset}
          className="text-xs text-primary underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
