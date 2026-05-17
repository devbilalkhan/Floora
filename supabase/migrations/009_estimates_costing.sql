-- ── 009: Estimates costing system ────────────────────────────────────────────

-- ── project_takeoff: coving linkage columns ──────────────────────────────────
alter table project_takeoff
  add column if not exists parent_finish_code text,
  add column if not exists cove_height_mm     numeric
    check (cove_height_mm is null or cove_height_mm in (100, 150, 200));

-- ── estimates: rate settings + additional costs + takeoff link ────────────────
alter table estimates
  add column if not exists source_takeoff_id uuid references takeoffs(id) on delete set null,
  add column if not exists accounting_rate   numeric(5,4) not null default 0.02,
  add column if not exists admin_rate        numeric(5,4) not null default 0.05,
  add column if not exists net_markup_pct    numeric(5,4) not null default 0.23,
  add column if not exists freight           numeric(10,2) not null default 0,
  add column if not exists accommodation     numeric(10,2) not null default 0,
  add column if not exists travel_allowance  numeric(10,2) not null default 0,
  add column if not exists bailing_fee       numeric(10,2) not null default 0;

-- ── material_library ──────────────────────────────────────────────────────────
create table if not exists material_library (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete cascade,
  name        text not null,
  unit        text not null,
  unit_cost   numeric(10,2) not null,
  coverage_m2 numeric(10,2),
  scope_hint  text,
  sort_order  int not null default 0,
  created_at  timestamptz default now()
);

alter table material_library enable row level security;

create policy "read_material_library" on material_library for select
  using (auth.role() = 'authenticated');

-- Global seed data (org_id = null = available to all orgs)
insert into material_library (name, unit, unit_cost, coverage_m2, scope_hint, sort_order)
select v.name, v.unit, v.unit_cost::numeric, v.coverage_m2::numeric, v.scope_hint, v.sort_order::int
from (values
  ('Primer (Porous)',                  'drum',  '220.00', null,   null,          '10'),
  ('Primer (Non-Porous)',              'drum',  '220.00', null,   null,          '20'),
  ('Glue Sheet/Plank',                'drum',  '129.00', '70',   'vinyl',       '30'),
  ('Glue Carpet Tiles',               'drum',  '130.00', '70',   'carpet',      '40'),
  ('Glue Carpet',                     'drum',  '220.00', '70',   'carpet',      '50'),
  ('Weld Rod',                        'ea',      '2.70', null,   'vinyl',       '60'),
  ('Feather Finish 20kg',             'bag',    '89.44', '70',   'vinyl',       '70'),
  ('Bulk Fill Bag',                   'bag',    '35.41', null,   null,          '80'),
  ('Underlay Carpet',                 'm2',     '14.00', null,   'carpet',      '90'),
  ('Cove Fillet',                     'coil',   '20.00', null,   'coving',     '100'),
  ('Contact Brushable (Max Bond 102)','drum',  '251.54', '70',   'coving',     '110'),
  ('Contact Sprayable',               'drum',  '246.00', '70',   'coving',     '120'),
  ('Vinyl Skirting',                  'lm',      '5.00', null,   'skirting',   '130'),
  ('Trims',                           'ea',     '35.00', null,   'transition', '140'),
  ('Rapid C90 Bag 20kg',              'bag',   '102.74', null,   null,         '150')
) as v(name, unit, unit_cost, coverage_m2, scope_hint, sort_order)
where not exists (
  select 1 from material_library
  where org_id is null and name = v.name and unit = v.unit
);

-- ── labour_library ────────────────────────────────────────────────────────────
create table if not exists labour_library (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete cascade,
  scope_category  text not null,
  description     text not null,
  rate            numeric(10,2) not null,
  unit            text not null,
  sort_order      int not null default 0,
  created_at      timestamptz default now()
);

alter table labour_library enable row level security;

create policy "read_labour_library" on labour_library for select
  using (auth.role() = 'authenticated');

insert into labour_library (scope_category, description, rate, unit, sort_order)
select v.scope_category, v.description, v.rate::numeric, v.unit, v.sort_order::int
from (values
  ('vinyl',           'Vinyl Install',           '23.00', 'm2',  '10'),
  ('vinyl',           'Feather Finish Labour',    '8.00', 'm2',  '20'),
  ('wall_vinyl',      'Wall Vinyl Install',       '25.00','m2',  '10'),
  ('wall_vinyl',      'Feather Finish Labour',    '8.00', 'm2',  '20'),
  ('carpet',          'Carpet Install (m2)',       '8.00', 'm2', '10'),
  ('carpet',          'Carpet Install (blm)',     '35.00','blm', '20'),
  ('coving_skirting', 'Coving Install',           '25.00','lm',  '10'),
  ('coving_skirting', 'Vinyl Skirting Install',    '6.00','lm',  '20'),
  ('stairs',          'Stairs Vinyl Install',     '85.00','ea',  '10'),
  ('transition',      'Trim Install',             '20.00','ea',  '10'),
  ('transition',      'Ramp Install',             '50.00','ea',  '20'),
  ('matting',         'Matting Install',           '0.00', 'm2', '10')
) as v(scope_category, description, rate, unit, sort_order)
where not exists (
  select 1 from labour_library
  where org_id is null and scope_category = v.scope_category and description = v.description
);

-- ── estimate_items ────────────────────────────────────────────────────────────
create table if not exists estimate_items (
  id             uuid primary key default gen_random_uuid(),
  estimate_id    uuid not null references estimates(id) on delete cascade,
  parent_item_id uuid references estimate_items(id) on delete cascade,
  sort_order     int not null default 0,

  type           text not null default 'primary'
                   check (type in ('primary', 'consumable')),
  scope_category text not null,
  finish_code    text,
  description    text,

  qty            numeric(10,3) not null default 0,
  unit           text not null default 'm2'
                   check (unit in ('m2', 'lm', 'blm', 'ea', 'drum', 'bag', 'coil')),
  waste_pct      numeric(5,2) not null default 0,

  -- coving merge data (vinyl primary rows only)
  cov_lm         numeric(10,3),
  cov_area       numeric(10,3),
  cov_height_mm  numeric,

  mat_rate       numeric(10,4) not null default 0,
  lab_rate       numeric(10,4) not null default 0,
  coverage_m2    numeric(10,2),

  is_auto        boolean not null default false,

  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table estimate_items enable row level security;

create policy "select_estimate_items" on estimate_items for select
  using (exists (
    select 1 from estimates e
    where e.id = estimate_id and user_has_project_access(e.project_id)
  ));

create policy "insert_estimate_items" on estimate_items for insert
  with check (exists (
    select 1 from estimates e
    where e.id = estimate_id and user_has_project_access(e.project_id)
  ));

create policy "update_estimate_items" on estimate_items for update
  using (exists (
    select 1 from estimates e
    where e.id = estimate_id and user_has_project_access(e.project_id)
  ));

create policy "delete_estimate_items" on estimate_items for delete
  using (exists (
    select 1 from estimates e
    where e.id = estimate_id and user_has_project_access(e.project_id)
  ));

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_estimate_items_updated_at') then
    create trigger trg_estimate_items_updated_at
      before update on estimate_items for each row execute function set_updated_at();
  end if;
end $$;
