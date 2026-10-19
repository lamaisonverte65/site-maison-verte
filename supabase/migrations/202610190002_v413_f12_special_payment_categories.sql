-- V4.13 / F1.2 — catégories propres aux prestations hors contrat.
-- À exécuter d'abord sur LMV Restore Test 2 et seulement après approbation
-- en production. Aucun paiement/facture/écriture existant n'est modifié.
begin;
insert into public.accounting_categories (entry_kind, code, name, sort_order)
values
  ('income', 'post_stay_cleaning', 'Ménage facturé après séjour', 45),
  ('income', 'additional_extra_bed', 'Lit supplémentaire après séjour', 46)
on conflict (entry_kind, code) do nothing;
commit;
