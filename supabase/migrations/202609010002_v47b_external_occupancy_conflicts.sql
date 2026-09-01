-- V4.7-B: persist and alert external/local occupancy overlaps.
--
-- Rollback after reverting the matching application code:
--   drop function public.release_external_occupancy_conflict_alert(uuid, integer, timestamptz);
--   drop function public.mark_external_occupancy_conflict_alert_sent(uuid, integer, timestamptz);
--   drop function public.claim_external_occupancy_conflict_alerts(integer, timestamptz, integer);
--   drop function public.reconcile_external_occupancy_conflicts(text, timestamptz);
--   drop table public.external_occupancy_conflicts;
--   drop table public.external_occupancy_conflict_runs;

create table public.external_occupancy_conflicts (
  id uuid primary key default gen_random_uuid(),
  external_occupancy_id uuid not null
    references public.external_occupancies(id)
    on update restrict on delete restrict,
  source text not null,
  external_uid text not null,
  external_start_date date not null,
  external_end_date date not null,
  local_kind text not null,
  local_id uuid not null,
  local_start_date date not null,
  local_end_date date not null,
  status text not null default 'open',
  occurrence_count integer not null default 1,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  alert_status text not null default 'pending',
  alert_claimed_at timestamptz,
  alert_claimed_occurrence integer,
  alert_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_occupancy_conflicts_source_allowed
    check (source in ('booking', 'airbnb')),
  constraint external_occupancy_conflicts_local_kind_allowed
    check (local_kind in ('booking_request', 'calendar_block')),
  constraint external_occupancy_conflicts_status_allowed
    check (status in ('open', 'resolved')),
  constraint external_occupancy_conflicts_alert_status_allowed
    check (alert_status in ('pending', 'claimed', 'sent', 'retry')),
  constraint external_occupancy_conflicts_external_period_valid
    check (external_end_date > external_start_date),
  constraint external_occupancy_conflicts_local_period_valid
    check (local_end_date > local_start_date),
  constraint external_occupancy_conflicts_occurrence_valid
    check (occurrence_count > 0),
  constraint external_occupancy_conflicts_target_key
    unique (external_occupancy_id, local_kind, local_id)
);

create index external_occupancy_conflicts_open_source_idx
  on public.external_occupancy_conflicts (source, status, last_detected_at)
  where status = 'open';

create index external_occupancy_conflicts_claim_idx
  on public.external_occupancy_conflicts (alert_status, alert_claimed_at, first_detected_at)
  where status = 'open';

alter table public.external_occupancy_conflicts enable row level security;

revoke all on table public.external_occupancy_conflicts from public;
revoke all on table public.external_occupancy_conflicts from anon, authenticated;
grant select, insert, update on table public.external_occupancy_conflicts to service_role;

create table public.external_occupancy_conflict_runs (
  source text primary key,
  last_reconciled_at timestamptz not null,
  updated_at timestamptz not null,
  constraint external_occupancy_conflict_runs_source_allowed
    check (source in ('booking', 'airbnb'))
);

alter table public.external_occupancy_conflict_runs enable row level security;

revoke all on table public.external_occupancy_conflict_runs from public;
revoke all on table public.external_occupancy_conflict_runs from anon, authenticated;
grant select, insert, update on table public.external_occupancy_conflict_runs to service_role;

