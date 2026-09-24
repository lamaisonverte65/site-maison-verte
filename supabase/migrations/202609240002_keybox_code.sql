-- Code courant de la boîte à clés.
-- Le code n'est pas historisé par réservation : les emails J-2 et la page dédiée
-- lisent toujours la valeur courante.

alter table public.pricing_settings
  add column if not exists keybox_code text;

comment on column public.pricing_settings.keybox_code is
  'Code courant de la boîte à clés communiqué aux voyageurs avant leur arrivée.';
