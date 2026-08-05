-- ── 065: Consolidate legacy per-item Glue Carpet rows into section-level ────
--
-- Carpet glue is now consolidated at section level (like vinyl's Glue Sheet/
-- Plank), so a drum isn't rounded up separately for every carpet row in an
-- estimate. Existing estimates still have the old per-item "Glue Carpet"
-- consumables from before this change; left alone, the next qty edit would
-- create a new section-level row alongside them and double-count glue.
--
-- For each estimate with legacy item-level Glue Carpet rows, this replaces
-- them with a single section-level row sized off the estimate's total carpet
-- area (matching what a fresh section sync would produce). One estimate
-- ("Post House Motel, Goulburn", 2b0d287d-56d1-44f3-8fdc-d0cabb9cb406) has a
-- manually-corrected Glue Carpet qty and is excluded — left for manual
-- review so the correction isn't silently discarded.
--
-- Idempotent: re-running finds no remaining item-level Glue Carpet rows and
-- is a no-op.

with targets as (
  select ei.estimate_id,
         (array_agg(ei.mat_rate))[1] as mat_rate
  from estimate_items ei
  where ei.description = 'Glue Carpet'
    and ei.is_auto = true
    and ei.parent_item_id is not null
    and ei.estimate_id <> '2b0d287d-56d1-44f3-8fdc-d0cabb9cb406'
  group by ei.estimate_id
),
areas as (
  select estimate_id, sum(qty) as total_area
  from estimate_items
  where type = 'primary'
    and scope_category = 'carpet'
    and estimate_id in (select estimate_id from targets)
  group by estimate_id
),
deleted as (
  delete from estimate_items
  where description = 'Glue Carpet'
    and is_auto = true
    and parent_item_id is not null
    and estimate_id in (select estimate_id from targets)
  returning estimate_id
)
insert into estimate_items (
  estimate_id, parent_item_id, scope_category, type, description,
  qty, sort_order, unit, mat_rate, lab_rate, coverage_m2, is_auto, waste_pct
)
select
  t.estimate_id, null, 'carpet', 'consumable', 'Glue Carpet',
  ceil(a.total_area / 70.0), 9000, 'drum', t.mat_rate, 0, 70, true, 0
from targets t
join areas a on a.estimate_id = t.estimate_id;
