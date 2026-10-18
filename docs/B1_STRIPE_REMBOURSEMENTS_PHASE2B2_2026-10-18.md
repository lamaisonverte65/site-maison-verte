# La Maison Verte V4.13 — B1/2B2 : comptabilisation des allocations Stripe remboursées

**Référence locale annoncée :** `018fe6e` (`main`, phase 2B1 validée avec 925/925 tests et build Vite sur le PC le 18/10/2026). Le ZIP a été construit à partir de l'archive complète d'audit du 18/10 puis des fichiers exacts livrés en phases 1, 2A et 2B1, sans accès direct au HEAD Windows. **Contrôler les différences localement avant commit.**

## Principes et protection financière

1. L'unité comptable est `public.refunds.id` (allocation), **pas** `refund_operations.id`. Le journal a pour clé unique `source='stripe'`, `source_record_key='direct:refund:<allocation-id>'`. Une opération peut contenir plusieurs remboursements et plusieurs exercices.
2. La fonction pure de projection bloque l'insertion si le remboursement **n'est pas `succeeded` dans le ledger et dans Stripe**, si les liens opération/réservation/paiement/PaymentIntent divergent, si la devise n'est pas EUR, si le montant au centime ne concorde pas, si les métadonnées Stripe sont incohérentes, si la catégorie de remboursement manque ou si une écriture historique ambiguë existe.
3. La date comptable utilisée est le **jour civil Europe/Paris de `stripe.refund.created`**, contrôlé en relisant l'objet Stripe. Il s'agit de la **date de création du remboursement Stripe finalement confirmé**, pas de la date d'arrivée bancaire ni d'une date de remboursement bancaire démontrée. Vérifier avec le comptable si un autre fait générateur doit s'appliquer ; **aucune règle fiscale de déduction n'est inventée** (`treatment='to_review'`).
4. Aucune fonction comptable n'appelle `stripe.refunds.create`, aucune modification des réservations, paiements, factures, avoirs, emails ou soldes Stripe. Une panne comptable est journalisée après le traitement métier, sans second remboursement ou renvoi d'email.
5. Une unique instruction `INSERT` par allocation, jamais `UPSERT` : l'index unique SQL `(source, source_record_key)` protège les doubles webhooks. La réponse `concurrent_write` nécessite un nouveau contrôle, pas une écriture forcée.
6. Une ancienne écriture globale `direct:refund:<operation-id>` est **à vérifier**, jamais reproduite automatiquement par allocation.

## Chemins d'entrée

- **Site :** `refund-booking-payment.js` appelle le moteur comptable **après** `processRefundOperation`. Ses erreurs sont isolées et ne changent pas la réponse métier.
- **Webhook :** `stripe-webhook.js` constate `refund.created` / `refund.updated` confirmés (si ces événements sont souscrits), consulte le ledger et Stripe et tente l'écriture uniquement si une allocation locale existe.
- **Rattrapage :** `sync-stripe-refund-accounting.js` planifie un contrôle quotidien UTC à 04:37, des allocations locales confirmées (`refunds.status='succeeded'`) avec pagination bornée. Les remboursements directement initiés dans Stripe **sans allocation locale confirmée** sont détectés sur les 90 derniers jours et leurs IDs consignés dans les logs ; **aucune écriture n'est créée sans rapprochement sûr**. Ce contrôle externe est limité à 2 000 événements par exécution ; un plafond atteint fait échouer explicitement le job. Il **ne crée pas encore de dossier d'anomalie persistante visible dans l'administration**.

## Rapprochement B1

- `admin-accounting-reconciliation` récupère les allocations `refunds` avec pagination explicite (plafond 20 000) et rattache les opérations aux réservations pertinentes. Le moteur produit une ligne financière par allocation et la place dans l'année correspondant à sa date Stripe Europe/Paris. Une preuve de date absente est marquée à vérifier avec fallback d'affichage uniquement (aucune écriture créée).
- Les opérations historiques sans allocation restent affichées selon l'ancienne logique pour ne pas effacer d'information ; les opérations possédant des allocations ne créent plus de ligne globale dupliquée.
- Un avoir est rattaché à l'opération globale ; son montant est donc comparé au total global et non au montant isolé d'une allocation. Le rapprochement interdit de valider un mauvais type comptable, une mauvaise réservation, une mauvaise catégorie ou une mauvaise référence Stripe.

## Tests et limites

- Nouveau fichier `tests/v413-b1-auto-refund-accounting.test.js` : 15 tests de projection et d'idempotence, statuts, intégrité, multi-allocations, double exercice, années à cheval, retrait du double comptage et simulations de la couche Supabase.
- 83/83 contrôles ciblés remboursements et rapprochement ont été réussis dans l'archive reconstruite.
- Contrôle transversal Stripe/remboursements/comptabilité sur archive partielle : 238/249 passent, **11 échouent dans les tests de backup Stripe** faute de fichiers de workflows et scripts backup absents de l'archive. Cette exécution ne valide pas le projet complet.
- Vérification de syntaxe Node de tous les JS modifiés : OK. Le build Vite et l'ensemble des tests sont à exécuter sur le vrai dépôt Windows, qui contient les sources et les dépendances manquantes.
- **À contrôler lors de la recette** : abonnements webhook Stripe `refund.created` et `refund.updated`, autorisations de lecture Stripe, catégories et contraintes SQL LIVE, temps d'exécution de la synchronisation, rapports de remboursements externes, restitution correcte dans B1 et anciens cas de crédit-notes.

**ATTENTION PRODUCTION :** migration `202610180001_v413_b1_refund_accounting_kind.sql` de 2A **non appliquée**. Ne pas déployer les nouvelles fonctions ni la tâche programmée avant revue et application explicite de la migration en production. **Aucune migration, aucun push, aucune écriture de données de production pendant la préparation de ce ZIP.**

## Installation et validation Windows

```powershell
Expand-Archive -Path "$env:USERPROFILE\Downloads\LMV_V4.13_B1_Remboursements_Stripe_PHASE2B2.zip" -DestinationPath "C:\Users\pc\Desktop\Site La MaisonVerte\Site Maison Verte - V4\travail" -Force
node --test tests/v413-b1-auto-refund-accounting.test.js
npm test
npm run build
git diff --check
git status --short
```

S'arrêter pour examiner le résultat, **sans commit, push ni migration**. Préserver tous les documents non suivis et tout code non relatif à B1.
