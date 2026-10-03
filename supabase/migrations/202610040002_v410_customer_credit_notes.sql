begin;

-- La Maison Verte V4.10 — Avoirs clients liés aux remboursements réels
-- Additif : aucune facture, réservation, paiement ou opération de remboursement existante n'est modifiée.

create table public.customer_credit_note_counters (
  credit_note_year integer primary key check (credit_note_year between 2000 and 9999),
  last_number integer not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now()
);

create table public.customer_credit_notes (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.customer_invoices(id) on update restrict on delete restrict,
  booking_request_id uuid references public.booking_requests(id) on update restrict on delete set null,
  refund_operation_id uuid not null references public.refund_operations(id) on update restrict on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'issued')),
  credit_note_number text unique,
  issued_at timestamptz,
  seller_snapshot jsonb not null default '{}'::jsonb,
  customer_snapshot jsonb not null default '{}'::jsonb,
  stay_snapshot jsonb not null default '{}'::jsonb,
  financial_snapshot jsonb not null default '{}'::jsonb,
  refund_snapshot jsonb not null default '{}'::jsonb,
  currency text not null default 'eur',
  total_amount numeric(12,2) not null check (total_amount > 0),
  pdf_storage_path text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (refund_operation_id),
  constraint customer_credit_notes_issue_state_check check (
    (status = 'draft' and credit_note_number is null and issued_at is null)
    or (status = 'issued' and credit_note_number is not null and issued_at is not null)
  )
);

create index customer_credit_notes_invoice_idx on public.customer_credit_notes(invoice_id, created_at);
create index customer_credit_notes_booking_idx on public.customer_credit_notes(booking_request_id) where booking_request_id is not null;
create index customer_credit_notes_issued_idx on public.customer_credit_notes(issued_at desc) where status = 'issued';

alter table public.customer_credit_note_counters enable row level security;
alter table public.customer_credit_notes enable row level security;
revoke all on table public.customer_credit_note_counters from anon, authenticated;
revoke all on table public.customer_credit_notes from anon, authenticated;
grant select on table public.customer_credit_note_counters to authenticated;
grant select on table public.customer_credit_notes to authenticated;
create policy customer_credit_note_counters_owner_only on public.customer_credit_note_counters
  for select to authenticated using (public.is_v4_owner());
create policy customer_credit_notes_owner_only on public.customer_credit_notes
  for all to authenticated using (public.is_v4_owner()) with check (public.is_v4_owner());

create or replace function public.protect_issued_customer_credit_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'issued' then raise exception 'issued_credit_note_immutable'; end if;
    return old;
  end if;
  if old.status = 'draft' and new.status = 'draft' then
    if new.id is distinct from old.id
      or new.invoice_id is distinct from old.invoice_id
      or new.booking_request_id is distinct from old.booking_request_id
      or new.refund_operation_id is distinct from old.refund_operation_id
      or new.credit_note_number is distinct from old.credit_note_number
      or new.issued_at is distinct from old.issued_at
      or new.seller_snapshot is distinct from old.seller_snapshot
      or new.customer_snapshot is distinct from old.customer_snapshot
      or new.stay_snapshot is distinct from old.stay_snapshot
      or new.refund_snapshot is distinct from old.refund_snapshot
      or new.currency is distinct from old.currency
      or new.total_amount is distinct from old.total_amount
      or new.pdf_storage_path is distinct from old.pdf_storage_path
      or new.created_at is distinct from old.created_at
    then raise exception 'credit_note_authoritative_fields_immutable'; end if;
  end if;
  if old.status = 'issued' then
    if new.id is distinct from old.id
      or new.invoice_id is distinct from old.invoice_id
      or new.booking_request_id is distinct from old.booking_request_id
      or new.refund_operation_id is distinct from old.refund_operation_id
      or new.status is distinct from old.status
      or new.credit_note_number is distinct from old.credit_note_number
      or new.issued_at is distinct from old.issued_at
      or new.seller_snapshot is distinct from old.seller_snapshot
      or new.customer_snapshot is distinct from old.customer_snapshot
      or new.stay_snapshot is distinct from old.stay_snapshot
      or new.financial_snapshot is distinct from old.financial_snapshot
      or new.refund_snapshot is distinct from old.refund_snapshot
      or new.currency is distinct from old.currency
      or new.total_amount is distinct from old.total_amount
      or new.created_at is distinct from old.created_at
      or (old.pdf_storage_path is not null and new.pdf_storage_path is distinct from old.pdf_storage_path)
      or (old.pdf_storage_path is null and new.pdf_storage_path is null and new.updated_at is distinct from old.updated_at)
    then raise exception 'issued_credit_note_immutable'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_issued_customer_credit_note() from public, anon, authenticated;
