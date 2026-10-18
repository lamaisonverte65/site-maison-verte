# La Maison Verte V4.13 — B1 Stripe : audit et livraison encaissements automatiques

État : **correctif local à tester ; aucun push**. Audit effectué sur l'archive `LMV_V4.13_AUDIT_STRIPE_AUTO.zip` du 18/10/2026.

## Parcours existant (à préserver)

- `netlify/functions/stripe-webhook.js` valide la signature Stripe ; `checkout.session.completed` passe par `processCheckoutSessionCompleted`.
- Les paiements sont appliqués à `payments`, `booking_requests`, `stripe_balance_transactions` et aux agrégats via des RPC transactionnelles Supabase. Emails client/propriétaire séparés et dédoublonnés par les RPC existantes.
- Le rapprochement comptable B1 et le rattrapage manuel owner-only `admin-direct-stripe-accounting` emploient les clés `direct:payment:<payment.id>` et `direct:fee:<payment.id>`, couvertes par l'index unique `(source, source_record_key)`.
- Les frais Stripe doivent venir de la **balance transaction du paiement**, jamais des cumuls de réservation. Pas de tolérance de 0,01 €.

## Contenu de ce correctif (phase encaissements)

- Après application confirmée du paiement (ou replay d'un checkout déjà appliqué), tentative non bloquante de création comptable.
- La fonction réutilise `planDirectStripeAccounting` : même reconnaissance des doublons, clés et contrôles au centime que le rattrapage manuel.
- L'écriture n'est possible que pour `paid` + `deposit` / `balance` / `full`, avec référence de réservation, PaymentIntent, date d'encaissement, balance transaction unique et montants/frais/net concordants.
- En cas de frais absents, d'ambiguïté ou de collision avec une recette manuelle, **aucune écriture n'est inventée**. L'onglet Imports permet toujours le contrôle et le rattrapage.
- Les webhooks payout et le job quotidien `sync-stripe-finance` peuvent achever le rapprochement lorsqu'une balance transaction apparaît plus tard.
- Erreur comptable : journalisation côté serveur, sans invalider le paiement Stripe confirmé et sans envoyer de second email. Écriture : un INSERT atomique ; aucune mise à jour ni suppression d'écriture historique.

## Limites à traiter avant la livraison globale de B1

1. **Remboursements réels : NON automatisés par ce ZIP.** Le journal `accounting_entries.entry_kind` accepte seulement `income` et `expense`. Un remboursement n'est pas une charge d'exploitation. Concevoir une migration avec un mouvement financier dédié, la présentation distincte en Synthèse et le rapprochement par remboursement Stripe effectivement réussi. Ne pas inclure les simples annulations à 0 €.
2. Pour un remboursement exécuté via `refund-booking-payment`, vérifier `refund_operations.status=succeeded`, `refunded_amount_cents > 0` et l'alignement avec les lignes `refunds` réellement `succeeded`, sans assimiler un message de politique de remboursement à une sortie d'argent. Un remboursement externe effectué dans le tableau de bord Stripe nécessite une détection/réconciliation dédiée.
3. Les paiements `manual` (ménage après séjour, supplément, autres compléments) sont **volontairement exclus** de la création automatique standard et doivent être qualifiés par leur véritable nature comptable, sans gonfler artificiellement les revenus locatifs.
4. Contrôler sur le site de développement la création pour un futur vrai paiement, puis le replay/consultation owner-only : le montant financier et les factures/emails ne doivent pas changer et le compteur comptable manquant doit refléter les écritures créées.
5. Recette fiscale ≠ validation comptable. Ne jamais soustraire automatiquement les commissions, frais ni taxes plateforme non démontrées de la base micro-BIC. La taxe directe repose sur les instantanés historiques justifiés.

## Vérifications

- Nouveau test ciblé `tests/v413-b1-auto-direct-stripe-accounting.test.js` et suites existantes B1, webhook, agrégats et remboursements.
- L'archive de sources n'inclut pas tous les fichiers du projet (notamment `shared/`, des docs, assets et dépendances) : les tests globaux et le build doivent être validés dans le dossier Windows complet.
- Aucun appel Stripe live ni écriture Supabase effectué pendant cet audit.
