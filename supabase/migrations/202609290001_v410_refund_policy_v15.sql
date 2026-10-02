begin;

-- La Maison Verte V4.10 — B3.1
-- Politique d'annulation/remboursement conforme au contrat V1.5.
-- Cette migration remplace uniquement l'autorité d'acquisition/allocation du remboursement.
-- Elle ne modifie ni le ledger, ni les paiements, ni les snapshots contractuels.

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
  v_is_v410 boolean;
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

  -- V4.10: le contrat et l'acompte sont des snapshots contractuels.
  -- Ne jamais recalculer l'acompte V4.10 depuis le total ou un taux courant.
  v_is_v410 := v_booking.contract_total is not null
    and v_booking.deposit_amount is not null
    and v_booking.deposit_basis is not null
    and v_booking.deposit_rate is not null;

  if v_is_v410 then
    v_contract_total_cents := round(v_booking.contract_total * 100)::bigint;
    v_contract_deposit_cents := round(v_booking.deposit_amount * 100)::bigint;
  else
    -- Compatibilité legacy uniquement : utiliser d'abord l'acompte historique s'il existe.
    v_contract_total_cents := round(coalesce(v_booking.owner_price, v_booking.estimated_total, 0) * 100)::bigint;
    v_contract_deposit_cents := case
      when v_booking.deposit_amount is not null then round(v_booking.deposit_amount * 100)::bigint
      else round(v_contract_total_cents * 0.30)::bigint
    end;
  end if;

  v_days := v_booking.start_date - current_date;

  if p_refund_mode = 'policy' then
    if p_cancellation_type = 'owner' then
      v_effective_mode := 'total';
      v_policy_label := 'Annulation propriétaire : remboursement total';
    elsif v_days > 30 then
      v_effective_mode := 'total';
      v_policy_label := 'Annulation client à plus de 30 jours : remboursement total';
    else
      v_effective_mode := 'balance';
      v_policy_label := 'Annulation client à J-30 ou moins : acompte contractuel conservé, tout le reste remboursable';
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

revoke all on function public.acquire_stripe_refund_operation(uuid, uuid, text, boolean, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.acquire_stripe_refund_operation(uuid, uuid, text, boolean, text, text, bigint, text) to service_role;

commit;
