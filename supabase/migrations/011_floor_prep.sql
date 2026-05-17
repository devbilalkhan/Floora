-- ── 011: Floor preparation calculator fields on estimates ─────────────────────
alter table estimates
  add column if not exists floor_prep_area           numeric(12,2) not null default 0,
  add column if not exists floor_prep_depth_mm       smallint      not null default 3,
  add column if not exists floor_prep_charge_per_bag numeric(10,2) not null default 0;
