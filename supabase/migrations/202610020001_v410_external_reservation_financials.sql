-- La Maison Verte V4.10 — B4.2a-2
-- Registre financier normalisé des réservations de plateformes.
-- Migration additive : ne modifie ni booking_requests, ni accounting_entries,
-- ni customer_invoices, ni le ledger Direct/Stripe.

create table public.external_reservation_financials (
  id uuid primary key default gen_random_uuid(),

  source text not null,
  external_reference text not null,
  booking_request_id uuid
    references public.booking_requests(id)
    on update restrict
    on delete set null,

  currency text not null default 'eur',

  start_date date,
  end_date date,
  nights integer,
  adults_count integer,
  children_count integer,

  accommodation_amount numeric(12,2),
  cleaning_fee numeric(12,2),
  tourist_tax_amount numeric(12,2),
  traveler_total numeric(12,2),

  commission_amount numeric(12,2),
  payment_fee_amount numeric(12,2),
  net_payout numeric(12,2),

  payment_date date,
  payment_reference text,

  provenance jsonb not null default '{}'::jsonb,
  raw_snapshot jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint external_reservation_financials_source_nonblank
    check (nullif(btrim(source), '') is not null),
  constraint external_reservation_financials_reference_nonblank
    check (nullif(btrim(external_reference), '') is not null),
  constraint external_reservation_financials_currency_nonblank
    check (nullif(btrim(currency), '') is not null),

  constraint external_reservation_financials_stay_dates_check
    check (start_date is null or end_date is null or end_date > start_date),
  constraint external_reservation_financials_nights_check
    check (nights is null or nights >= 0),
  constraint external_reservation_financials_adults_check
    check (adults_count is null or adults_count >= 0),
  constraint external_reservation_financials_children_check
    check (children_count is null or children_count >= 0),

  constraint external_reservation_financials_accommodation_check
    check (accommodation_amount is null or accommodation_amount >= 0),
  constraint external_reservation_financials_cleaning_check
    check (cleaning_fee is null or cleaning_fee >= 0),
  constraint external_reservation_financials_tourist_tax_check
    check (tourist_tax_amount is null or tourist_tax_amount >= 0),
  constraint external_reservation_financials_traveler_total_check
    check (traveler_total is null or traveler_total >= 0),
  constraint external_reservation_financials_commission_check
    check (commission_amount is null or commission_amount >= 0),
  constraint external_reservation_financials_payment_fee_check
    check (payment_fee_amount is null or payment_fee_amount >= 0),
  constraint external_reservation_financials_net_payout_check
    check (net_payout is null or net_payout >= 0),

  constraint external_reservation_financials_source_reference_key
    unique (source, external_reference)
);

create index external_reservation_financials_booking_request_idx
  on public.external_reservation_financials (booking_request_id)
  where booking_request_id is not null;

create index external_reservation_financials_payment_reference_idx
  on public.external_reservation_financials (source, payment_reference)
  where payment_reference is not null;

create index external_reservation_financials_stay_idx
  on public.external_reservation_financials (start_date, end_date);

comment on table public.external_reservation_financials is
  'Données financières normalisées des réservations de plateformes. Source de rapprochement/facturation, distincte du journal comptable et du ledger Direct/Stripe.';

comment on column public.external_reservation_financials.booking_request_id is
  'Lien facultatif vers la réservation interne lorsqu''un rapprochement est démontré.';

comment on column public.external_reservation_financials.cleaning_fee is
  'NULL = inconnu/non démontré ; 0 = absence de forfait ménage explicitement démontrée ; montant positif = montant explicite.';

comment on column public.external_reservation_financials.provenance is
  'Provenance et niveau de connaissance des valeurs normalisées : explicite, zéro confirmé, inconnu ou dérivé selon règle validée.';

comment on column public.external_reservation_financials.raw_snapshot is
  'Trace structurée des données sources utiles à l''audit ; ne remplace pas les fichiers d''import originaux.';

alter table public.external_reservation_financials enable row level security;

revoke all on table public.external_reservation_financials from anon, authenticated;
grant select, insert, update, delete
  on table public.external_reservation_financials
  to authenticated;

create policy external_reservation_financials_owner_only
  on public.external_reservation_financials
  for all
  to authenticated
  using (public.is_v4_owner())
  with check (public.is_v4_owner());
