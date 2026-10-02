-- PRE-FLIGHT LIVE — LECTURE SEULE
-- B4.2a-2 external_reservation_financials
-- Exécuter AVANT la migration et transmettre le résultat si un contrôle échoue.

-- P1 — La table cible ne doit pas déjà exister.
select
  to_regclass('public.external_reservation_financials') as target_table;

-- Attendu : NULL.

-- P2 — Dépendances réellement requises par la migration.
select
  to_regclass('public.booking_requests') as booking_requests_table,
  to_regprocedure('public.is_v4_owner()') as owner_guard_function;

-- Attendu :
-- booking_requests_table = booking_requests
-- owner_guard_function   = is_v4_owner()

-- P3 — Vérifier le type réel de booking_requests.id, sans le supposer.
select
  table_schema,
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'booking_requests'
  and column_name = 'id';

-- Attendu : udt_name = uuid.
