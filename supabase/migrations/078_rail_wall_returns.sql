-- ── 078: Rail lines — wall returns ────────────────────────────────────────────
-- Wall returns on the Handrails tab: qty × $ each, added to material like
-- brackets and screws. Added to crash_rail_lines too so both tables keep the
-- same shape (the shared RailLine type / select) — crash rail doesn't show it.

alter table handrail_lines
  add column if not exists returns_qty   integer not null default 0 check (returns_qty >= 0),
  add column if not exists return_price  numeric;

alter table crash_rail_lines
  add column if not exists returns_qty   integer not null default 0 check (returns_qty >= 0),
  add column if not exists return_price  numeric;
