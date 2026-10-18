-- LMV V4.13 / B1 phase 2A — type de mouvement « refund ».
-- MIGRATION À VALIDER ET À APPLIQUER EXPLICITEMENT PLUS TARD : ne l'exécutez pas
-- tant que le rapprochement et l'interface ne prennent pas en charge ce type.
-- Aucun remboursement Stripe, journal existant, paiement, facture ni avoir n'est modifié.
-- Les montants de refund resteront POSITIFS dans amount_ttc ; seul le signe
-- économique de restitution sera porté par la lecture comptable future.
-- La clé source/source_record_key reste unique (index historique inchangé).

begin;

-- Ajouter puis valider la contrainte élargie AVANT de retirer l'ancienne.
-- Si le schéma vivant ne possède plus les noms de contraintes de référence,
-- la migration échoue et la transaction est annulée : pas de DROP approximatif.
alter table public.accounting_entries
  add constraint accounting_entries_entry_kind_v413_check
  check (entry_kind in ('income', 'expense', 'refund')) not valid;

alter table public.accounting_entries
  validate constraint accounting_entries_entry_kind_v413_check;

alter table public.accounting_entries
  drop constraint accounting_entries_entry_kind_check;

-- Catégorisation distincte : un remboursement n'est jamais une charge.
alter table public.accounting_categories
  add constraint accounting_categories_entry_kind_v413_check
  check (entry_kind in ('income', 'expense', 'refund')) not valid;

alter table public.accounting_categories
  validate constraint accounting_categories_entry_kind_v413_check;

alter table public.accounting_categories
  drop constraint accounting_categories_entry_kind_check;

insert into public.accounting_categories (entry_kind, code, name, sort_order)
values ('refund', 'direct_stripe_refund', 'Remboursement client Stripe — Direct', 10)
on conflict (entry_kind, code) do nothing;

commit;
