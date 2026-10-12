# Sauvegarde Stripe → pCloud — Plan d’implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une sauvegarde directe, complète, autonome, brute et chiffrée du compte Stripe production de La Maison Verte vers pCloud, indépendante de Supabase et sans modifier les flux métier du site.

**Architecture:** Un workflow GitHub Actions Stripe séparé exécute un export Node exhaustif vers un répertoire local, valide les NDJSON, construit inventaire/manifest/checksums, puis réutilise les scripts pCloud/rclone existants avec `PCLOUD_BASE_PATH=02_Stripe` et un `PCLOUD_LATEST_ROOT` dédié. Les scripts pCloud communs ne sont modifiés que si un test prouve qu’ils ne satisfont pas déjà ce contrat.

**Tech Stack:** Node.js 22, `stripe` ^22.1.1, `node:test`, GitHub Actions, Bash pour l’orchestration CI, rclone crypt, pCloud Europe.

**Spec:** `docs/superpowers/specs/2026-10-12-backup-stripe-pcloud-design.md`

## Global Constraints

- Compte Stripe : production/live uniquement.
- Secret GitHub dédié : `STRIPE_BACKUP_KEY`, restricted key en lecture seule ; ne jamais réutiliser `STRIPE_SECRET_KEY`.
- Identité attendue : `STRIPE_EXPECTED_ACCOUNT_ID`, valeur non secrète fournie au workflow via GitHub variable ou environnement.
- Secrets pCloud existants : `PCLOUD_TOKEN`, `RCLONE_CRYPT_PASSWORD`, `RCLONE_CRYPT_PASSWORD2`.
- Aucun secret ne doit être affiché dans les logs ni sérialisé dans manifest/inventaire.
- Les objets Stripe bruts sont conservés, y compris les données client et éventuels `client_secret` présents dans les réponses Stripe ; l’archive n’est jamais envoyée en clair sur pCloud.
- Backup complet, non incrémental, sans filtre temporel.
- Cadence : `17 3 * * *` UTC.
- Rétention identique à Supabase : daily 30 j, weekly 365 j, monthly/yearly/manual/baseline sans purge automatique.
- Pointeur Supabase existant inchangé : `La Maison Verte/backup-download/latest.json`.
- Pointeur Stripe : `La Maison Verte/backup-download/stripe/latest.json`.
- Aucun fichier métier Netlify, React, migration Supabase, réservation, paiement, facture ou webhook existant ne doit être modifié.
- Tests locaux Windows : ne jamais exiger `/bin/bash`, WSL ou Git Bash ; tester les scripts Bash par inspection de source et tester la logique fonctionnelle dans les modules Node.
- État Git de départ connu : `065bdac` est local, `main` est en avance d’un commit sur `origin/main`; aucun `git push` pendant ce chantier sans autorisation explicite.
- Ne pas ajouter/stager les dossiers locaux non suivis `docs/MD/` et `docs/superpowers/catia/`.
- Chaque commit prévu ci-dessous reste local ; aucun push.

## Review Focus

1. **Pagination réellement exhaustive** : un export doit consommer tout async iterable Stripe, y compris >100 objets et >100 line items, sans `autoPagingToArray` borné.
2. **Mode live** : toute ressource exposant `livemode` avec une valeur différente de `true` doit faire échouer l’export avant upload.
3. **Mauvais compte** : un `stripe_account_id` différent de `STRIPE_EXPECTED_ACCOUNT_ID` doit échouer avant création d’un backup publiable.
4. **Échec partiel** : une seule catégorie Stripe en erreur doit faire échouer l’assemblage ; aucun `_SUCCESS` ni nouveau `latest` ne doit être publié.
5. **Isolation pCloud** : Stripe doit écrire sous `02_Stripe` et sous `backup-download/stripe/latest.json`, jamais dans le pointeur Supabase existant.

---

## File map

### À créer

