-- La Maison Verte V4.15 / AUD-12 - LECTURE SEULE.
-- Exécuter sur la base cible avant d'envisager la migration R16.
-- Tous les indicateurs prerequis_* doivent être true.
select
  to_regclass('public.accounting_entries') is not null as prerequis_ecritures,
  to_regclass('public.accounting_fixed_assets') is not null as prerequis_immobilisations,
  to_regprocedure('public.is_v4_owner()') is not null as prerequis_controle_proprietaire,
  exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = to_regclass('public.accounting_fixed_assets')
      and c.contype = 'f' and c.confrelid = to_regclass('public.accounting_entries')
  ) as prerequis_lien_entre_tables,
  exists (
    select 1 from pg_catalog.pg_class c
    where c.oid = to_regclass('public.accounting_entries') and c.relrowsecurity
  ) as prerequis_rls_ecritures,
  exists (
    select 1 from pg_catalog.pg_class c
    where c.oid = to_regclass('public.accounting_fixed_assets') and c.relrowsecurity
  ) as prerequis_rls_immobilisations,
  to_regprocedure('public.save_manual_accounting_entry_atomic(uuid,jsonb,jsonb)') is not null as fonction_aud12_deja_installee;

-- S'assurer de la présence des colonnes réellement utilisées.
with expected(table_name, column_name) as (
  values
  ('accounting_entries','id'), ('accounting_entries','entry_date'),
  ('accounting_entries','entry_kind'), ('accounting_entries','category_id'),
  ('accounting_entries','label'), ('accounting_entries','counterparty'),
  ('accounting_entries','amount_ttc'), ('accounting_entries','treatment'),
  ('accounting_entries','source'), ('accounting_entries','payment_method'),
  ('accounting_entries','notes'), ('accounting_entries','metadata'),
  ('accounting_entries','updated_at'),
  ('accounting_fixed_assets','accounting_entry_id'),
  ('accounting_fixed_assets','asset_category'),
  ('accounting_fixed_assets','in_service_date'),
  ('accounting_fixed_assets','acquisition_value'),
  ('accounting_fixed_assets','depreciation_method'),
  ('accounting_fixed_assets','depreciation_duration_months'),
  ('accounting_fixed_assets','residual_value'),
  ('accounting_fixed_assets','notes'),
  ('accounting_fixed_assets','updated_at')
)
select e.table_name, e.column_name as colonne_manquante
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = e.table_name
  and c.column_name = e.column_name
where c.column_name is null
order by e.table_name, e.column_name;
-- La seconde requête doit retourner 0 ligne.
