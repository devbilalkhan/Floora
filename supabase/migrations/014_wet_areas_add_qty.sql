-- ── 014: Add qty column to estimate_wet_areas ─────────────────────────────────
alter table estimate_wet_areas
  add column if not exists qty integer not null default 1;
