-- ── 076: Additional costs in per-unit sell rates ──────────────────────────────
-- Controls whether freight, accommodation, travel allowance and bailing fee are
-- spread into the per-unit category sell rates (Costing badges + Report). Does not
-- change Total ex-GST. Defaults to true so existing estimates keep their rates.

alter table estimates
  add column if not exists include_additional_in_rates boolean not null default true;
