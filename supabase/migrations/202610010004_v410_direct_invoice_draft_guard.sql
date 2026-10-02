-- La Maison Verte V4.10 — B2 Brouillon facture Direct
-- Garde d'unicité : une réservation Direct ne peut porter qu'une facture client.
-- Aucun numéro n'est consommé par cette migration.

create unique index customer_invoices_direct_booking_unique_idx
  on public.customer_invoices (booking_request_id)
  where source = 'direct' and booking_request_id is not null;

comment on index public.customer_invoices_direct_booking_unique_idx is
  'Une réservation Direct correspond à une seule facture client (brouillon ou émise).';
