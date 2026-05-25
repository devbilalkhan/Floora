-- Superadmins should always resolve to 'admin' in user_project_role and
-- user_org_role, regardless of their organization_members row. Without this,
-- a superadmin with an 'estimator' membership row gets locked out of
-- admin-gated UI sections (e.g. Actuals).

create or replace function user_project_role(proj_id uuid)
returns text language sql security definer stable as $$
  select case
    when is_superadmin() then 'admin'
    else (
      select om.role::text
      from projects p
      join organization_members om on om.organization_id = p.organization_id
      where p.id = proj_id and om.user_id = auth.uid()
      limit 1
    )
  end
$$;

create or replace function user_org_role(org_id uuid)
returns text language sql security definer stable as $$
  select case
    when is_superadmin() then 'admin'
    else (
      select role::text
      from organization_members
      where organization_id = org_id and user_id = auth.uid()
      limit 1
    )
  end
$$;