create trigger protect_issued_customer_credit_note_before_update
before update on public.customer_credit_notes for each row execute function public.protect_issued_customer_credit_note();
create trigger protect_issued_customer_credit_note_before_delete
before delete on public.customer_credit_notes for each row execute function public.protect_issued_customer_credit_note();

create or replace function public.admin_issue_customer_credit_note(p_credit_note_id uuid)
returns public.customer_credit_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note public.customer_credit_notes%rowtype;
  v_year integer;
  v_number integer;
  v_manual boolean;
  v_accommodation numeric;
  v_cleaning numeric;
  v_tax numeric;
  v_components_cents bigint;
  v_total_cents bigint;
begin
  if not public.is_v4_owner() then raise exception 'owner_required'; end if;
  select * into v_note from public.customer_credit_notes where id = p_credit_note_id for update;
  if not found then raise exception 'credit_note_not_found'; end if;
  if v_note.status <> 'draft' then raise exception 'credit_note_not_draft'; end if;

  v_manual := coalesce((v_note.financial_snapshot ->> 'manual_required')::boolean, true);
  v_accommodation := nullif(v_note.financial_snapshot ->> 'accommodation_refund', '')::numeric;
  v_cleaning := nullif(v_note.financial_snapshot ->> 'cleaning_refund', '')::numeric;
  v_tax := nullif(v_note.financial_snapshot ->> 'tourist_tax_refund', '')::numeric;
  if v_manual or v_accommodation is null or v_cleaning is null or v_tax is null
     or v_accommodation < 0 or v_cleaning < 0 or v_tax < 0 then
    raise exception 'credit_note_breakdown_incomplete';
  end if;
  v_components_cents := round(v_accommodation * 100)::bigint + round(v_cleaning * 100)::bigint + round(v_tax * 100)::bigint;
  v_total_cents := round(v_note.total_amount * 100)::bigint;
  if v_components_cents <> v_total_cents then raise exception 'credit_note_total_mismatch'; end if;
  if round(v_tax * 100)::bigint <> coalesce((v_note.refund_snapshot ->> 'tourist_tax_refund_cents')::bigint, 0) then
    raise exception 'credit_note_tax_mismatch';
  end if;

  v_year := extract(year from timezone('Europe/Paris', now()))::integer;
  insert into public.customer_credit_note_counters(credit_note_year, last_number)
  values (v_year, 1)
  on conflict (credit_note_year) do update
    set last_number = public.customer_credit_note_counters.last_number + 1, updated_at = now()
  returning last_number into v_number;

  update public.customer_credit_notes
  set status='issued', credit_note_number=format('AV-LMV-%s-%s', v_year, lpad(v_number::text,4,'0')),
      issued_at=now(), updated_at=now()
  where id=p_credit_note_id returning * into v_note;
  return v_note;
end;
$$;
revoke all on function public.admin_issue_customer_credit_note(uuid) from public, anon;
grant execute on function public.admin_issue_customer_credit_note(uuid) to authenticated;

create or replace function public.create_customer_credit_note_after_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.customer_invoices%rowtype;
  v_invoice_count integer;
  v_total_cents bigint;
  v_tax_cents bigint;
  v_remaining_cents bigint;
  v_invoice_total_cents bigint;
  v_invoice_accommodation numeric;
  v_invoice_cleaning numeric;
  v_invoice_tax numeric;
  v_financial jsonb;
  v_kind text;
  v_manual boolean := false;
  v_accommodation_refund numeric;
  v_cleaning_refund numeric;
