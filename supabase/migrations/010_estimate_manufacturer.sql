-- ── 010: Add manufacturer field to estimate_items ────────────────────────────
alter table estimate_items
  add column if not exists manufacturer text;
