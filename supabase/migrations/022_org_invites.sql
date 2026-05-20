-- Invite-only access: pending invitations for org members
create table if not exists org_invites (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references organizations(id) on delete cascade,
  email       text        not null,
  role        org_role    not null default 'estimator',
  invited_by  uuid        not null references profiles(id),
  status      text        not null default 'pending'
                          check (status in ('pending', 'accepted', 'expired')),
  expires_at  timestamptz not null default now() + interval '7 days',
  created_at  timestamptz default now()
);

-- At most one pending invite per org + email
create unique index if not exists org_invites_one_pending
  on org_invites(org_id, email)
  where status = 'pending';

alter table org_invites enable row level security;

create policy "org admins read invites"
  on org_invites for select
  using (is_superadmin() or user_org_role(org_id) = 'admin');

create policy "org admins create invites"
  on org_invites for insert
  with check (is_superadmin() or user_org_role(org_id) = 'admin');

create policy "org admins update invites"
  on org_invites for update
  using (is_superadmin() or user_org_role(org_id) = 'admin');

create policy "org admins delete invites"
  on org_invites for delete
  using (is_superadmin() or user_org_role(org_id) = 'admin');
