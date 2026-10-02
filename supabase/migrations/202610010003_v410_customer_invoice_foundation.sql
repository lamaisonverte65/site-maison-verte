-- La Maison Verte V4.10 — B1 Fondation facturation client
-- BROUILLON A RELIRE. NE PAS EXECUTER AVANT PREFLIGHT LIVE.
-- Factures commerciales autonomes, distinctes de accounting_documents.

create table public.customer_invoice_counters (
  invoice_year integer primary key check (invoice_year between 2000 and 9999),
  last_number integer not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now()
);

create table public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('direct', 'booking', 'airbnb')),
  booking_request_id uuid references public.booking_requests(id) on update restrict on delete set null,
  external_reference text,
  status text not null default 'draft' check (status in ('draft', 'issued')),
  invoice_number text unique,
  issued_at timestamptz,
  seller_snapshot jsonb not null default '{}'::jsonb,
  customer_snapshot jsonb not null default '{}'::jsonb,
  stay_snapshot jsonb not null default '{}'::jsonb,
  financial_snapshot jsonb not null default '{}'::jsonb,
  payment_snapshot jsonb not null default '[]'::jsonb,
  currency text not null default 'eur',
  total_amount numeric(12,2) not null check (total_amount >= 0),
  pdf_storage_path text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_invoices_source_reference_check check (
    (source = 'direct' and booking_request_id is not null)
    or (source in ('booking', 'airbnb') and (booking_request_id is not null or nullif(btrim(external_reference), '') is not null))
  ),
  constraint customer_invoices_issue_state_check check (
    (status = 'draft' and invoice_number is null and issued_at is null)
    or (status = 'issued' and invoice_number is not null and issued_at is not null)
  )
);

create index customer_invoices_booking_request_idx
  on public.customer_invoices (booking_request_id)
  where booking_request_id is not null;
create index customer_invoices_external_reference_idx
  on public.customer_invoices (source, external_reference)
  where external_reference is not null;
create index customer_invoices_issued_at_idx
  on public.customer_invoices (issued_at desc)
  where status = 'issued';

comment on table public.customer_invoices is
  'Factures clients LMV. Un brouillon est modifiable ; une facture émise conserve ses snapshots commerciaux.';
comment on column public.customer_invoices.booking_request_id is
  'Réservation interne si disponible. SET NULL à la suppression : une facture émise reste autonome.';
comment on column public.customer_invoices.external_reference is
  'Référence de réservation plateforme, notamment numéro Booking/Airbnb.';
comment on column public.customer_invoices.pdf_storage_path is
  'Chemin privé du PDF archivé. Peut être attaché une seule fois après émission.';

alter table public.customer_invoice_counters enable row level security;
alter table public.customer_invoices enable row level security;

revoke all on table public.customer_invoice_counters from anon, authenticated;
revoke all on table public.customer_invoices from anon, authenticated;
grant select on table public.customer_invoice_counters to authenticated;
grant select, insert, update, delete on table public.customer_invoices to authenticated;

create policy customer_invoice_counters_owner_only on public.customer_invoice_counters
  for select to authenticated using (public.is_v4_owner());
create policy customer_invoices_owner_only on public.customer_invoices
  for all to authenticated using (public.is_v4_owner()) with check (public.is_v4_owner());

-- Une facture émise est figée. Seul l'attachement initial du PDF est toléré après émission.
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

create trigger protect_issued_customer_invoice_before_update
before update on public.customer_invoices
for each row execute function public.protect_issued_customer_invoice();

create trigger protect_issued_customer_invoice_before_delete
before delete on public.customer_invoices
for each row execute function public.protect_issued_customer_invoice();

-- Attribution atomique du numéro au moment de l'émission.
create or replace function public.admin_issue_customer_invoice(p_invoice_id uuid)
returns public.customer_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.customer_invoices%rowtype;
  v_year integer;
  v_number integer;
begin
  if not public.is_v4_owner() then
    raise exception 'owner_required';
  end if;

  select * into v_invoice
  from public.customer_invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'invoice_not_found';
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'invoice_not_draft';
  end if;

  if v_invoice.total_amount < 0
     or v_invoice.seller_snapshot = '{}'::jsonb
     or v_invoice.customer_snapshot = '{}'::jsonb
     or v_invoice.stay_snapshot = '{}'::jsonb
     or v_invoice.financial_snapshot = '{}'::jsonb then
    raise exception 'invoice_snapshot_incomplete';
  end if;

  v_year := extract(year from timezone('Europe/Paris', now()))::integer;

  insert into public.customer_invoice_counters(invoice_year, last_number)
  values (v_year, 1)
  on conflict (invoice_year) do update
    set last_number = public.customer_invoice_counters.last_number + 1,
        updated_at = now()
  returning last_number into v_number;

  -- OLD est encore draft : le trigger autorise cette transition contrôlée.
  update public.customer_invoices
  set status = 'issued',
      invoice_number = format('LMV-%s-%s', v_year, lpad(v_number::text, 4, '0')),
      issued_at = now(),
      updated_at = now()
  where id = p_invoice_id
  returning * into v_invoice;

  return v_invoice;
end;
$$;

revoke all on function public.admin_issue_customer_invoice(uuid) from public, anon;
grant execute on function public.admin_issue_customer_invoice(uuid) to authenticated;
