-- La Maison Verte V4.10 — application atomique d'un paiement ménage post-séjour.
-- Le paiement reste hors agrégats contractuels : payments.booking_request_id est NULL ;
-- la relation à la réservation passe par booking_cleaning_issues et metadata.

create or replace function public.apply_post_stay_cleaning_payment(
  p_cleaning_issue_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount numeric,
  p_currency text,
  p_customer_email text,
  p_metadata jsonb,
  p_stripe_paid_at timestamptz,
  p_stripe_fee_amount numeric,
  p_stripe_net_amount numeric,
  p_balance_transaction_id text,
  p_charge_id text
)
returns table (outcome text, booking jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue public.booking_cleaning_issues%rowtype;
  v_booking public.booking_requests%rowtype;
  v_payment_id uuid;
  v_inserted boolean := false;
begin
  if p_cleaning_issue_id is null or nullif(p_checkout_session_id, '') is null then
    raise exception 'cleaning_payment_reference_missing';
  end if;

  select * into v_issue
  from public.booking_cleaning_issues
  where id = p_cleaning_issue_id
  for update;
  if not found then raise exception 'cleaning_issue_not_found'; end if;

  select * into v_booking
  from public.booking_requests
  where id = v_issue.booking_request_id;
  if not found then raise exception 'booking_not_found'; end if;

  if v_issue.status = 'paid' then
    return query select 'already_applied', to_jsonb(v_booking);
    return;
  end if;
  if v_issue.status <> 'payment_requested' then
    return query select 'review_required', to_jsonb(v_booking);
    return;
  end if;
  if v_issue.stripe_session_id is distinct from p_checkout_session_id then
    return query select 'review_required', to_jsonb(v_booking);
    return;
  end if;
  if coalesce(p_amount, 0) <= 0 or round(p_amount * 100) <> round(v_issue.amount_due * 100) then
    return query select 'review_required', to_jsonb(v_booking);
    return;
  end if;

  insert into public.payments (
    booking_request_id, payment_type, manual_reason, amount, currency, status,
    stripe_checkout_session_id, stripe_payment_intent_id, customer_email, paid_at, metadata
  ) values (
    null, 'manual', 'cleaning', p_amount, coalesce(nullif(p_currency, ''), 'eur'), 'paid',
    p_checkout_session_id, p_payment_intent_id, p_customer_email, p_stripe_paid_at,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'booking_id', v_booking.id,
      'cleaning_issue_id', v_issue.id,
      'post_stay_cleaning', true
    )
  )
  on conflict (stripe_checkout_session_id) do nothing
  returning id, true into v_payment_id, v_inserted;

  if not coalesce(v_inserted, false) then
    select id into v_payment_id
    from public.payments
    where stripe_checkout_session_id = p_checkout_session_id;
    if v_payment_id is null then
      return query select 'review_required', to_jsonb(v_booking);
      return;
    end if;
  end if;

  if coalesce(p_balance_transaction_id, '') <> ''
    and p_stripe_fee_amount is not null
    and p_stripe_net_amount is not null then
    insert into public.stripe_balance_transactions (
      id, booking_request_id, payment_id, payment_type, payment_intent_id, charge_id,
      type, reporting_category, amount, fee, net, currency, created_at_stripe,
      reconciliation_status, updated_at
    ) values (
      p_balance_transaction_id, null, v_payment_id, 'manual', p_payment_intent_id, p_charge_id,
      'charge', 'charge', p_amount, p_stripe_fee_amount, p_stripe_net_amount,
      coalesce(nullif(p_currency, ''), 'eur'), p_stripe_paid_at, 'en_attente_payout', now()
    )
    on conflict (id) do update
    set booking_request_id = null,
        payment_id = excluded.payment_id,
        payment_type = excluded.payment_type,
        payment_intent_id = excluded.payment_intent_id,
        charge_id = excluded.charge_id,
        amount = excluded.amount,
        fee = excluded.fee,
        net = excluded.net,
        currency = excluded.currency,
        updated_at = now();
  end if;

  update public.booking_cleaning_issues
  set status = 'paid',
      paid_at = coalesce(p_stripe_paid_at, now()),
      payment_id = v_payment_id,
      updated_at = now()
  where id = v_issue.id;

  insert into public.booking_events (
    booking_request_id, event_type, label, message, metadata
  ) values (
    v_booking.id,
    'post_stay_cleaning_paid',
    'Ménage après séjour payé',
    'Le paiement séparé du ménage après séjour a été reçu.',
    jsonb_build_object('cleaningIssueId', v_issue.id, 'paymentId', v_payment_id, 'amount', p_amount)
  );

  return query select case when v_inserted then 'applied' else 'already_applied' end, to_jsonb(v_booking);
end;
$$;

revoke all on function public.apply_post_stay_cleaning_payment(uuid,text,text,numeric,text,text,jsonb,timestamptz,numeric,numeric,text,text)
  from public, anon, authenticated;
grant execute on function public.apply_post_stay_cleaning_payment(uuid,text,text,numeric,text,text,jsonb,timestamptz,numeric,numeric,text,text)
  to service_role;
