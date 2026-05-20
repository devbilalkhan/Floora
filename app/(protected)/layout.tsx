import { Nav } from "@/components/nav";
import { TaskProvider } from "@/components/tasks/task-provider";
import { TaskPanel } from "@/components/tasks/task-panel";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TaskProvider>
      <Nav />
      <main>{children}</main>
      <TaskPanel />
    </TaskProvider>
  );
}