- `.github/workflows/backup-stripe.yml` — orchestration planifiée/manuelle Stripe.
- `scripts/backup/backup-stripe.mjs` — export exhaustif, validation live/compte/doublons, NDJSON et inventaire.
- `scripts/backup/assemble-stripe-backup.sh` — orchestration locale de l’export, manifest et checksums.
- `scripts/backup/build-stripe-manifest.mjs` — validation des fichiers exportés, tailles/hashes, manifest Stripe.
- `tests/backup-stripe-export.test.js` — comportement fonctionnel de l’exporteur avec faux client Stripe.
- `tests/backup-stripe-package.test.js` — validation inventaire/manifest/SHA et corruption NDJSON.
- `tests/backup-stripe-pcloud.test.js` — isolation `02_Stripe`, pointeur, rétention et ordre de publication.
- `tests/backup-stripe-workflow.test.js` — contrat du workflow GitHub Actions.
- `tests/backup-stripe-docs.test.js` — garde-fous documentaires.
- `docs/operations/BACKUP_STRIPE_PCLOUD.md` — exploitation et sécurité.
- `docs/operations/RECOVERY_STRIPE_BACKUP.md` — récupération d’une archive historique.

### À modifier seulement si un test rouge le justifie

- `scripts/backup/upload-pcloud.sh`
- `scripts/backup/publish-latest-backup.sh`
- `scripts/backup/rotate-pcloud.sh`

Le comportement observé dans l’audit indique que `PCLOUD_BASE_PATH` et `PCLOUD_LATEST_ROOT` sont déjà paramétrables ; le plan part donc du principe **aucune modification pCloud** tant que les tests ne prouvent pas le contraire.

---

### Task 1: Export Stripe exhaustif et testable

**Files:**
- Create: `scripts/backup/backup-stripe.mjs`
- Create: `tests/backup-stripe-export.test.js`

**Interfaces:**
- Consumes: un objet Stripe SDK ou faux client exposant les mêmes méthodes de lecture.
- Produces:
  - `export async function exportStripeBackup({ stripe, outputDir, expectedAccountId, logger })`
  - `export async function writeNdjsonCollection({ iterable, filePath, collectionName, requireLiveMode })`
  - `export async function writeCheckoutLineItems({ stripe, sessions, filePath })`
  - CLI utilisant `BACKUP_DIR`, `STRIPE_BACKUP_KEY`, `STRIPE_EXPECTED_ACCOUNT_ID`.
- `exportStripeBackup(...)` retourne `{ accountId, apiVersion, counts }`.

- [ ] **Step 1: écrire les tests rouges du contrat d’export**

Dans `tests/backup-stripe-export.test.js`, créer un faux client dont les méthodes `list()` et `listLineItems()` retournent des async iterables. Tester au minimum :

```js
test('Stripe export consumes every item from every async iterable, including more than one API page', async () => {
  // 205 PaymentIntents + plusieurs objets pour toutes les autres collections.
  // Assert: payment_intents.ndjson contient 205 lignes et chaque autre fichier contient tous ses objets.
});

test('Stripe export keeps raw objects and explicitly associates every line item with its Checkout Session', async () => {
  // Assert: objet principal JSON inchangé ; line item enveloppé par checkout_session_id + line_item.
});

test('Stripe export rejects wrong account before writing a publishable backup', async () => {
  // expected acct_expected, account returned acct_wrong -> reject.
});

test('Stripe export rejects any object explicitly marked livemode false', async () => {
  // reject avec catégorie concernée, sans contenu client dans le message.
});

test('Stripe export rejects duplicate ids and duplicate line-item ids within one session', async () => {
  // reject avant succès.
});

test('one Stripe category failure fails the complete export and never reports success', async () => {
  // une list() jette une erreur -> exportStripeBackup rejette.
});

test('Stripe export never serializes credential environment values into inventory metadata', async () => {
  // scanner counts/metadata générés ; aucune valeur STRIPE_BACKUP_KEY/pCloud/rclone.
});
```

- [ ] **Step 2: exécuter uniquement ces tests et constater l’échec**

Run:

```powershell
node --test tests/backup-stripe-export.test.js
```

Expected: FAIL parce que `scripts/backup/backup-stripe.mjs` n’existe pas.

- [ ] **Step 3: implémenter l’exporteur avec un seul chemin de collecte exhaustif**

Dans `scripts/backup/backup-stripe.mjs` :

- créer les répertoires `account`, `finance`, `checkout`, `customers`, `catalog`, `config`, `inventory`;
- récupérer l’identité du compte avant les collections et comparer exactement à `expectedAccountId`;
- parcourir les listes avec `for await...of`, jamais avec un tableau plafonné ;
- utiliser une demande `limit: 100` comme taille de page API, sans que `100` devienne une limite globale ;
- exporter :
  - `paymentIntents.list`
  - `charges.list`
  - `refunds.list`
  - `balanceTransactions.list`
  - `payouts.list`
  - `disputes.list`
  - `checkout.sessions.list`
  - `customers.list`
  - `products.list`
  - `prices.list`
  - `webhookEndpoints.list`
