begin;

-- LA MAISON VERTE V4.10 — B4.3.2A-4
-- Taxe de séjour : encaissement réel + composante fiscale explicite des annulations.
--
-- A-4.1 : V4.10 + collecteur la_maison_verte => tourist_tax_collected depuis le ledger.
-- A-4.2 : refund_operations.tourist_tax_refund_cents fige la part de taxe planifiée ;
--         finalize ne matérialise tourist_tax_refunded qu'après succès Stripe complet.
-- Hors périmètre : refund_only/départ anticipé A-4.3, plateformes, legacy, backfill.

-- Préconditions strictes : signatures LIVE attendues, schéma attendu, et absence
-- de données V4.10/remboursement apparues depuis le préflight validé.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apply_stripe_checkout_payment'
    and pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid, p_checkout_session_id text, p_payment_intent_id text, p_payment_type text, p_manual_reason text, p_amount numeric, p_currency text, p_customer_email text, p_metadata jsonb, p_stripe_paid_at timestamp with time zone, p_stripe_fee_amount numeric, p_stripe_net_amount numeric, p_balance_transaction_id text, p_charge_id text, p_arrival_token_hash text';
  if v_count <> 1 then raise exception 'A-4 precondition: payment RPC signature unexpected'; end if;

  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='acquire_stripe_refund_operation'
    and pg_get_function_identity_arguments(p.oid) = 'p_operation_id uuid, p_booking_id uuid, p_action text, p_is_refund_only boolean, p_refund_mode text, p_cancellation_type text, p_custom_amount_cents bigint, p_message text';
  if v_count <> 1 then raise exception 'A-4 precondition: acquire RPC signature unexpected'; end if;

  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='finalize_stripe_refund_operation'
    and pg_get_function_identity_arguments(p.oid) = 'p_operation_id uuid';
  if v_count <> 1 then raise exception 'A-4 precondition: finalize RPC signature unexpected'; end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='refund_operations' and column_name='tourist_tax_refund_cents') then
    raise exception 'A-4 precondition: tourist_tax_refund_cents already exists';
  end if;

  if exists (select 1 from public.booking_requests where contract_total is not null) then
    raise exception 'A-4 precondition: V4.10 bookings appeared since validated preflight; re-audit before migration';
  end if;
  if exists (select 1 from public.refund_operations) then
    raise exception 'A-4 precondition: refund operations appeared since validated preflight; re-audit before migration';
  end if;
end $$;

alter table public.refund_operations
  add column tourist_tax_refund_cents bigint not null default 0;

