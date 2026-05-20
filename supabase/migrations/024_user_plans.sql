-- ── 024: User Plans ────────────────────────────────────────────────────────────
--
-- Tracks the subscription plan for each account owner (the user who pays).
-- One row per paying user. org_limit controls how many orgs they can admin.
--
-- Plans:
--   basic      → 2 orgs  (default)
--   pro        → 5 orgs
--   enterprise → unlimited (-1)
--
-- Superadmins bypass all limits — enforced in application code.

create table user_plans (
  user_id             uuid        primary key references profiles(id) on delete cascade,
  plan                text        not null default 'basic'
                                  check (plan in ('basic', 'pro', 'enterprise')),
  org_limit           int         not null default 2,
  stripe_customer_id  text,
  stripe_sub_id       text,
  status              text        not null default 'trial'
                                  check (status in ('trial', 'active', 'cancelled')),
  trial_ends_at       timestamptz not null default now() + interval '14 days',
  created_at          timestamptz default now()
);

alter table user_plans enable row level security;

-- Users can read their own plan; superadmin can read all.
create policy "read own plan" on user_plans for select
  using (auth.uid() = user_id or is_superadmin());

-- Only superadmin or service role can insert/update/delete plans.
create policy "superadmin manage plans" on user_plans for all
  using (is_superadmin());
