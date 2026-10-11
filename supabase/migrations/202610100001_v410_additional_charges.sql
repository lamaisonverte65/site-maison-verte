-- La Maison Verte V4.10 — demandes de paiement complémentaires génériques.
-- Ces montants sont volontairement hors contrat : aucune écriture sur booking_requests.contract_total.

create table if not exists public.booking_additional_charges (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on update restrict on delete restrict,
  cleaning_issue_id uuid references public.booking_cleaning_issues(id) on update restrict on delete set null,
  category text not null default 'other',
  reason_label text not null,
  amount numeric(12,2) not null,
  customer_message text,
  status text not null default 'draft',
  stripe_session_id text,
  payment_link text,
  payment_id uuid references public.payments(id) on update restrict on delete set null,
  invoice_id uuid references public.customer_invoices(id) on update restrict on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  payment_requested_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint booking_additional_charges_category_check check (category in ('cleaning','damage','extra_bed','other')),
  constraint booking_additional_charges_reason_check check (length(btrim(reason_label)) between 1 and 200),
  constraint booking_additional_charges_amount_positive check (amount > 0),
  constraint booking_additional_charges_message_check check (customer_message is null or length(customer_message) <= 3000),
  constraint booking_additional_charges_status_check check (status in ('draft','payment_requested','paid','cancelled'))
);

create index if not exists booking_additional_charges_booking_idx
  on public.booking_additional_charges(booking_request_id, created_at desc);
create index if not exists booking_additional_charges_cleaning_issue_idx
  on public.booking_additional_charges(cleaning_issue_id)
  where cleaning_issue_id is not null;
create unique index if not exists booking_additional_charges_stripe_session_unique_idx
  on public.booking_additional_charges(stripe_session_id)
  where stripe_session_id is not null;
create unique index if not exists booking_additional_charges_payment_unique_idx
  on public.booking_additional_charges(payment_id)
  where payment_id is not null;

alter table public.booking_additional_charges enable row level security;
revoke all on table public.booking_additional_charges from anon, authenticated;
grant select on table public.booking_additional_charges to authenticated;

drop policy if exists booking_additional_charges_owner_select on public.booking_additional_charges;
create policy booking_additional_charges_owner_select
on public.booking_additional_charges for select to authenticated
using (public.is_v4_owner());

comment on table public.booking_additional_charges is
  'Demandes de paiement complémentaires owner, distinctes du total contractuel et du solde de la réservation.';
comment on column public.booking_additional_charges.amount is
  'Montant saisi explicitement par owner pour cette demande ; ne constitue pas un snapshot du contrat initial.';

alter table public.customer_invoices
  add column if not exists additional_charge_id uuid references public.booking_additional_charges(id) on update restrict on delete set null;

alter table public.customer_invoices
  drop constraint if exists customer_invoices_invoice_kind_check;
alter table public.customer_invoices
  add constraint customer_invoices_invoice_kind_check
  check (invoice_kind in ('stay', 'post_stay_cleaning', 'additional_charge'));

alter table public.customer_invoices
  drop constraint if exists customer_invoices_cleaning_issue_check;
alter table public.customer_invoices
  add constraint customer_invoices_cleaning_issue_check
  check (
    (invoice_kind = 'stay' and cleaning_issue_id is null and additional_charge_id is null)
    or (invoice_kind = 'post_stay_cleaning' and source = 'direct' and booking_request_id is not null and cleaning_issue_id is not null and additional_charge_id is null)
    or (invoice_kind = 'additional_charge' and source = 'direct' and booking_request_id is not null and cleaning_issue_id is null and additional_charge_id is not null)
  );

create unique index if not exists customer_invoices_additional_charge_unique_idx
  on public.customer_invoices(additional_charge_id)
  where invoice_kind = 'additional_charge' and additional_charge_id is not null;

comment on column public.customer_invoices.additional_charge_id is
  'Demande de paiement complémentaire à l’origine de cette facture séparée.';

create or replace function public.protect_issued_customer_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'issued' then raise exception 'issued_invoice_immutable'; end if;
    return old;
  end if;

  if old.status = 'issued' then
    if new.id is distinct from old.id
      or new.source is distinct from old.source
      or new.booking_request_id is distinct from old.booking_request_id
      or new.external_reference is distinct from old.external_reference
      or new.invoice_kind is distinct from old.invoice_kind
      or new.cleaning_issue_id is distinct from old.cleaning_issue_id
      or new.additional_charge_id is distinct from old.additional_charge_id
      or new.status is distinct from old.status
      or new.invoice_number is distinct from old.invoice_number
      or new.issued_at is distinct from old.issued_at
      or new.seller_snapshot is distinct from old.seller_snapshot
      or new.customer_snapshot is distinct from old.customer_snapshot
      or new.stay_snapshot is distinct from old.stay_snapshot
      or new.financial_snapshot is distinct from old.financial_snapshot
      or new.payment_snapshot is distinct from old.payment_snapshot
      or new.currency is distinct from old.currency
      or new.total_amount is distinct from old.total_amount
      or new.created_at is distinct from old.created_at
      or (old.pdf_storage_path is not null and new.pdf_storage_path is distinct from old.pdf_storage_path)
      or (old.pdf_storage_path is null and new.pdf_storage_path is null and new.updated_at is distinct from old.updated_at)
    then
      raise exception 'issued_invoice_immutable';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_issued_customer_invoice() from public, anon, authenticated;
