-- ── 054: Per-line retention selection ────────────────────────────────────────
--
-- Retention is withheld per progress claim (projects.retention_pct), but not
-- every income line should have retention applied to it. This lets the user
-- flag which income entries retention applies to; the Actuals page sums
-- retention only across flagged lines rather than the whole income total.

alter table actual_line_items
  add column if not exists retention_applied boolean not null default false;
