export type PriceListMaterial = {
  id: string;
  description: string;
  manufacturer: string;
  scope: string;
  unit: string;
  mat_rate: number;
};

export type PriceListLabour = {
  id: string;
  description: string;
  scope: string;
  unit: string;
  lab_rate: number;
};

export const MATERIAL_PRICE_LIST: PriceListMaterial[] = [
  // ── Vinyl Flooring ────────────────────────────────────────────────────────
  { id: "m-v-01", description: "Homogeneous Vinyl Sheet",          manufacturer: "Altro",    scope: "vinyl",           unit: "m2",   mat_rate: 48.50 },
  { id: "m-v-02", description: "Heterogeneous Vinyl Sheet",        manufacturer: "Polyflor", scope: "vinyl",           unit: "m2",   mat_rate: 38.00 },
  { id: "m-v-03", description: "LVT Plank (2.5mm)",                manufacturer: "Karndean", scope: "vinyl",           unit: "m2",   mat_rate: 55.00 },
  { id: "m-v-04", description: "LVT Tile (3.0mm)",                 manufacturer: "Amtico",   scope: "vinyl",           unit: "m2",   mat_rate: 62.00 },
  { id: "m-v-05", description: "Safety Vinyl (R10)",               manufacturer: "Altro",    scope: "vinyl",           unit: "m2",   mat_rate: 52.00 },
  { id: "m-v-06", description: "Conductive Vinyl Sheet",           manufacturer: "Polyflor", scope: "vinyl",           unit: "m2",   mat_rate: 88.00 },
  { id: "m-v-07", description: "Pressure Sensitive Adhesive",      manufacturer: "Bostik",   scope: "vinyl",           unit: "drum", mat_rate: 72.00 },
  { id: "m-v-08", description: "Contact Adhesive (Max Bond 102)",  manufacturer: "Roberts",  scope: "vinyl",           unit: "drum", mat_rate: 95.00 },
  { id: "m-v-09", description: "Weld Rod (per coil, 25m)",         manufacturer: "Altro",    scope: "vinyl",           unit: "coil", mat_rate: 48.00 },
  { id: "m-v-10", description: "Seam Sealer",                      manufacturer: "Roberts",  scope: "vinyl",           unit: "ea",   mat_rate: 22.00 },

  // ── Carpet Flooring ───────────────────────────────────────────────────────
  { id: "m-c-01", description: "Commercial Carpet Tile (500×500)", manufacturer: "Interface",scope: "carpet",          unit: "m2",   mat_rate: 55.00 },
  { id: "m-c-02", description: "Broadloom Carpet (loop pile)",     manufacturer: "Godfrey Hirst", scope: "carpet",    unit: "m2",   mat_rate: 38.00 },
  { id: "m-c-03", description: "Broadloom Carpet (cut pile)",      manufacturer: "Cavalier", scope: "carpet",         unit: "m2",   mat_rate: 44.00 },
  { id: "m-c-04", description: "Carpet Adhesive",                  manufacturer: "Bostik",   scope: "carpet",         unit: "drum", mat_rate: 68.00 },
  { id: "m-c-05", description: "Carpet Underlay (8mm PU foam)",    manufacturer: "Dunlop",   scope: "carpet",         unit: "m2",   mat_rate: 8.50 },
  { id: "m-c-06", description: "Gripper Rod (2.4m length)",        manufacturer: "Roberts",  scope: "carpet",         unit: "ea",   mat_rate: 6.50 },
  { id: "m-c-07", description: "Tackless Strip",                   manufacturer: "Roberts",  scope: "carpet",         unit: "lm",   mat_rate: 2.80 },

  // ── Covings & Skirtings ───────────────────────────────────────────────────
  { id: "m-cs-01", description: "Cove Fillet (per lm)",            manufacturer: "Altro",    scope: "coving_skirting", unit: "lm",   mat_rate: 3.50 },
  { id: "m-cs-02", description: "Vinyl Skirting (100mm)",          manufacturer: "Polyflor", scope: "coving_skirting", unit: "lm",   mat_rate: 9.00 },
  { id: "m-cs-03", description: "Vinyl Skirting (150mm)",          manufacturer: "Polyflor", scope: "coving_skirting", unit: "lm",   mat_rate: 12.00 },
  { id: "m-cs-04", description: "Timber Skirting (67×18mm)",       manufacturer: "Generic",  scope: "coving_skirting", unit: "lm",   mat_rate: 7.50 },
  { id: "m-cs-05", description: "Contact Brushable (Max Bond 102)",manufacturer: "Roberts",  scope: "coving_skirting", unit: "drum", mat_rate: 95.00 },

  // ── Wall Vinyl ────────────────────────────────────────────────────────────
  { id: "m-wv-01", description: "Wall Vinyl (Type 2)",             manufacturer: "Altro",    scope: "wall_vinyl",      unit: "m2",   mat_rate: 52.00 },
  { id: "m-wv-02", description: "Wall Vinyl (Type 1)",             manufacturer: "Polyflor", scope: "wall_vinyl",      unit: "m2",   mat_rate: 42.00 },
  { id: "m-wv-03", description: "Wall Adhesive",                   manufacturer: "Bostik",   scope: "wall_vinyl",      unit: "drum", mat_rate: 78.00 },

  // ── Entry Matting ─────────────────────────────────────────────────────────
  { id: "m-m-01", description: "Entrance Matting (heavy duty)",    manufacturer: "Forbo",    scope: "matting",         unit: "m2",   mat_rate: 185.00 },
  { id: "m-m-02", description: "Entrance Matting (standard)",      manufacturer: "Forbo",    scope: "matting",         unit: "m2",   mat_rate: 125.00 },
  { id: "m-m-03", description: "Aluminium Mat Frame",              manufacturer: "Generic",  scope: "matting",         unit: "m2",   mat_rate: 95.00 },

  // ── Stairs & Nosings ─────────────────────────────────────────────────────
  { id: "m-s-01", description: "Stair Nosing (aluminium, 55mm)",   manufacturer: "Altro",    scope: "stairs",          unit: "lm",   mat_rate: 28.00 },
  { id: "m-s-02", description: "Stair Nosing (vinyl insert)",      manufacturer: "Gradus",   scope: "stairs",          unit: "lm",   mat_rate: 35.00 },
  { id: "m-s-03", description: "Stair Tread (rubber)",             manufacturer: "Jaymart",  scope: "stairs",          unit: "lm",   mat_rate: 48.00 },

  // ── Floor Transitions ─────────────────────────────────────────────────────
  { id: "m-t-01", description: "T-Bar Transition (aluminium)",     manufacturer: "Generic",  scope: "transition",      unit: "lm",   mat_rate: 14.00 },
  { id: "m-t-02", description: "Reducer Strip",                    manufacturer: "Generic",  scope: "transition",      unit: "lm",   mat_rate: 11.00 },
  { id: "m-t-03", description: "End Cap / Edge Trim",              manufacturer: "Generic",  scope: "transition",      unit: "lm",   mat_rate: 9.00 },
  { id: "m-t-04", description: "Expansion Joint Cover",            manufacturer: "Gradus",   scope: "transition",      unit: "lm",   mat_rate: 42.00 },

  // ── Other ─────────────────────────────────────────────────────────────────
  { id: "m-o-01", description: "Floor Levelling Compound (25kg)",  manufacturer: "Ardex",    scope: "other",           unit: "bag",  mat_rate: 33.00 },
  { id: "m-o-02", description: "Moisture Barrier / Primer",        manufacturer: "Ardex",    scope: "other",           unit: "ea",   mat_rate: 48.00 },
  { id: "m-o-03", description: "Skim Coat Compound (20kg)",        manufacturer: "Mapei",    scope: "other",           unit: "bag",  mat_rate: 28.00 },
  { id: "m-o-04", description: "Double-Sided Tape",                manufacturer: "Generic",  scope: "other",           unit: "ea",   mat_rate: 12.00 },
];

