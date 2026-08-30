-- OBSOLETE: archived after adoption of the owner + housekeeping model.
-- Apply only after 202608270002, the controlled owner repair, and every
-- post-write check in docs/operations/admin-users-owner-repair.md.

do $$
begin
  if exists (
    select 1
    from public.admin_users
    where not public.admin_permissions_are_valid(permissions::jsonb, permission_mode)
  ) then
    raise exception 'admin_users still contains invalid permission data';
  end if;

  if exists (select 1 from public.admin_users where auth_user_id is null) then
    raise exception 'Every admin_users profile must be linked to Supabase Auth before finalization';
  end if;
end;
$$;

alter table public.admin_users
  add constraint admin_users_permissions_valid
  check (public.admin_permissions_are_valid(permissions::jsonb, permission_mode)) not valid;

alter table public.admin_users validate constraint admin_users_permissions_valid;
alter table public.admin_users validate constraint admin_users_auth_user_fk;

alter table public.admin_users
  alter column permissions set default '[]',
  alter column permissions set not null,
  alter column auth_user_id set not null;
