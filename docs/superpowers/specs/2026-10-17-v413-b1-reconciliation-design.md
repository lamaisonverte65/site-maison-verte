# La Maison Verte V4.13 — B1 Rapprochement comptable, fiscal et taxe de séjour

## 1. Objectif

B1 doit fournir une comptabilité annuelle fiable permettant :
- de rapprocher les encaissements, remboursements, plateformes, écritures comptables et documents ;
- de préparer les montants à reporter dans la déclaration fiscale ;
- d’identifier explicitement les anomalies ;
- de produire des totaux personnalisés de gestion ;
- sans modifier automatiquement les données sources.

L’année sélectionnée correspond à **l’année réelle d’encaissement ou de remboursement**. Les réservations, séjours ou dates de facturation ne déterminent pas à eux seuls l’exercice comptable.

## 2. Principes d’autorité

Les sources existantes conservent leur autorité :

```text
booking_requests.contract_total → montant contractuel Direct
payments → encaissements réellement réalisés
refunds / refund_operations → remboursements réellement réalisés
Stripe balance transactions → frais et mouvements Stripe
external_reservation_financials → données financières Booking / Airbnb
accounting_entries → journal comptable
customer_invoices → factures émises
customer_credit_notes → avoirs
tourist_tax_snapshot → taxe de séjour historique de la réservation
```

B1 ne crée pas une nouvelle source de vérité. Il construit une **vue de rapprochement calculée en lecture seule**.

## 3. Architecture B1.1

Endpoint owner-only :

```text
GET /.netlify/functions/admin-accounting-reconciliation?year=2026
```

Le moteur pur prévu est :

```text
netlify/functions/_lib/accounting-reconciliation.js
```

Réponse :

```text
rows
accountingSummary
taxSummary
```

Une ligne représente une opération économique : encaissement, remboursement, commission, frais, charge, ménage post-séjour ou autre mouvement pertinent.

## 4. Statuts de rapprochement

Chaque ligne possède quatre contrôles :

```text
financier
comptable
documentaire
fiscal
```

Statut global :

```text
Cohérent
Manquant
À vérifier
```

- `Cohérent` : données nécessaires présentes et concordantes ;
- `Manquant` : contrepartie attendue absente ;
- `À vérifier` : contradiction, ambiguïté ou règle impossible à établir sans hypothèse.

Tolérance monétaire : **≤ 0,01 € compatible ; > 0,01 € anomalie**.

## 5. Direct

La recette annuelle provient des **paiements effectivement encaissés**. `contract_total` sert de contrôle, mais ne crée pas une recette.

Ordre de rapprochement comptable :

```text
1. identifiant explicite du mouvement
2. référence + réservation
3. montant/date/réservation = suggestion uniquement
```

Le cas 3 reste `À vérifier`.

## 6. Booking / Airbnb

Source financière :

```text
external_reservation_financials
```

L’année provient de la date d’encaissement connue.

Les composants restent séparés : `traveler_total`, `accommodation_amount`, `cleaning_fee`, `tourist_tax_amount`, `commission_amount`, `payment_fee_amount`, `net_payout`.

Le moteur ne doit jamais fabriquer le chiffre fiscal avec `net payout + commission` ou un coefficient supposé.

Si la composition du montant n’est pas démontrée :

```text
fiscalGrossAmount = null
fiscalStatus = À vérifier
```

## 7. Calcul fiscal

Le montant destiné à une case fiscale correspond à la **recette brute LMV démontrée** :

```text
recette LMV encaissée
+ suppléments constituant une prestation LMV
- taxe de séjour explicitement identifiée
```

Les commissions Booking/Airbnb, frais Stripe/bancaires et autres charges ne diminuent pas automatiquement le brut micro-BIC. Aucun abattement n’est soustrait par LMV.

## 8. Règles fiscales versionnées

Les règles sont définies par **année de revenus**.

```text
2025 / meuble_tourisme_non_classe
→ déclaration 2026
→ 2042-C-PRO
→ déclarant 2 : 5OH
→ abattement : 30 %

2025 / meuble_tourisme_classe
→ déclaration 2026
→ 2042-C-PRO
→ déclarant 2 : 5OG
→ abattement : 50 %
```

Pour un formulaire non encore publié :

```text
box = null
ruleStatus = form_pending
```

Aucune extrapolation automatique.

## 9. Changement de classement

Lorsqu’une opération ne peut pas être classée juridiquement avec certitude entre classé et non classé, elle reste `Fiscal : À vérifier`. Le moteur n’invente pas la règle.

## 10. Taxe de séjour — principe historique impératif

Pour une réservation déjà calculée, `tourist_tax_snapshot` est l’autorité historique.

