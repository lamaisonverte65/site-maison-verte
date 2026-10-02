-- B4.3.1 — PRE-FLIGHT COMPTABILITE / DECLARATIONS
-- STRICTEMENT EN LECTURE SEULE. Toutes les instructions exécutables sont des SELECT.

-- 1. Vérifier qu'aucune table B4.3.1 cible n'existe déjà.
select
  to_regclass('public.accounting_categories') as accounting_categories,
  to_regclass('public.accounting_import_batches') as accounting_import_batches,
  to_regclass('public.accounting_entries') as accounting_entries,
  to_regclass('public.accounting_fixed_assets') as accounting_fixed_assets,
  to_regclass('public.accounting_documents') as accounting_documents;

-- 2. Autorité propriétaire utilisée pour les futures politiques RLS.
select
  p.oid::regprocedure::text as function_signature,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_v4_owner';

-- 3. Tables auxquelles les écritures pourront être rapprochées.
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('booking_requests', 'external_reservations', 'payments', 'stripe_payouts', 'stripe_balance_transactions')
  and c.column_name in (
    'id', 'source', 'external_id', 'booking_id', 'reservation_id',
    'start_date', 'end_date', 'created_at', 'amount', 'gross_amount',
    'net_amount', 'fee_amount', 'payout_id'
  )
order by c.table_name, c.ordinal_position;

-- 4. Contraintes/FK existantes sur les tables de rapprochement utiles.
select
  conrelid::regclass::text as table_name,
  conname,
  contype,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'public'::regnamespace
  and conrelid in (
    'public.booking_requests'::regclass,
    'public.payments'::regclass,
    'public.stripe_payouts'::regclass,
    'public.stripe_balance_transactions'::regclass
  )
order by table_name, conname;

-- 5. Confirmer les rôles admin réellement actifs.
select role, is_owner, is_active, count(*) as row_count
from public.admin_users
group by role, is_owner, is_active
order by role, is_owner desc, is_active desc;
