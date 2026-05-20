import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTasksData } from "@/app/actions/tasks";
import { PlannerView } from "./planner-view";
import type { Task } from "@/lib/task-types";

export default async function PlannerPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const data = await getTasksData(params.orgSlug);
  if (!data) notFound();

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-5">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link
          href={`/orgs/${params.orgSlug}/projects`}
          className="hover:text-foreground transition-colors"
        >
          Projects
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Planner</span>
      </nav>

      <PlannerView
        orgSlug={params.orgSlug}
        initialTasks={data.tasks as Task[]}
        projects={data.projects}
        members={data.members}
        currentUserId={data.currentUserId}
      />
    </div>
  );
}
