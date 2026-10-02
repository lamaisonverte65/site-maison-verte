-- V4.10 — séparation définitive des notes internes et du champ legacy owner_message.
-- owner_message reste en lecture seule pour préserver l’historique ambigu.

alter table public.booking_requests
  add column if not exists internal_notes text;

comment on column public.booking_requests.internal_notes is
  'Notes internes admin liées à la réservation. Non envoyées au client et distinctes des notes ménage.';

-- Le RPC de finalisation des remboursements est redéfini depuis sa version A-4.2
-- afin qu’aucune nouvelle opération ne réécrive owner_message. Le motif reste
-- tracé dans refund_reason et booking_events.

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
  v_tourist_tax_refunded_cents bigint := 0;
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

  -- B4.3.2A-4.2 — matérialiser uniquement la composante fiscale d'opérations
  -- effectivement finalisées. L'opération courante est incluse explicitement :
  -- toutes ses allocations Stripe ont déjà été vérifiées succeeded ci-dessus.
  if v_booking.contract_total is not null
    and v_booking.deposit_rate is not null
    and v_booking.deposit_basis is not null
    and v_booking.deposit_amount is not null
    and v_booking.tourist_tax_collector = 'la_maison_verte' then
    select coalesce(sum(ro.tourist_tax_refund_cents), 0)::bigint
      into v_tourist_tax_refunded_cents
    from public.refund_operations ro
    where ro.booking_request_id = v_booking.id
      and (ro.status = 'succeeded' or ro.id = p_operation_id);

    update public.booking_requests
    set tourist_tax_refunded = least(
          coalesce(tourist_tax_collected, 0),
          v_tourist_tax_refunded_cents / 100.0
        ),
        updated_at = now()
    where id = v_booking.id;

    select * into v_booking
    from public.booking_requests
    where id = v_booking.id;
  end if;

  if v_operation.is_refund_only then
    update public.booking_requests
    set payment_status = case
          when v_operation.refunded_amount_cents > 0 and greatest(v_booking_paid_cents - v_booking_refunded_cents, 0) > 0
            then 'partially_refunded'
          when v_operation.refunded_amount_cents > 0 then 'refunded'
          else payment_status
        end,
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
      'refundedAmountCents', v_operation.refunded_amount_cents,
      'touristTaxRefundCents', v_operation.tourist_tax_refund_cents
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

revoke all on function public.apply_stripe_checkout_payment(uuid,text,text,text,text,numeric,text,text,jsonb,timestamptz,numeric,numeric,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_stripe_checkout_payment(uuid,text,text,text,text,numeric,text,text,jsonb,timestamptz,numeric,numeric,text,text,text) to service_role;
revoke all on function public.acquire_stripe_refund_operation(uuid,uuid,text,boolean,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.acquire_stripe_refund_operation(uuid,uuid,text,boolean,text,text,bigint,text) to service_role;

revoke all on function public.finalize_stripe_refund_operation(uuid) from public, anon, authenticated;
grant execute on function public.finalize_stripe_refund_operation(uuid) to service_role;
