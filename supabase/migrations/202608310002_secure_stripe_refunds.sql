create table if not exists public.refund_operations (
  id uuid primary key,
  booking_request_id uuid not null references public.booking_requests(id) on delete restrict,
  action text not null check (action in ('refund_only', 'cancel_refund')),
  is_refund_only boolean not null,
  refund_mode text not null check (refund_mode in ('none', 'policy', 'total', 'custom', 'deposit', 'balance')),
  cancellation_type text not null check (cancellation_type in ('client', 'owner')),
  custom_amount_cents bigint,
  requested_amount_cents bigint not null default 0 check (requested_amount_cents >= 0),
  refunded_amount_cents bigint not null default 0 check (refunded_amount_cents >= 0),
  effective_mode text not null,
  policy_label text not null,
  message text not null default '',
  status text not null default 'pending' check (status in (
    'pending', 'in_progress', 'stripe_succeeded', 'succeeded', 'failed', 'needs_reconciliation'
  )),
  last_error text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.refund_operations enable row level security;

revoke all on table public.refund_operations from public, anon, authenticated;
grant select, insert, update on table public.refund_operations to service_role;

alter table public.refunds
  add column if not exists operation_id uuid references public.refund_operations(id) on delete restrict,
  add column if not exists idempotency_key text,
  add column if not exists allocation_order integer,
  add column if not exists amount_cents bigint,
  add column if not exists operation_status text,
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.refunds
  add constraint refunds_amount_cents_nonnegative check (amount_cents is null or amount_cents >= 0),
  add constraint refunds_operation_status_valid check (
    operation_status is null or operation_status in (
      'pending', 'in_progress', 'stripe_succeeded', 'succeeded', 'failed', 'needs_reconciliation'
    )
  );

create unique index refunds_idempotency_key_uidx
  on public.refunds (idempotency_key)
  where idempotency_key is not null;

create unique index refunds_operation_payment_uidx
  on public.refunds (operation_id, payment_id)
  where operation_id is not null and payment_id is not null;

create index refund_operations_booking_status_idx
  on public.refund_operations (booking_request_id, status, created_at);

create or replace function public.refund_operation_snapshot(p_operation_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'operation', to_jsonb(o),
    'allocations', coalesce((
      select jsonb_agg(
        to_jsonb(r) || jsonb_build_object('payment_intent_id', p.stripe_payment_intent_id)
        order by r.allocation_order asc, r.id asc
      )
      from public.refunds r
      join public.payments p on p.id = r.payment_id
      where r.operation_id = o.id
    ), '[]'::jsonb)
  )
  from public.refund_operations o
  where o.id = p_operation_id;
$$;

revoke all on function public.refund_operation_snapshot(uuid) from public, anon, authenticated;

create or replace function public.acquire_stripe_refund_operation(
  p_operation_id uuid,
  p_booking_id uuid,
  p_action text,
  p_is_refund_only boolean,
  p_refund_mode text,
  p_cancellation_type text,
  p_custom_amount_cents bigint,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.booking_requests%rowtype;
  v_existing public.refund_operations%rowtype;
  v_payment record;
  v_effective_mode text;
  v_policy_label text;
  v_days integer;
  v_contract_total_cents bigint;
  v_contract_deposit_cents bigint;
  v_payment_cents bigint;
  v_succeeded_cents bigint;
  v_reserved_cents bigint;
  v_available_cents bigint;
  v_eligible_cents bigint;
  v_total_eligible_cents bigint := 0;
  v_requested_cents bigint := 0;
  v_remaining_cents bigint := 0;
  v_allocation_cents bigint;
  v_allocation_order integer := 0;
  v_refund_id uuid;
  v_action text;
  v_is_refund_only boolean;
begin
  if p_operation_id is null or p_booking_id is null then
    raise exception 'operation_id and booking_id are required';
  end if;

  v_is_refund_only := coalesce(p_is_refund_only, false) or p_action = 'refund_only';
  v_action := case when v_is_refund_only then 'refund_only' else 'cancel_refund' end;

  if p_action is distinct from v_action then
    raise exception 'refund operation action is inconsistent';
  end if;
  if p_refund_mode not in ('none', 'policy', 'total', 'custom', 'deposit', 'balance') then
    raise exception 'unsupported refund mode';
  end if;
  if p_cancellation_type not in ('client', 'owner') then
    raise exception 'unsupported cancellation type';
  end if;
  if p_refund_mode = 'custom' and coalesce(p_custom_amount_cents, 0) < 0 then
    raise exception 'custom refund amount cannot be negative';
  end if;

  select * into v_existing
  from public.refund_operations
  where id = p_operation_id;

  if found then
    if v_existing.booking_request_id is distinct from p_booking_id
      or v_existing.action is distinct from v_action
      or v_existing.is_refund_only is distinct from v_is_refund_only
      or v_existing.refund_mode is distinct from p_refund_mode
      or v_existing.cancellation_type is distinct from p_cancellation_type
      or v_existing.custom_amount_cents is distinct from p_custom_amount_cents
      or v_existing.message is distinct from coalesce(p_message, '') then
      raise exception 'refund operation payload conflict' using errcode = '23505';
    end if;
    return public.refund_operation_snapshot(p_operation_id);
  end if;

  select * into v_booking
  from public.booking_requests
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'booking not found';
  end if;

  select * into v_existing
  from public.refund_operations
  where id = p_operation_id;

  if found then
    if v_existing.booking_request_id is distinct from p_booking_id
      or v_existing.action is distinct from v_action
      or v_existing.is_refund_only is distinct from v_is_refund_only
      or v_existing.refund_mode is distinct from p_refund_mode
      or v_existing.cancellation_type is distinct from p_cancellation_type
      or v_existing.custom_amount_cents is distinct from p_custom_amount_cents
      or v_existing.message is distinct from coalesce(p_message, '') then
      raise exception 'refund operation payload conflict' using errcode = '23505';
    end if;
    return public.refund_operation_snapshot(p_operation_id);
  end if;

  perform 1
  from public.payments
  where booking_request_id = p_booking_id
  order by paid_at asc nulls last, created_at asc, id asc
  for update;

  v_contract_total_cents := round(coalesce(v_booking.owner_price, v_booking.estimated_total, 0) * 100)::bigint;
  v_contract_deposit_cents := round(v_contract_total_cents * 0.30)::bigint;
  v_days := v_booking.start_date - current_date;

  if p_refund_mode = 'policy' then
    if p_cancellation_type = 'owner' then
      v_effective_mode := 'total';
      v_policy_label := 'Annulation propriétaire : remboursement total';
    elsif v_days > 30 then
      v_effective_mode := 'total';
      v_policy_label := 'Annulation client à plus de 30 jours : remboursement total';
    elsif v_days >= 7 then
      v_effective_mode := 'balance';
      v_policy_label := 'Annulation client entre J-30 et J-7 : acompte conservé, solde remboursable';
    else
      v_effective_mode := 'none';
      v_policy_label := 'Annulation client à moins de 7 jours : aucun remboursement';
    end if;
  else
    v_effective_mode := p_refund_mode;
    v_policy_label := case p_refund_mode
      when 'none' then 'Aucun remboursement choisi'
      when 'total' then 'Remboursement total choisi'
      when 'custom' then 'Remboursement montant libre'
      when 'deposit' then 'Remboursement acompte choisi'
      when 'balance' then 'Remboursement solde choisi'
      else 'Mode de remboursement inconnu'
    end;
  end if;

  for v_payment in
    select *
    from public.payments
    where booking_request_id = p_booking_id
      and status in ('paid', 'partially_refunded')
      and stripe_payment_intent_id is not null
      and btrim(stripe_payment_intent_id) <> ''
    order by paid_at asc nulls last, created_at asc, id asc
  loop
    v_payment_cents := round(v_payment.amount * 100)::bigint;

    select
      coalesce(sum(case
        when r.status = 'succeeded'
          then coalesce(r.amount_cents, round(r.amount * 100)::bigint)
        else 0 end), 0)::bigint,
      coalesce(sum(case
        when r.operation_status in ('pending', 'in_progress', 'stripe_succeeded', 'needs_reconciliation', 'failed')
          then coalesce(r.amount_cents, 0)
        else 0 end), 0)::bigint
    into v_succeeded_cents, v_reserved_cents
    from public.refunds r
    where r.payment_id = v_payment.id;

    v_available_cents := greatest(v_payment_cents - v_succeeded_cents - v_reserved_cents, 0);
    v_eligible_cents := 0;

    if v_effective_mode in ('total', 'custom') then
      v_eligible_cents := v_available_cents;
    elsif v_effective_mode = 'deposit'
      and (v_payment.payment_type = 'deposit'
        or (v_payment.payment_type = 'manual' and v_payment.manual_reason = 'acompte')) then
      v_eligible_cents := v_available_cents;
    elsif v_effective_mode = 'balance' then
      if v_payment.payment_type = 'balance'
        or (v_payment.payment_type = 'manual' and v_payment.manual_reason in ('solde', 'complement')) then
        v_eligible_cents := v_available_cents;
      elsif v_payment.payment_type = 'full'
        or (v_payment.payment_type = 'manual' and v_payment.manual_reason = 'total') then
        v_eligible_cents := least(
          v_available_cents,
          greatest(v_payment_cents - v_contract_deposit_cents - v_succeeded_cents - v_reserved_cents, 0)
        );
      end if;
    end if;

    v_total_eligible_cents := v_total_eligible_cents + v_eligible_cents;
  end loop;

  v_requested_cents := case
    when v_effective_mode = 'none' then 0
    when v_effective_mode = 'custom' then least(greatest(coalesce(p_custom_amount_cents, 0), 0), v_total_eligible_cents)
    else v_total_eligible_cents
  end;

  insert into public.refund_operations (
    id, booking_request_id, action, is_refund_only, refund_mode,
    cancellation_type, custom_amount_cents, requested_amount_cents,
    effective_mode, policy_label, message, status
  ) values (
    p_operation_id, p_booking_id, v_action, v_is_refund_only, p_refund_mode,
    p_cancellation_type, p_custom_amount_cents, v_requested_cents,
    v_effective_mode, v_policy_label, coalesce(p_message, ''), 'pending'
  );

  v_remaining_cents := v_requested_cents;

  for v_payment in
    select *
    from public.payments
    where booking_request_id = p_booking_id
      and status in ('paid', 'partially_refunded')
      and stripe_payment_intent_id is not null
      and btrim(stripe_payment_intent_id) <> ''
    order by paid_at asc nulls last, created_at asc, id asc
  loop
    exit when v_remaining_cents <= 0;
    v_payment_cents := round(v_payment.amount * 100)::bigint;

    select
      coalesce(sum(case
        when r.status = 'succeeded'
          then coalesce(r.amount_cents, round(r.amount * 100)::bigint)
        else 0 end), 0)::bigint,
      coalesce(sum(case
        when r.operation_status in ('pending', 'in_progress', 'stripe_succeeded', 'needs_reconciliation', 'failed')
          then coalesce(r.amount_cents, 0)
        else 0 end), 0)::bigint
    into v_succeeded_cents, v_reserved_cents
    from public.refunds r
    where r.payment_id = v_payment.id;

    v_available_cents := greatest(v_payment_cents - v_succeeded_cents - v_reserved_cents, 0);
    v_eligible_cents := 0;

    if v_effective_mode in ('total', 'custom') then
      v_eligible_cents := v_available_cents;
    elsif v_effective_mode = 'deposit'
      and (v_payment.payment_type = 'deposit'
        or (v_payment.payment_type = 'manual' and v_payment.manual_reason = 'acompte')) then
      v_eligible_cents := v_available_cents;
    elsif v_effective_mode = 'balance' then
      if v_payment.payment_type = 'balance'
        or (v_payment.payment_type = 'manual' and v_payment.manual_reason in ('solde', 'complement')) then
        v_eligible_cents := v_available_cents;
      elsif v_payment.payment_type = 'full'
        or (v_payment.payment_type = 'manual' and v_payment.manual_reason = 'total') then
        v_eligible_cents := least(
          v_available_cents,
          greatest(v_payment_cents - v_contract_deposit_cents - v_succeeded_cents - v_reserved_cents, 0)
        );
      end if;
    end if;

    v_allocation_cents := least(v_eligible_cents, v_remaining_cents);
    if v_allocation_cents <= 0 then
      continue;
    end if;

    v_allocation_order := v_allocation_order + 1;
    v_refund_id := gen_random_uuid();

    insert into public.refunds (
      id, booking_request_id, payment_id, amount, amount_cents, currency,
      status, cancellation_type, refund_mode, reason,
      stripe_payment_intent_id, metadata, operation_id, idempotency_key,
      allocation_order, operation_status, updated_at
    ) values (
      v_refund_id, p_booking_id, v_payment.id, v_allocation_cents / 100.0,
      v_allocation_cents, coalesce(v_payment.currency, 'eur'), 'pending',
      p_cancellation_type, p_refund_mode, v_policy_label,
      v_payment.stripe_payment_intent_id,
      jsonb_build_object('refund_operation_id', p_operation_id, 'allocation_order', v_allocation_order),
      p_operation_id, 'lmv-refund:' || p_operation_id::text || ':' || v_refund_id::text,
      v_allocation_order, 'pending', now()
    );

    v_remaining_cents := v_remaining_cents - v_allocation_cents;
  end loop;

  if v_remaining_cents <> 0 then
    raise exception 'refund allocation did not consume requested amount';
  end if;

  return public.refund_operation_snapshot(p_operation_id);
end;
$$;

create or replace function public.claim_stripe_refund_allocation(
  p_operation_id uuid,
  p_allocation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_payment_id uuid;
  v_operation public.refund_operations%rowtype;
  v_refund public.refunds%rowtype;
begin
  select booking_request_id into v_booking_id
  from public.refund_operations
  where id = p_operation_id;
  if not found then raise exception 'refund operation not found'; end if;

  select payment_id into v_payment_id
  from public.refunds
  where id = p_allocation_id;
  if not found then raise exception 'refund allocation not found'; end if;

  -- lock booking_requests
  perform 1 from public.booking_requests where id = v_booking_id for update;
  if not found then raise exception 'booking not found'; end if;

  -- lock payments
  perform 1 from public.payments where id = v_payment_id for update;
  if not found then raise exception 'payment not found'; end if;

  -- lock refund_operations
  select * into v_operation
  from public.refund_operations
  where id = p_operation_id
  for update;

  -- lock refunds allocation
  select * into v_refund
  from public.refunds
  where id = p_allocation_id
  for update;

  if v_refund.operation_id is distinct from v_operation.id
    or v_refund.booking_request_id is distinct from v_operation.booking_request_id
    or v_refund.payment_id is distinct from v_payment_id then
    raise exception 'refund allocation does not belong to operation';
  end if;

  if v_refund.operation_status = 'pending' then
    update public.refunds
    set operation_status = 'in_progress',
        updated_at = now()
    where id = p_allocation_id;

    update public.refund_operations
    set status = 'in_progress',
        updated_at = now()
    where id = p_operation_id and status = 'pending';

    return jsonb_build_object('outcome', 'claimed_first_attempt');
  end if;

  return jsonb_build_object('outcome', 'already_' || v_refund.operation_status);
end;
$$;

create or replace function public.record_stripe_refund_result(
  p_operation_id uuid,
  p_allocation_id uuid,
  p_stripe_refund_id text,
  p_stripe_status text,
  p_stripe_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_payment_id uuid;
  v_refund public.refunds%rowtype;
  v_payment public.payments%rowtype;
  v_operation public.refund_operations%rowtype;
  v_booking public.booking_requests%rowtype;
  v_payment_refunded_cents bigint;
  v_booking_refunded_cents bigint;
  v_booking_paid_cents bigint;
  v_operation_refunded_cents bigint;
  v_all_succeeded boolean;
begin
  select booking_request_id into v_booking_id
  from public.refund_operations
  where id = p_operation_id;
  if not found then raise exception 'refund operation not found'; end if;

  select payment_id into v_payment_id
  from public.refunds
  where id = p_allocation_id;
  if not found then raise exception 'refund allocation not found'; end if;

  -- lock booking_requests
  select * into v_booking
  from public.booking_requests
  where id = v_booking_id
  for update;
  if not found then raise exception 'booking not found'; end if;

  -- lock payments
  select * into v_payment
  from public.payments
  where id = v_payment_id
  for update;
  if not found then raise exception 'payment not found'; end if;

  -- lock refund_operations
  select * into v_operation
  from public.refund_operations
  where id = p_operation_id
  for update;

  -- lock refunds allocation
  select * into v_refund
  from public.refunds
  where id = p_allocation_id
  for update;

  if v_refund.operation_id is distinct from v_operation.id
    or v_refund.booking_request_id is distinct from v_operation.booking_request_id
    or v_refund.payment_id is distinct from v_payment.id then
    raise exception 'refund allocation does not belong to operation';
  end if;

  if v_refund.operation_status = 'succeeded' then
    if v_refund.stripe_refund_id is distinct from p_stripe_refund_id then
      raise exception 'stripe refund id conflict';
    end if;
    return jsonb_build_object('outcome', 'already_recorded');
  end if;

  if p_stripe_refund_id is null or btrim(p_stripe_refund_id) = '' then
    raise exception 'stripe refund id is required';
  end if;

  if p_stripe_status is distinct from 'succeeded' then
    update public.refunds
    set stripe_refund_id = p_stripe_refund_id,
        status = coalesce(nullif(p_stripe_status, ''), 'pending'),
        operation_status = case when p_stripe_status = 'failed' then 'failed' else 'needs_reconciliation' end,
        metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_stripe_metadata, '{}'::jsonb),
        updated_at = now()
    where id = p_allocation_id;

    update public.refund_operations
    set status = case when p_stripe_status = 'failed' then 'failed' else 'needs_reconciliation' end,
        updated_at = now()
    where id = p_operation_id;

    return jsonb_build_object('outcome', 'needs_reconciliation', 'stripe_status', p_stripe_status);
  end if;

  update public.refunds
  set stripe_refund_id = p_stripe_refund_id,
      status = 'succeeded',
      operation_status = 'succeeded',
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_stripe_metadata, '{}'::jsonb),
      last_error = null,
      updated_at = now()
  where id = p_allocation_id;

  select coalesce(sum(coalesce(r.amount_cents, round(r.amount * 100)::bigint)), 0)::bigint
  into v_payment_refunded_cents
  from public.refunds r
  where r.payment_id = v_payment.id and r.status = 'succeeded';

  update public.payments
  set refunded_amount = v_payment_refunded_cents / 100.0,
      refund_status = case
        when v_payment_refunded_cents >= round(v_payment.amount * 100)::bigint then 'refunded'
        when v_payment_refunded_cents > 0 then 'partially_refunded'
        else 'not_refunded'
      end,
      status = case
        when v_payment_refunded_cents >= round(v_payment.amount * 100)::bigint then 'refunded'
        when v_payment_refunded_cents > 0 then 'partially_refunded'
        else 'paid'
      end,
      stripe_refund_id = p_stripe_refund_id,
      refunded_at = now(),
      refund_reason = v_operation.policy_label,
      updated_at = now()
  where id = v_payment.id;

  select coalesce(sum(round(p.amount * 100)::bigint), 0)::bigint
  into v_booking_paid_cents
  from public.payments p
  where p.booking_request_id = v_booking.id
    and p.status in ('paid', 'partially_refunded', 'refunded');

  select coalesce(sum(coalesce(r.amount_cents, round(r.amount * 100)::bigint)), 0)::bigint
  into v_booking_refunded_cents
  from public.refunds r
  where r.booking_request_id = v_booking.id and r.status = 'succeeded';

  update public.booking_requests
  set stripe_refund_id = p_stripe_refund_id,
      updated_at = now()
  where id = v_booking.id;

  perform public.recompute_booking_financial_aggregates(v_booking.id);

  select coalesce(sum(amount_cents), 0)::bigint
  into v_operation_refunded_cents
  from public.refunds
  where operation_id = p_operation_id and operation_status = 'succeeded';

  select not exists (
    select 1 from public.refunds
    where operation_id = p_operation_id and operation_status <> 'succeeded'
  ) into v_all_succeeded;

  update public.refund_operations
  set refunded_amount_cents = v_operation_refunded_cents,
      status = case when v_all_succeeded then 'stripe_succeeded' else 'in_progress' end,
      last_error = null,
      updated_at = now()
  where id = p_operation_id;

  return jsonb_build_object(
    'outcome', case when v_all_succeeded then 'stripe_succeeded' else 'recorded' end,
    'refunded_amount_cents', v_operation_refunded_cents
  );
end;
$$;

create or replace function public.record_stripe_refund_failure(
  p_operation_id uuid,
  p_allocation_id uuid,
  p_status text,
  p_stripe_refund_id text,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_payment_id uuid;
  v_operation public.refund_operations%rowtype;
  v_refund public.refunds%rowtype;
begin
  if p_status not in ('failed', 'stripe_succeeded', 'needs_reconciliation') then
    raise exception 'unsupported refund failure status';
  end if;

  select booking_request_id into v_booking_id
  from public.refund_operations
  where id = p_operation_id;
  if not found then raise exception 'refund operation not found'; end if;

  select payment_id into v_payment_id
  from public.refunds
  where id = p_allocation_id;
  if not found then raise exception 'refund allocation not found'; end if;

  -- lock booking_requests
  perform 1 from public.booking_requests where id = v_booking_id for update;
  if not found then raise exception 'booking not found'; end if;

  -- lock payments
  perform 1 from public.payments where id = v_payment_id for update;
  if not found then raise exception 'payment not found'; end if;

  -- lock refund_operations
  select * into v_operation
  from public.refund_operations
  where id = p_operation_id
  for update;

  -- lock refunds allocation
  select * into v_refund
  from public.refunds
  where id = p_allocation_id
  for update;

  if v_refund.operation_id is distinct from v_operation.id
    or v_refund.booking_request_id is distinct from v_operation.booking_request_id
    or v_refund.payment_id is distinct from v_payment_id then
    raise exception 'refund allocation does not belong to operation';
  end if;

  if v_refund.operation_status = 'succeeded' then
    return jsonb_build_object('outcome', 'already_recorded');
  end if;

  update public.refunds
  set operation_status = p_status,
      status = p_status,
      stripe_refund_id = coalesce(p_stripe_refund_id, stripe_refund_id),
      last_error = p_error,
      updated_at = now()
  where id = p_allocation_id;

  update public.refund_operations
  set status = case when p_status = 'stripe_succeeded' then 'needs_reconciliation' else p_status end,
      last_error = p_error,
      updated_at = now()
  where id = p_operation_id and status <> 'succeeded';

  return jsonb_build_object('outcome', p_status);
end;
$$;

create or replace function public.finalize_stripe_refund_operation(p_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_operation public.refund_operations%rowtype;
  v_booking public.booking_requests%rowtype;
  v_booking_paid_cents bigint;
  v_booking_refunded_cents bigint;
  v_last_refund_id text;
  v_deposit_status text;
  v_balance_status text;
  v_result jsonb;
begin
  select booking_request_id into v_booking_id
  from public.refund_operations
  where id = p_operation_id;
  if not found then raise exception 'refund operation not found'; end if;

  -- lock booking_requests
  select * into v_booking
  from public.booking_requests
  where id = v_booking_id
  for update;
  if not found then raise exception 'booking not found'; end if;

  -- lock payments
  perform 1
  from public.payments
  where booking_request_id = v_booking_id
  order by paid_at asc nulls last, created_at asc, id asc
  for update;

  -- lock refund_operations
  select * into v_operation
  from public.refund_operations
  where id = p_operation_id
  for update;

  if v_operation.status = 'succeeded' then
    return jsonb_build_object(
      'outcome', 'already_succeeded',
      'should_notify', false,
      'refunded_amount_cents', v_operation.refunded_amount_cents,
      'policy_label', v_operation.policy_label,
      'action', v_operation.action
    ) || coalesce(v_operation.result, '{}'::jsonb);
  end if;

  if exists (
    select 1 from public.refunds
    where operation_id = p_operation_id and operation_status <> 'succeeded'
  ) then
    return jsonb_build_object(
      'outcome', 'incomplete',
      'should_notify', false,
      'refunded_amount_cents', v_operation.refunded_amount_cents,
      'policy_label', v_operation.policy_label,
      'action', v_operation.action
    );
  end if;

  select coalesce(sum(round(p.amount * 100)::bigint), 0)::bigint
  into v_booking_paid_cents
  from public.payments p
  where p.booking_request_id = v_booking.id
    and p.status in ('paid', 'partially_refunded', 'refunded');

  select coalesce(sum(coalesce(r.amount_cents, round(r.amount * 100)::bigint)), 0)::bigint
  into v_booking_refunded_cents
  from public.refunds r
  where r.booking_request_id = v_booking.id and r.status = 'succeeded';

  select stripe_refund_id into v_last_refund_id
  from public.refunds
  where operation_id = p_operation_id and operation_status = 'succeeded'
  order by allocation_order desc nulls last, created_at desc
  limit 1;

  if v_operation.is_refund_only then
    update public.booking_requests
    set payment_status = case
          when v_operation.refunded_amount_cents > 0 and greatest(v_booking_paid_cents - v_booking_refunded_cents, 0) > 0
            then 'partially_refunded'
          when v_operation.refunded_amount_cents > 0 then 'refunded'
          else payment_status
        end,
        owner_message = case when v_operation.message <> '' then v_operation.message else owner_message end,
        refund_policy_applied = v_operation.policy_label,
        refund_reason = case when v_operation.message <> '' then v_operation.message else v_operation.policy_label end,
        stripe_refund_id = coalesce(v_last_refund_id, stripe_refund_id),
        updated_at = now()
    where id = v_booking.id;
  else
    v_deposit_status := case
      when v_operation.refunded_amount_cents > 0 and v_operation.effective_mode in ('deposit', 'total') then 'remboursé'
      else coalesce(v_booking.deposit_status, 'annulé')
    end;
    v_balance_status := case
      when v_operation.refunded_amount_cents > 0 and v_operation.effective_mode in ('balance', 'total', 'custom') then 'remboursé / à vérifier'
      else coalesce(v_booking.balance_status, 'annulé')
    end;

    update public.booking_requests
    set status = 'cancelled',
        payment_status = case when v_operation.refunded_amount_cents > 0 then 'refunded_or_cancelled' else coalesce(payment_status, 'cancelled') end,
        owner_message = v_operation.message,
        cancelled_at = now(),
        cancelled_by = v_operation.cancellation_type,
        refund_policy_applied = v_operation.policy_label,
        refund_reason = case when v_operation.message <> '' then v_operation.message else v_operation.policy_label end,
        stripe_refund_id = coalesce(v_last_refund_id, stripe_refund_id),
        deposit_status = v_deposit_status,
        balance_status = v_balance_status,
        manual_payment_status = case
          when manual_payment_status = 'paid' and v_operation.refunded_amount_cents > 0 then 'remboursé / à vérifier'
          else manual_payment_status
        end,
        updated_at = now()
    where id = v_booking.id;
  end if;

  perform public.recompute_booking_financial_aggregates(v_booking.id);

  insert into public.booking_events (
    booking_request_id, event_type, label, message, metadata
  ) values (
    v_booking.id,
    case when v_operation.is_refund_only then 'refund_only' else 'booking_cancelled_refund' end,
    case
      when v_operation.is_refund_only and v_operation.refunded_amount_cents > 0 then 'Remboursement simple effectué'
      when v_operation.is_refund_only then 'Remboursement simple sans montant remboursé'
      when v_operation.refunded_amount_cents > 0 then 'Réservation annulée et remboursement effectué'
      else 'Réservation annulée sans remboursement'
    end,
    v_operation.policy_label || '. Montant remboursé : ' || (v_operation.refunded_amount_cents / 100.0)::text || ' EUR. ' || v_operation.message,
    jsonb_build_object(
      'refundOperationId', v_operation.id,
      'cancellationType', v_operation.cancellation_type,
      'refundMode', v_operation.refund_mode,
      'requestedAmountCents', v_operation.requested_amount_cents,
      'refundedAmountCents', v_operation.refunded_amount_cents
    )
  );

  select * into v_booking
  from public.booking_requests
  where id = v_booking.id;

  v_result := jsonb_build_object('booking', to_jsonb(v_booking));

  update public.refund_operations
  set status = 'succeeded',
      result = v_result,
      completed_at = now(),
      updated_at = now(),
      last_error = null
  where id = p_operation_id;

  return jsonb_build_object(
    'outcome', 'succeeded',
    'should_notify', true,
    'refunded_amount_cents', v_operation.refunded_amount_cents,
    'policy_label', v_operation.policy_label,
    'action', v_operation.action
  ) || v_result;
end;
$$;

revoke all on function public.acquire_stripe_refund_operation(
  uuid, uuid, text, boolean, text, text, bigint, text
) from public, anon, authenticated;
grant execute on function public.acquire_stripe_refund_operation(
  uuid, uuid, text, boolean, text, text, bigint, text
) to service_role;

revoke all on function public.claim_stripe_refund_allocation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_stripe_refund_allocation(uuid, uuid)
  to service_role;

revoke all on function public.record_stripe_refund_result(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_stripe_refund_result(
  uuid, uuid, text, text, jsonb
) to service_role;

revoke all on function public.record_stripe_refund_failure(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_stripe_refund_failure(
  uuid, uuid, text, text, text
) to service_role;

revoke all on function public.finalize_stripe_refund_operation(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_stripe_refund_operation(uuid)
  to service_role;
