-- LA MAISON VERTE V4.10 — Migration B1
-- Persist the authoritative V4.10 public-booking financial snapshots atomically.
-- Requires Migration A (202609280001) to have been applied first.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='booking_requests' and column_name='deposit_rate'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='booking_requests' and column_name='deposit_basis'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='booking_requests' and column_name='contract_total'
  ) then
    raise exception 'V4.10 Migration A is required before B1.';
  end if;
end
$$;

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

  -- V4.10 public bookings must arrive with a complete server-computed snapshot.
  if nullif(p_booking ->> 'deposit_rate', '') is null
     or nullif(p_booking ->> 'deposit_basis', '') is null
     or nullif(p_booking ->> 'deposit_amount', '') is null
     or nullif(p_booking ->> 'contract_total', '') is null
     or p_booking -> 'tourist_tax_snapshot' is null then
    raise exception 'Incomplete V4.10 public booking financial snapshot.';
  end if;

  v_period := daterange(v_start_date, v_end_date, '[)');

  if exists (
    select 1 from public.public_rate_limits
    where scope = 'public_booking_duplicate'
      and key_hash = p_fingerprint
      and window_started_at > p_now - make_interval(secs => 300)
  ) then
    return query select 'duplicate'::text, null::uuid;
    return;
  end if;

  if exists (
    select 1 from public.booking_requests
    where status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
      and (source is null or source in ('website', 'direct', 'admin_client', 'admin_personal'))
      and daterange(start_date, end_date, '[)') && v_period
  ) or exists (
    select 1 from public.calendar_blocks
    where start_date is not null and end_date is not null
      and daterange(start_date, end_date, '[)') && v_period
  ) or exists (
    select 1 from public.external_occupancies
    where is_current is true
      and not (source in ('booking', 'airbnb') and end_date = start_date + 1)
      and daterange(start_date, end_date, '[)') && v_period
  ) then
    return query select 'date_conflict'::text, null::uuid;
    return;
  end if;

  begin
    if public.claim_public_rate_limit('public_booking_duplicate', p_fingerprint, 300, 1, p_now) is not true then
      return query select 'duplicate'::text, null::uuid;
      return;
    end if;

    insert into public.booking_requests (
      status, guest_first_name, guest_last_name, guest_email, guest_phone,
      adults_count, children_count, children_ages, baby_bed_needed,
      marketing_consent, marketing_consent_at,
      start_date, end_date, nights,
      estimated_total, accommodation_gross, promotion_code,
      promotion_discount_rate, promotion_discount_amount, accommodation_net,
      tourist_tax_amount, tourist_tax_collector, tourist_tax_snapshot,
      deposit_rate, deposit_basis, deposit_amount, contract_total,
      cleaning_option, cleaning_fee, payment_preference,
      cleaning_obligations_accepted_at, cleaning_obligations_version,
      message, contract_accepted, contract_accepted_at, contract_version, contract_url
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
      v_start_date, v_end_date, (p_booking ->> 'nights')::integer,
      (p_booking ->> 'estimated_total')::numeric,
      (p_booking ->> 'accommodation_gross')::numeric,
      nullif(p_booking ->> 'promotion_code', ''),
      nullif(p_booking ->> 'promotion_discount_rate', '')::numeric,
      nullif(p_booking ->> 'promotion_discount_amount', '')::numeric,
      (p_booking ->> 'accommodation_net')::numeric,
      (p_booking ->> 'tourist_tax_amount')::numeric,
      coalesce(nullif(p_booking ->> 'tourist_tax_collector', ''), 'la_maison_verte'),
      p_booking -> 'tourist_tax_snapshot',
      (p_booking ->> 'deposit_rate')::numeric,
      (p_booking ->> 'deposit_basis')::numeric,
      (p_booking ->> 'deposit_amount')::numeric,
      (p_booking ->> 'contract_total')::numeric,
      coalesce((p_booking ->> 'cleaning_option')::boolean, false),
      coalesce((p_booking ->> 'cleaning_fee')::integer, 0),
      case when p_booking ->> 'payment_preference' = 'full' then 'full' else 'deposit' end,
      nullif(p_booking ->> 'cleaning_obligations_accepted_at', '')::timestamptz,
      nullif(p_booking ->> 'cleaning_obligations_version', ''),
      nullif(p_booking ->> 'message', ''),
      true,
      nullif(p_booking ->> 'contract_accepted_at', '')::timestamptz,
      nullif(p_booking ->> 'contract_version', ''),
      nullif(p_booking ->> 'contract_url', '')
    ) returning id into v_booking_id;
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
  'V4.10 service-role boundary: atomic public booking creation with authoritative contract, deposit and tourist-tax snapshots.';

commit;
