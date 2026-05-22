import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { TaskProvider } from "@/components/tasks/task-provider";
import { TaskPanel } from "@/components/tasks/task-panel";

// Shown while Nav's async queries (getUser + profiles) resolve.
// Matches the nav's layout so there's no shift when the real nav streams in.
function NavFallback() {
  return (
    <header className="h-12 bg-card/65 backdrop-blur-xl border-b border-border sticky top-0 z-40 flex items-center px-4 gap-4">
      <span className="text-sm font-semibold tracking-tight">Flooring Estimator</span>
      <div className="flex-1" />
    </header>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TaskProvider>
      <div className="print:hidden">
        <Suspense fallback={<NavFallback />}>
          <Nav />
        </Suspense>
      </div>
      <main>{children}</main>
      <div className="print:hidden">
        <TaskPanel />
      </div>
    </TaskProvider>
  );
}