Une nouvelle règle de taxe **ne doit pas** modifier :
- `tourist_tax_amount`
- `tourist_tax_snapshot`
- `contract_total`
- le montant historique dû pour cette réservation.

Le registre réglementaire ne doit pas utiliser un nouveau catalogue de règles pour remplacer le montant historique d’une réservation déjà calculée.

## 11. Registre taxe de séjour

Comportement cible :

```text
ancienne réservation
↓
tourist_tax_snapshot
↓
montant historique
↓
montant de référence
```

Aucun recalcul réglementaire secondaire n’est requis pour B1.1/B1.2. La solution minimale privilégiée est de ne pas recalculer les réservations historiques.

## 12. Versionnement des règles taxe de séjour

`effective_from` reste enregistré comme date réglementaire. `created_at` conserve la date réelle de création.

Une règle nouvelle ne devient pas rétroactivement applicable aux snapshots déjà établis simplement parce que son `effective_from` est antérieur.

```text
réservation déjà calculée → snapshot figé
nouvelle réservation → règle applicable au moment du nouveau calcul
```

## 13. Bandeau « Règle en vigueur aujourd’hui »

Dans le résumé :

```text
Depuis le created_at · saisie le created_at
```

Exemple :

```text
Règle en vigueur aujourd’hui
2,30 € / personne taxable / nuit
Depuis le 28/09/2026 · saisie le 28/09/2026
```

`effective_from` reste disponible dans le détail/historique réglementaire.

## 14. Modification volontaire d’une réservation

Une modification administrative seule ne recalcule pas les éléments financiers.

Si dates/adultes/enfants changent, un nouveau calcul peut être nécessaire. Il doit utiliser une règle historiquement cohérente et ne jamais sélectionner silencieusement une règle saisie postérieurement simplement parce que son `effective_from` a été antidaté.

## 15. Interface B1.2

Sous-onglet `Rapprochement` dans Comptabilité, avec une année unique.

Synthèse :

```text
Recettes encaissées
Dépenses / frais
Anomalies
Montant fiscal prêt à déclarer
```

Colonnes principales :

```text
Date
Source
Type
Réservation
Référence
Brut
Taxe de séjour
Commission
Frais
Net
Comptabilité
Fiscal
État
```

## 16. Filtres et tris

Filtres cumulables : source, type, statut, catégorie comptable, catégorie fiscale, période, client, réservation, facture présente/absente, écriture présente/absente, montant fiscal validé/non validé.

Tris : date, montant, source, client, statut, catégorie.

Priorité par défaut : `À vérifier` → `Manquant` → `Cohérent`.

## 17. Totaux personnalisés

Les totaux de gestion ne sont pas des données fiscales. Ils peuvent couvrir CA brut connu, commissions, frais Stripe/plateformes, net économique, énergie, entretien, CFE, revenu moyen/nuit, Direct, Booking, Airbnb.

Ils sont recalculés selon les filtres. Aucune vue personnalisée persistante en B1.2.

## 18. Synthèse fiscale

`taxSummary` ne comprend que les opérations `Cohérentes` avec montant fiscal démontré et catégorie déterminée.

L’écran distingue toujours :
- `Montant fiscal validé`
- `Montant restant à vérifier`

## 19. Sécurité

B1.1/B1.2 est :
- owner-only ;
- lecture seule ;
- une seule année par requête ;
- sans `INSERT`, `UPDATE`, `DELETE` ni correction automatique.

## 20. Tests indispensables

Le chantier doit vérifier notamment :

```text
nouvelle règle → aucun UPDATE booking_requests
règle rétrodatée → snapshot historique inchangé
registre historique → montant principal issu du snapshot
changement de classement → anciennes réservations inchangées
modification administrative → taxe inchangée
modification dates/voyageurs → recalcul explicite et version historique contrôlée
bandeau admin → "Depuis le" = created_at
effective_from → conservé dans l'historique réglementaire
```

## 21. Découpage

```text
B1.0 : correctif avoir ↔ facture séjour, commit local déjà réalisé
B1.1 : moteur read-only + endpoint + règles fiscales
B1.2 : UI rapprochement + filtres/tris/totaux/synthèse fiscale + protection historique taxe
B1.3 : contrôle taxe plateformes
B1.4 : éventuelle automatisation écritures Direct
```

La correction de rétroactivité du registre taxe de séjour doit être traitée avant ou au tout début de B1.2.

## 22. Critère de réussite

```text
aucune règle nouvelle ne modifie le passé
aucun montant fiscal n'est inventé
aucun net plateforme n'est assimilé au brut
aucune taxe de séjour inconnue n'est estimée
chaque anomalie est visible
les montants fiscaux sont explicables ligne par ligne
les années précédentes restent consultables telles qu'elles ont été enregistrées
```
