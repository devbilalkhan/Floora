-- Access helper: any org member who can see the estimate can access its SWMS
create or replace function user_has_estimate_access(est_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from estimates e
    join projects p on p.id = e.project_id
    join organization_members om on om.organization_id = p.organization_id
    where e.id = est_id and om.user_id = auth.uid()
  )
$$;

-- SWMS: one record per estimate (versioned via the `version` field)
create table swms (
  id          uuid        primary key default gen_random_uuid(),
  estimate_id uuid        not null references estimates(id) on delete cascade,
  org_id      uuid        not null references organizations(id),
  version     int         not null default 1,
  document_number text,
  status      text        not null default 'draft'
                check (status in ('draft', 'approved')),

  -- Section 1 — Cover & Approval
  s1_pc_name                    text,
  s1_pc_contact                 text,
  s1_works_manager              text,
  s1_works_manager_contact      text,
  s1_date_provided_to_pc        date,
  s1_workplace_location         text,
  s1_work_activity              text,
  s1_project_reference          text,
  s1_dev_responsible            text,
  s1_compliance_person          text,
  s1_compliance_measures        text,
  s1_reviewer                   text,
  s1_date_received_by_reviewer  date,
  s1_review_triggers            text,
  s1_next_review_date           date,

  -- Variable-length sections stored as JSONB arrays / objects
  s2_hrcw       jsonb not null default '[]',  -- HrcwRow[]
  s3_persons    jsonb not null default '[]',  -- PersonRow[]

  -- Section 4 individual text fields
  s4_project              text,
  s4_pc                   text,
  s4_activity_description text,
  s4_plant_equipment      text,
  s4_materials            text,
  s4_ppe                  text,
  s4_training             text,
  s4_permits              text,
  s4_maintenance          text,
  s4_legislation          text,
  s4_codes                text,
  s4_standards            text,

  s6_hazards    jsonb not null default '[]',  -- HazardRow[]
  s7_procedures jsonb not null default '[]',  -- EmergencyProcedure[]
  s7_contacts   jsonb not null default '[]',  -- EmergencyContact[]

  -- Section 8
  s8_responsible_person text,
  s8_responsible_quals  text,
  s8_workers            jsonb not null default '[]',  -- WorkerRow[]

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table swms enable row level security;

create policy "select_swms" on swms for select
  using (user_has_estimate_access(estimate_id));

create policy "insert_swms" on swms for insert
  with check (user_has_estimate_access(estimate_id));

create policy "update_swms" on swms for update
  using (user_has_estimate_access(estimate_id));

create policy "delete_swms" on swms for delete
  using (user_has_estimate_access(estimate_id));

create trigger trg_swms_updated_at
  before update on swms for each row execute function set_updated_at();
