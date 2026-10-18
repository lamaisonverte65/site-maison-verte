# La Maison Verte V4.13 — B1 remboursements Stripe — Phase 2B1

**Base :** commit local `a1f6bc8` annoncé et validé par l'utilisateur (phase 2A, 914 tests globaux OK sur Windows). Les fichiers du ZIP sont issus des archives de sources fournies, sur lesquelles la phase 1 et la phase 2A ont été superposées. **Aucun accès au HEAD local Windows n'est possible ici.**

## Portée limitée : lecture comptable, aucun remboursement déclenché

- Le journal comptable affiche une catégorie distincte **Remboursements** (consultation uniquement). Pas de bouton pour créer un remboursement comptable manuel.
- `accountingYearSummary` distingue `income`, `expense`, `refund` et calcule le solde indicatif `income - expense - refund` sans assimiler les remboursements aux dépenses.
- Le rapprochement traite toute écriture `entry_kind='refund'` sans contrepartie reconnue comme une restitution orpheline **à vérifier**, avec montant économique négatif. Un type `income` ou une écriture de source non Stripe ne valident plus un remboursement, même si clé/montant concordent ; les années et les centimes sont contrôlés.
- La synthèse fiscale ne convertit plus un remboursement en montant brut en attente. La fiscalité du remboursement reste « À vérifier » ; aucune déduction fiscale automatique.
- Correction d'un espace final dans `docs/B1_STRIPE_REMBOURSEMENTS_PHASE2A_2026-10-18.md` qui provoquait l'avertissement `git diff --cached --check` du commit antérieur.

## Limitation majeure : ne pas déployer isolément

**Cette phase n'implémente PAS** le rapprochement de chaque ligne `public.refunds` (allocation Stripe). La vue historique rapproche encore les `refund_operations` globales. Si de futures écritures sont enregistrées avec la clé `direct:refund:<allocation-id>` avant adaptation du rapprochement, les lignes risquent de rester orphelines et un remboursement pourrait être compté deux fois dans la synthèse indicative.

**Ne pas faire de push, ne pas appliquer la migration 2A, ne pas utiliser l'automatisation des remboursements en production.** Il faut auparavant compléter la phase 2B2 : allocation réelle, horodatage Stripe certifié, réconciliation multi-allocations et multi-exercices, idempotence, gestion des remboursements externes et vérification du parcours complet.

## Tests de cette livraison

- `tests/v413-b1-refund-accounting-readonly.test.js` : 11 nouveaux tests.
- Avec les 44 tests de rapprochement/fiscalité/remboursement existants : **55 tests ciblés réussis** dans l'archive fournie.
- Tentative de suite générale sur l'archive incomplète : 861 tests, 790 réussites et 71 échecs liés notamment à des dossiers / dépendances absents de l'archive (`scripts/backup`, `.github/workflows`, `docs/operations`, `shared/`, assets). La suite globale **n'est pas validée** sur cette archive. `node_modules` absent ; build Vite impossible à lancer dans cet environnement.
- Il revient au projet Windows complet de confirmer les tests globaux et le build.

## Installation PowerShell depuis le dossier travail

```powershell
Expand-Archive -Path "$env:USERPROFILE\Downloads\LMV_V4.13_B1_Remboursements_Stripe_PHASE2B1.zip" -DestinationPath "C:\Users\pc\Desktop\Site La MaisonVerte\Site Maison Verte - V4\travail" -Force

node --test tests/v413-b1-refund-accounting-readonly.test.js
npm test
npm run build
git diff --check
git status --short --untracked-files=all
```

**S'arrêter pour examiner les résultats, sans commit ni push.** Préserver `docs/MD/`, les anciens documents locaux `superpowers` et tous les fichiers sans rapport avec B1.
