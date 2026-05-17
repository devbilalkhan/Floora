// Default rates used when generating estimate items.
// Single source of truth — imported by actions.ts and the price list pages.

export const MAT = {
  glueSheet:        129.00,
  glueCarpet:       220.00,
  featherFinish:     89.44,
  contactBrushable: 251.54,
  coveFillet:        20.00,
  vinylSkirting:      5.00,
  trims:             35.00,
  weldRod:            2.70,
} as const;

export const LAB = {
  vinyl:           23.00,
  wallVinyl:       25.00,
  wallVinylSemi:   29.00,  // wet area wall vinyl up to 1500mH
  wallVinylFull:   35.00,  // wet area wall vinyl 2000mH
  wallVinylAbove:  40.00,  // wet area wall vinyl above 2000mH
  carpet:           8.00,
  carpetBlm:       35.00,
  coving:          25.00,
  vinylSkirting:    6.00,
  featherFinish:    8.00,
  stairs:          85.00,
  transition:      20.00,
} as const;

export const COVERAGE_M2 = 70;  // m² per drum / bag
export const FILLET_LM   = 15;  // lm per coil

export const FLOOR_PREP = {
  bagsDiv:    12, // (area_m2 × depth_mm) / bagsDiv = bags required
  matPerBag:  33, // self-levelling compound material cost per bag
  labPerBag:  40, // labour cost per bag
} as const;
