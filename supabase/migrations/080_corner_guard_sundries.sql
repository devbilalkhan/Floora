-- ── 080: Corner guards — sundries (builders mastic, silicone) ─────────────────
-- Estimate-level, not per line: qty × $ each, added to the corner guards total.

alter table protection_estimates
  add column if not exists cg_mastic_qty      numeric not null default 0 check (cg_mastic_qty >= 0),
  add column if not exists cg_mastic_price    numeric,
  add column if not exists cg_silicone_qty    numeric not null default 0 check (cg_silicone_qty >= 0),
  add column if not exists cg_silicone_price  numeric;
