// Isomorphic — safe to import in both server actions and client components.

export type ProductSnapshot = {
  finish_code: string;
  description: string | null;
  manufacturer: string | null;
  colour: string | null;
  scope_category: string;
  supply: Record<string, number>;
};

export const TEMPLATE_PLACEHOLDERS = [
  { key: "{{Name}}",         description: "Supplier name" },
  { key: "{{Project name}}", description: "Project name" },
  { key: "{{Address}}",      description: "Project address" },
  { key: "{{Specifier}}",    description: "Specifier / head client" },
  { key: "{{Products}}",     description: "Auto-generated product list" },
  { key: "{{Sender name}}",  description: "Your email address" },
  { key: "{{Signature}}",    description: "Your email signature (set in Settings)" },
] as const;

export const DEFAULT_TEMPLATE = `Hi {{Name}},

Please provide pricing for the following products for {{Project name}}:

{{Products}}

Please quote per unit including pack sizes where applicable.

Best regards,

{{Signature}}`;

function formatSupplyLine(supply: Record<string, number>): string {
  return Object.entries(supply)
    .filter(([, qty]) => qty > 0)
    .map(([unit, qty]) => `${Math.ceil(qty).toLocaleString()} ${unit === "m2" ? "m²" : unit}`)
    .join(", ");
}

function buildProductsBlock(products: ProductSnapshot[]): string {
  if (products.length === 0) return "(no products added)";
  const divider = "-".repeat(52);
  const items = products.map((p) => {
    const lines = [`  ${p.finish_code} - ${p.description ?? "Product"}`];
    if (p.manufacturer || p.colour) {
      lines.push(
        `  Manufacturer: ${p.manufacturer ?? "-"}${p.colour ? `  |  Colour: ${p.colour}` : ""}`
      );
    }
    lines.push(`  Supply Qty: ${formatSupplyLine(p.supply)}`);
    return lines.join("\n");
  });
  return [divider, items.join("\n" + divider + "\n"), divider].join("\n");
}

export function renderEmailBody(
  template: string,
  vars: {
    Name: string;
    "Project name": string;
    Address: string;
    Specifier: string;
    "Sender name": string;
    Signature: string;
  },
  products: ProductSnapshot[]
): string {
  const allVars: Record<string, string> = {
    ...vars,
    Products: buildProductsBlock(products),
  };
  return template.replace(/\{\{([^|}]+?)(?:\|([^}]*))?\}\}/g, (match, key: string, fallback?: string) => {
    const trimmed = key.trim();
    const known = trimmed in allVars;
    const value = known ? allVars[trimmed] : undefined;
    if (value) return value;                              // non-empty value → use it
    if (fallback !== undefined) return fallback.trim();   // empty/missing + fallback → use fallback
    if (known) return "";                                 // known key, empty value, no fallback → blank
    return match;                                         // unknown key → leave placeholder
  });
}
