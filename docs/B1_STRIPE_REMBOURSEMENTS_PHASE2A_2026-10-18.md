# La Maison Verte V4.13 — B1 remboursements Stripe — Phase 2A

**Point de départ :** commit local utilisateur `5aff916` (phase 1 encaissements validée).
**Livrable :** préparation SQL et tests seulement. **Ne pas exécuter la migration en production à cette étape.**

## Objectif et effet exact

Le schéma `accounting_entries.entry_kind` et celui de `accounting_categories.entry_kind` autorisent actuellement `income` / `expense`. La migration proposée autorise également **`refund`** : restitution réelle d'argent au client, **ni charge d'exploitation ni nouvelle recette**. Une catégorie dédiée `direct_stripe_refund` est ajoutée avec `ON CONFLICT DO NOTHING`.

- Aucun ancien montant ou écriture n'est recalculé ni réécrit.
- Aucune modification des tables `payments`, `refunds`, `refund_operations`, `booking_requests`, factures/avoirs ou des webhooks.
- L'index existant `accounting_entries_source_record_unique_idx` reste intact : il permettra une seule écriture par véritable allocation de remboursement.
- Montant futur positif en base (`amount_ttc`), signe négatif uniquement pour les totaux de trésorerie.
- L'opération est enveloppée dans une transaction. Si les contraintes n'ont pas les noms attendus, une erreur arrête la migration et annule la transaction. **Ne pas forcer un DROP générique.**

## Revue SQL en lecture seule préalable à toute application (ultérieure)

Dans l'éditeur SQL Supabase, cette requête ne modifie rien :

```sql
select n.nspname as schema_name, t.relname as table_name,
       c.conname as constraint_name, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname in ('accounting_entries', 'accounting_categories')
  and c.contype = 'c' and c.conname like '%entry_kind%'
order by t.relname, c.conname;
```

**Résultat attendu avant migration :** `accounting_entries_entry_kind_check` et `accounting_categories_entry_kind_check`, autorisant `income` et `expense`. En cas d'écart, arrêter et réauditer la contrainte effective au lieu de forcer l'exécution.

## À faire sur le PC après extraction du ZIP

Depuis le dossier de travail complet :

```powershell
node --test tests/v413-b1-refund-accounting-schema.test.js
npm test
npm run build

git diff --check
git status --short
```

Ne pas appliquer la migration, ne pas committer/pusher ni modifier la production sans nouvelle décision explicite.

## Phase 2B — préalable impératif à toute écriture de remboursement

1. Modifier le rapprochement (`_lib/accounting-reconciliation.js`, endpoint, UI, résumé annuel) pour reconnaître `refund` sans l'assimiler à une recette et afficher séparément brut, sorties et solde de gestion.
2. Distinguer chaque ligne `refunds` réellement réussie (allocation avec ID Stripe) de l'opération `refund_operations`, qui peut contenir plusieurs allocations ou une annulation à zéro ; conserver la date Stripe vérifiée, y compris en cas de remboursement d'un autre exercice.
3. Mettre en place un moteur d'écritures idempotent à clé `source='stripe'`, `source_record_key='direct:refund:<allocation-id>'`, s'appuyant sur l'unicité existante, sans refuser ni relancer un remboursement Stripe si la comptabilité échoue.
4. Ne pas transformer en comptabilité un remboursement Stripe externe non lié de façon certaine à une réservation et à un paiement ; prévoir une revue et un rattrapage.
5. Tester les remboursements complets, partiels, multiples, échecs/retries, hors site, sur deux exercices, frais éventuels, avoirs et annulations sans mouvement.

**État des vérifications au moment de l'archive :** 7 nouveaux tests de migration et 91 tests ciblés (incluant les scénarios existants de remboursement/direct/phase 1 et le rapprochement) réussis. Le dépôt fourni sous forme d'archive n'est pas le projet complet : tests globaux et build à exécuter sur Windows. Aucune connexion ni modification Supabase réelle.
