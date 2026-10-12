-- ── 081: Protection estimate notes ────────────────────────────────────────────
-- Rich-text notes (TipTap HTML) shown on the Costing summary tab. Internal only.

alter table protection_estimates add column if not exists notes text;
