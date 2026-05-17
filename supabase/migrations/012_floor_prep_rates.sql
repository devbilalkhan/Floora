-- ── 012: Editable material and labour rates for floor preparation ──────────────
alter table estimates
  add column if not exists floor_prep_mat_per_bag numeric(10,2) not null default 33,
  add column if not exists floor_prep_lab_per_bag numeric(10,2) not null default 40;
