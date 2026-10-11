-- ── 077: Wet area feather finish ──────────────────────────────────────────────
-- Feather finish labour on wet areas: ff_sqm × feather finish rate ($8/m²), added
-- to the wet area's labour. NULL = follow floor_sqm (the default for new rows).
-- Existing rows are set to 0 so estimates already priced keep their totals.

alter table estimate_wet_areas
  add column if not exists ff_sqm numeric check (ff_sqm is null or ff_sqm >= 0);

update estimate_wet_areas set ff_sqm = 0 where ff_sqm is null;
