-- LOCAL PREPARATION ONLY. Do not run without a fresh production read-only
-- audit, a backup, a reviewed maintenance plan, and explicit authorization.
--
-- Phase A is additive and intentionally compatible with the audited legacy
-- rows: one active read_only profile and one active owner without auth_user_id.
-- It adds no speculative business or external-enrichment column.

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
    select 1 from pg_catalog.pg_constraint
    where conname = 'admin_users_owner_coherent'
      and conrelid = 'public.admin_users'::regclass
  ) then
    alter table public.admin_users
      add constraint admin_users_owner_coherent
      check ((role = 'owner') is not distinct from (is_owner is true)) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'admin_users_owner_active'
      and conrelid = 'public.admin_users'::regclass
  ) then
    alter table public.admin_users
      add constraint admin_users_owner_active
      check (role is distinct from 'owner' or is_active is true) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
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

-- These two checks are compatible with the audited rows and can be validated
-- independently of the read_only deactivation and owner Auth repair.
alter table public.admin_users validate constraint admin_users_owner_coherent;
alter table public.admin_users validate constraint admin_users_owner_active;

-- Final active-role and active-Auth constraints are deferred to Phase B.
-- This keeps Phase A compatible with the legacy user-management function
-- until the fixed-role owner/housekeeping code has been deployed.

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

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
    where au.role = 'owner'
      and au.is_owner is true
      and au.is_active is true
      and (
        au.auth_user_id = auth.uid()
        or (
          au.auth_user_id is null
          and lower(au.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          and 1 = (
            select count(*)
            from public.admin_users owner_candidate
            where owner_candidate.role = 'owner'
              and owner_candidate.is_owner is true
              and owner_candidate.is_active is true
          )
        )
      )
  );
$$;

revoke all on function public.is_v4_owner() from public, anon;
grant execute on function public.is_v4_owner() to authenticated, service_role;

-- The owner dashboard still uses authenticated direct reads in V4. These
-- policies preserve that path while a RESTRICTIVE policy prevents any other
-- authenticated profile, including housekeeping, from benefiting from an
-- older permissive policy. Required anonymous insert/review/visit policies are
-- otherwise left intact.
do $$
declare
  target_table_name text;
  protected_tables constant text[] := array[
    'booking_requests', 'customers', 'payments', 'booking_events',
    'email_logs', 'guest_reviews', 'site_visits', 'reservations',
    'stripe_payouts', 'stripe_balance_transactions', 'refunds',
    'external_reservation_clients', 'external_calendar_actions', 'calendar_blocks',
    'pricing_settings', 'season_prices', 'price_overrides'
  ];
begin
  foreach target_table_name in array protected_tables loop
    if to_regclass(format('public.%I', target_table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', target_table_name);

    if not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = target_table_name
        and policyname = 'v4_owner_authenticated_access'
    ) then
      execute format(
        'create policy v4_owner_authenticated_access on public.%I as permissive for all to authenticated using (public.is_v4_owner()) with check (public.is_v4_owner())',
        target_table_name
      );
    end if;

    if not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = target_table_name
        and policyname = 'v4_internal_role_boundary'
    ) then
      execute format(
        'create policy v4_internal_role_boundary on public.%I as restrictive for all to authenticated using (public.is_v4_owner()) with check (public.is_v4_owner())',
        target_table_name
      );
    end if;
  end loop;
end;
$$;

comment on table public.admin_users is
  'V4 authority source. Active product roles are owner and housekeeping; historical permissions are ignored by application authorization.';
