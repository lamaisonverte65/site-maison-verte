-- FIN-04: version the production Stripe balance ledger and derive booking caches from ledgers.
-- Historical compatibility: Stripe stores both charge (ch_...) and refund (re_...)
-- source identifiers in charge_id. The column is intentionally not renamed here.

create table if not exists public.stripe_balance_transactions (
  id text primary key,
  booking_request_id uuid references public.booking_requests(id) on delete set null,
  payment_id text,
  payment_type text,
  payment_intent_id text,
  charge_id text,
  payout_id text,
  type text,
  reporting_category text,
  amount numeric,
  fee numeric,
  net numeric,
  currency text,
  available_on timestamptz,
  created_at_stripe timestamptz,
  description text,
  reconciliation_status text default 'en_attente_payout',
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.stripe_balance_transactions
  add column if not exists booking_request_id uuid,
  add column if not exists payment_id text,
  add column if not exists payment_type text,
  add column if not exists payment_intent_id text,
  add column if not exists charge_id text,
  add column if not exists payout_id text,
  add column if not exists type text,
  add column if not exists reporting_category text,
  add column if not exists amount numeric,
  add column if not exists fee numeric,
  add column if not exists net numeric,
  add column if not exists currency text,
  add column if not exists available_on timestamptz,
  add column if not exists created_at_stripe timestamptz,
  add column if not exists description text,
  add column if not exists reconciliation_status text default 'en_attente_payout',
  add column if not exists raw jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stripe_balance_transactions'::regclass
      and contype = 'f'
      and conkey = array[(select attnum from pg_attribute
        where attrelid = 'public.stripe_balance_transactions'::regclass
          and attname = 'booking_request_id')]
  ) then
    alter table public.stripe_balance_transactions
      add constraint stripe_balance_transactions_booking_request_id_fkey
      foreign key (booking_request_id) references public.booking_requests(id) on delete set null;
  end if;

  if to_regclass('public.stripe_payouts') is not null and not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stripe_balance_transactions'::regclass
      and contype = 'f'
      and conkey = array[(select attnum from pg_attribute
        where attrelid = 'public.stripe_balance_transactions'::regclass
          and attname = 'payout_id')]
  ) then
    alter table public.stripe_balance_transactions
      add constraint stripe_balance_transactions_payout_id_fkey
      foreign key (payout_id) references public.stripe_payouts(id) on delete set null;
  end if;
end;
$$;

create index if not exists idx_stripe_balance_transactions_booking_request_id
  on public.stripe_balance_transactions (booking_request_id);
create index if not exists idx_stripe_balance_transactions_payment_intent_id
  on public.stripe_balance_transactions (payment_intent_id);
create index if not exists idx_stripe_balance_transactions_payout_id
  on public.stripe_balance_transactions (payout_id);

alter table public.stripe_balance_transactions enable row level security;

-- Required by the derived cents formula. Migration 002 repeats this add safely.
alter table public.refunds add column if not exists amount_cents bigint;

