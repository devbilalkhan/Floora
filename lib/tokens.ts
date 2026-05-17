export type ScopeCategory =
  | "vinyl"
  | "carpet"
  | "coving"
  | "skirting"
  | "transition"
  | "wall_vinyl"
  | "stairs"
  | "trim"
  | "matting_systems"
  | "other";

export const SCOPE_CATEGORIES: { value: ScopeCategory; label: string }[] = [
  { value: "vinyl", label: "Vinyl" },
  { value: "carpet", label: "Carpet" },
  { value: "coving", label: "Coving" },
  { value: "skirting", label: "Skirting" },
  { value: "transition", label: "Transition" },
  { value: "wall_vinyl", label: "Wall Vinyl" },
  { value: "stairs", label: "Stairs" },
  { value: "trim", label: "Trim" },
  { value: "matting_systems", label: "Matting Systems" },
  { value: "other", label: "Other" },
];

export const SCOPE_COLOURS: Record<ScopeCategory, string> = {
  vinyl: "#8B5CF6",
  carpet: "#F472B6",
  coving: "#22D3EE",
  skirting: "#34D399",
  transition: "#FBBF24",
  wall_vinyl: "#A78BFA",
  stairs: "#F87171",
  trim: "#94A3B8",
  matting_systems: "#FB923C",
  other: "#64748B",
};

export const SCOPE_LABEL: Record<ScopeCategory, string> = Object.fromEntries(
  SCOPE_CATEGORIES.map(({ value, label }) => [value, label])
) as Record<ScopeCategory, string>;
