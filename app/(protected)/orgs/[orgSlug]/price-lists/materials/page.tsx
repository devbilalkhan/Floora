import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MAT, COVERAGE_M2, FILLET_LM } from "@/lib/default-rates";

const fmt = (n: number) =>
  n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ITEMS = [
  { description: "Glue Sheet / Plank (Vinyl Adhesive)", unit: "drum", rate: MAT.glueSheet,        coverage: `${COVERAGE_M2} m²/drum` },
  { description: "Glue Carpet (Carpet Adhesive)",        unit: "drum", rate: MAT.glueCarpet,       coverage: `${COVERAGE_M2} m²/drum` },
  { description: "Feather Finish 20 kg",                 unit: "bag",  rate: MAT.featherFinish,    coverage: `${COVERAGE_M2} m²/bag`  },
  { description: "Contact Brushable (Max Bond 102)",     unit: "drum", rate: MAT.contactBrushable, coverage: `${COVERAGE_M2} m²/drum` },
  { description: "Cove Fillet",                          unit: "coil", rate: MAT.coveFillet,       coverage: `${FILLET_LM} lm/coil`   },
  { description: "Weld Rod",                             unit: "lm",   rate: MAT.weldRod,          coverage: "1 lm per 2 m² vinyl"    },
  { description: "Vinyl Skirting",                       unit: "lm",   rate: MAT.vinylSkirting,    coverage: null                     },
  { description: "Floor Transitions / Trims",            unit: "ea",   rate: MAT.trims,            coverage: null                     },
] as const;

export default function MaterialPriceListPage({
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
        <span className="text-foreground">Material Price List</span>
      </nav>

      <div>
        <h1 className="text-lg font-bold">Material Price List</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Default rates applied when generating estimate items.
        </p>
      </div>

      <div className="border border-border rounded-sm overflow-hidden bg-card/65 backdrop-blur-xl">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
          <div className="w-0.5 h-3.5 rounded-full bg-primary/60" />
          <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-widest">
            Consumables &amp; Sundries
          </span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              <th className="px-4 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
              <th className="px-4 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Unit</th>
              <th className="px-4 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Rate</th>
              <th className="px-4 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Coverage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ITEMS.map((item) => (
              <tr key={item.description} className="hover:bg-muted/10">
                <td className="px-4 py-2.5 text-foreground/80">{item.description}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.unit}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-foreground/85">
                  ${fmt(item.rate)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground/70 text-[11px]">
                  {item.coverage ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