- pour chaque Checkout Session, parcourir `checkout.sessions.listLineItems(session.id, { limit: 100 })`;
- rejeter un doublon d’ID dans une collection ; clé line item = `checkout_session_id + line_item.id`;
- lorsque la propriété `livemode` existe, exiger strictement `true`;
- écrire un objet JSON compact par ligne et un `\n` terminal ;
- écrire `account/account.json` avec l’objet compte brut ;
- écrire `inventory/counts.json` depuis les nombres réellement écrits ;
- ne logger que catégorie + compteur, jamais l’objet brut.

Le CLI doit construire `new Stripe(process.env.STRIPE_BACKUP_KEY, { maxNetworkRetries: 3 })`; laisser le SDK gérer le backoff réseau borné plutôt que d’empiler une seconde boucle de retry manuelle. Les erreurs 401/403 doivent remonter immédiatement avec un message de catégorie non sensible.

- [ ] **Step 4: exécuter les tests d’export**

Run:

```powershell
node --test tests/backup-stripe-export.test.js
```

Expected: PASS, 0 fail.

- [ ] **Step 5: commit local, sans push**

```powershell
git add -- scripts/backup/backup-stripe.mjs tests/backup-stripe-export.test.js
git commit -m "Ajoute export Stripe complet pour sauvegarde"
```

Ne pas pousser.

---

### Task 2: Assemblage, validation, manifest et SHA256

**Files:**
- Create: `scripts/backup/build-stripe-manifest.mjs`
- Create: `scripts/backup/assemble-stripe-backup.sh`
- Create: `tests/backup-stripe-package.test.js`

**Interfaces:**
- Consumes: répertoire produit par `backup-stripe.mjs`.
- Produces:
  - `buildStripeManifest(backupDir, { backupId, backupKind, stripeSdkVersion })`
  - `manifest.json`
  - `SHA256SUMS`
- Convention checksum:
  - `manifest.json` liste taille + SHA256 de tous les fichiers de données/inventaire, **sauf** `manifest.json` et `SHA256SUMS`;
  - `SHA256SUMS` couvre ensuite tous les fichiers sauf lui-même, **y compris `manifest.json`**.
  - Cela évite toute référence circulaire.

- [ ] **Step 1: écrire les tests rouges du paquet**

Dans `tests/backup-stripe-package.test.js` :

```js
test('Stripe manifest validates every NDJSON line and reproduces exact counts', async () => {});
test('Stripe manifest records exact file size and SHA256 without circular self-hash', async () => {});
test('Stripe package rejects malformed NDJSON before checksums are accepted', async () => {});
test('Stripe package rejects a counts.json mismatch', async () => {});
test('Stripe package accepts zero objects only as an explicit empty NDJSON collection', async () => {});
test('Stripe manifest contains account id, backup identity, live mode, SDK/API version and exported categories', async () => {});
test('Stripe manifest and inventory never contain credential environment values', async () => {});
```

Ajouter un test statique de `assemble-stripe-backup.sh` qui vérifie l’ordre :

```text
backup-stripe.mjs
→ build-stripe-manifest.mjs
→ SHA256SUMS
```

et le refus d’un `BACKUP_DIR` non vide.

- [ ] **Step 2: vérifier que les tests sont rouges**

Run:

```powershell
node --test tests/backup-stripe-package.test.js
```

Expected: FAIL fichiers absents.

- [ ] **Step 3: implémenter `build-stripe-manifest.mjs`**

Responsabilités exactes :

- accepter le répertoire en argument CLI ; refuser absence/racine filesystem ;
- lire la liste attendue des 11 fichiers NDJSON ;
- parser chaque ligne non vide en JSON ;
- recompter et comparer à `inventory/counts.json`;
- relire `account/account.json`, vérifier `id === STRIPE_EXPECTED_ACCOUNT_ID`;
- vérifier `livemode === true` sur tous les objets qui exposent le champ ;
- calculer taille + SHA256 des fichiers de données/inventaire ;
- écrire `manifest.json` avec `format_version: 1`, `backup_id`, `backup_kind`, `created_at_utc`, `stripe_account_id`, `livemode: true`, versions Stripe/API si disponibles, `inventory`, `exported_categories`, `files`;
- ne jamais inclure une variable d’environnement secrète.

