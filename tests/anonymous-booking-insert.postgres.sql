-- LOCAL DISPOSABLE POSTGRESQL ONLY; never run on Supabase or an application database.
-- psql -X -h 127.0.0.1 -d auth02_booking_insert_test -f tests/anonymous-booking-insert.postgres.sql
-- Requires an empty database and a superuser on a disposable cluster.
-- Everything, including fixture roles, rolls back. No real customer data.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if current_database() <> 'auth02_booking_insert_test'
     or to_regclass('public.booking_requests') is not null then
    raise exception 'Requires an empty disposable auth02_booking_insert_test database';
  end if;
end $$;
create role anon;
create role authenticated;
create role service_role;
grant usage on schema public to anon, authenticated, service_role;
create table public.booking_requests (
  id uuid primary key default gen_random_uuid(), source text default 'website',
  status text, start_date date, end_date date,
  guest_first_name text, guest_last_name text, guest_email text, guest_phone text,
  adults_count integer, children_count integer, children_ages text,
  baby_bed_needed boolean, marketing_consent boolean, marketing_consent_at timestamptz,
  nights integer, estimated_total numeric, message text, contract_accepted boolean,
  contract_accepted_at timestamptz, contract_version text, contract_url text
);
create table public.calendar_blocks (id uuid, start_date date, end_date date);
create table public.external_occupancies (
  id uuid, source text, start_date date, end_date date, is_current boolean
);
\ir ../supabase/migrations/202608270001_add_public_rate_limits.sql
\ir ../supabase/migrations/202609010001_v47a_atomic_direct_bookings.sql
alter table public.booking_requests enable row level security;
grant select, insert, update, delete on public.booking_requests to anon, authenticated, service_role;
create policy "Allow public insert booking requests" on public.booking_requests
  for insert to anon with check (true);
create policy "fixture authenticated access" on public.booking_requests
  for all to authenticated using (true) with check (true);

-- Reproduce the old bypass before applying the fix.
set local role anon;
insert into public.booking_requests (status, start_date, end_date)
values ('refused', '2035-01-10', '2035-01-15');
reset role;

\ir ../supabase/migrations/202609030001_revoke_anon_booking_insert.sql
\ir ../supabase/migrations/202609030001_revoke_anon_booking_insert.sql

do $$ begin
  if has_table_privilege('anon', 'public.booking_requests', 'INSERT') then
    raise exception 'Anonymous INSERT still granted';
  end if;
  if exists (select 1 from pg_policies where schemaname='public'
    and tablename='booking_requests' and policyname='Allow public insert booking requests') then
    raise exception 'Legacy INSERT policy still present';
  end if;
  if not (has_table_privilege('anon', 'public.booking_requests', 'SELECT')
    and has_table_privilege('anon', 'public.booking_requests', 'UPDATE')
    and has_table_privilege('anon', 'public.booking_requests', 'DELETE')
    and has_table_privilege('authenticated', 'public.booking_requests', 'INSERT')
    and has_table_privilege('service_role', 'public.booking_requests', 'INSERT')) then
    raise exception 'Unrelated grants changed';
  end if;
  if has_function_privilege('anon', 'public.create_public_booking_request_atomic(jsonb,text,timestamptz)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.create_public_booking_request_atomic(jsonb,text,timestamptz)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.create_public_booking_request_atomic(jsonb,text,timestamptz)', 'EXECUTE') then
    raise exception 'Incorrect atomic RPC grants';
  end if;
end $$;

set local role anon;
do $$ begin
  begin
    insert into public.booking_requests (status) values ('paid');
    raise exception 'Anonymous direct insertion succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_public_booking_request_atomic('{}', repeat('a',64));
    raise exception 'Anonymous RPC call succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin
    perform public.create_public_booking_request_atomic('{}', repeat('b',64));
    raise exception 'Authenticated RPC call succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role service_role;
do $$ declare result record; begin
  select * into result from public.create_public_booking_request_atomic(
    '{"start_date":"2035-01-10","end_date":"2035-01-15","nights":5}', repeat('c',64));
  if result.outcome is distinct from 'created' or result.booking_id is null then
    raise exception 'Secure service-role booking creation failed';
  end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.booking_requests) <> 2
    or not exists (select 1 from public.booking_requests where status='pending' and source='website') then
    raise exception 'Unexpected booking state after permission tests';
  end if;
end $$;
rollback;
