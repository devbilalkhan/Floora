import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { TaskButton } from "./tasks/task-button";

export async function Nav() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="h-12 bg-card/65 backdrop-blur-xl border-b border-border sticky top-0 z-40 flex items-center px-4 gap-4">
      <Link href="/orgs" className="text-sm font-semibold tracking-tight">
        Flooring Estimator
      </Link>
      <div className="flex-1" />
      {user && <TaskButton />}
      <ThemeToggle />
      {user && <UserMenu email={user.email ?? ""} />}
    </header>
  );
}