create or replace function public.reconcile_external_occupancy_conflicts(
  p_source text,
  p_detected_at timestamptz default now()
)
returns table (active_count bigint, resolved_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_count bigint;
  v_resolved_count bigint;
  v_source_claimed boolean := false;
begin
  if p_source not in ('booking', 'airbnb') or p_detected_at is null then
    raise exception 'Invalid external conflict reconciliation input.';
  end if;

  insert into public.external_occupancy_conflict_runs (
    source,
    last_reconciled_at,
    updated_at
  ) values (
    p_source,
    p_detected_at,
    p_detected_at
  )
  on conflict (source) do update set
    last_reconciled_at = excluded.last_reconciled_at,
    updated_at = excluded.updated_at
  where external_occupancy_conflict_runs.last_reconciled_at < excluded.last_reconciled_at
  returning true into v_source_claimed;

  if not coalesce(v_source_claimed, false) then
    return query select 0::bigint, 0::bigint;
    return;
  end if;

  with current_pairs as materialized (
    select
      external.id as external_occupancy_id,
      external.source,
      external.external_uid,
      external.start_date as external_start_date,
      external.end_date as external_end_date,
      'booking_request'::text as local_kind,
      booking.id as local_id,
      booking.start_date as local_start_date,
      booking.end_date as local_end_date
    from public.external_occupancies external
    join public.booking_requests booking
      on external.start_date < booking.end_date
     and external.end_date > booking.start_date
    where external.source = p_source
      and external.source in ('booking', 'airbnb')
      and external.is_current is true
      and external.end_date <> external.start_date + 1
      and booking.status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
      and (booking.source is null or booking.source in ('direct', 'admin_client', 'admin_personal'))

    union all

    select
      external.id,
      external.source,
      external.external_uid,
      external.start_date,
      external.end_date,
      'calendar_block'::text,
      block.id,
      block.start_date,
      block.end_date
    from public.external_occupancies external
    join public.calendar_blocks block
      on external.start_date < block.end_date
     and external.end_date > block.start_date
    where external.source = p_source
      and external.source in ('booking', 'airbnb')
      and external.is_current is true
      and external.end_date <> external.start_date + 1
      and block.start_date is not null
      and block.end_date is not null
      and block.end_date > block.start_date
  ),
  upserted as (
    insert into public.external_occupancy_conflicts (
      external_occupancy_id,
      source,
      external_uid,
      external_start_date,
      external_end_date,
      local_kind,
      local_id,
      local_start_date,
      local_end_date,
      status,
      occurrence_count,
      first_detected_at,
      last_detected_at,
      alert_status,
      created_at,
      updated_at
    )
    select
      pair.external_occupancy_id,
      pair.source,
      pair.external_uid,
      pair.external_start_date,
      pair.external_end_date,
      pair.local_kind,
      pair.local_id,
      pair.local_start_date,
      pair.local_end_date,
      'open',
      1,
      p_detected_at,
      p_detected_at,
      'pending',
      p_detected_at,
      p_detected_at
    from current_pairs pair
    on conflict (external_occupancy_id, local_kind, local_id) do update set
      source = excluded.source,
      external_uid = excluded.external_uid,
      external_start_date = excluded.external_start_date,
      external_end_date = excluded.external_end_date,
      local_start_date = excluded.local_start_date,
      local_end_date = excluded.local_end_date,
      status = 'open',
      occurrence_count = case
        when external_occupancy_conflicts.status = 'resolved'
          then external_occupancy_conflicts.occurrence_count + 1
        else external_occupancy_conflicts.occurrence_count
      end,
      last_detected_at = p_detected_at,
      resolved_at = null,
      alert_status = case
        when external_occupancy_conflicts.status = 'resolved' then 'pending'
        else external_occupancy_conflicts.alert_status
      end,
      alert_claimed_at = case
        when external_occupancy_conflicts.status = 'resolved' then null
        else external_occupancy_conflicts.alert_claimed_at
      end,
      alert_claimed_occurrence = case
        when external_occupancy_conflicts.status = 'resolved' then null
        else external_occupancy_conflicts.alert_claimed_occurrence
      end,
      alert_sent_at = case
        when external_occupancy_conflicts.status = 'resolved' then null
        else external_occupancy_conflicts.alert_sent_at
      end,
      updated_at = p_detected_at
    returning 1
  ),
  resolved as (
    update public.external_occupancy_conflicts conflict
    set status = 'resolved',
        resolved_at = p_detected_at,
        updated_at = p_detected_at
    where conflict.source = p_source
      and conflict.status = 'open'
      and not exists (
        select 1
        from current_pairs pair
        where pair.external_occupancy_id = conflict.external_occupancy_id
          and pair.local_kind = conflict.local_kind
          and pair.local_id = conflict.local_id
      )
    returning 1
  )
  select
    (select count(*) from upserted),
    (select count(*) from resolved)
  into v_active_count, v_resolved_count;

  return query select v_active_count, v_resolved_count;
end;
$$;

create or replace function public.claim_external_occupancy_conflict_alerts(
  p_limit integer default 50,
  p_now timestamptz default now(),
  p_claim_timeout_seconds integer default 900
)
returns setof public.external_occupancy_conflicts
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 100 or p_now is null or p_claim_timeout_seconds < 60 then
    raise exception 'Invalid external conflict alert claim input.';
  end if;

  return query
  with candidates as (
    select conflict.id
    from public.external_occupancy_conflicts conflict
    where conflict.status = 'open'
      and (
        conflict.alert_status in ('pending', 'retry')
        or (
          conflict.alert_status = 'claimed'
          and conflict.alert_claimed_at <= p_now - make_interval(secs => p_claim_timeout_seconds)
        )
      )
    order by conflict.first_detected_at, conflict.id
    for update skip locked
    limit p_limit
  )
  update public.external_occupancy_conflicts conflict
  set alert_status = 'claimed',
      alert_claimed_at = p_now,
      alert_claimed_occurrence = conflict.occurrence_count,
      updated_at = p_now
  from candidates
  where conflict.id = candidates.id
  returning conflict.*;
end;
$$;

create or replace function public.mark_external_occupancy_conflict_alert_sent(
  p_conflict_id uuid,
  p_occurrence integer,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  update public.external_occupancy_conflicts
  set alert_status = 'sent',
      alert_sent_at = p_now,
      updated_at = p_now
  where id = p_conflict_id
    and status = 'open'
    and alert_status = 'claimed'
    and occurrence_count = p_occurrence
    and alert_claimed_occurrence = p_occurrence
  returning true into v_updated;
  return coalesce(v_updated, false);
end;
$$;

create or replace function public.release_external_occupancy_conflict_alert(
  p_conflict_id uuid,
  p_occurrence integer,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  update public.external_occupancy_conflicts
  set alert_status = 'retry',
      alert_claimed_at = null,
      alert_claimed_occurrence = null,
      updated_at = p_now
  where id = p_conflict_id
    and status = 'open'
    and alert_status = 'claimed'
    and occurrence_count = p_occurrence
    and alert_claimed_occurrence = p_occurrence
  returning true into v_updated;
  return coalesce(v_updated, false);
end;
$$;

revoke all on function public.reconcile_external_occupancy_conflicts(text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.claim_external_occupancy_conflict_alerts(integer, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.mark_external_occupancy_conflict_alert_sent(uuid, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.release_external_occupancy_conflict_alert(uuid, integer, timestamptz)
  from public, anon, authenticated;

grant execute on function public.reconcile_external_occupancy_conflicts(text, timestamptz)
  to service_role;
grant execute on function public.claim_external_occupancy_conflict_alerts(integer, timestamptz, integer)
  to service_role;
grant execute on function public.mark_external_occupancy_conflict_alert_sent(uuid, integer, timestamptz)
  to service_role;
grant execute on function public.release_external_occupancy_conflict_alert(uuid, integer, timestamptz)
  to service_role;

comment on table public.external_occupancy_conflicts is
  'V4.7-B non-PII history of external/local overlaps; resolution is always human.';
comment on table public.external_occupancy_conflict_runs is
  'V4.7-B per-source generation gate preventing stale reconciliation from superseding newer state.';
comment on function public.reconcile_external_occupancy_conflicts(text, timestamptz) is
  'Reconciles one successfully synchronized source from persisted occupation state.';
comment on function public.claim_external_occupancy_conflict_alerts(integer, timestamptz, integer) is
  'Atomically claims open conflict alerts; abandoned claims become retryable after timeout.';
