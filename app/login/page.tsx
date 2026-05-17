import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Flooring Estimator
          </h1>
          <p className="text-sm text-muted-foreground">
            SPM Commercial Flooring &amp; DFO Flooring
          </p>
        </div>

        <div className="bg-card/65 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a magic link.
            </p>
          </div>

          {searchParams.error && (
            <p className="text-xs text-destructive">
              {searchParams.error === "auth_error"
                ? "Authentication failed — please try again."
                : "Something went wrong — please try again."}
            </p>
          )}

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
