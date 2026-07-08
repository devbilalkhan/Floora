-- ── 055: Per-line include/exclude from totals ────────────────────────────────
--
-- Lets the user flag an income/expense line as excluded from subtotals and
-- totals (e.g. a placeholder or disputed line) while keeping it visible in
-- the Actuals table for reference.

alter table actual_line_items
  add column if not exists included_in_totals boolean not null default true;
