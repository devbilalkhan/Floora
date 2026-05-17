import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LAB } from "@/lib/default-rates";

const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ITEMS = [
  { scope: "Vinyl Flooring",              rate: LAB.vinyl,          unit: "m²"  },
  { scope: "Wall Vinyl",                  rate: LAB.wallVinyl,      unit: "m²"  },
  { scope: "Carpet Flooring (m²)",        rate: LAB.carpet,         unit: "m²"  },
  { scope: "Carpet Flooring (blm)",       rate: LAB.carpetBlm,      unit: "blm" },
  { scope: "Coving / Coved Skirting",     rate: LAB.coving,         unit: "lm"  },
  { scope: "Vinyl Skirting (flat)",       rate: LAB.vinylSkirting,  unit: "lm"  },
  { scope: "Feather Finish Labour",       rate: LAB.featherFinish,  unit: "m²"  },
  { scope: "Stairs & Nosings",            rate: LAB.stairs,         unit: "ea"  },
  { scope: "Floor Transitions",           rate: LAB.transition,     unit: "lm"  },
] as const;

export default function LabourPriceListPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href={`/orgs/${params.orgSlug}/projects`} className="hover:text-foreground transition-colors">
          Projects
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Labour Price List</span>
      </nav>

      <div>
        <h1 className="text-lg font-bold">Labour Price List</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Default labour rates applied per scope category when generating estimate items.
        </p>
      </div>

      <div className="border border-border rounded-sm overflow-hidden bg-card/65 backdrop-blur-xl">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
          <div className="w-0.5 h-3.5 rounded-full bg-secondary/60" />
          <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-widest">
            Labour Rates by Scope
          </span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              <th className="px-4 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Scope / Activity</th>
              <th className="px-4 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Rate</th>
              <th className="px-4 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ITEMS.map((item) => (
              <tr key={item.scope} className="hover:bg-muted/10">
                <td className="px-4 py-2.5 text-foreground/80">{item.scope}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-foreground/85">
                  ${fmt(item.rate)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
