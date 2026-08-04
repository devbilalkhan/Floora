-- ── 063: Per-line include/exclude from totals ────────────────────────────────
--
-- Lets the user toggle an estimate line (primary or consumable) out of the
-- costing totals while keeping it visible for reference — e.g. excluding one
-- of two carpet rows (CPT 1 / CPT 2) along with its own consumables.

alter table estimate_items
  add column if not exists included_in_totals boolean not null default true;