Le module doit exporter la fonction de construction pour les tests et avoir un petit wrapper CLI.

- [ ] **Step 4: implémenter `assemble-stripe-backup.sh` minimal**

Le shell doit uniquement orchestrer :

```text
BACKUP_DIR vide
→ node backup-stripe.mjs
→ node build-stripe-manifest.mjs
→ sha256sum de tous les fichiers sauf SHA256SUMS, tri déterministe
→ présence non vide de manifest.json et SHA256SUMS
```

Il ne doit ni appeler pCloud ni Stripe autrement que via `backup-stripe.mjs`.

- [ ] **Step 5: exécuter les tests du paquet puis les tests export**

Run:

```powershell
node --test `
  tests/backup-stripe-export.test.js `
  tests/backup-stripe-package.test.js
```

Expected: PASS, 0 fail, sans WSL/Bash.

- [ ] **Step 6: commit local, sans push**

```powershell
git add -- `
  scripts/backup/build-stripe-manifest.mjs `
  scripts/backup/assemble-stripe-backup.sh `
  tests/backup-stripe-package.test.js

git commit -m "Valide et assemble les sauvegardes Stripe"
```

Ne pas pousser.

---

### Task 3: Réutilisation pCloud et workflow GitHub indépendant

**Files:**
- Create: `.github/workflows/backup-stripe.yml`
- Create: `tests/backup-stripe-pcloud.test.js`
- Create: `tests/backup-stripe-workflow.test.js`
- Modify only if tests require it:
  - `scripts/backup/upload-pcloud.sh`
  - `scripts/backup/publish-latest-backup.sh`
  - `scripts/backup/rotate-pcloud.sh`

**Interfaces:**
- Workflow env:
  - `STRIPE_BACKUP_KEY=${{ secrets.STRIPE_BACKUP_KEY }}`
  - `STRIPE_EXPECTED_ACCOUNT_ID=${{ vars.STRIPE_EXPECTED_ACCOUNT_ID }}`
  - `PCLOUD_TOKEN`, `RCLONE_CRYPT_PASSWORD`, `RCLONE_CRYPT_PASSWORD2` depuis secrets.
- pCloud env Stripe:
  - `PCLOUD_BASE_PATH=02_Stripe`
  - `PCLOUD_LATEST_ROOT=La Maison Verte/backup-download/stripe`

- [ ] **Step 1: écrire d’abord les tests pCloud contre le code actuel**

`tests/backup-stripe-pcloud.test.js` doit vérifier par lecture de source :

```js
test('existing pCloud upload supports an independent Stripe base path without changing the Supabase default', () => {});
test('existing latest publisher supports a Stripe pointer root while keeping the Supabase default', () => {});
test('rotation remains parameterized by PCLOUD_BASE_PATH and purges only daily/weekly', () => {});
test('_SUCCESS precedes latest publication and failed latest publication cannot delete the completed backup', () => {});
```

Important : si ces tests passent contre les scripts actuels, **ne modifier aucun script pCloud**.

- [ ] **Step 2: exécuter les tests pCloud**

Run:

```powershell
node --test tests/backup-stripe-pcloud.test.js
```

Expected: PASS avec le code audité actuel. Si un test échoue, corriger uniquement la cause minimale et rerun tous les tests backup Supabase concernés.

- [ ] **Step 3: écrire le test rouge du workflow**

`tests/backup-stripe-workflow.test.js` vérifie :

- `cron: '17 3 * * *'`;
- `workflow_dispatch` avec `manual` et `baseline`;
- `permissions: contents: read` et aucune permission write;
- `concurrency.group: lmv-stripe-backup`, `cancel-in-progress: false`;
- Node 22 + `npm ci --ignore-scripts`;
- installation rclone ;
- secrets/variable requis sans valeur en clair ;
- `assemble-stripe-backup.sh`;
- upload avec `PCLOUD_BASE_PATH=02_Stripe`;
- `PCLOUD_LATEST_ROOT=La Maison Verte/backup-download/stripe`;
- tiers daily/weekly/monthly/yearly suivant la même logique Supabase ;
- rotation uniquement sur événement `schedule` après succès ;
- artifact diagnostic court, jamais le backup brut ;
- aucune référence à `STRIPE_SECRET_KEY`;
- aucune invocation de fonction Netlify ou Supabase.

- [ ] **Step 4: implémenter `.github/workflows/backup-stripe.yml`**

Suivre la structure de `backup-supabase.yml`, avec :

```yaml
name: Backup Stripe to pCloud
on:
  schedule:
    - cron: '17 3 * * *'
  workflow_dispatch:
    inputs:
      backup_kind:
        required: true
        default: manual
        type: choice
        options: [manual, baseline]
