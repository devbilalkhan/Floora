"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

export function EstimateSwitcher({
  estimates,
  currentId,
  orgSlug,
  projectId,
}: {
  estimates: { id: string; name: string }[];
  currentId: string;
  orgSlug: string;
  projectId: string;
}) {
  const router = useRouter();

  if (estimates.length <= 1) return null;

  return (
    <div className="relative inline-flex items-center">
      <select
        value={currentId}
        onChange={(e) =>
          router.push(
            `/orgs/${orgSlug}/projects/${projectId}/estimates/${e.target.value}/costing`
          )
        }
        className="appearance-none text-xs bg-input border border-border rounded pl-2.5 pr-7 py-1 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40 max-w-[220px] truncate cursor-pointer"
      >
        {estimates.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-muted-foreground" />
    </div>
  );
}
