create or replace function public.apply_stripe_checkout_payment(
  p_booking_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_payment_type text,
  p_manual_reason text,
  p_amount numeric,
  p_currency text,
  p_customer_email text,
  p_metadata jsonb,
  p_stripe_paid_at timestamptz,
  p_stripe_fee_amount numeric,
  p_stripe_net_amount numeric,
  p_balance_transaction_id text,
  p_charge_id text,
  p_arrival_token_hash text
)
returns table (
  outcome text,
  review_reason text,
  booking jsonb,
  arrival_token_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.booking_requests%rowtype;
  v_existing_status text;
  v_review_reason text;
  v_payment_acquired boolean := false;
  v_payment_id text;
  v_total_due numeric := 0;
  v_previous_paid numeric := 0;
  v_new_total_paid numeric := 0;
  v_remaining_due numeric := 0;
  v_fully_paid boolean := false;
  v_applied_amount numeric := 0;
  v_discount_amount numeric := 0;
  v_arrival_expires_at timestamptz;
begin
  if p_checkout_session_id is null or btrim(p_checkout_session_id) = '' then
    raise exception 'checkout_session_id is required';
  end if;

  if p_stripe_paid_at is null then
    raise exception 'stripe_paid_at is required';
  end if;

  if p_arrival_token_hash is null or p_arrival_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'valid arrival_token_hash is required';
  end if;

  select status
    into v_existing_status
  from public.payments
  where stripe_checkout_session_id = p_checkout_session_id;

  if found then
    return query select
      case when v_existing_status = 'requires_review' then 'review_required' else 'already_applied' end,
      case when v_existing_status = 'requires_review' then 'previously_flagged' else null end,
      null::jsonb,
      null::timestamptz;
    return;
  end if;

  select *
    into v_booking
  from public.booking_requests
  where id = p_booking_id
  for update;

  if not found then
    v_review_reason := 'booking_not_found';
  else
    v_total_due := coalesce(v_booking.owner_price, v_booking.estimated_total, 0);
    v_previous_paid := coalesce(v_booking.amount_paid, 0);
    v_remaining_due := greatest(v_total_due - v_previous_paid, 0);

    if v_booking.status in ('cancelled', 'refused', 'expired') then
      v_review_reason := 'booking_' || v_booking.status;
    elsif p_payment_type in ('deposit', 'full') then
      if v_booking.status <> 'accepted' then
        v_review_reason := 'initial_payment_status_incompatible';
      elsif v_booking.acceptance_expires_at is not null
        and p_stripe_paid_at > v_booking.acceptance_expires_at then
        v_review_reason := 'acceptance_expired_before_payment';
      elsif coalesce(v_booking.payment_link, '') <> '' then
        if position(p_checkout_session_id in v_booking.payment_link) = 0 then
          v_review_reason := 'initial_checkout_session_obsolete';
        end if;
      elsif coalesce(v_booking.stripe_checkout_session_id, '') <> p_checkout_session_id then
        v_review_reason := 'initial_checkout_session_obsolete';
      end if;

      if v_review_reason is null
        and p_payment_type = 'full'
        and abs(p_amount - v_total_due) > 0.01 then
        v_review_reason := 'full_amount_mismatch';
      end if;
    elsif p_payment_type = 'balance' then
      if v_booking.status not in ('deposit_paid', 'paid') then
        v_review_reason := 'balance_payment_status_incompatible';
      elsif position(p_checkout_session_id in coalesce(v_booking.balance_payment_link, '')) = 0 then
        v_review_reason := 'balance_checkout_session_obsolete';
      elsif v_remaining_due <= 0 then
        v_review_reason := 'booking_already_fully_paid';
      elsif p_amount > v_remaining_due + 0.01 then
        v_review_reason := 'balance_exceeds_remaining_due';
      end if;
    elsif p_payment_type = 'manual' then
      if coalesce(v_booking.manual_payment_stripe_session_id, '') <> p_checkout_session_id then
        v_review_reason := 'manual_checkout_session_obsolete';
      end if;
    else
      v_review_reason := 'unsupported_payment_type';
    end if;
  end if;

  if coalesce(p_amount, 0) <= 0 and v_review_reason is null then
    v_review_reason := 'invalid_paid_amount';
  end if;

  if v_review_reason is not null then
    v_payment_acquired := false;
    insert into public.payments (
      booking_request_id,
      payment_type,
      manual_reason,
      amount,
      currency,
      status,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      customer_email,
      paid_at,
      metadata
    ) values (
      null,
      coalesce(nullif(p_payment_type, ''), 'unknown'),
      p_manual_reason,
      coalesce(p_amount, 0),
      coalesce(nullif(p_currency, ''), 'eur'),
      'requires_review',
      p_checkout_session_id,
      p_payment_intent_id,
      p_customer_email,
      p_stripe_paid_at,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'review_reason', v_review_reason,
        'booking_id', p_booking_id,
        'stripe_amount', coalesce(p_amount, 0)
      )
    )
    on conflict (stripe_checkout_session_id) do nothing
    returning true into v_payment_acquired;

    if not coalesce(v_payment_acquired, false) then
      select status
        into v_existing_status
      from public.payments
      where stripe_checkout_session_id = p_checkout_session_id;

      return query select
        case when v_existing_status = 'requires_review' then 'review_required' else 'already_applied' end,
        case when v_existing_status = 'requires_review' then 'previously_flagged' else null end,
        null::jsonb,
        null::timestamptz;
      return;
    end if;

    if v_booking.id is not null then
      insert into public.booking_events (
        booking_request_id,
        event_type,
        label,
        message,
        metadata
      ) values (
        v_booking.id,
        'payment_requires_review',
        'Paiement Stripe a verifier',
        'Une Checkout Session payee est incompatible avec l etat courant de la reservation.',
        jsonb_build_object(
          'reviewReason', v_review_reason,
          'paymentType', p_payment_type,
          'sessionId', p_checkout_session_id,
          'paymentIntentId', p_payment_intent_id,
          'amount', coalesce(p_amount, 0)
        )
      );
    end if;

    return query select 'review_required', v_review_reason, null::jsonb, null::timestamptz;
    return;
  end if;

  v_applied_amount := p_amount;

  v_payment_acquired := false;
  insert into public.payments (
    booking_request_id,
    payment_type,
    manual_reason,
    amount,
    currency,
    status,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    customer_email,
    paid_at,
    metadata
  ) values (
    v_booking.id,
    p_payment_type,
    case when p_payment_type = 'manual' then p_manual_reason else null end,
    v_applied_amount,
    coalesce(nullif(p_currency, ''), 'eur'),
    'paid',
    p_checkout_session_id,
    p_payment_intent_id,
    p_customer_email,
    p_stripe_paid_at,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (stripe_checkout_session_id) do nothing
  returning id::text, true into v_payment_id, v_payment_acquired;

  if not coalesce(v_payment_acquired, false) then
    return query select 'already_applied', null::text, null::jsonb, null::timestamptz;
    return;
  end if;

  v_arrival_expires_at := ((v_booking.end_date + 1)::text || 'T00:00:00Z')::timestamptz - interval '1 millisecond';

  if p_payment_type = 'full' then
    update public.booking_requests
    set status = 'fully_paid',
        payment_status = 'paid',
        deposit_amount = 0,
        balance_amount = v_total_due,
        deposit_status = 'non applicable',
        balance_status = 'paid',
        balance_paid_at = p_stripe_paid_at,
        amount_paid = v_total_due,
        stripe_checkout_session_id = p_checkout_session_id,
        stripe_payment_intent_id = p_payment_intent_id,
        last_payment_type = 'full',
        last_payment_amount = p_amount,
        last_payment_paid_at = p_stripe_paid_at,
        confirmed_at = p_stripe_paid_at,
        arrival_token_hash = p_arrival_token_hash,
        arrival_token_expires_at = v_arrival_expires_at,
        arrival_token_created_at = now(),
        updated_at = now()
    where id = v_booking.id;
  elsif p_payment_type = 'deposit' then
    update public.booking_requests
    set status = 'deposit_paid',
        payment_status = 'paid',
        deposit_amount = p_amount,
        balance_amount = greatest(v_total_due - p_amount, 0),
        deposit_status = 'paid',
        deposit_paid_at = p_stripe_paid_at,
        balance_status = 'en attente',
        amount_paid = p_amount,
        stripe_checkout_session_id = p_checkout_session_id,
        stripe_payment_intent_id = p_payment_intent_id,
        last_payment_type = 'deposit',
        last_payment_amount = p_amount,
        last_payment_paid_at = p_stripe_paid_at,
        confirmed_at = p_stripe_paid_at,
        arrival_token_hash = p_arrival_token_hash,
        arrival_token_expires_at = v_arrival_expires_at,
        arrival_token_created_at = now(),
        updated_at = now()
    where id = v_booking.id;
  elsif p_payment_type = 'balance' then
    v_new_total_paid := v_previous_paid + p_amount;
    v_fully_paid := v_total_due > 0 and v_new_total_paid >= v_total_due;

    update public.booking_requests
    set status = case when v_fully_paid then 'fully_paid' else 'paid' end,
        payment_status = 'paid',
        balance_status = case when v_fully_paid then 'paid' else 'partiellement payé' end,
        balance_paid_at = case when v_fully_paid then p_stripe_paid_at else v_booking.balance_paid_at end,
        amount_paid = v_new_total_paid,
        stripe_checkout_session_id = p_checkout_session_id,
        stripe_payment_intent_id = p_payment_intent_id,
        last_payment_type = 'balance',
        last_payment_amount = p_amount,
        last_payment_paid_at = p_stripe_paid_at,
        confirmed_at = p_stripe_paid_at,
        arrival_token_hash = p_arrival_token_hash,
        arrival_token_expires_at = v_arrival_expires_at,
        arrival_token_created_at = now(),
        updated_at = now()
    where id = v_booking.id;
  else
    v_new_total_paid := v_previous_paid + p_amount;
    v_total_due := case when p_manual_reason = 'total' then p_amount else v_total_due end;
    v_fully_paid := v_total_due > 0 and v_new_total_paid >= v_total_due;

    if p_manual_reason = 'total' then
      v_discount_amount := greatest(coalesce(v_booking.estimated_total, 0) - p_amount, 0);
      update public.booking_requests
      set manual_payment_status = 'paid',
          manual_payment_paid_at = p_stripe_paid_at,
          manual_payment_amount = p_amount,
          manual_payment_reason = p_manual_reason,
          status = 'fully_paid',
          payment_status = 'paid',
          owner_price = p_amount,
          amount_paid = p_amount,
          deposit_amount = 0,
          balance_amount = p_amount,
          deposit_status = 'non applicable',
          balance_status = 'paid',
          balance_paid_at = p_stripe_paid_at,
          discount_amount = case when v_discount_amount > 0 then v_discount_amount else coalesce(v_booking.discount_amount, 0) end,
          discount_reason = case when v_discount_amount > 0 then 'Paiement total manuel / tarif promo' else v_booking.discount_reason end,
          stripe_checkout_session_id = p_checkout_session_id,
          stripe_payment_intent_id = p_payment_intent_id,
          last_payment_type = 'manual:total',
          last_payment_amount = p_amount,
          last_payment_paid_at = p_stripe_paid_at,
          confirmed_at = p_stripe_paid_at,
          arrival_token_hash = p_arrival_token_hash,
          arrival_token_expires_at = v_arrival_expires_at,
          arrival_token_created_at = now(),
          updated_at = now()
      where id = v_booking.id;
    elsif p_manual_reason = 'acompte' then
      update public.booking_requests
      set manual_payment_status = 'paid',
          manual_payment_paid_at = p_stripe_paid_at,
          manual_payment_amount = p_amount,
          manual_payment_reason = p_manual_reason,
          status = case when v_fully_paid then 'fully_paid' else 'deposit_paid' end,
          payment_status = 'paid',
          deposit_amount = p_amount,
          deposit_status = 'paid',
          deposit_paid_at = p_stripe_paid_at,
          balance_amount = greatest(v_total_due - v_new_total_paid, 0),
          balance_status = case when v_fully_paid then 'paid' else 'en attente' end,
          balance_paid_at = case when v_fully_paid then p_stripe_paid_at else v_booking.balance_paid_at end,
          amount_paid = v_new_total_paid,
          stripe_checkout_session_id = p_checkout_session_id,
          stripe_payment_intent_id = p_payment_intent_id,
          last_payment_type = 'manual:acompte',
          last_payment_amount = p_amount,
          last_payment_paid_at = p_stripe_paid_at,
          confirmed_at = p_stripe_paid_at,
          arrival_token_hash = p_arrival_token_hash,
          arrival_token_expires_at = v_arrival_expires_at,
          arrival_token_created_at = now(),
          updated_at = now()
      where id = v_booking.id;
    else
      update public.booking_requests
      set manual_payment_status = 'paid',
          manual_payment_paid_at = p_stripe_paid_at,
          manual_payment_amount = p_amount,
          manual_payment_reason = p_manual_reason,
          status = case when v_fully_paid then 'fully_paid' else 'paid' end,
          payment_status = 'paid',
          balance_status = case when v_fully_paid then 'paid' else coalesce(v_booking.balance_status, 'partiellement payé') end,
          balance_paid_at = case when v_fully_paid then p_stripe_paid_at else v_booking.balance_paid_at end,
          amount_paid = v_new_total_paid,
          stripe_checkout_session_id = p_checkout_session_id,
          stripe_payment_intent_id = p_payment_intent_id,
          last_payment_type = 'manual:' || coalesce(p_manual_reason, 'complement'),
          last_payment_amount = p_amount,
          last_payment_paid_at = p_stripe_paid_at,
          confirmed_at = p_stripe_paid_at,
          arrival_token_hash = p_arrival_token_hash,
          arrival_token_expires_at = v_arrival_expires_at,
          arrival_token_created_at = now(),
          updated_at = now()
      where id = v_booking.id;
    end if;
  end if;

  if coalesce(p_balance_transaction_id, '') <> ''
    and p_stripe_fee_amount is not null
    and p_stripe_net_amount is not null then
    insert into public.stripe_balance_transactions (
      id,
      booking_request_id,
      payment_id,
      payment_type,
      payment_intent_id,
      charge_id,
      type,
      reporting_category,
      amount,
      fee,
      net,
      currency,
      created_at_stripe,
      reconciliation_status,
      updated_at
    ) values (
      p_balance_transaction_id,
      v_booking.id,
      v_payment_id,
      p_payment_type,
      p_payment_intent_id,
      p_charge_id,
      'charge',
      'charge',
      p_amount,
      p_stripe_fee_amount,
      p_stripe_net_amount,
      coalesce(nullif(p_currency, ''), 'eur'),
      p_stripe_paid_at,
      'en_attente_payout',
      now()
    )
    on conflict (id) do update
    set booking_request_id = excluded.booking_request_id,
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

  perform public.recompute_booking_financial_aggregates(v_booking.id);

  insert into public.booking_events (
    booking_request_id,
    event_type,
    label,
    message,
    metadata
  ) values (
    v_booking.id,
    'payment_received',
    case
      when p_payment_type = 'manual' then 'Paiement manuel recu'
      else 'Paiement recu : ' || p_payment_type
    end,
    'Montant recu : ' || v_applied_amount::text || ' EUR',
    jsonb_build_object(
      'paymentType', p_payment_type,
      'manualReason', p_manual_reason,
      'sessionId', p_checkout_session_id,
      'paymentIntentId', p_payment_intent_id,
      'amount', v_applied_amount,
      'stripeFeeAmount', p_stripe_fee_amount,
      'stripeNetAmount', p_stripe_net_amount,
      'stripeBalanceTransactionId', p_balance_transaction_id,
      'stripeChargeId', p_charge_id
    )
  );

  update public.booking_requests
  set status = 'expired',
      updated_at = now()
  where id <> v_booking.id
    and status in ('pending', 'accepted')
    and start_date < v_booking.end_date
    and end_date > v_booking.start_date;

  select *
    into v_booking
  from public.booking_requests
  where id = v_booking.id;

  return query select 'applied', null::text, to_jsonb(v_booking), v_arrival_expires_at;
end;
$$;

revoke all on function public.apply_stripe_checkout_payment(
  uuid, text, text, text, text, numeric, text, text, jsonb, timestamptz,
  numeric, numeric, text, text, text
) from public, anon, authenticated;

grant execute on function public.apply_stripe_checkout_payment(
  uuid, text, text, text, text, numeric, text, text, jsonb, timestamptz,
  numeric, numeric, text, text, text
) to service_role;
