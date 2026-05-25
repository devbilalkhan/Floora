-- ── 038: Project Actuals ─────────────────────────────────────────────────────
--
-- Phase 3: income/expense tracking, AI invoice extraction, margin dashboard.
--
-- New tables (order matters — FK chain: actual_groups → extraction_runs → actual_line_items):
--   actual_groups         – top-level income/expense groupings per project
--   extraction_runs       – audit log of Claude API extraction calls
--   actual_line_items     – individual invoice lines (child of actual_groups)
--   actuals_prompt_config – per-org custom extraction prompts
--
-- Projects gains two retention columns:
--   retention_pct       – % withheld per progress claim (null = no retention)
--   retention_released  – cumulative retention paid back by client (ex-GST)
--
-- RLS uses existing is_superadmin(), user_project_role(), user_org_role()
-- helpers from migration 021. No new helpers needed.

-- ── Retention fields on projects ─────────────────────────────────────────────

alter table projects
  add column if not exists retention_pct      numeric(5,2),
  add column if not exists retention_released numeric(12,2) not null default 0;

-- ── actual_groups ─────────────────────────────────────────────────────────────

create table if not exists actual_groups (
  id           uuid        primary key default gen_random_uuid(),
  project_id   uuid        not null references projects(id) on delete cascade,
  org_id       uuid        not null references organizations(id) on delete cascade,
  owner_id     uuid        not null references profiles(id),
  type         text        not null check (type in ('income', 'expense')),
  name         text        not null default 'New group',
  sort_order   int         not null default 0,
  is_collapsed boolean     not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── extraction_runs (before actual_line_items — FK dependency) ────────────────

create table if not exists extraction_runs (
  id                   uuid        primary key default gen_random_uuid(),
  project_id           uuid        not null references projects(id) on delete cascade,
  owner_id             uuid        not null references profiles(id),
  group_id             uuid        references actual_groups(id) on delete set null,
  file_name            text        not null,
  file_mime_type       text        not null,
  prompt_used          text        not null,
  raw_response         jsonb,
  line_items_extracted int         not null default 0,
  status               text        not null default 'pending'
                         check (status in ('pending', 'completed', 'failed')),
  error_message        text,
  created_at           timestamptz not null default now()
);

-- ── actual_line_items ─────────────────────────────────────────────────────────

create table if not exists actual_line_items (
  id                uuid        primary key default gen_random_uuid(),
  group_id          uuid        not null references actual_groups(id) on delete cascade,
  project_id        uuid        not null references projects(id) on delete cascade,
  owner_id          uuid        not null references profiles(id),
  sort_order        int         not null default 0,
  invoice_date      date,
  invoice_number    text,
  description       text        not null default '',
  qty               numeric,
  unit_price        numeric,
  subtotal          numeric     not null default 0,
  source            text        not null default 'manual'
                      check (source in ('manual', 'ai_extracted')),
  extraction_run_id uuid        references extraction_runs(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── actuals_prompt_config ─────────────────────────────────────────────────────

create table if not exists actuals_prompt_config (
  id                    uuid        primary key default gen_random_uuid(),
  org_id                uuid        not null unique references organizations(id) on delete cascade,
  owner_id              uuid        not null references profiles(id),
  income_system_prompt  text        not null,
  expense_system_prompt text        not null,
  updated_at            timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table actual_groups         enable row level security;
alter table actual_line_items     enable row level security;
alter table extraction_runs       enable row level security;
alter table actuals_prompt_config enable row level security;

drop policy if exists "admin_pm_access" on actual_groups;
create policy "admin_pm_access" on actual_groups
  for all using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  );

drop policy if exists "admin_pm_access" on actual_line_items;
create policy "admin_pm_access" on actual_line_items
  for all using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  );

drop policy if exists "admin_pm_access" on extraction_runs;
create policy "admin_pm_access" on extraction_runs
  for all using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  );

-- actuals_prompt_config is org-scoped, not project-scoped
drop policy if exists "admin_pm_access" on actuals_prompt_config;
create policy "admin_pm_access" on actuals_prompt_config
  for all using (
    is_superadmin()
    or user_org_role(org_id) in ('admin', 'project_manager')
  );

-- ── updated_at triggers ───────────────────────────────────────────────────────

drop trigger if exists trg_actual_groups_updated_at on actual_groups;
create trigger trg_actual_groups_updated_at
  before update on actual_groups for each row execute function set_updated_at();

drop trigger if exists trg_actual_line_items_updated_at on actual_line_items;
create trigger trg_actual_line_items_updated_at
  before update on actual_line_items for each row execute function set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists actual_groups_project_id_idx     on actual_groups(project_id);
create index if not exists actual_line_items_group_id_idx   on actual_line_items(group_id);
create index if not exists actual_line_items_project_id_idx on actual_line_items(project_id);
create index if not exists extraction_runs_project_id_idx   on extraction_runs(project_id);
