export type Takeoff = {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_by: string;
  created_at: string;
};

export type TakeoffRow = {
  id: string;
  scope_category: string;
  finish_code: string | null;
  description: string | null;
  manufacturer: string | null;
  colour: string | null;
  location: string | null;
  level: string | null;
  qty: number;
  unit: string;
  waste_pct: number;
  notes: string | null;
  sort_order: number;
  parent_finish_code: string | null;
  cove_height_mm: number | null;
};

export const CATEGORIES: {
  key: string;
  label: string;
  defaultUnit: "m2" | "lm" | "ea";
}[] = [
  { key: "vinyl",           label: "Vinyl Flooring",      defaultUnit: "m2" },
  { key: "carpet",          label: "Carpet Flooring",     defaultUnit: "m2" },
  { key: "wall_vinyl",      label: "Wall Vinyl",          defaultUnit: "m2" },
  { key: "coving_skirting", label: "Covings & Skirtings", defaultUnit: "lm" },
  { key: "matting",         label: "Entry Matting",       defaultUnit: "m2" },
  { key: "stairs",          label: "Stairs & Nosings",    defaultUnit: "lm" },
  { key: "transition",      label: "Floor Transitions",   defaultUnit: "lm" },
  { key: "other",           label: "Other",               defaultUnit: "m2" },
];

export const LEVELS = [
  "B2", "B1", "GF", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10",
];
