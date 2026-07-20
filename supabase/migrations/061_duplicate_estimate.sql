-- Duplicates a single estimate within the same project.
--
-- Copied:   estimate row (source_takeoff_id kept as-is — same project),
--           estimate_wet_areas, estimate_items (parent_item_id remapped),
--           swms (reset to draft, version 1, doc number cleared)
--
-- Skipped:  estimate_attachments (files), quotes
--
-- Returns the new estimate UUID.

create or replace function duplicate_estimate(
  p_estimate_id uuid,
  p_new_name    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id       uuid := auth.uid();
  v_project_id      uuid;
  v_role            text;
  v_new_estimate_id uuid;
begin
  -- ── Auth ──────────────────────────────────────────────────────────────────
  select project_id into v_project_id
  from   estimates
  where  id = p_estimate_id;

  if v_project_id is null then
    raise exception 'Estimate not found or access denied';
  end if;

  v_role := user_project_role(v_project_id);
  if v_role not in ('admin', 'project_manager') then
    raise exception 'You do not have permission to do this';
  end if;

  -- ── Estimate ──────────────────────────────────────────────────────────────
  insert into estimates (
    project_id, name, description, status, created_by,
    source_takeoff_id,
    accounting_rate, admin_rate, net_markup_pct,
    freight, accommodation, travel_allowance, bailing_fee,
    floor_prep_area, floor_prep_depth_mm,
    floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag,
    grind_area, grind_labor_rate, grind_charge_rate
  )
  select
    project_id, p_new_name, description, 'draft', v_caller_id,
    source_takeoff_id,
    accounting_rate, admin_rate, net_markup_pct,
    freight, accommodation, travel_allowance, bailing_fee,
    floor_prep_area, floor_prep_depth_mm,
    floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag,
    grind_area, grind_labor_rate, grind_charge_rate
  from estimates
  where id = p_estimate_id
  returning id into v_new_estimate_id;

  -- ── Wet areas ─────────────────────────────────────────────────────────────
  insert into estimate_wet_areas (
    estimate_id, sort_order, name,
    floor_sqm, wall_semi_sqm, wall_full_sqm, coving_lm, qty, charge
  )
  select
    v_new_estimate_id, sort_order, name,
    floor_sqm, wall_semi_sqm, wall_full_sqm, coving_lm, qty, charge
  from estimate_wet_areas
  where estimate_id = p_estimate_id;

  -- ── Estimate items (with parent_item_id remapping) ──────────────────────────
  create temp table _item_map (
    old_id uuid primary key,
    new_id uuid not null default gen_random_uuid()
  ) on commit drop;

  insert into _item_map (old_id)
  select id from estimate_items where estimate_id = p_estimate_id;

  insert into estimate_items (
    id, estimate_id, parent_item_id,
    sort_order, type, scope_category,
    finish_code, description,
    qty, unit, waste_pct,
    cov_lm, cov_area, cov_height_mm,
    mat_rate, lab_rate, coverage_m2, is_auto,
    manufacturer, level, product_type
  )
  select
    m.new_id, v_new_estimate_id, null,
    ei.sort_order, ei.type, ei.scope_category,
    ei.finish_code, ei.description,
    ei.qty, ei.unit, ei.waste_pct,
    ei.cov_lm, ei.cov_area, ei.cov_height_mm,
    ei.mat_rate, ei.lab_rate, ei.coverage_m2, ei.is_auto,
    ei.manufacturer, ei.level, ei.product_type
  from estimate_items ei
  join _item_map m on m.old_id = ei.id
  where ei.estimate_id = p_estimate_id;

  update estimate_items new_ei
  set    parent_item_id = parent_map.new_id
  from   _item_map child_map
  join   estimate_items orig on orig.id = child_map.old_id
                             and orig.estimate_id = p_estimate_id
                             and orig.parent_item_id is not null
  join   _item_map parent_map on parent_map.old_id = orig.parent_item_id
  where  new_ei.id = child_map.new_id;

  -- ── SWMS (reset version + status; keep all content) ────────────────────────
  insert into swms (
    estimate_id, org_id,
    version, document_number, status,
    s1_pc_name, s1_pc_contact,
    s1_works_manager, s1_works_manager_contact,
    s1_date_provided_to_pc, s1_workplace_location,
    s1_work_activity, s1_project_reference,
    s1_dev_responsible, s1_compliance_person, s1_compliance_measures,
    s1_reviewer, s1_date_received_by_reviewer,
    s1_review_triggers, s1_next_review_date,
    s2_hrcw, s3_persons,
    s4_project, s4_pc, s4_activity_description,
    s4_plant_equipment, s4_materials, s4_ppe, s4_training,
    s4_permits, s4_maintenance, s4_legislation, s4_codes, s4_standards,
    s6_hazards, s7_procedures, s7_contacts,
    s8_responsible_person, s8_responsible_quals, s8_workers
  )
  select
    v_new_estimate_id, org_id,
    1, null, 'draft',
    s1_pc_name, s1_pc_contact,
    s1_works_manager, s1_works_manager_contact,
    s1_date_provided_to_pc, s1_workplace_location,
    s1_work_activity, s1_project_reference,
    s1_dev_responsible, s1_compliance_person, s1_compliance_measures,
    s1_reviewer, s1_date_received_by_reviewer,
    s1_review_triggers, s1_next_review_date,
    s2_hrcw, s3_persons,
    s4_project, s4_pc, s4_activity_description,
    s4_plant_equipment, s4_materials, s4_ppe, s4_training,
    s4_permits, s4_maintenance, s4_legislation, s4_codes, s4_standards,
    s6_hazards, s7_procedures, s7_contacts,
    s8_responsible_person, s8_responsible_quals, s8_workers
  from swms
  where estimate_id = p_estimate_id;

  return v_new_estimate_id;
end;
$$;

grant execute on function duplicate_estimate(uuid, text) to authenticated;
