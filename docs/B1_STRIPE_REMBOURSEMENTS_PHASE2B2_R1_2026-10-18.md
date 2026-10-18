# La Maison Verte V4.13 — B1 / 2B2-R1 — Audit transversal et correctif contrôlé

**Base documentaire :** ZIP phase 2B2 du 18/10/2026 ; dernier HEAD local déclaré pour B1-2B1 : `018fe6e`. Le commit de 2B2 n'a pas été confirmé par un `git log` utilisateur.

## Pourquoi R1

1. `admin-accounting-reconciliation.js` utilisait `allocationsYear` et `allocationsAll` sans les définir ; un appel réel au rapprochement pouvait retourner HTTP 500 malgré les tests unitaires du moteur pur.
2. Des remboursements Stripe devenus `succeeded` *après* la réponse initiale restaient en `needs_reconciliation` dans `refunds`. La comptabilisation en 2B2 ne lisait que les allocations déjà confirmées localement.
3. Une opération dont Stripe était confirmé mais dont la finalisation métier restait en attente disparaissait du rapprochement, qui exigeait `refund_operations.status = succeeded`.

## Changements ciblés

- Endpoint annuel : chargement paginé de `refunds` confirmés, ancrage des réservations par **date Stripe Europe/Paris**, maintien des allocations de plusieurs exercices dans le contexte de la réservation. Erreur explicite au plafond de 20 000 lignes, pas de résultat faussement exhaustif.
- Helper `reconcile-delayed-stripe-refund.js` : vérification de la correspondance entre allocation, opération, paiement et **objet Stripe récupéré à nouveau**, avec contrôles identifiants, EUR, montant exact en centimes et métadonnées. En cas de preuve fiable, appel à la **RPC existante** `record_stripe_refund_result`, sans nouveau remboursement et sans écriture directe dans les tables métier.
- Webhook `refund.created` / `refund.updated` : tentative de réconciliation avant comptabilisation, sans faire échouer le webhook sur un problème comptable.
- Synchronisation planifiée : reprise limitée des allocations connues et non encore confirmées localement, pagination par identifiant pour ne pas sauter de lignes modifiées, journalisation des issues. Le rattrapage comptable existant suit ensuite.
- Vue comptable : une allocation réellement confirmée reste visible dans son exercice, même si l'opération parent est encore `stripe_succeeded`. La ligne est alors explicitement `À vérifier` avec motif `refund_operation_requires_business_finalization`.

## Limite de sécurité **NON RÉSOLUE**

Ce patch **ne finalise pas automatiquement** une réservation ni une opération métier tardive. En effet, `finalize_stripe_refund_operation` modifie la réservation et renvoie `should_notify` ; la notification doit être émise par un mécanisme métier fiable et idempotent, non depuis une simple synchronisation comptable. Une opération `stripe_succeeded` ainsi récupérée requiert encore finalisation dans le parcours admin et contrôle de l'email / de l'avoir. Ne pas confondre « comptabilisé » et « entièrement terminé ».

Aucune nouvelle RPC SQL ni migration dans R1. La migration **phase 2A** autorisant `accounting_entries.entry_kind = refund` reste **non appliquée** et doit précéder tout déploiement du code qui crée de telles écritures.

## Validation réalisée sur archive partielle

- 7 nouveaux tests R1 : cohérence Stripe, refus des données douteuses, idempotence, reprise par curseur, affichage d'opération non finalisée, exécution simulée de l'endpoint annuel, aucune action de remboursement externe.
- **93/93 tests ciblés réussis**, couvrant également les protections existantes : moteur de remboursement, webhook idempotent, rapprochement, fiscalité/lecture et schéma.
- Vérification syntaxe `node --check` des modules JavaScript modifiés.
- L'archive n'inclut pas l'ensemble du projet et ses dépendances installées : **`npm test` complet et `npm run build` restent impérativement à faire sur le dépôt Windows**.

## Vérifications obligatoires avant tout commit/déploiement

1. Confirmer le HEAD local (2B2 commit éventuellement créé), vérifier les fichiers modifiés puis appliquer le ZIP R1 uniquement.
2. `node --test tests/v413-b1-refund-transversal-r1.test.js`, `npm test`, `npm run build`, `git diff --check`, `git status --short`.
3. Examiner l'endpoint administratif réel (année avec plusieurs allocations) et l'interface mobile/desktop, sans provoquer de remboursement de test en production.
4. Préparer une procédure séparée pour les opérations `stripe_succeeded` non finalisées : notification client, statut réservation, avoir, gestion des retries et journalisation fiable.
5. Aucun push GitHub, aucune application de migration ni manipulation Stripe/Supabase production sans décision explicite.

**Ne pas modifier** les documents non suivis `docs/MD/` et les deux documents `docs/superpowers` locaux.
