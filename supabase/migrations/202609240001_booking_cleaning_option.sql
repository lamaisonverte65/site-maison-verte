-- V4.8: configurable cleaning fee, booking cleaning choice/consent,
-- and lightweight follow-up for unpaid cleaning not performed by the guest.
--
-- This migration does not change historical booking totals.
-- pricing_settings.cleaning_fee is the current configurable price.
-- booking_requests.cleaning_fee is the historical cleaning tariff proposed
-- for the booking, whether or not the guest selected the cleaning option.
--
-- Application code must keep estimated_total / owner_price as global totals:
-- the cleaning fee is included only when cleaning_option = true.

alter table public.pricing_settings
  add column if not exists cleaning_fee numeric not null default 50;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pricing_settings_cleaning_fee_nonnegative'
      and conrelid = 'public.pricing_settings'::regclass
  ) then
    alter table public.pricing_settings
      add constraint pricing_settings_cleaning_fee_nonnegative
      check (cleaning_fee >= 0);
  end if;
end;
$$;

comment on column public.pricing_settings.cleaning_fee is
  'Current configurable end-of-stay cleaning fee used for new bookings.';

alter table public.booking_requests
  add column if not exists cleaning_option boolean not null default false,
  add column if not exists cleaning_fee integer not null default 0,
  add column if not exists cleaning_obligations_accepted_at timestamptz,
  add column if not exists cleaning_obligations_version text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_requests_cleaning_fee_nonnegative'
      and conrelid = 'public.booking_requests'::regclass
  ) then
    alter table public.booking_requests
      add constraint booking_requests_cleaning_fee_nonnegative
      check (cleaning_fee >= 0);
  end if;
end;
$$;

comment on column public.booking_requests.cleaning_option is
  'Whether the guest selected the end-of-stay cleaning option for this booking.';

comment on column public.booking_requests.cleaning_fee is
  'Historical cleaning tariff proposed for this booking, preserved even when the guest declined the option.';

comment on column public.booking_requests.cleaning_obligations_accepted_at is
  'Timestamp of the guest explicit acceptance of cleaning obligations when the cleaning option was declined.';

comment on column public.booking_requests.cleaning_obligations_version is
  'Version of the cleaning-obligations text explicitly accepted when the cleaning option was declined.';

create table if not exists public.booking_cleaning_issues (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete cascade,
  reported_at timestamptz not null default now(),
  reported_by text,
  status text not null default 'reported',
  amount_due integer not null,
  notes text,
  payment_requested_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_cleaning_issues_booking_unique unique (booking_request_id),
  constraint booking_cleaning_issues_status_check
    check (status in ('reported', 'confirmed', 'payment_requested', 'paid', 'cancelled')),
  constraint booking_cleaning_issues_amount_nonnegative
    check (amount_due >= 0)
);

-- Security: align the new internal table with the owner-only V4 model.
alter table public.booking_cleaning_issues enable row level security;

drop policy if exists "v4_internal_role_boundary" on public.booking_cleaning_issues;
create policy "v4_internal_role_boundary"
on public.booking_cleaning_issues
as restrictive
for all
to authenticated
using (public.is_v4_owner())
with check (public.is_v4_owner());

drop policy if exists "v4_owner_authenticated_access" on public.booking_cleaning_issues;
create policy "v4_owner_authenticated_access"
on public.booking_cleaning_issues
as permissive
for all
to authenticated
using (public.is_v4_owner())
with check (public.is_v4_owner());

comment on table public.booking_cleaning_issues is
  'Lightweight follow-up for a booking without the cleaning option where the expected end-of-stay cleaning was not performed adequately.';

comment on column public.booking_cleaning_issues.amount_due is
  'Amount claimed for the cleaning issue; application code must initialize it from booking_requests.cleaning_fee, the historical tariff for that booking.';