alter table public.refund_operations
  add constraint refund_operations_tourist_tax_refund_nonnegative_check
    check (tourist_tax_refund_cents >= 0),
  add constraint refund_operations_tourist_tax_refund_requested_check
    check (tourist_tax_refund_cents <= requested_amount_cents);

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
  v_is_v410 boolean := false;
  v_arrival_expires_at timestamptz;
  v_total_paid_ledger numeric := 0;
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
    v_is_v410 := v_booking.contract_total is not null
      and v_booking.deposit_rate is not null
      and v_booking.deposit_basis is not null
      and v_booking.deposit_amount is not null;
    v_total_due := case
      when v_is_v410 then v_booking.contract_total
      else coalesce(v_booking.owner_price, v_booking.estimated_total, 0)
    end;
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

      if v_review_reason is null
        and p_payment_type = 'deposit'
        and v_is_v410
        and abs(p_amount - v_booking.deposit_amount) > 0.01 then
        v_review_reason := 'deposit_amount_mismatch';
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
      elsif v_is_v410
        and p_manual_reason = 'total'
        and abs(p_amount - v_remaining_due) > 0.01 then
        v_review_reason := 'manual_total_amount_mismatch';
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
        deposit_amount = case when v_is_v410 then v_booking.deposit_amount else 0 end,
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
        deposit_amount = case when v_is_v410 then v_booking.deposit_amount else p_amount end,
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
    v_total_due := case when p_manual_reason = 'total' and not v_is_v410 then p_amount else v_total_due end;
    v_fully_paid := v_total_due > 0 and v_new_total_paid >= v_total_due;

    if p_manual_reason = 'total' and v_is_v410 then
      -- V4.10 : un paiement ne modifie jamais le contrat. Le montant a déjà
      -- été contrôlé contre le restant dû ci-dessus.
      v_new_total_paid := v_previous_paid + p_amount;
      update public.booking_requests
      set manual_payment_status = 'paid',
          manual_payment_paid_at = p_stripe_paid_at,
          manual_payment_amount = p_amount,
          manual_payment_reason = p_manual_reason,
          status = 'fully_paid',
          payment_status = 'paid',
          amount_paid = v_new_total_paid,
          balance_status = 'paid',
          balance_paid_at = p_stripe_paid_at,
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
    elsif p_manual_reason = 'total' then
      -- Legacy uniquement : comportement historique conservé.
      v_total_due := p_amount;
      v_fully_paid := true;
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
          deposit_amount = case when v_is_v410 then v_booking.deposit_amount else p_amount end,
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

  -- V4.10 B4.3.2A-4.1 — matérialiser la taxe réellement encaissée.
  -- Le ledger des paiements est l’autorité ; les remboursements sont suivis
  -- séparément dans tourist_tax_refunded. La valeur collectée ne diminue jamais.
  if v_is_v410 and v_booking.tourist_tax_collector = 'la_maison_verte' then
    select coalesce(sum(p.amount), 0)
      into v_total_paid_ledger
    from public.payments p
    where p.booking_request_id = v_booking.id
      and p.status in ('paid', 'partially_refunded', 'refunded');

    update public.booking_requests
    set tourist_tax_collected = greatest(
          coalesce(tourist_tax_collected, 0),
          least(
            coalesce(tourist_tax_amount, 0),
            greatest(
              v_total_paid_ledger - greatest(
                coalesce(contract_total, 0) - coalesce(tourist_tax_amount, 0),
                0
              ),
              0
            )
          )
        ),
        updated_at = now()
    where id = v_booking.id;
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
  v_tourist_tax_refund_cents bigint := 0;
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

  -- B4.3.2A-4.2 — composante fiscale figée au moment de l'acquisition.
  -- Seulement pour une annulation V4.10 collectée par La Maison Verte et
  -- un remboursement contractuel total/balance. Les refund_only et modes
  -- manuels custom/deposit/none restent à 0 dans A-4.
  if not v_is_refund_only
    and v_is_v410
    and v_booking.tourist_tax_collector = 'la_maison_verte'
    and v_effective_mode in ('total', 'balance')
    and p_refund_mode <> 'custom' then
    v_tourist_tax_refund_cents := least(
      v_requested_cents,
      greatest(
        round((coalesce(v_booking.tourist_tax_collected, 0)
          - coalesce(v_booking.tourist_tax_refunded, 0)) * 100)::bigint,
        0
      )
    );
  else
    v_tourist_tax_refund_cents := 0;
  end if;

  insert into public.refund_operations (
    id, booking_request_id, action, is_refund_only, refund_mode,
    cancellation_type, custom_amount_cents, requested_amount_cents,
    tourist_tax_refund_cents, effective_mode, policy_label, message, status
  ) values (
    p_operation_id, p_booking_id, v_action, v_is_refund_only, p_refund_mode,
    p_cancellation_type, p_custom_amount_cents, v_requested_cents,
    v_tourist_tax_refund_cents, v_effective_mode, v_policy_label, coalesce(p_message, ''), 'pending'
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

commit;

-- POSTFLIGHT UNIQUE : une seule table de sortie.
with rpc as (
  select p.proname, p.prosecdef, pg_get_functiondef(p.oid) def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'apply_stripe_checkout_payment',
    'acquire_stripe_refund_operation',
    'finalize_stripe_refund_operation'
  )
), checks as (
  select '01_SCHEMA'::text section, 'tourist_tax_refund_cents'::text item,
    case when exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='refund_operations'
        and column_name='tourist_tax_refund_cents' and data_type='bigint' and is_nullable='NO'
    ) then 'OK' else 'ERREUR' end status,
    'bigint NOT NULL DEFAULT 0 attendu'::text details
  union all
  select '02_RPC', proname,
    case when prosecdef and (
      (proname='apply_stripe_checkout_payment' and def ilike '%tourist_tax_collected = greatest%' and def ilike '%v_total_paid_ledger%') or
      (proname='acquire_stripe_refund_operation' and def ilike '%v_tourist_tax_refund_cents%' and def ilike '%tourist_tax_refund_cents%') or
      (proname='finalize_stripe_refund_operation' and def ilike '%sum(ro.tourist_tax_refund_cents)%' and def ilike '%tourist_tax_refunded = least%')
    ) then 'OK' else 'ERREUR' end,
    concat('security_definer=',prosecdef,' | tax_collected=',def ilike '%tourist_tax_collected%',
           ' | tax_component=',def ilike '%tourist_tax_refund_cents%',
           ' | tax_refunded=',def ilike '%tourist_tax_refunded%')
  from rpc
  union all
  select '03_CONSTRAINTS','tax_refund_constraints',
    case when (select count(*) from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname='refund_operations' and c.conname in (
        'refund_operations_tourist_tax_refund_nonnegative_check','refund_operations_tourist_tax_refund_requested_check'))=2
      then 'OK' else 'ERREUR' end, '2 contraintes attendues'
  union all
  select '04_DATA','integrity',
    case when not exists (select 1 from public.refund_operations where tourist_tax_refund_cents < 0 or tourist_tax_refund_cents > requested_amount_cents)
      and not exists (select 1 from public.booking_requests where tourist_tax_refunded > tourist_tax_collected)
      then 'OK' else 'ERREUR' end,
    concat('operations=',(select count(*) from public.refund_operations),
           ' | v410=',(select count(*) from public.booking_requests where contract_total is not null))
)
select section,item,status,details from checks order by section,item;