permissions:
  contents: read
concurrency:
  group: lmv-stripe-backup
  cancel-in-progress: false
```

Le job doit avoir un timeout borné, valider `STRIPE_BACKUP_KEY`, `STRIPE_EXPECTED_ACCOUNT_ID` et les trois secrets pCloud, créer `BACKUP_ID` UTC et les tiers, puis :

```text
assemble-stripe-backup.sh
→ pour chaque tier: upload-pcloud.sh avec PCLOUD_BASE_PATH/PCLOUD_LATEST_ROOT Stripe
→ rotation programmée avec PCLOUD_BASE_PATH=02_Stripe
→ diagnostic texte non sensible toujours uploadé 14 jours
```

- [ ] **Step 5: exécuter les tests workflow + pCloud + anciens tests backup pCloud**

Run:

```powershell
node --test `
  tests/backup-stripe-pcloud.test.js `
  tests/backup-stripe-workflow.test.js `
  tests/backup-pcloud-crypt.test.js `
  tests/backup-pcloud-policy.test.js `
  tests/backup-latest-pointer.test.js `
  tests/backup-supabase-workflow.test.js
```

Expected: PASS, 0 fail.

- [ ] **Step 6: commit local, sans push**

```powershell
git add -- `
  .github/workflows/backup-stripe.yml `
  tests/backup-stripe-pcloud.test.js `
  tests/backup-stripe-workflow.test.js
```

Ajouter les scripts pCloud à cette commande **uniquement s’ils ont réellement dû être modifiés**, puis :

```powershell
git commit -m "Ajoute workflow Stripe vers pCloud"
```

Ne pas pousser.

---

### Task 4: Documentation opérationnelle et récupération

**Files:**
- Create: `docs/operations/BACKUP_STRIPE_PCLOUD.md`
- Create: `docs/operations/RECOVERY_STRIPE_BACKUP.md`
- Create: `tests/backup-stripe-docs.test.js`

**Interfaces:**
- Documentation de mise en service ; aucune dépendance runtime.

- [ ] **Step 1: écrire les tests documentaires rouges**

Vérifier que les docs mentionnent explicitement :

- `STRIPE_BACKUP_KEY` restricted/read-only ;
- `STRIPE_EXPECTED_ACCOUNT_ID`;
- jamais `STRIPE_SECRET_KEY` pour le backup ;
- production/livemode seulement ;
- contenu des 11 catégories ;
- données client et archive hautement sensible ;
- `02_Stripe`;
- cadence `03:17 UTC`;
- rétention complète ;
- baseline permanent ;
- pointeur `backup-download/stripe/latest.json`;
- récupération via `LMVCRYPT:`;
- vérification `sha256sum -c SHA256SUMS` ou équivalent Windows ;
- recherche par PaymentIntent/Charge/Checkout Session/Refund/Payout ;
- impossibilité de réinjecter les paiements historiques ;
- snapshot non atomique ;
- secrets exclus des logs/manifest ;
- procédure de création de la clé restreinte sans jamais demander sa valeur dans le chat.

- [ ] **Step 2: exécuter le test et constater l’échec**

```powershell
node --test tests/backup-stripe-docs.test.js
```

Expected: FAIL documents absents.

- [ ] **Step 3: écrire `BACKUP_STRIPE_PCLOUD.md`**

Documenter architecture, secrets, permissions, format, cadence, rétention, baseline, logs, limites, observabilité et procédure de lancement manuel.

Ne jamais inclure de valeur réelle de clé/token.

- [ ] **Step 4: écrire `RECOVERY_STRIPE_BACKUP.md`**

Documenter :

```text
LMVCRYPT:02_Stripe/<tier>/<backup_id>
→ copie locale
→ SHA256
→ lecture NDJSON
→ recherche par IDs
→ rapprochement documentaire avec Supabase
```

Inclure commandes PowerShell compatibles Windows pour rechercher un ID dans les NDJSON, sans supposer WSL.

- [ ] **Step 5: exécuter le test documentaire**

```powershell
node --test tests/backup-stripe-docs.test.js
```

Expected: PASS.

- [ ] **Step 6: commit local, sans push**

