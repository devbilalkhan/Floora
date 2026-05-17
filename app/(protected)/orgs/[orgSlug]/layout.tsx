import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronRight } from "lucide-react";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgSlug: string };
}) {
  const supabase = createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, slug")
    .eq("slug", params.orgSlug)
    .single();

  if (!org) notFound();

  return (
    <div>
      <div className="border-b border-border px-4 h-9 flex items-center gap-1.5 text-xs text-muted-foreground bg-background/50">
        <Link href="/orgs" className="hover:text-foreground transition-colors">
          Organizations
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{org.name}</span>
      </div>
      {children}
    </div>
  );
}
