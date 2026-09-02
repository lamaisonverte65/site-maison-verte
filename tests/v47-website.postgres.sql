-- Integration regression: psql -v ON_ERROR_STOP=1 -d v47_website_test -f tests/v47-website.postgres.sql
-- LOCAL DISPOSABLE DATABASE ONLY. Never run against an existing application database.
-- The fixture reproduces the observed source DEFAULT; all test objects roll back.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if current_database() <> 'v47_website_test' or to_regclass('public.booking_requests') is not null then
    raise exception 'Requires an empty disposable v47_website_test database';
  end if;
end $$;
create role anon;
create role authenticated;
create role service_role;
create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  source text default 'website', status text, start_date date, end_date date,
  guest_first_name text, guest_last_name text, guest_email text, guest_phone text,
  adults_count integer, children_count integer, children_ages text,
  baby_bed_needed boolean, marketing_consent boolean, marketing_consent_at timestamptz,
  nights integer, estimated_total numeric, message text, contract_accepted boolean,
  contract_accepted_at timestamptz, contract_version text, contract_url text
);
create table public.calendar_blocks (id uuid primary key default gen_random_uuid(), start_date date, end_date date);
create table public.external_occupancies (
  id uuid primary key default gen_random_uuid(), source text not null,
  external_uid text not null, start_date date not null, end_date date not null,
  is_current boolean not null default true, unique(source, external_uid)
);
-- Historical website/refused must not prevent migration or block dates.
insert into public.booking_requests(status, start_date, end_date)
values ('refused', '2030-01-10', '2030-01-15');
\ir ../supabase/migrations/202608270001_add_public_rate_limits.sql
\ir ../supabase/migrations/202609010001_v47a_atomic_direct_bookings.sql
\ir ../supabase/migrations/202609010002_v47b_external_occupancy_conflicts.sql

do $$
declare result record;
begin
  select * into result from public.create_public_booking_request_atomic(
    jsonb_build_object('start_date','2030-01-10','end_date','2030-01-15'), repeat('a',64));
  if result.outcome <> 'created' or result.booking_id is null then
    raise exception 'website/refused incorrectly blocked RPC: %', result.outcome;
  end if;
  if not exists (select 1 from public.booking_requests where id=result.booking_id and source='website' and status='pending') then
    raise exception 'Public INSERT did not preserve website DEFAULT';
  end if;
  select * into result from public.create_public_booking_request_atomic(
    jsonb_build_object('start_date','2030-01-12','end_date','2030-01-16'), repeat('b',64));
  if result.outcome <> 'date_conflict' or result.booking_id is not null then
    raise exception 'website/pending did not block RPC: %', result.outcome;
  end if;
  if exists (select 1 from public.public_rate_limits where key_hash=repeat('b',64)) then
    raise exception 'Rejected overlap consumed a duplicate claim';
  end if;
  begin
    insert into public.booking_requests(status,start_date,end_date)
    values ('confirmed','2030-01-11','2030-01-14');
    raise exception 'Exclusion did not protect website INSERT';
  exception when exclusion_violation then null;
  end;
  begin
    update public.booking_requests set status='accepted' where status='refused';
    raise exception 'Exclusion did not protect website status transition';
  exception when exclusion_violation then null;
  end;
  select * into result from public.create_public_booking_request_atomic(
    jsonb_build_object('start_date','2030-01-15','end_date','2030-01-18'), repeat('c',64));
  if result.outcome <> 'created' then raise exception 'Adjacent website request rejected'; end if;
end $$;

-- V4.7-B: real overlaps against website are detected; refused and technical events are not.
insert into public.booking_requests(status,start_date,end_date)
values ('refused','2030-02-10','2030-02-15');
insert into public.external_occupancies(source,external_uid,start_date,end_date) values
 ('booking','real-booking','2030-01-11','2030-01-14'),
 ('airbnb','real-airbnb','2030-01-11','2030-01-14'),
 ('booking','technical-booking','2030-01-11','2030-01-12'),
 ('airbnb','technical-airbnb','2030-01-11','2030-01-12'),
 ('booking','refused-only','2030-02-11','2030-02-14');
select * from public.reconcile_external_occupancy_conflicts('booking');
select * from public.reconcile_external_occupancy_conflicts('airbnb');
do $$ begin
  if (select count(*) from public.external_occupancy_conflicts) <> 2
     or exists (select 1 from public.external_occupancy_conflicts where external_uid not in ('real-booking','real-airbnb')) then
    raise exception 'Expected only the two multi-night conflicts against website/pending';
  end if;
end $$;

-- Both providers: one-night rows allow creation; multi-night rows still block the RPC.
do $$
declare provider text; result record; month_number integer := 3; period_start date;
begin
  foreach provider in array array['booking','airbnb'] loop
    period_start := make_date(2030,month_number,10);
    insert into public.external_occupancies(source,external_uid,start_date,end_date)
    values(provider,provider || '-rpc-technical',period_start+1,period_start+2);
    select * into result from public.create_public_booking_request_atomic(
      jsonb_build_object('start_date',period_start,'end_date',period_start+5),md5(provider || '-one') || md5(provider || '-one'));
    if result.outcome <> 'created' then raise exception '% one-night row blocked RPC',provider; end if;
    period_start := make_date(2030,month_number+1,10);
    insert into public.external_occupancies(source,external_uid,start_date,end_date)
    values(provider,provider || '-rpc-real',period_start+1,period_start+3);
    select * into result from public.create_public_booking_request_atomic(
      jsonb_build_object('start_date',period_start,'end_date',period_start+5),md5(provider || '-multi') || md5(provider || '-multi'));
    if result.outcome <> 'date_conflict' then raise exception '% multi-night row did not block RPC',provider; end if;
    month_number := month_number+2;
  end loop;
end $$;
select 'PASS: website default, refused, exclusion, RPC, adjacency, V4.7-B and one-night rules' as result;
rollback;
