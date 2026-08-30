-- LOCAL PREPARATION ONLY. Run only after separate authorization, after the
-- unique production owner is linked to Supabase Auth, and after every legacy
-- active role (including read_only) has been audited and deactivated.

do $$
declare
  strict_owner_count integer;
begin
  select count(*)
  into strict_owner_count
  from public.admin_users
  where role = 'owner'
    and is_owner is true
    and is_active is true
    and auth_user_id is not null;

  if strict_owner_count <> 1 then
    raise exception 'Phase B requires exactly one active strict owner linked to Supabase Auth';
  end if;

  if exists (
    select 1 from public.admin_users
    where is_active is true
      and (
        role is null
        or role not in ('owner', 'housekeeping')
      )
  ) then
    raise exception 'Phase B requires every legacy non-product role to be inactive';
  end if;

  if exists (
    select 1 from public.admin_users
    where is_active is true
      and auth_user_id is null
  ) then
    raise exception 'Phase B requires every active profile to be linked to Supabase Auth';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'admin_users_active_role_allowed'
      and conrelid = 'public.admin_users'::regclass
  ) then
    alter table public.admin_users
      add constraint admin_users_active_role_allowed
      check (
        is_active is not true
        or (role is not null and role in ('owner', 'housekeeping'))
      ) not valid;
  end if;
end;
$$;

alter table public.admin_users
  validate constraint admin_users_active_role_allowed;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'admin_users_active_auth_required'
      and conrelid = 'public.admin_users'::regclass
  ) then
    alter table public.admin_users
      add constraint admin_users_active_auth_required
      check (is_active is not true or auth_user_id is not null) not valid;
  end if;
end;
$$;

alter table public.admin_users validate constraint admin_users_active_auth_required;

alter table public.admin_users
  validate constraint admin_users_auth_user_fk;

-- Remove the temporary email fallback from direct-database owner policies.
create or replace function public.is_v4_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.auth_user_id = auth.uid()
      and au.role = 'owner'
      and au.is_owner is true
      and au.is_active is true
  );
$$;

-- The matching frontend and Netlify code is already deployed at this point:
-- public booking submission and calendar export no longer need anonymous
-- full-row reads from booking_requests.
revoke select on table public.booking_requests from anon;

-- Inactive historical profiles and the historical permissions column remain
-- intact. No ownership-transfer function is created by this migration.