export const LABOUR_PRICE_LIST: PriceListLabour[] = [
  // ── Vinyl Flooring ────────────────────────────────────────────────────────
  { id: "l-v-01", description: "Vinyl Sheet — Supply & Install",    scope: "vinyl",           unit: "m2",  lab_rate: 28.00 },
  { id: "l-v-02", description: "LVT Plank — Install only",          scope: "vinyl",           unit: "m2",  lab_rate: 22.00 },
  { id: "l-v-03", description: "LVT Tile — Install only",           scope: "vinyl",           unit: "m2",  lab_rate: 24.00 },
  { id: "l-v-04", description: "Vinyl Sheet — Weld Rod",            scope: "vinyl",           unit: "lm",  lab_rate: 8.00 },
  { id: "l-v-05", description: "Vinyl — Strip & Dispose",           scope: "vinyl",           unit: "m2",  lab_rate: 12.00 },

  // ── Carpet Flooring ───────────────────────────────────────────────────────
  { id: "l-c-01", description: "Carpet Tile — Install only",        scope: "carpet",          unit: "m2",  lab_rate: 18.00 },
  { id: "l-c-02", description: "Broadloom — Stretch & Fit",        scope: "carpet",          unit: "m2",  lab_rate: 22.00 },
  { id: "l-c-03", description: "Broadloom — Direct Stick",         scope: "carpet",          unit: "m2",  lab_rate: 25.00 },
  { id: "l-c-04", description: "Carpet — Strip & Dispose",          scope: "carpet",          unit: "m2",  lab_rate: 10.00 },

  // ── Covings & Skirtings ───────────────────────────────────────────────────
  { id: "l-cs-01", description: "Coving Labour (heat-formed)",      scope: "coving_skirting", unit: "lm",  lab_rate: 22.00 },
  { id: "l-cs-02", description: "Skirting — Fix & Finish",          scope: "coving_skirting", unit: "lm",  lab_rate: 12.00 },
  { id: "l-cs-03", description: "Skirting — Remove existing",       scope: "coving_skirting", unit: "lm",  lab_rate: 6.00 },

  // ── Wall Vinyl ────────────────────────────────────────────────────────────
  { id: "l-wv-01", description: "Wall Vinyl — Install only",        scope: "wall_vinyl",      unit: "m2",  lab_rate: 32.00 },
  { id: "l-wv-02", description: "Wall Vinyl — Remove existing",     scope: "wall_vinyl",      unit: "m2",  lab_rate: 14.00 },

  // ── Entry Matting ─────────────────────────────────────────────────────────
  { id: "l-m-01", description: "Matting — Install inc. frame",      scope: "matting",         unit: "m2",  lab_rate: 45.00 },
  { id: "l-m-02", description: "Matting — Install, frame supplied", scope: "matting",         unit: "m2",  lab_rate: 28.00 },

  // ── Stairs & Nosings ─────────────────────────────────────────────────────
  { id: "l-s-01", description: "Stair Nosing — Fix to concrete",    scope: "stairs",          unit: "lm",  lab_rate: 35.00 },
  { id: "l-s-02", description: "Stair Nosing — Fix to timber",      scope: "stairs",          unit: "lm",  lab_rate: 28.00 },
  { id: "l-s-03", description: "Stair Tread — Full installation",   scope: "stairs",          unit: "ea",  lab_rate: 120.00 },
  { id: "l-s-04", description: "Stair Tread — Remove existing",     scope: "stairs",          unit: "ea",  lab_rate: 45.00 },

  // ── Floor Transitions ─────────────────────────────────────────────────────
  { id: "l-t-01", description: "Transition Strip — Fix to concrete",scope: "transition",      unit: "lm",  lab_rate: 18.00 },
  { id: "l-t-02", description: "Transition Strip — Fix to timber",  scope: "transition",      unit: "lm",  lab_rate: 14.00 },

  // ── Other ─────────────────────────────────────────────────────────────────
  { id: "l-o-01", description: "Floor Prep — Grind & Level",        scope: "other",           unit: "m2",  lab_rate: 18.00 },
  { id: "l-o-02", description: "Floor Prep — Compound (per bag)",   scope: "other",           unit: "bag", lab_rate: 40.00 },
  { id: "l-o-03", description: "Moisture Barrier — Apply",          scope: "other",           unit: "m2",  lab_rate: 8.00 },
  { id: "l-o-04", description: "General Labour (per hour)",         scope: "other",           unit: "ea",  lab_rate: 85.00 },
];
