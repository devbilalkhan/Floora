-- Optional estimated cost basis for admin fee calculation
-- null = use actual total expenses as the base
alter table projects
  add column if not exists admin_fee_estimated_cost numeric(12,2);
