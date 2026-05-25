-- Add admin_fee_pct to projects for auto-calculated admin & other fee
-- null = no admin fee; value = percentage of total expenses
alter table projects
  add column if not exists admin_fee_pct numeric(5,2);
