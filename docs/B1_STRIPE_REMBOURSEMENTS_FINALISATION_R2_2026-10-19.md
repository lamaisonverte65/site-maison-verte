# La Maison Verte V4.13 — B1-R2 — Finalisation métier des remboursements différés

**Point de référence local annoncé par l'utilisateur :** commit `5ff57b7` (R1).
**Sources de travail :** ZIP d'audit du 18/10/2026 + correctifs phase 1, 2A, 2B1, 2B2 et R1 successifs. Ce ZIP R2 **n'a pas été construit directement depuis les fichiers du dépôt Windows** : contrôler le diff sur le dépôt réel avant le commit.
**Statut :** proposition de code et tests locaux ciblés, pas de validation de production.

## Problème démontré

- R1 confirme les allocations différées, sans finaliser `refund_operations` ni la réservation.
- Une fois l'allocation devenue `succeeded`, le scanner R1 ne la relit plus ; seul un scanner **par opération `stripe_succeeded`** permet une reprise robuste.
- La finalisation SQL met à jour la réservation, insère un événement, recalcule les agrégats et active le trigger de brouillon d'avoir lorsqu'une facture de séjour émise le permet.
- L'email métier est un effet externe, distinct de la transaction SQL. Un simple `finalize -> send` peut perdre une notification si l'exécution s'interrompt entre les deux. Un retry aveugle peut la doubler.

## Solution R2

1. **Migration additive** `202610190001_v413_b1_refund_notification_outbox.sql` : table à clé unique `refund_operation_id`, insertion par trigger lors du passage vers `succeeded` **seulement dans la transaction du nouveau wrapper `finalize_stripe_refund_operation_with_notification`**, réservation atomique du droit d'envoyer via RPC service-role et statut final. Aucun backfill historique.
2. **Reprise par opération** `_lib/finalize-delayed-stripe-refund.js` : charge le snapshot SQL, refuse les allocations incertaines ou partielles, appelle **seulement** le wrapper `finalize_stripe_refund_operation_with_notification` (qui réutilise le SQL métier historique), sans jamais appeler `stripe.refunds.create` et utilise la notification outbox.
3. **Notifications partagées** `_lib/refund-notification-outbox.js` : reprend les deux modèles d'email existants, échappe le message, contrôle la réservation et expire les sessions Checkout pour une annulation avant de réclamer l'envoi. Les chemins immédiat et différé partagent désormais la même réservation unique.
4. **Raccordements** : `refund-booking-payment`, `stripe-webhook`, `sync-stripe-refund-accounting` ; la synchronisation traite aussi les opérations déjà confirmées avant R2. Le scanner des emails pending permet de reprendre une notification créée mais non revendiquée.
5. **Sûreté** : après réservation `sending`, un transport réseau incertain, un crash ou une réponse fournisseur non vérifiable **ne conduit jamais à une relance automatique**. L'état reste `sending` ou `needs_review` et doit être contrôlé auprès de Resend. Un envoi confirmé est marqué `sent` avant la journalisation `email_logs` ; une panne de log ne déclenche pas un deuxième envoi.
6. Le wrapper SQL transactionnel évite aussi les doubles emails au déploiement : les anciens endpoints continuent à utiliser la RPC sans outbox et leurs notifications classiques, tandis que les nouvelles fonctions créent leur outbox et utilisent le nouveau sender.
7. Le moteur métier existant conserve seul l'autorité sur réservations, facture et avoir. R2 ne fabrique pas d'avoir et ne modifie pas le statut par des `UPDATE` applicatifs.

## Cas limites et limites volontairement maintenues

- Remboursement `refund_only` de montant zéro : **pas d'email de remboursement**.
- Annulation sans remboursement : le parcours SQL existant et son email d'annulation sont conservés.
- Remboursement externe sans allocation locale sûre : **pas de finalisation automatique**.
- Pour un remboursement déjà `succeeded` avant l'installation R2, **pas d'outbox rétroactif**, afin d'éviter les doubles notifications historiques.
- Les états `sending`/`needs_review` et les envois antérieurs à R2 nécessitent un contrôle manuel avec Resend et les journaux avant toute correction.
- Le mécanisme garantit un **envoi revendiqué au plus une fois par opération** par le code, mais ne peut pas prouver la réception de l'email. Il privilégie le risque de notification manquante à celui d'un doublon silencieux en cas de réponse réseau incertaine.
- Le texte commercial des anciens emails est conservé ; les helpers d'envoi historiques dans `refund-booking-payment.js` restent présents (non appelés) pour éviter une refonte supplémentaire, à nettoyer lors d'un chantier dédié après mise à jour des tests existants.

## Prérequis avant déploiement — AUCUN EXÉCUTÉ

1. Relecture du diff contre le dépôt Windows `5ff57b7`, du SQL et des privilèges effectifs Supabase.
2. Réexécuter les nouveaux tests R2, les tests de remboursement, **toute la suite**, le build Vite, puis une vérification du bundling des fonctions Netlify (`npx netlify dev`) ; l'archive d'audit partielle n'est pas une preuve de validation du projet complet.
3. Test en environnement isolé avec une **base Supabase de test** : migration 2A puis migration R2, finalisation concurrente, avoir, email et vérification du trigger. Ne jamais utiliser de remboursements réels ou de secrets live pour ces tests.
4. Plan de déploiement groupé et fenêtre de changement : appliquer d'abord les migrations SQL validées, puis déployer ensemble les fonctions modifiées. Vérifier l'existence des nouvelles RPC avant de mettre les fonctions en service.
5. Contrôles après déploiement : absence de `sending` bloqué, `needs_review`, opérations `stripe_succeeded`, incohérences de statuts réservation/avoir et email_logs ; examiner les historiques 2024/2025/2026 sans backfill aveugle.
6. **Pas de push, migration, commit ou changement en production avant validation explicite.** Préserver `docs/MD/` et les documents `docs/superpowers` non suivis.

## Tests ciblés

`node --test tests/v413-b1-refund-finalization-r2.test.js`

Puis `npm test`, `npm run build`, `git diff --check`, `git status --short` dans le dépôt complet.
