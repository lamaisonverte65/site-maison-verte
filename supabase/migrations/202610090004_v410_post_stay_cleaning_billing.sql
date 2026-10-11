-- La Maison Verte V4.10 — ménage après séjour : modèle et facturation complémentaire
-- Le contrat initial reste intangible : aucune écriture sur booking_requests.contract_total.

alter table public.booking_cleaning_issues
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists stripe_session_id text,
  add column if not exists payment_id uuid references public.payments(id) on update restrict on delete set null,
  add column if not exists invoice_id uuid references public.customer_invoices(id) on update restrict on delete set null;

create unique index if not exists booking_cleaning_issues_stripe_session_unique_idx
  on public.booking_cleaning_issues(stripe_session_id)
  where stripe_session_id is not null;

create unique index if not exists booking_cleaning_issues_payment_unique_idx
  on public.booking_cleaning_issues(payment_id)
  where payment_id is not null;

alter table public.customer_invoices
  add column if not exists invoice_kind text not null default 'stay',
  add column if not exists cleaning_issue_id uuid references public.booking_cleaning_issues(id) on update restrict on delete set null;

alter table public.customer_invoices
  drop constraint if exists customer_invoices_invoice_kind_check;
alter table public.customer_invoices
  add constraint customer_invoices_invoice_kind_check
  check (invoice_kind in ('stay', 'post_stay_cleaning'));

alter table public.customer_invoices
  drop constraint if exists customer_invoices_cleaning_issue_check;
alter table public.customer_invoices
  add constraint customer_invoices_cleaning_issue_check
  check (
    (invoice_kind = 'stay' and cleaning_issue_id is null)
    or (invoice_kind = 'post_stay_cleaning' and source = 'direct' and booking_request_id is not null and cleaning_issue_id is not null)
  );

drop index if exists public.customer_invoices_direct_booking_unique_idx;
create unique index customer_invoices_direct_booking_unique_idx
  on public.customer_invoices (booking_request_id)
  where source = 'direct' and booking_request_id is not null and invoice_kind = 'stay';

create unique index customer_invoices_cleaning_issue_unique_idx
  on public.customer_invoices (cleaning_issue_id)
  where invoice_kind = 'post_stay_cleaning' and cleaning_issue_id is not null;

comment on column public.customer_invoices.invoice_kind is
  'Nature du document : stay pour la facture de séjour, post_stay_cleaning pour une facture ménage séparée après séjour.';
comment on column public.customer_invoices.cleaning_issue_id is
  'Dossier ménage post-séjour à l’origine de la facture complémentaire.';

-- La protection d'une facture émise doit aussi figer les nouveaux champs métier.
create or replace function public.protect_issued_customer_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'issued' then
      raise exception 'issued_invoice_immutable';
    end if;
    return old;
  end if;

  if old.status = 'issued' then
    if new.id is distinct from old.id
      or new.source is distinct from old.source
      or new.booking_request_id is distinct from old.booking_request_id
      or new.external_reference is distinct from old.external_reference
      or new.invoice_kind is distinct from old.invoice_kind
      or new.cleaning_issue_id is distinct from old.cleaning_issue_id
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
