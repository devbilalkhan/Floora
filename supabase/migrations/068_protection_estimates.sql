-- ── 068: Protection estimates — corner guards ─────────────────────────────────
-- Structured costing for the wall & door protection trade. One estimate per job
-- holds job-level defaults; corner_guard_lines hold the priced lines.
-- Line rate/price columns are nullable: null = inherit the job default.
-- All money is cost (no markup / freight yet).

create table if not exists protection_estimates (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references projects(id) on delete cascade,
  name                  text not null,
  default_price_std     numeric,
  default_price_nib     numeric,
  default_install_rate  numeric,
  default_coving_mm     integer not null default 150,
  cutting_enabled       boolean not null default false,
  default_cutting_rate  numeric,
  created_by            uuid references profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists corner_guard_lines (
  id                uuid primary key default gen_random_uuid(),
  estimate_id       uuid not null references protection_estimates(id) on delete cascade,
  project_id        uuid not null references projects(id) on delete cascade,
  sort_order        integer not null default 0,
  group_name        text,
  description       text,
  wall_height_mm    integer,
  coving_mm         integer,
  qty_std           integer not null default 0 check (qty_std >= 0),
  qty_nib           integer not null default 0 check (qty_nib >= 0),
  price_std         numeric,
  price_nib         numeric,
  install_rate      numeric,
  cutting_enabled   boolean,
  cuts_qty          integer not null default 0 check (cuts_qty >= 0),
  cutting_rate      numeric,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists protection_estimates_project_id_idx on protection_estimates(project_id);
create index if not exists corner_guard_lines_estimate_id_idx on corner_guard_lines(estimate_id);

alter table protection_estimates enable row level security;
alter table corner_guard_lines enable row level security;

-- Admin / project manager only (same rule as actuals)
drop policy if exists "admin_pm_access" on protection_estimates;
create policy "admin_pm_access" on protection_estimates
  for all using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  )
  with check (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  );

-- project_id is denormalised for RLS; the check keeps it consistent with the estimate
drop policy if exists "admin_pm_access" on corner_guard_lines;
create policy "admin_pm_access" on corner_guard_lines
  for all using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  )
  with check (
    (is_superadmin() or user_project_role(project_id) in ('admin', 'project_manager'))
    and exists (
      select 1 from protection_estimates e
      where e.id = estimate_id and e.project_id = corner_guard_lines.project_id
    )
  );

drop trigger if exists trg_protection_estimates_updated_at on protection_estimates;
create trigger trg_protection_estimates_updated_at
  before update on protection_estimates for each row execute function set_updated_at();

drop trigger if exists trg_corner_guard_lines_updated_at on corner_guard_lines;
create trigger trg_corner_guard_lines_updated_at
  before update on corner_guard_lines for each row execute function set_updated_at();
