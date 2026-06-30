-- ── 052: Estimate Grinding ────────────────────────────────────────────────────
--
-- Adds surface grinding fields to estimates. Grinding is a per-m² operation:
-- cost = grind_area × grind_labor_rate, revenue = grind_area × grind_charge_rate.
-- Profit folds into gross margin the same way as floor prep.

alter table estimates
  add column if not exists grind_area          numeric default 0,
  add column if not exists grind_labor_rate    numeric default 0,
  add column if not exists grind_charge_rate   numeric default 0;