create or replace view public.booking_financial_ledger_aggregates
with (security_invoker = true)
as
with eligible_payments as (
  select
    p.id,
    p.booking_request_id,
    p.stripe_checkout_session_id,
    p.stripe_payment_intent_id,
    p.amount,
    round(p.amount * 100)::bigint as paid_cents
  from public.payments p
  where p.booking_request_id is not null
    and p.status in ('paid', 'partially_refunded', 'refunded')
),
payment_totals as (
  select
    p.booking_request_id,
    coalesce(sum(round(p.amount * 100)::bigint), 0)::bigint as gross_paid_cents,
    count(*)::bigint as payment_count,
    count(*) filter (
      where (p.stripe_payment_intent_id is not null or p.stripe_checkout_session_id is not null)
        and not exists (
          select 1
          from public.stripe_balance_transactions bt
          where bt.booking_request_id = p.booking_request_id
            and bt.type = 'charge'
            and bt.amount is not null
            and bt.fee is not null
            and bt.net is not null
            and (
              bt.payment_id = p.id::text
              or bt.payment_intent_id = p.stripe_payment_intent_id
            )
        )
    )::bigint as missing_charge_count
  from eligible_payments p
  group by p.booking_request_id
),
succeeded_refunds as (
  select
    r.id,
    r.booking_request_id,
    r.stripe_refund_id,
    r.amount,
    r.amount_cents,
    coalesce(r.amount_cents, round(r.amount * 100)::bigint) as refunded_cents
  from public.refunds r
  where r.booking_request_id is not null
    and r.status = 'succeeded'
),
refund_totals as (
  select
    r.booking_request_id,
    coalesce(sum(coalesce(r.amount_cents, round(r.amount * 100)::bigint)), 0)::bigint as refunded_cents,
    count(*)::bigint as refund_count,
    count(*) filter (
      where r.stripe_refund_id is null
        or not exists (
          select 1
          from public.stripe_balance_transactions bt
          where bt.booking_request_id = r.booking_request_id
            and bt.type = 'refund'
            and bt.amount is not null
            and bt.fee is not null
            and bt.net is not null
            and (
              bt.charge_id = r.stripe_refund_id
              or bt.raw -> 'source' ->> 'id' = r.stripe_refund_id
            )
        )
    )::bigint as missing_refund_count
  from succeeded_refunds r
  group by r.booking_request_id
),
stripe_totals as (
  select
    bt.booking_request_id,
    coalesce(sum(bt.fee), 0)::numeric as stripe_fee_amount,
    coalesce(sum(bt.net), 0)::numeric as stripe_net_amount,
    count(*)::bigint as stripe_transaction_count,
    count(*) filter (
      where bt.amount is null or bt.fee is null or bt.net is null
    )::bigint as missing_transaction_value_count
  from public.stripe_balance_transactions bt
  where bt.booking_request_id is not null
  group by bt.booking_request_id
)
select
  br.id as booking_request_id,
  coalesce(pt.gross_paid_cents, 0)::bigint as gross_paid_cents,
  coalesce(rt.refunded_cents, 0)::bigint as refunded_cents,
  greatest(
    coalesce(pt.gross_paid_cents, 0)::bigint - coalesce(rt.refunded_cents, 0)::bigint,
    0::bigint
  ) as amount_paid_cents,
  coalesce(st.stripe_fee_amount, 0)::numeric as stripe_fee_amount,
  coalesce(st.stripe_net_amount, 0)::numeric as stripe_net_amount,
  coalesce(pt.payment_count, 0)::bigint as payment_count,
  coalesce(rt.refund_count, 0)::bigint as refund_count,
  coalesce(st.stripe_transaction_count, 0)::bigint as stripe_transaction_count,
  coalesce(st.missing_transaction_value_count, 0)::bigint as missing_transaction_value_count,
  coalesce(pt.missing_charge_count, 0)::bigint as missing_charge_count,
  coalesce(rt.missing_refund_count, 0)::bigint as missing_refund_count,
  (
    coalesce(pt.missing_charge_count, 0) = 0
    and coalesce(rt.missing_refund_count, 0) = 0
    and coalesce(st.missing_transaction_value_count, 0) = 0
  ) as stripe_financials_complete,
  abs(
    round((coalesce(br.amount_paid, 0) + coalesce(br.refunded_amount, 0)) * 100)::bigint
    - coalesce(pt.gross_paid_cents, 0)::bigint
  ) <= 1 as backfill_safe
from public.booking_requests br
left join payment_totals pt on pt.booking_request_id = br.id
left join refund_totals rt on rt.booking_request_id = br.id
left join stripe_totals st on st.booking_request_id = br.id;

revoke all on public.booking_financial_ledger_aggregates from public, anon;
grant select on public.booking_financial_ledger_aggregates to authenticated, service_role;

create or replace function public.recompute_booking_financial_aggregates(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aggregate public.booking_financial_ledger_aggregates%rowtype;
begin
  perform 1
  from public.booking_requests
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'booking not found';
  end if;

  select * into v_aggregate
  from public.booking_financial_ledger_aggregates
  where booking_request_id = p_booking_id;

  update public.booking_requests
  set amount_paid = v_aggregate.amount_paid_cents / 100.0,
      refunded_amount = v_aggregate.refunded_cents / 100.0,
      updated_at = now()
  where id = p_booking_id;

  if v_aggregate.stripe_financials_complete then
    update public.booking_requests
    set stripe_fee_amount = v_aggregate.stripe_fee_amount,
        stripe_net_amount = v_aggregate.stripe_net_amount,
        commission_amount = v_aggregate.stripe_fee_amount,
        owner_net_amount = v_aggregate.stripe_net_amount,
        updated_at = now()
    where id = p_booking_id;
  end if;

  return jsonb_build_object(
    'bookingRequestId', p_booking_id,
    'grossPaidCents', v_aggregate.gross_paid_cents,
    'refundedCents', v_aggregate.refunded_cents,
    'amountPaidCents', v_aggregate.amount_paid_cents,
    'stripeFeeAmount', v_aggregate.stripe_fee_amount,
    'stripeNetAmount', v_aggregate.stripe_net_amount,
    'stripeFinancialsComplete', v_aggregate.stripe_financials_complete,
    'missingChargeCount', v_aggregate.missing_charge_count,
    'missingRefundCount', v_aggregate.missing_refund_count,
    'missingTransactionValueCount', v_aggregate.missing_transaction_value_count
  );
end;
$$;

revoke all on function public.recompute_booking_financial_aggregates(uuid)
  from public, anon, authenticated;
grant execute on function public.recompute_booking_financial_aggregates(uuid)
  to service_role;

-- Guarded historical backfill: unsafe or incomplete rows retain every cached value.
do $$
declare
  v_booking record;
begin
  for v_booking in
    select booking_request_id
    from public.booking_financial_ledger_aggregates
    where backfill_safe
      and stripe_financials_complete
  loop
    perform public.recompute_booking_financial_aggregates(v_booking.booking_request_id);
  end loop;
end;
$$;
