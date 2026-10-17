# La Maison Verte V4.13 — B1.1/B1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un rapprochement annuel read-only fiable pour Direct/Booking/Airbnb, une synthèse fiscale explicable, et empêcher toute règle de taxe de séjour nouvellement saisie de recalculer les réservations historiques.

**Architecture:** Un moteur pur côté Netlify construit les lignes normalisées et les synthèses à partir des sources autoritaires existantes. Un endpoint owner-only charge une seule année et n’effectue aucune écriture. L’UI `DeclarationsPanel` affiche ensuite rapprochement, filtres, tris et synthèse fiscale. Le registre taxe de séjour historique bascule sur le snapshot enregistré.

**Tech Stack:** React/Vite, Netlify Functions ESM, Supabase/PostgreSQL, Node test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-10-17-v413-b1-reconciliation-design.md`

## Global Constraints

- `booking_requests.contract_total` reste le total contractuel Direct autoritaire.
- `payments` et remboursements réels déterminent les encaissements/remboursements d’un exercice.
- Une seule année civile est traitée par requête, selon la date réelle d’encaissement/remboursement.
- `external_reservation_financials` reste distinct du journal comptable et du ledger Direct/Stripe.
- Aucun calcul `net payout + commission`, aucun coefficient Booking, aucune taxe de séjour estimée ne peut produire un montant fiscal.
- Les commissions/frais restent des données de gestion et ne diminuent pas automatiquement le brut micro-BIC.
- `tourist_tax_snapshot` est l’autorité historique d’une réservation déjà calculée.
- Une règle de taxe nouvelle ou rétrodatée ne modifie ni ne recalcule silencieusement les réservations historiques.
- B1.1/B1.2 est read-only vis-à-vis des données métier : aucun `INSERT`, `UPDATE`, `DELETE` ni RPC d’écriture dans le nouvel endpoint.
- Les lignes `À vérifier`/`Manquant` restent visibles et n’entrent pas dans le total fiscal définitif.
- Aucun push intermédiaire : commits locaux par tâche, puis push groupé après vérifications globales.
- Ne pas modifier/supprimer les éléments locaux non suivis `docs/MD/`, les anciens plans/specs locaux ni `scripts.zip`.

## Review Focus

1. Paiement ou remboursement exactement à la frontière du 1er janvier : il doit appartenir à une seule année, déterminée par sa date effective.
2. Réservation Direct avec plusieurs paiements et taxe de séjour non ventilable entre exercices : aucun prorata inventé ; statut fiscal `À vérifier`.
3. Plusieurs écritures comptables candidates pour une même opération : ne jamais choisir silencieusement ; statut `À vérifier`.
4. Plateforme avec `net_payout` et commission connus mais brut LMV/taxe inconnus : rapprochement financier possible, `fiscalGrossAmount = null`.
5. Règle de taxe créée après une réservation avec `effective_from` antidaté : le registre et toute consultation historique doivent conserver le snapshot original.

---

### Task 1: Figer le registre historique de taxe de séjour sur les snapshots

**Files:**
- Modify: `netlify/functions/_lib/tourist-tax-declaration.js`
- Modify: `netlify/functions/admin-tourist-tax-declaration.js`
- Modify: `src/components/admin/DeclarationsPanel.jsx`
- Test: `tests/v410-a51b-tourist-tax-declaration.test.js`
- Create: `tests/v413-b11-tourist-tax-snapshot-authority.test.js`

**Interfaces:**
- Consumes: `booking_requests.tourist_tax_snapshot`, `tourist_tax_collected`, `tourist_tax_refunded`, `tourist_tax_collector`.
- Produces: `buildTouristTaxDeclarationRows({ bookings })` dont le montant historique de référence vient exclusivement du snapshot ; `summarizeTouristTaxDeclaration(rows, { year, month })`.

- [ ] **Step 1: écrire les tests RED sur l’autorité du snapshot.**

Assertions :
- une réservation historique garde `night.totalTaxCents` même si un catalogue de règles différent existe ;
- aucune nouvelle règle n’est nécessaire pour calculer le montant historique ;
- une nuit sans snapshot exploitable reste explicitement non calculable ;
- les plateformes restent hors du total LMV ;
- le total mensuel de référence provient du snapshot/collecté, pas d’un recalcul réglementaire.

- [ ] **Step 2: lancer les tests ciblés et vérifier l’échec attendu.**

```powershell
node --test tests\v413-b11-tourist-tax-snapshot-authority.test.js tests\v410-a51b-tourist-tax-declaration.test.js
```

Expected: FAIL sur les assertions qui interdisent le recalcul historique.

- [ ] **Step 3: simplifier `buildTouristTaxDeclarationRows` pour ne plus résoudre un barème courant pour les réservations historiques.**

Conserver les allocations `collected/refunded` par nuit et exposer explicitement :
- `snapshotTaxCents`
- `collectedCents`
- `refundedCents`
- `netCollectedCents`
- statut/motif lorsque le snapshot est incomplet.

Ne pas appeler `calculateTouristTaxNight()` pour déterminer le montant de référence historique.

- [ ] **Step 4: retirer de l’endpoint les lectures devenues inutiles de `tourist_tax_classification_history` / `tourist_tax_rules` pour le registre historique.**

Le handler reste `GET`, `ownerOnly: true`, une période validée, sans mutation.

- [ ] **Step 5: adapter la zone Taxe de séjour de `DeclarationsPanel.jsx`.**

Renommer les libellés qui laisseraient entendre un recalcul courant (`Dû Aure-Louron`) si nécessaire, pour indiquer clairement le **montant historique enregistré** et le net collecté.

- [ ] **Step 6: exécuter les tests ciblés.**

Expected: tous PASS.

- [ ] **Step 7: commit local.**

```powershell
git add netlify/functions/_lib/tourist-tax-declaration.js netlify/functions/admin-tourist-tax-declaration.js src/components/admin/DeclarationsPanel.jsx tests/v410-a51b-tourist-tax-declaration.test.js tests/v413-b11-tourist-tax-snapshot-authority.test.js
git commit -m "fix: preserve historical tourist tax snapshots"
```

---

### Task 2: Corriger le bandeau de règle de taxe sans changer le versionnement

**Files:**
- Modify: `src/components/PricingAdmin.jsx`
- Modify: `tests/v410-b41-tourist-tax-admin.test.js`
- Create: `tests/v413-b12-tourist-tax-current-rule-label.test.js`

**Interfaces:**
- Consumes: `currentTaxRule.created_at`, `currentTaxRule.effective_from`.
- Produces: bandeau « Depuis le … · saisie le … » utilisant `created_at` pour les deux dates de ce résumé, tout en conservant `effective_from` dans les données et l’historique.

- [ ] **Step 1: écrire le test RED.**

Assertions :
- le résumé n’utilise pas `effective_from` dans « Depuis le » ;
- il utilise `created_at` pour « Depuis le » et « saisie le » ;
- les formulaires/migrations continuent de gérer `effective_from`.

- [ ] **Step 2: lancer le test ciblé et constater l’échec.**

```powershell
node --test tests\v413-b12-tourist-tax-current-rule-label.test.js tests\v410-b41-tourist-tax-admin.test.js
```

- [ ] **Step 3: modifier uniquement le rendu du bandeau dans `PricingAdmin.jsx`.**

Ne pas modifier l’enregistrement de `effective_from`, le RPC de versionnement, ni l’historique.

- [ ] **Step 4: relancer les tests ciblés.**

Expected: PASS.

- [ ] **Step 5: commit local.**

```powershell
git add src/components/PricingAdmin.jsx tests/v410-b41-tourist-tax-admin.test.js tests/v413-b12-tourist-tax-current-rule-label.test.js
git commit -m "fix: show tourist tax rule creation date"
```

---

### Task 3: Verrouiller le recalcul lors d’une modification volontaire de réservation

**Files:**
- Modify: `netlify/functions/update-booking-request.js`
- Test: `tests/v410-booking-modification.test.js`
- Create: `tests/v413-b13-tourist-tax-booking-edit-version.test.js`

**Interfaces:**
- Consumes: snapshot existant (`deposit_rate`, `tourist_tax_snapshot.classification`, informations de règle/version disponibles dans le snapshot).
- Produces: recalcul explicite uniquement lorsque dates/voyageurs changent, sans sélectionner silencieusement une règle créée après le snapshot à cause d’un `effective_from` rétrodaté.

- [ ] **Step 1: écrire les tests RED.**

Cas :
- édition administrative seule → aucun recalcul financier ;
- changement dates/voyageurs → preview explicite ;
- règle créée après le snapshot mais antidatée → ne remplace pas silencieusement la version historique ;
- si les informations historiques nécessaires manquent → retour contrôlé `À vérifier`/erreur explicite plutôt qu’un barème inventé.

- [ ] **Step 2: lancer les tests ciblés.**

```powershell
node --test tests\v413-b13-tourist-tax-booking-edit-version.test.js tests\v410-booking-modification.test.js
```

- [ ] **Step 3: adapter le helper de preview V4.10 avec le minimum de code nécessaire.**

Préserver les comportements actuels de `contract_total`, acompte, promotion et absence de paiement/remboursement automatique.

- [ ] **Step 4: relancer les tests ciblés.**

Expected: PASS.

- [ ] **Step 5: commit local.**

```powershell
git add netlify/functions/update-booking-request.js tests/v410-booking-modification.test.js tests/v413-b13-tourist-tax-booking-edit-version.test.js
git commit -m "fix: preserve tourist tax version on booking edits"
```

---

### Task 4: Créer les règles fiscales versionnées en module pur

**Files:**
- Create: `netlify/functions/_lib/accounting-fiscal-rules.js`
- Create: `tests/v413-b11-accounting-fiscal-rules.test.js`

**Interfaces:**
- Produces:
  - `getFiscalRule(incomeYear, category, declarant = 2)`
  - `classifyFiscalOperation(operation, context)`
  - `buildFiscalSummary(rows, incomeYear)`
- Return fields: `incomeYear`, `declarationYear`, `form`, `box`, `abatementRate`, `ruleStatus`, `category`, `grossAmountCents`.

- [ ] **Step 1: écrire les tests RED avec les valeurs validées.**

Cas minimum :
- revenus 2025, non classé, déclarant 2 → `2042-C-PRO`, `5OH`, 30 % ;
- revenus 2025, classé, déclarant 2 → `5OG`, 50 % ;
- formulaire futur non confirmé → `box: null`, `ruleStatus: "form_pending"` ;
- aucune déduction de commission/frais ;
- opération de transition de classement ambiguë → catégorie nulle / `À vérifier`.

- [ ] **Step 2: lancer le test ciblé.**

```powershell
node --test tests\v413-b11-accounting-fiscal-rules.test.js
```

Expected: FAIL module absent.

- [ ] **Step 3: implémenter le module pur sans accès DB.**

Ne stocker que les règles confirmées ; aucune extrapolation de case future.

- [ ] **Step 4: relancer le test.**

Expected: PASS.

- [ ] **Step 5: commit local.**

```powershell
git add netlify/functions/_lib/accounting-fiscal-rules.js tests/v413-b11-accounting-fiscal-rules.test.js
git commit -m "feat: add versioned accounting fiscal rules"
```

---

### Task 5: Construire le moteur pur de rapprochement annuel

**Files:**
- Create: `netlify/functions/_lib/accounting-reconciliation.js`
- Create: `tests/v413-b11-accounting-reconciliation.test.js`

**Interfaces:**
- Consumes:
  - `year`
  - `bookings`
  - `payments`
  - `refundOperations`
  - `stripeBalanceTransactions`
  - `externalFinancials`
  - `accountingEntries`
  - `invoices`
  - `creditNotes`
  - `cleaningIssues`
  - `additionalCharges`
- Produces:
  - `buildAccountingReconciliation(input) -> { rows, accountingSummary, taxSummary }`
- Une `row` contient au minimum :
  - `id`, `date`, `source`, `type`
  - `bookingRequestId`, `externalReference`
  - `grossKnownCents`, `touristTaxCents`, `commissionCents`, `paymentFeeCents`, `netCents`
  - `accountingEntryIds`, `invoiceIds`, `creditNoteIds`
  - `financialStatus`, `accountingStatus`, `documentStatus`, `fiscalStatus`, `status`
  - `reasons[]`
  - `fiscalCategory`, `fiscalGrossAmountCents`.

- [ ] **Step 1: écrire les tests RED du noyau Direct.**

Cas :
- paiement dans l’année correcte ;
- acompte/solde sur deux années ;
- remboursement à sa date effective ;
- tolérance ≤ 1 centime ;
- écart > 1 centime ;
- écriture comptable explicite trouvée ;
- écriture absente → `Manquant` ;
- plusieurs candidats → `À vérifier`.

- [ ] **Step 2: écrire les tests RED plateformes.**

Cas :
- Booking/Airbnb par `payment_date` ;
- correspondance par `source + external_reference` / liens explicites ;
- `net_payout + commission` ne crée jamais le brut fiscal ;
- taxe inconnue ne se calcule jamais par pourcentage ;
- brut démontré + taxe explicite → montant fiscal possible ;
- commission et frais séparés.

- [ ] **Step 3: écrire les tests RED documentaire/post-séjour.**

Cas :
- facture séjour distincte de `post_stay_cleaning` / `additional_charge` ;
- remboursement réussi avec facture séjour émise et avoir absent → `Manquant` documentaire ;
- ménage/charge post-séjour reste une opération séparée du `contract_total`.

- [ ] **Step 4: exécuter le test complet du moteur et constater RED.**

```powershell
node --test tests\v413-b11-accounting-reconciliation.test.js
```

- [ ] **Step 5: implémenter des index `Map` par identifiants explicites.**

Pas de N+1, pas de matching fuzzy validé automatiquement.

- [ ] **Step 6: implémenter les statuts et résumés.**

`taxSummary` n’inclut que les lignes globalement cohérentes avec montant fiscal et catégorie démontrés. Conserver séparément le montant concerné par les anomalies.

- [ ] **Step 7: relancer le test du moteur.**

Expected: PASS.

- [ ] **Step 8: commit local.**

```powershell
git add netlify/functions/_lib/accounting-reconciliation.js tests/v413-b11-accounting-reconciliation.test.js
git commit -m "feat: add read-only accounting reconciliation engine"
```

---

### Task 6: Ajouter l’endpoint owner-only d’une seule année

**Files:**
- Create: `netlify/functions/admin-accounting-reconciliation.js`
- Create: `tests/v413-b11-accounting-reconciliation-endpoint.test.js`

**Interfaces:**
- Consumes: `GET ?year=YYYY`, Bearer token admin owner.
- Produces: `{ year, rows, accountingSummary, taxSummary, generatedAt }`.
- Uses: `authorizeAdminRequest(event, supabase, { ownerOnly: true })`.

- [ ] **Step 1: écrire les tests RED d’endpoint.**

Assertions :
- méthode non GET → 405 ;
- année invalide → 400 ;
- endpoint owner-only ;
- requêtes bornées à l’année lorsque la table porte une date d’encaissement ;
- aucune chaîne `.insert(`, `.update(`, `.delete(` ni RPC d’écriture ;
- appelle `buildAccountingReconciliation`.

- [ ] **Step 2: lancer les tests ciblés.**

```powershell
node --test tests\v413-b11-accounting-reconciliation-endpoint.test.js
```

- [ ] **Step 3: implémenter l’endpoint en requêtes parallèles.**

Sélectionner uniquement les champs requis. Pour les tables liées dont l’année n’est pas portée directement, charger les lignes reliées aux identifiants de l’exercice lorsque c’est possible.

- [ ] **Step 4: relancer les tests ciblés.**

Expected: PASS.

- [ ] **Step 5: commit local.**

```powershell
git add netlify/functions/admin-accounting-reconciliation.js tests/v413-b11-accounting-reconciliation-endpoint.test.js
git commit -m "feat: expose annual accounting reconciliation"
```

---

### Task 7: Ajouter le service client et le sous-onglet Rapprochement

**Files:**
- Create: `src/services/accountingReconciliationService.js`
- Modify: `src/components/admin/DeclarationsPanel.jsx`
- Modify only if needed: `src/components/admin/adminStyles.js`
- Create: `tests/v413-b12-accounting-reconciliation-ui.test.js`

**Interfaces:**
- Produces client: `fetchAccountingReconciliation(year)`.
- Consumes endpoint Task 6.
- UI subtab key: `reconciliation`, label `Rapprochement`.

- [ ] **Step 1: écrire le test RED du service et de l’intégration UI.**

Assertions :
- Bearer token envoyé ;
- `year` passé à l’endpoint ;
- `SUBTABS` contient `Rapprochement` ;
- changement d’année recharge le rapprochement ;
- états loading/error/empty explicites.

- [ ] **Step 2: exécuter les tests ciblés.**

```powershell
node --test tests\v413-b12-accounting-reconciliation-ui.test.js
```

- [ ] **Step 3: implémenter le service.**

Suivre le pattern de `touristTaxDeclarationService.js`, avec `cache: "no-store"`.

- [ ] **Step 4: intégrer l’état et le chargement dans `DeclarationsPanel.jsx`.**

Ne pas mélanger les écritures manuelles/imports existants avec l’état calculé du rapprochement.

- [ ] **Step 5: relancer les tests ciblés.**

Expected: PASS.

- [ ] **Step 6: commit local.**

```powershell
git add src/services/accountingReconciliationService.js src/components/admin/DeclarationsPanel.jsx src/components/admin/adminStyles.js tests/v413-b12-accounting-reconciliation-ui.test.js
git commit -m "feat: add accounting reconciliation admin view"
```

---

### Task 8: Ajouter détail, filtres, tris, totaux personnalisés et synthèse fiscale

**Files:**
- Prefer Create: `src/components/admin/AccountingReconciliationPanel.jsx`
- Prefer Create: `src/utils/accountingReconciliationView.js`
- Modify: `src/components/admin/DeclarationsPanel.jsx`
- Modify only if needed: `src/components/admin/adminStyles.js`
- Create: `tests/v413-b12-accounting-reconciliation-filters.test.js`
- Create: `tests/v413-b12-accounting-reconciliation-responsive.test.js`

**Interfaces:**
- `filterReconciliationRows(rows, filters)`
- `sortReconciliationRows(rows, sort)`
- `summarizeVisibleReconciliationRows(rows)`
- `AccountingReconciliationPanel({ data, year })`

- [ ] **Step 1: écrire les tests RED des filtres/tri/totaux.**

Cas :
- filtres cumulés source/type/statut/catégorie fiscale ;
- `Cohérents uniquement`, `Anomalies uniquement`, `Prêts pour déclaration` ;
- tri par défaut `À vérifier` → `Manquant` → `Cohérent`, puis date décroissante ;
- totaux visibles recalculés après filtre ;
- aucune vue nommée/persistée.

- [ ] **Step 2: écrire le test RED de séparation gestion/fiscal.**

Assertions :
- commissions/frais présents dans la synthèse gestion ;
- aucun frais ne réduit le montant fiscal ;
- `Montant fiscal validé` et `Montant restant à vérifier` distincts ;
- case `null` affichée « à confirmer ».

- [ ] **Step 3: écrire le test RED responsive.**

Prévoir tableau desktop et présentation compacte mobile sans imposer un tableau illisible.

- [ ] **Step 4: implémenter les utilitaires purs.**

- [ ] **Step 5: implémenter `AccountingReconciliationPanel`.**

Le détail d’une ligne montre source, réservation/plateforme, comptabilité, facture/avoir, taxe, fiscal et motifs exacts.

- [ ] **Step 6: intégrer le composant dans `DeclarationsPanel`.**

- [ ] **Step 7: relancer les tests B1.2.**

Expected: PASS.

- [ ] **Step 8: commit local.**

```powershell
git add src/components/admin/AccountingReconciliationPanel.jsx src/utils/accountingReconciliationView.js src/components/admin/DeclarationsPanel.jsx src/components/admin/adminStyles.js tests/v413-b12-accounting-reconciliation-filters.test.js tests/v413-b12-accounting-reconciliation-responsive.test.js
git commit -m "feat: add reconciliation filters and fiscal summary"
```

---

### Task 9: Vérification globale B1.1/B1.2 avant push groupé

**Files:**
- Aucun nouveau fichier de production sauf correction ciblée révélée par une vérification.

- [ ] **Step 1: tests ciblés B1.**

```powershell
node --test tests\v413-b1*.test.js tests\v410-a51b-tourist-tax-declaration.test.js tests\v410-b41-tourist-tax-admin.test.js tests\v410-booking-modification.test.js
```

Expected: 0 fail.

- [ ] **Step 2: suite complète.**

```powershell
npm test
```

Expected: 0 fail, avec nombre exact de tests/pass consigné.

- [ ] **Step 3: build.**

```powershell
npm run build
```

Expected: exit code 0.

- [ ] **Step 4: contrôle Git.**

```powershell
git diff --check
git status --short
git log --oneline -8
```

Expected :
- aucune anomalie whitespace ;
- changements B1 attendus uniquement ;
- les éléments locaux non suivis restent hors commits.

- [ ] **Step 5: vérification manuelle admin.**

Contrôler :
- 2025 puis 2026 ;
- Direct avec acompte/solde ;
- une Booking ;
- une Airbnb ;
- une ligne incomplète/ambigüe ;
- les totaux après filtre ;
- une réservation historique de taxe ;
- une règle récente/rétrodatée qui ne change pas son snapshot ;
- le bandeau `Depuis le = saisie le`.

- [ ] **Step 6: comparer plusieurs résultats au calcul manuel issu des sources brutes.**

Ne déclarer B1 validé que si chaque montant testé est explicable sans hypothèse.

- [ ] **Step 7: push groupé uniquement après validation utilisateur.**

```powershell
git push origin main
```

Ne pas pousser avant accord.
