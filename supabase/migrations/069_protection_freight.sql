-- ── 069: Protection estimate freight ──────────────────────────────────────────
-- Job-level freight amount, added to the job total after the line subtotal.
-- Pass-through cost: will not be marked up once markup is added.

alter table protection_estimates add column if not exists freight numeric;
