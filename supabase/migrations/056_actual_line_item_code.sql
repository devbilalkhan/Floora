-- ── 056: Per-line cost code ───────────────────────────────────────────────────
--
-- Lets the user tag a line item with a short cost code (e.g. FR for Freight)
-- independent of which supplier/invoice it's under, so a specific cost type
-- can be tracked as its own total regardless of which invoice it came in on.

alter table actual_line_items
  add column if not exists code text;
