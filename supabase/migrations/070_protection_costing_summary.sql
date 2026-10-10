-- ── 070: Protection estimate costing summary ─────────────────────────────────
-- Job-level inputs for the Costing summary tab:
--   training (marked up), accommodation / meals / travel / freight (pass-through,
--   no markup — freight already exists from 069), admin % and markup %.
-- Percentages are stored as whole numbers (7 = 7%).

alter table protection_estimates
  add column if not exists training       numeric,
  add column if not exists accommodation  numeric,
  add column if not exists meals          numeric,
  add column if not exists travel         numeric,
  add column if not exists admin_pct      numeric not null default 7,
  add column if not exists markup_pct     numeric not null default 23
    check (markup_pct >= 0 and markup_pct <= 100);
