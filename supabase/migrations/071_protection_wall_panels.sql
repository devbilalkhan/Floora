-- ── 071: Protection estimates — wall panels ───────────────────────────────────
-- Wall panel tab: job defaults on protection_estimates (pre-filled from the
-- wall protection spec v1.0), takeoff lines priced per whole sheet, and weld
-- rods kept as their own cost lines (spec §11). All money is cost — admin and
-- markup are applied in the Costing summary.
-- Line rate/size columns are nullable: null = inherit the job default.
-- sheets_override: null = base sheets calculated as ROUNDUP(gross m² ÷ sheet m²).

alter table protection_estimates
  add column if not exists wp_sheet_width_mm   integer not null default 1220,
  add column if not exists wp_sheet_length_mm  integer not null default 3000,
  add column if not exists wp_wastage_pct      numeric not null default 10,
  add column if not exists wp_default_price    numeric,
  add column if not exists wp_install_rate     numeric default 260,
  add column if not exists wp_glue_rate        numeric default 94.5,
  add column if not exists wp_cutout_rate      numeric default 40;

create table if not exists wall_panel_lines (
  id                uuid primary key default gen_random_uuid(),
  estimate_id       uuid not null references protection_estimates(id) on delete cascade,
  project_id        uuid not null references projects(id) on delete cascade,
  sort_order        integer not null default 0,
  item_code         text,
  product           text,
  gross_m2          numeric check (gross_m2 >= 0),
  net_m2            numeric check (net_m2 >= 0),
  sheet_width_mm    integer check (sheet_width_mm > 0),
  sheet_length_mm   integer check (sheet_length_mm > 0),
  sheets_override   integer check (sheets_override >= 0),
  wastage_pct       numeric check (wastage_pct >= 0),
  price             numeric,
  install_rate      numeric,
  glue_rate         numeric,
  cutouts_qty       integer not null default 0 check (cutouts_qty >= 0),
  cutout_rate       numeric,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists wall_panel_weld_rods (
  id            uuid primary key default gen_random_uuid(),
  estimate_id   uuid not null references protection_estimates(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  sort_order    integer not null default 0,
  description   text,
  qty           numeric not null default 0 check (qty >= 0),
  unit          text,
  unit_cost     numeric,
  wastage_pct   numeric not null default 0 check (wastage_pct >= 0),
  labour        numeric,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists wall_panel_lines_estimate_id_idx on wall_panel_lines(estimate_id);
create index if not exists wall_panel_weld_rods_estimate_id_idx on wall_panel_weld_rods(estimate_id);

alter table wall_panel_lines enable row level security;
alter table wall_panel_weld_rods enable row level security;

-- Admin / project manager only — same rule as corner_guard_lines (068)
drop policy if exists "admin_pm_access" on wall_panel_lines;
create policy "admin_pm_access" on wall_panel_lines
  for all using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  )
  with check (
    (is_superadmin() or user_project_role(project_id) in ('admin', 'project_manager'))
    and exists (
      select 1 from protection_estimates e
      where e.id = estimate_id and e.project_id = wall_panel_lines.project_id
    )
  );

drop policy if exists "admin_pm_access" on wall_panel_weld_rods;
create policy "admin_pm_access" on wall_panel_weld_rods
  for all using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  )
  with check (
    (is_superadmin() or user_project_role(project_id) in ('admin', 'project_manager'))
    and exists (
      select 1 from protection_estimates e
      where e.id = estimate_id and e.project_id = wall_panel_weld_rods.project_id
    )
  );

drop trigger if exists trg_wall_panel_lines_updated_at on wall_panel_lines;
create trigger trg_wall_panel_lines_updated_at
  before update on wall_panel_lines for each row execute function set_updated_at();

drop trigger if exists trg_wall_panel_weld_rods_updated_at on wall_panel_weld_rods;
create trigger trg_wall_panel_weld_rods_updated_at
  before update on wall_panel_weld_rods for each row execute function set_updated_at();
