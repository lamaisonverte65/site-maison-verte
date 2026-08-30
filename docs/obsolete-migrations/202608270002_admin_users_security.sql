-- OBSOLETE: archived after adoption of the owner + housekeeping model.
-- Prepared locally after the read-only production audit. Do not apply without
-- a fresh catalog/data backup review and explicit production authorization.

alter table public.admin_users
  add column if not exists permission_mode text;

-- Preserve the behavior of every legacy profile. Empty arrays inherited role
-- defaults; non-empty arrays were custom. System roles stay in role mode.
update public.admin_users
set permission_mode = case
  when role in ('owner', 'housekeeping') then 'role'
  when jsonb_typeof(permissions::jsonb) = 'array'
       and jsonb_array_length(permissions::jsonb) = 0 then 'role'
  when jsonb_typeof(permissions::jsonb) = 'array'
       and jsonb_array_length(permissions::jsonb) > 0 then 'custom'
  else null
end
where permission_mode is null;

do $$
begin
  if exists (select 1 from public.admin_users where permission_mode is null) then
    raise exception 'admin_users contains a legacy permission value that cannot be migrated safely';
  end if;
end;
$$;

alter table public.admin_users
  alter column permission_mode set default 'role',
  alter column permission_mode set not null;

create or replace function public.admin_permissions_are_valid(
  p_permissions jsonb,
  p_mode text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_permissions) <> 'array' then false
    when p_mode = 'role' then true
    when p_mode = 'none' then jsonb_array_length(p_permissions) = 0
    when p_mode = 'custom' then
      jsonb_array_length(p_permissions) > 0
      and not exists (
        select 1
        from jsonb_array_elements_text(p_permissions) as item(permission)
        where permission not in (
          'view:requests', 'view:reservations', 'view:calendar',
          'view:pricing', 'view:customers', 'view:crm',
          'view:payments', 'view:communication', 'view:stripe_payouts',
          'view:reviews', 'view:visits', 'view:summary', 'view:users',
          'manage:reservations', 'manage:customers', 'manage:payments',
          'manage:communication', 'manage:reviews', 'manage:calendar',
          'manage:pricing', 'manage:settings', 'manage:users',
          'contact:email', 'contact:phone', 'contact:sms'
        )
      )
    else false
  end;
$$;

revoke all on function public.admin_permissions_are_valid(jsonb, text) from public, anon, authenticated;

alter table public.admin_users
  add constraint admin_users_role_allowed
    check (role in ('owner', 'admin', 'manager', 'read_only', 'housekeeping')) not valid,
  add constraint admin_users_permission_mode_allowed
    check (permission_mode in ('role', 'custom', 'none')) not valid,
  add constraint admin_users_owner_coherent
    check ((role = 'owner') = (is_owner is true)) not valid,
  add constraint admin_users_system_role_mode
    check (role not in ('owner', 'housekeeping') or permission_mode = 'role') not valid;

alter table public.admin_users validate constraint admin_users_role_allowed;
alter table public.admin_users validate constraint admin_users_permission_mode_allowed;
alter table public.admin_users validate constraint admin_users_owner_coherent;
alter table public.admin_users validate constraint admin_users_system_role_mode;
-- The permissions constraint is added only by the finalization migration,
-- after the audited owner repair and its rollback window. A NOT VALID check
-- would still reject a rollback update restoring the saved legacy {} value.

create unique index if not exists admin_users_email_normalized_key
  on public.admin_users (lower(email));

create unique index if not exists admin_users_auth_user_id_key
  on public.admin_users (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists admin_users_single_owner_key
  on public.admin_users ((is_owner))
  where is_owner is true;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'admin_users_auth_user_fk'
      and conrelid = 'public.admin_users'::regclass
  ) then
    alter table public.admin_users
      add constraint admin_users_auth_user_fk
      foreign key (auth_user_id) references auth.users(id)
      on update restrict on delete restrict not valid;
  end if;
end;
$$;

create or replace function public.transfer_admin_ownership(
  p_expected_owner_id uuid,
  p_expected_owner_auth_user_id uuid,
  p_target_id uuid
)
returns table (
  previous_owner_id uuid,
  previous_owner_auth_user_id uuid,
  previous_owner_role text,
  previous_owner_display_name text,
  new_owner_id uuid,
  new_owner_auth_user_id uuid,
  new_owner_role text,
  new_owner_display_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_owner public.admin_users%rowtype;
  target public.admin_users%rowtype;
  owner_count integer;
begin
  if p_expected_owner_id is null
     or p_expected_owner_auth_user_id is null
     or p_target_id is null then
    raise exception 'Expected owner and target identifiers are required';
  end if;

  -- Lock every owner candidate before counting so concurrent transfers cannot
  -- both validate the same state.
  perform id
  from public.admin_users
  where role = 'owner' or is_owner is true
  for update;

  select count(*)
  into owner_count
  from public.admin_users
  where role = 'owner' or is_owner is true;

  if owner_count <> 1 then
    raise exception 'Exactly one current owner is required';
  end if;

  select *
  into strict current_owner
  from public.admin_users
  where role = 'owner' and is_owner is true
  for update;

  if current_owner.id <> p_expected_owner_id
     or current_owner.auth_user_id is null
     or current_owner.auth_user_id <> p_expected_owner_auth_user_id
     or current_owner.is_active is not true then
    raise exception 'Expected owner identity no longer matches current state';
  end if;

  select *
  into strict target
  from public.admin_users
  where id = p_target_id
  for update;

  if target.id = current_owner.id
     or target.is_active is not true
     or target.role = 'owner'
     or target.is_owner is true
     or target.auth_user_id is null then
    raise exception 'Ownership target is invalid';
  end if;

  update public.admin_users
  set role = 'admin',
      is_owner = false,
      permission_mode = 'role',
      permissions = '[]',
      updated_at = now()
  where id = current_owner.id;

  update public.admin_users
  set role = 'owner',
      is_owner = true,
      permission_mode = 'role',
      permissions = '[]',
      updated_at = now()
  where id = target.id;

  return query
  select
    current_owner.id,
    current_owner.auth_user_id,
    'admin'::text,
    current_owner.display_name,
    target.id,
    target.auth_user_id,
    'owner'::text,
    target.display_name;
end;
$$;

revoke all on function public.transfer_admin_ownership(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_admin_ownership(uuid, uuid, uuid) to service_role;

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;