```powershell
git add -- `
  docs/operations/BACKUP_STRIPE_PCLOUD.md `
  docs/operations/RECOVERY_STRIPE_BACKUP.md `
  tests/backup-stripe-docs.test.js

git commit -m "Documente sauvegarde et recuperation Stripe"
```

Ne pas pousser.

---

### Task 5: Régression complète et préparation du handoff réel

**Files:**
- No production files expected.
- Verify all files introduced by Tasks 1–4.

**Interfaces:**
- Produces a locally validated branch only. No deployment.

- [ ] **Step 1: exécuter tous les tests Stripe ciblés**

```powershell
node --test `
  tests/backup-stripe-export.test.js `
  tests/backup-stripe-package.test.js `
  tests/backup-stripe-pcloud.test.js `
  tests/backup-stripe-workflow.test.js `
  tests/backup-stripe-docs.test.js
```

Expected: PASS, 0 fail.

- [ ] **Step 2: exécuter toute la suite**

```powershell
npm test
```

Expected: PASS, 0 fail. Ne pas annoncer « OK » tant que la sortie réelle n’a pas été observée.

- [ ] **Step 3: contrôles Git**

```powershell
git diff --check
git status --short
git log --oneline -5
```

Expected:
- aucun problème `git diff --check`;
- aucun fichier métier inattendu modifié;
- `docs/MD/` et `docs/superpowers/catia/` peuvent rester `??` et ne doivent pas être ajoutés;
- branche toujours non poussée.

- [ ] **Step 4: build web seulement si le périmètre a dévié**

Si aucun fichier `src/` ou fonction Netlify n’a été modifié, le build Vite n’est pas un critère de ce chantier. Si le périmètre a accidentellement touché le bundle web, arrêter et auditer avant de lancer :

```powershell
npm run build
```

- [ ] **Step 5: revue de sécurité avant toute autorisation de push**

Vérifier dans le diff complet :

```text
aucune clé/token en clair
aucun JSON Stripe brut dans tests/docs/logs
aucune modification paiement/remboursement/webhook métier
aucune modification Supabase
pointeur Supabase intact
pointeur Stripe distinct
```

---

## Post-push acceptance gate — à exécuter uniquement après autorisation explicite

Cette section n’est **pas** exécutée pendant l’implémentation locale.

1. Créer dans Stripe une restricted key dédiée en lecture seule pour les ressources prévues ; stocker sa valeur uniquement dans GitHub secret `STRIPE_BACKUP_KEY`.
2. Configurer `STRIPE_EXPECTED_ACCOUNT_ID` comme valeur non secrète GitHub, sans clé dans le dépôt.
3. Pousser les commits uniquement lorsque l’utilisateur l’autorise.
4. Lancer GitHub Actions `Backup Stripe to pCloud` avec `backup_kind=baseline`.
5. Observer le run réel : compte attendu, catégories, compteurs, upload, `cryptcheck`, `_SUCCESS`, pointeur Stripe.
6. Vérifier via `LMVCRYPT:` la présence de `02_Stripe/baseline/<backup_id>`.
7. Télécharger localement l’archive déchiffrée.
8. Vérifier `SHA256SUMS`.
9. Vérifier `inventory/counts.json` et `manifest.json`.
10. Rechercher plusieurs opérations historiques connues par PaymentIntent, Charge, Checkout Session, Refund et Payout.
11. Faire le contrôle documentaire Stripe ↔ Supabase sans utiliser Supabase comme critère de validité de l’archive.
12. Contrôler que `La Maison Verte/backup-download/latest.json` pointe toujours sur Supabase et que `La Maison Verte/backup-download/stripe/latest.json` pointe sur Stripe.
13. Seulement après ces contrôles, marquer le chantier « Stripe backup opérationnel ».

## Self-review

- **Spec coverage:** toutes les sections de la spécification sont couvertes : export, live/account guards, raw objects, line items, inventaire, manifest/SHA, pCloud, rétention, latest distinct, workflow, docs, récupération, baseline réel.
- **Isolation:** le plan n’impose aucune modification Netlify/React/Supabase.
- **Windows:** aucun test local n’exécute Bash ; la régression du problème WSL déjà rencontré est évitée.
- **PCloud YAGNI:** les scripts communs sont d’abord testés tels quels ; pas de modification si leur paramétrage actuel suffit.
- **Checksum:** convention non circulaire fixée explicitement.
- **Deployment:** aucun push/deploy n’est inclus avant autorisation utilisateur.
