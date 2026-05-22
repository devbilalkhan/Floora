create table if not exists quotes (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  project_id       uuid not null references projects(id) on delete cascade,
  estimate_id      uuid references estimates(id) on delete set null,
  quote_number     text not null,
  quote_date       text not null,
  valid_for        text not null default '30 days from date of issue',

  -- Company snapshot (editable per-quote)
  company_name     text,
  company_abn      text,
  company_address  text,
  company_phone    text,
  company_email    text,

  -- Client
  to_name          text,
  to_address       text,
  to_contact       text,
  to_email         text,

  -- Project ref
  project_ref      text,
  project_loc      text,

  -- Content
  scope_text       text,
  notes            text,
  terms            text,

  -- Line items stored as JSONB array
  lines            jsonb not null default '[]',

  -- Totals
  total_ex_gst     numeric not null default 0,
  gst              numeric not null default 0,
  grand_total      numeric not null default 0,

  status           text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table quotes enable row level security;

-- Members of the org can select quotes for their projects
create policy "quotes_select" on quotes for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = org_id
        and om.user_id = auth.uid()
    )
  );

create policy "quotes_insert" on quotes for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = org_id
        and om.user_id = auth.uid()
    )
  );

create policy "quotes_update" on quotes for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = org_id
        and om.user_id = auth.uid()
    )
  );

create policy "quotes_delete" on quotes for delete
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = org_id
        and om.user_id = auth.uid()
    )
  );