begin
  if not (old.status is distinct from 'succeeded' and new.status = 'succeeded' and new.refunded_amount_cents > 0) then return new; end if;

  select count(*) into v_invoice_count
  from public.customer_invoices ci
  where ci.booking_request_id = new.booking_request_id and ci.status = 'issued';
  if v_invoice_count <> 1 then return new; end if;
  select * into v_invoice from public.customer_invoices ci
  where ci.booking_request_id = new.booking_request_id and ci.status = 'issued' limit 1;

  v_total_cents := new.refunded_amount_cents;
  v_tax_cents := coalesce(new.tourist_tax_refund_cents, 0);
  if v_tax_cents > v_total_cents then return new; end if;
  v_remaining_cents := v_total_cents - v_tax_cents;
  v_invoice_total_cents := round(v_invoice.total_amount * 100)::bigint;
  v_invoice_accommodation := coalesce((v_invoice.financial_snapshot ->> 'accommodation_net')::numeric, 0);
  v_invoice_cleaning := coalesce((v_invoice.financial_snapshot ->> 'cleaning_fee')::numeric, 0);
  v_invoice_tax := coalesce((v_invoice.financial_snapshot ->> 'tourist_tax_amount')::numeric, 0);
  v_kind := case when v_total_cents = v_invoice_total_cents then 'full' else 'partial' end;

  if v_total_cents = v_invoice_total_cents then
    v_accommodation_refund := v_invoice_accommodation;
    v_cleaning_refund := v_invoice_cleaning;
    if round((v_invoice_accommodation + v_invoice_cleaning + (v_tax_cents / 100.0)) * 100)::bigint <> v_total_cents then
      v_manual := true; v_accommodation_refund := null; v_cleaning_refund := null;
    end if;
  elsif round(v_invoice_cleaning * 100)::bigint = 0 then
    v_accommodation_refund := v_remaining_cents / 100.0; v_cleaning_refund := 0;
  elsif round(v_invoice_accommodation * 100)::bigint = 0 then
    v_accommodation_refund := 0; v_cleaning_refund := v_remaining_cents / 100.0;
  else
    v_manual := true; v_accommodation_refund := null; v_cleaning_refund := null;
  end if;

  v_financial := jsonb_build_object(
    'manual_required', v_manual,
    'credit_note_kind', v_kind,
    'accommodation_refund', v_accommodation_refund,
    'cleaning_refund', v_cleaning_refund,
    'tourist_tax_refund', v_tax_cents / 100.0,
    'original_invoice_total', v_invoice.total_amount,
    'original_invoice_accommodation', v_invoice_accommodation,
    'original_invoice_cleaning', v_invoice_cleaning,
    'original_invoice_tax', v_invoice_tax
  );

  insert into public.customer_credit_notes(
    invoice_id, booking_request_id, refund_operation_id, seller_snapshot, customer_snapshot, stay_snapshot,
    financial_snapshot, refund_snapshot, currency, total_amount
  ) values (
    v_invoice.id, new.booking_request_id, new.id, v_invoice.seller_snapshot, v_invoice.customer_snapshot, v_invoice.stay_snapshot,
    v_financial,
    jsonb_build_object(
      'refund_operation_id', new.id, 'refunded_amount_cents', new.refunded_amount_cents,
      'tourist_tax_refund_cents', coalesce(new.tourist_tax_refund_cents,0), 'refund_mode', new.refund_mode,
      'effective_mode', new.effective_mode, 'policy_label', new.policy_label, 'action', new.action,
      'completed_at', new.completed_at, 'invoice_id', v_invoice.id, 'invoice_number', v_invoice.invoice_number,
      'invoice_issued_at', v_invoice.issued_at
    ),
    v_invoice.currency, new.refunded_amount_cents / 100.0
  ) on conflict (refund_operation_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_customer_credit_note_after_refund() from public, anon, authenticated;
create trigger create_customer_credit_note_after_refund_succeeded
after update of status on public.refund_operations
for each row when (old.status is distinct from 'succeeded' and new.status = 'succeeded')
execute function public.create_customer_credit_note_after_refund();

commit;
