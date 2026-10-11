-- ── 075: Protection estimate retention ────────────────────────────────────────
-- Retention % on the Costing summary. Retention is ADDED to the price to recover
-- the amount the client withholds: retention = total ex GST before retention ×
-- retention %. Whole-number percent (5 = 5%); 0 = no retention, which is the
-- default so existing estimates keep their current totals.
-- (The "training" column is shown as "Preliminaries" in the app — label change only.)

alter table protection_estimates
  add column if not exists retention_pct numeric not null default 0
    check (retention_pct >= 0 and retention_pct <= 100);
