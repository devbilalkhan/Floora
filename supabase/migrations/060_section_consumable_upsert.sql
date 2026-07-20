-- ── 060: Prevent duplicate section-level consumable rows ────────────────────
-- syncSectionConsumables() (Glue Sheet/Plank, Feather Finish 20kg, Feather
-- Finish Labour) previously did a SELECT to check for an existing row, then
-- INSERTed if none was found. Two overlapping calls for the same
-- estimate/scope (rapid qty edits, a retried request) could both pass the
-- SELECT before either INSERT landed, producing duplicate rows. This adds a
-- partial unique index plus an atomic upsert RPC so the insert-or-update
-- decision happens inside a single statement instead of split across a
-- read and a write.

create unique index if not exists uq_estimate_items_section_consumable
  on estimate_items (estimate_id, scope_category, description)
  where is_auto = true and parent_item_id is null and type = 'consumable';

create or replace function upsert_section_consumable(
  p_estimate_id    uuid,
  p_scope_category text,
  p_description    text,
  p_qty            numeric,
  p_sort_order     int,
  p_unit           text,
  p_mat_rate       numeric,
  p_lab_rate       numeric,
  p_coverage_m2    numeric
) returns estimate_items
language plpgsql
as $$
declare
  result estimate_items;
begin
  insert into estimate_items (
    estimate_id, parent_item_id, scope_category, type, description,
    qty, sort_order, unit, mat_rate, lab_rate, coverage_m2, is_auto, waste_pct
  ) values (
    p_estimate_id, null, p_scope_category, 'consumable', p_description,
    p_qty, p_sort_order, p_unit, p_mat_rate, p_lab_rate, p_coverage_m2, true, 0
  )
  on conflict (estimate_id, scope_category, description)
    where is_auto = true and parent_item_id is null and type = 'consumable'
  do update set qty = excluded.qty
  returning * into result;

  return result;
end;
$$;

-- Server actions call this via the service-role client (see createAuthedClient
-- in lib/supabase/server.ts). Access is gated up front by assertEstimateAccess()
-- using the RLS-respecting client, so this RPC is intentionally restricted to
-- service_role rather than granted to authenticated/anon.
revoke execute on function upsert_section_consumable(
  uuid, text, text, numeric, int, text, numeric, numeric, numeric
) from public;
grant execute on function upsert_section_consumable(
  uuid, text, text, numeric, int, text, numeric, numeric, numeric
) to service_role;
