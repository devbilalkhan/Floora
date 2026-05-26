-- Duplicates a project and all its estimating data.
--
-- Copied:   project, takeoffs + project_takeoff rows,
--           estimates + estimate_items (parent_item_id remapped) +
--           estimate_wet_areas + swms (reset to draft)
--
-- Skipped:  drawings / drawing_pages / takeoff_items (canvas + files),
--           project_documents (files), actual_groups / actual_line_items,
--           quotes, tasks, price_requests
--
-- Returns the new project UUID.

create or replace function duplicate_project(
  p_project_id uuid,
  p_new_name    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id        uuid := auth.uid();
  v_org_id           uuid;
  v_new_project_id   uuid;

  -- takeoff ID remap  old_uuid::text → new_uuid::text
  v_takeoff_map      jsonb := '{}'::jsonb;
  v_old_takeoff_id   uuid;
  v_new_takeoff_id   uuid;

  -- estimate loop
  v_old_estimate_id  uuid;
  v_new_estimate_id  uuid;
begin
  -- ── Auth ──────────────────────────────────────────────────────────────────
  select p.organization_id into v_org_id
  from   projects p
  join   organization_members om on om.organization_id = p.organization_id
  where  p.id = p_project_id
    and  om.user_id = v_caller_id
  limit  1;

  if v_org_id is null then
    raise exception 'Project not found or access denied';
  end if;

  -- ── Project ───────────────────────────────────────────────────────────────
  insert into projects (
    organization_id, created_by,
    name, location, head_client, status, brand, notes,
    start_date, end_date,
    retention_pct, retention_released,
    admin_fee_estimated_cost
  )
  select
    organization_id, v_caller_id,
    p_new_name, location, head_client, 'active', brand, notes,
    start_date, end_date,
    retention_pct, 0,          -- reset accumulated retention
    admin_fee_estimated_cost
  from projects
  where id = p_project_id
  returning id into v_new_project_id;

  -- ── Takeoffs ──────────────────────────────────────────────────────────────
  for v_old_takeoff_id in
    select id from takeoffs
    where  project_id = p_project_id
    order  by sort_order
  loop
    insert into takeoffs (project_id, name, sort_order, created_by)
    select v_new_project_id, name, sort_order, v_caller_id
    from   takeoffs
    where  id = v_old_takeoff_id
    returning id into v_new_takeoff_id;

    -- Build mapping so estimates can remap source_takeoff_id
    v_takeoff_map := v_takeoff_map
      || jsonb_build_object(v_old_takeoff_id::text, v_new_takeoff_id::text);

    insert into project_takeoff (
      takeoff_id, created_by, sort_order,
      scope_category, finish_code, description,
      manufacturer, colour, location, level, product_type,
      qty, unit, notes, waste_pct,
      parent_finish_code, cove_height_mm
    )
    select
      v_new_takeoff_id, v_caller_id, sort_order,
      scope_category, finish_code, description,
      manufacturer, colour, location, level, product_type,
      qty, unit, notes, waste_pct,
      parent_finish_code, cove_height_mm
    from project_takeoff
    where takeoff_id = v_old_takeoff_id;
  end loop;

  -- ── Estimates ─────────────────────────────────────────────────────────────
  for v_old_estimate_id in
    select id from estimates
    where  project_id = p_project_id
    order  by created_at
  loop
    insert into estimates (
      project_id, name, description, status, created_by,
      source_takeoff_id,
      accounting_rate, admin_rate, net_markup_pct,
      freight, accommodation, travel_allowance, bailing_fee,
      floor_prep_area, floor_prep_depth_mm,
      floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag
    )
    select
      v_new_project_id, name, description, 'draft', v_caller_id,
      -- remap source_takeoff_id to the new takeoff; NULL if not found
      case when source_takeoff_id is not null
           then (v_takeoff_map ->> source_takeoff_id::text)::uuid
           else null end,
      accounting_rate, admin_rate, net_markup_pct,
      freight, accommodation, travel_allowance, bailing_fee,
      floor_prep_area, floor_prep_depth_mm,
      floor_prep_charge_per_bag, floor_prep_mat_per_bag, floor_prep_lab_per_bag
    from estimates
    where id = v_old_estimate_id
    returning id into v_new_estimate_id;

    -- Wet areas ──────────────────────────────────────────────────────────────
    insert into estimate_wet_areas (
      estimate_id, sort_order, name,
      floor_sqm, wall_semi_sqm, wall_full_sqm, coving_lm, qty, charge
    )
    select
      v_new_estimate_id, sort_order, name,
      floor_sqm, wall_semi_sqm, wall_full_sqm, coving_lm, qty, charge
    from estimate_wet_areas
    where estimate_id = v_old_estimate_id;

    -- Estimate items (with parent_item_id remapping) ──────────────────────────
    -- Build a fresh ID map for this estimate's items.
    -- DROP IF EXISTS guards against the edge case where a previous iteration
    -- failed mid-way and left the table behind inside the same transaction.
    drop table if exists _item_map;
    create temp table _item_map (
      old_id uuid primary key,
      new_id uuid not null default gen_random_uuid()
    );

    insert into _item_map (old_id)
    select id from estimate_items where estimate_id = v_old_estimate_id;

    -- Insert all items; parent_item_id is NULL for now (fixed below)
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
    where ei.estimate_id = v_old_estimate_id;

    -- Wire up parent_item_id: for every child item that had a parent,
    -- point it at the new parent's ID using the map.
    update estimate_items new_ei
    set    parent_item_id = parent_map.new_id
    from   _item_map child_map
    join   estimate_items orig on orig.id = child_map.old_id
                               and orig.estimate_id = v_old_estimate_id
                               and orig.parent_item_id is not null
    join   _item_map parent_map on parent_map.old_id = orig.parent_item_id
    where  new_ei.id = child_map.new_id;

    drop table _item_map;

    -- SWMS (reset version + status; keep all content) ────────────────────────
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
      1, null, 'draft',          -- reset version, clear doc number, back to draft
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
    where estimate_id = v_old_estimate_id;

  end loop;

  return v_new_project_id;
end;
$$;

-- Grant execute to authenticated users (RLS enforced inside the function)
grant execute on function duplicate_project(uuid, text) to authenticated;