create or replace function public.create_public_booking_request_atomic(
  p_booking jsonb,
  p_fingerprint text,
  p_now timestamptz default now()
)
returns table (outcome text, booking_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start_date date;
  v_end_date date;
  v_period daterange;
  v_booking_id uuid;
begin
  if p_booking is null or jsonb_typeof(p_booking) <> 'object' then
    raise exception 'Invalid public booking payload.';
  end if;

  begin
    v_start_date := (p_booking ->> 'start_date')::date;
    v_end_date := (p_booking ->> 'end_date')::date;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception 'Invalid public booking dates.';
  end;

  if v_start_date is null or v_end_date is null or v_end_date <= v_start_date then
    raise exception 'Invalid public booking period.';
  end if;

  v_period := daterange(v_start_date, v_end_date, '[)');

  -- A successful identical request already owns this fingerprint. Probe it
  -- without mutating the claim so a retry remains distinguishable from a new
  -- request that merely overlaps the dates. The actual claim stays after the
  -- availability pre-check and is rolled back with a failed insert.
  if exists (
    select 1
    from public.public_rate_limits
    where scope = 'public_booking_duplicate'
      and key_hash = p_fingerprint
      and window_started_at > p_now - make_interval(secs => 300)
  ) then
    return query select 'duplicate'::text, null::uuid;
    return;
  end if;

  if exists (
    select 1
    from public.booking_requests
    where status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
      and (source is null or source in ('website', 'direct', 'admin_client', 'admin_personal'))
      and daterange(start_date, end_date, '[)') && v_period
  ) or exists (
    select 1
    from public.calendar_blocks
    where start_date is not null
      and end_date is not null
      and daterange(start_date, end_date, '[)') && v_period
  ) or exists (
    select 1
    from public.external_occupancies
    where is_current is true
      and not (source in ('booking', 'airbnb') and end_date = start_date + 1)
      and daterange(start_date, end_date, '[)') && v_period
  ) then
    return query select 'date_conflict'::text, null::uuid;
    return;
  end if;

  -- The nested block is a PostgreSQL subtransaction. If the exclusion
  -- constraint wins a concurrent race, its handler rolls back the fingerprint
  -- claim as well as the failed insert before returning date_conflict.
  begin
    if public.claim_public_rate_limit(
      'public_booking_duplicate',
      p_fingerprint,
      300,
      1,
      p_now
    ) is not true then
      return query select 'duplicate'::text, null::uuid;
      return;
    end if;

    insert into public.booking_requests (
      status,
      guest_first_name,
      guest_last_name,
      guest_email,
      guest_phone,
      adults_count,
      children_count,
      children_ages,
      baby_bed_needed,
      marketing_consent,
      marketing_consent_at,
      start_date,
      end_date,
      nights,
      estimated_total,
      cleaning_option,
      cleaning_fee,
      cleaning_obligations_accepted_at,
      cleaning_obligations_version,
      message,
      contract_accepted,
      contract_accepted_at,
      contract_version,
      contract_url
    ) values (
      'pending',
      nullif(p_booking ->> 'guest_first_name', ''),
      nullif(p_booking ->> 'guest_last_name', ''),
      nullif(p_booking ->> 'guest_email', ''),
      nullif(p_booking ->> 'guest_phone', ''),
      (p_booking ->> 'adults_count')::integer,
      (p_booking ->> 'children_count')::integer,
      nullif(p_booking ->> 'children_ages', ''),
      coalesce((p_booking ->> 'baby_bed_needed')::boolean, false),
      coalesce((p_booking ->> 'marketing_consent')::boolean, false),
      nullif(p_booking ->> 'marketing_consent_at', '')::timestamptz,
      v_start_date,
      v_end_date,
      (p_booking ->> 'nights')::integer,
      (p_booking ->> 'estimated_total')::numeric,
      coalesce((p_booking ->> 'cleaning_option')::boolean, false),
      coalesce((p_booking ->> 'cleaning_fee')::integer, 0),
      nullif(p_booking ->> 'cleaning_obligations_accepted_at', '')::timestamptz,
      nullif(p_booking ->> 'cleaning_obligations_version', ''),
      nullif(p_booking ->> 'message', ''),
      true,
      nullif(p_booking ->> 'contract_accepted_at', '')::timestamptz,
      nullif(p_booking ->> 'contract_version', ''),
      nullif(p_booking ->> 'contract_url', '')
    )
    returning id into v_booking_id;
  exception when exclusion_violation then
    return query select 'date_conflict'::text, null::uuid;
    return;
  end;

  return query select 'created'::text, v_booking_id;
end;
$$;

revoke all on function public.create_public_booking_request_atomic(jsonb, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_public_booking_request_atomic(jsonb, text, timestamptz)
  to service_role;

comment on function public.create_public_booking_request_atomic(jsonb, text, timestamptz) is
  'V4.8 service-role boundary: V4.7-A atomic public booking creation plus cleaning option, historical fee snapshot and cleaning-obligations acceptance trace.';
