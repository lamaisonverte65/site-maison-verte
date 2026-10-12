# Sauvegarde Stripe → pCloud — Spécification de conception

**Projet :** La Maison Verte V4.10
**Date :** 2026-10-12
**Statut :** design fonctionnel approuvé, spécification à relire avant plan d’implémentation
**Chemin cible :** `docs/superpowers/specs/2026-10-12-backup-stripe-pcloud-design.md`

## 1. Objectif

Ajouter une sauvegarde **directe, indépendante, complète et chiffrée** des données Stripe de production de La Maison Verte vers pCloud Europe.

Cette sauvegarde complète les deux protections déjà existantes :

1. Stripe reste la plateforme qui exécute réellement les paiements ;
2. Supabase conserve une représentation métier et comptable d’une partie importante des opérations Stripe ;
3. la sauvegarde Supabase → pCloud archive déjà ces tables ;
4. le nouveau chantier ajoute une archive **directement issue de l’API Stripe**, sans passer par Supabase.

Le but principal est de conserver durablement la preuve financière, les objets Stripe historiques, les métadonnées utiles, la configuration non sensible et les informations nécessaires à un rapprochement ou à une reconstruction documentaire après incident.

Ce système **n’est pas une restauration de compte Stripe** : les paiements, charges, remboursements et virements historiques ne peuvent pas être recréés comme tels dans un autre compte Stripe.

## 2. Contexte observé dans le projet audité

L’audit du projet actuel confirme les éléments structurants suivants :

- la sauvegarde Supabase est exécutée par `.github/workflows/backup-supabase.yml` à `02:17 UTC` ;
- l’infrastructure pCloud existante utilise `rclone crypt`, pCloud Europe, un staging `.incoming`, `cryptcheck`, puis un marqueur `_SUCCESS` ;
- `scripts/backup/upload-pcloud.sh` est déjà paramétrable par `PCLOUD_BASE_PATH` ;
- `scripts/backup/rotate-pcloud.sh` est également paramétrable par `PCLOUD_BASE_PATH` ;
- `scripts/backup/publish-latest-backup.sh` utilise actuellement un pointeur non chiffré `latest.json`, avec un root configurable par `PCLOUD_LATEST_ROOT` ;
- le projet utilise déjà le SDK Node Stripe (`stripe` version `^22.1.1`) ;
- le mécanisme métier `sync-stripe-finance.js` ne constitue pas un export Stripe exhaustif : il travaille notamment sur les 20 payouts récents et jusqu’à 100 réservations avec PaymentIntent ;
- Supabase contient déjà des identifiants et données financières Stripe utiles, notamment paiements, payouts et balance transactions, mais cela ne remplace pas une archive directe de Stripe.

Le nouveau système doit donc réutiliser l’infrastructure pCloud éprouvée sans coupler son succès à la sauvegarde Supabase et sans modifier les flux métier Stripe/Netlify existants.

## 3. Périmètre fonctionnel approuvé

### 3.1 Données Stripe à archiver

Le périmètre retenu correspond à l’approche « complète utile » :

#### Finance
- PaymentIntents ;
- Charges ;
- Refunds ;
- Balance Transactions ;
- Payouts ;
- Disputes.

#### Checkout
- Checkout Sessions ;
- tous les line items de chaque Checkout Session.

#### Clients
- Customers.

#### Catalogue
- Products ;
- Prices.

#### Configuration non sensible
- informations du compte utiles à son identification ;
- Webhook Endpoints et événements activés ;
- version de format de la sauvegarde ;
- version du SDK Stripe utilisée ;
- version API Stripe effective/observée lorsque Stripe la rend disponible de manière fiable.

### 3.2 Mode Stripe

La sauvegarde automatique concerne **uniquement le compte Stripe de production / live mode**.

Les objets de test ne sont pas inclus dans le workflow automatique. Un éventuel export du mode test serait un chantier séparé.

Lorsque la ressource Stripe expose un champ `livemode`, la sauvegarde doit refuser tout objet où `livemode !== true`. Pour les ressources de configuration qui n’exposeraient pas ce champ, l’utilisation de la clé live dédiée et la validation de l’identité du compte constituent la garde principale.

### 3.3 Fidélité des objets

Les objets sont conservés **bruts et complets tels que renvoyés par l’API Stripe**, sans transformation destructive des données métier ou client.

Cela inclut les données personnelles éventuellement présentes dans les objets Stripe (`customer_details`, `billing_details`, nom, email, adresse, etc.). Ces données sont acceptées parce que l’archive est chiffrée côté client par `rclone crypt` avant d’être stockée sur pCloud.

**Clarification de sécurité importante :** des objets Stripe bruts peuvent eux-mêmes contenir des champs sensibles applicatifs, par exemple un `client_secret` de PaymentIntent. Le design approuvé privilégie l’archive brute complète : ces champs font donc partie du contenu archivé s’ils sont renvoyés par l’API. En revanche, aucune **clé de compte**, clé restreinte de backup, variable d’environnement, secret webhook, token pCloud ou mot de passe rclone ne doit être injecté artificiellement dans l’archive ni apparaître dans les logs.

## 4. Non-objectifs

Ce chantier ne doit pas :

- modifier le comportement des paiements, remboursements, factures ou webhooks du site ;
- modifier les données Supabase ;
- remplacer `sync-stripe-finance.js` ;
- modifier les règles métier de rapprochement Stripe/Supabase ;
- permettre de recréer des paiements historiques dans un autre compte Stripe ;
- sauvegarder les secrets Stripe ou pCloud ;
- ajouter un bouton admin de téléchargement Stripe dans cette première version ;
- migrer ou déplacer le pointeur `latest` Supabase déjà utilisé par le bouton admin ;
- introduire une sauvegarde incrémentale.

## 5. Architecture retenue

Le système Stripe possède son propre workflow GitHub Actions mais réutilise les composants pCloud communs déjà testés.

```text
Stripe production
      ↓ clé restreinte lecture seule
backup-stripe.mjs
      ↓
archive locale complète
      ↓
validation + inventaire + manifest + SHA256
      ↓
upload-pcloud.sh
      ↓ rclone crypt
pCloud Europe / 02_Stripe
```

### 5.1 Séparation des workflows

Deux workflows indépendants :

```text
.github/workflows/backup-supabase.yml
.github/workflows/backup-stripe.yml
```

La défaillance d’un backup Stripe ne doit pas faire échouer la sauvegarde Supabase, et inversement.

### 5.2 Cadence Stripe

Workflow automatique Stripe :

```text
17 3 * * *
```

soit `03:17 UTC`, une heure après Supabase (`02:17 UTC`).

Le workflow supporte également `workflow_dispatch` avec :

- `manual` ;
- `baseline`.

### 5.3 Tiers et rétention

Même politique que Supabase :

| Tier | Rétention |
|---|---|
| `daily` | 30 jours |
| `weekly` | 365 jours |
| `monthly` | illimitée |
| `yearly` | permanente |
| `manual` | permanente sauf suppression explicite |
| `baseline` | permanente |

Chaque backup est **complet et autonome**.

Les exécutions planifiées doivent produire `daily` et, selon la date UTC, également `weekly`, `monthly` et/ou `yearly` suivant la même logique que Supabase.

## 6. Structure pCloud

Le chemin logique déchiffré devient :

```text
LMVCRYPT:
├── 01_Supabase/
│   ├── baseline/
│   ├── daily/
│   ├── weekly/
│   ├── monthly/
│   ├── yearly/
│   └── manual/
└── 02_Stripe/
    ├── baseline/
    ├── daily/
    ├── weekly/
    ├── monthly/
    ├── yearly/
    └── manual/
```

Pour Stripe :

```text
PCLOUD_BASE_PATH=02_Stripe
```

### 6.1 Pointeur latest

Le pointeur Stripe doit être indépendant du pointeur Supabase.

Le système Supabase actuel conserve son chemin existant afin de ne pas casser le bouton admin déjà développé :

```text
La Maison Verte/backup-download/latest.json
```

Stripe utilise :

```text
La Maison Verte/backup-download/stripe/latest.json
```

via :

```text
PCLOUD_LATEST_ROOT="La Maison Verte/backup-download/stripe"
```

Le chantier Stripe **ne doit jamais écraser** le `latest.json` Supabase existant.

## 7. Structure d’une sauvegarde Stripe

Structure logique cible :

```text
stripe-backup/
├── account/
│   └── account.json
├── finance/
│   ├── payment_intents.ndjson
│   ├── charges.ndjson
│   ├── refunds.ndjson
│   ├── balance_transactions.ndjson
│   ├── payouts.ndjson
│   └── disputes.ndjson
├── checkout/
│   ├── checkout_sessions.ndjson
│   └── checkout_session_line_items.ndjson
├── customers/
│   └── customers.ndjson
├── catalog/
│   ├── products.ndjson
│   └── prices.ndjson
├── config/
│   └── webhook_endpoints.ndjson
├── inventory/
│   └── counts.json
├── manifest.json
└── SHA256SUMS
```

Un fichier NDJSON contient exactement un objet JSON par ligne.

### 7.1 Identité des line items

`checkout_session_line_items.ndjson` doit permettre de rattacher chaque line item à sa Checkout Session d’origine. Si l’objet Stripe ne transporte pas lui-même cette relation dans un champ exploitable, l’enveloppe NDJSON doit ajouter uniquement le minimum de contexte non destructif nécessaire, par exemple :

```json
{"checkout_session_id":"cs_...","line_item":{...objet Stripe brut...}}
```

Ce fichier est la seule exception autorisée au principe « un objet Stripe brut seul par ligne », car la relation session → line item doit rester explicite et exploitable hors Stripe.

## 8. Règles de collecte Stripe

### 8.1 Pagination exhaustive

Aucune ressource listable ne doit être limitée à une première page.

La collecte doit poursuivre la pagination jusqu’à ce que Stripe indique qu’il n’existe plus de page suivante.

Aucune limite locale du type `limit: 20` ou `limit: 100` ne constitue une limite d’historique.

### 8.2 Absence de filtre temporel

Les backups complets ne filtrent pas sur une date de création. Ils récupèrent tout l’historique encore accessible à la clé Stripe au moment de l’exécution.

### 8.3 Checkout Sessions

Après export de toutes les Checkout Sessions, l’exporteur doit récupérer tous les line items de chaque session, avec pagination complète lorsque nécessaire.

### 8.4 Doublons

Pour chaque collection principale, deux objets portant le même `id` dans le même fichier constituent une anomalie et font échouer l’assemblage.

Les line items sont contrôlés dans le contexte de leur session d’origine.

### 8.5 Objets supprimés ou plus exposés par Stripe

Le système ne peut archiver que ce que l’API Stripe rend encore accessible au moment du backup.

Le premier baseline permanent est donc particulièrement important : un objet présent lors du baseline reste conservé dans cette archive même s’il n’est plus renvoyé plus tard par l’API.

## 9. Inventaire et manifest

### 9.1 `inventory/counts.json`

Il contient au minimum le nombre d’objets effectivement écrits pour chaque catégorie :

```json
{
  "payment_intents": 18,
  "charges": 18,
  "refunds": 2,
  "balance_transactions": 26,
  "payouts": 11,
  "disputes": 0,
  "checkout_sessions": 22,
  "checkout_session_line_items": 22,
  "customers": 15,
  "products": 1,
  "prices": 3,
  "webhook_endpoints": 1
}
```

Ces valeurs sont calculées depuis les données réellement écrites et ne sont jamais inventées à partir d’estimations Stripe.

### 9.2 `manifest.json`

Le manifest contient au minimum :

- `format_version` ;
- `backup_id` ;
- `tier` / type de backup ;
- `created_at_utc` ;
- `stripe_account_id` ;
- indication `livemode` ;
- version du package `stripe` utilisée ;
- version API Stripe effective/observée si disponible ;
- compteurs de l’inventaire ;
- taille de chaque fichier archivé ;
- SHA256 de chaque fichier archivé ;
- liste explicite des catégories exportées.

Le manifest ne contient aucune clé ou valeur secrète provenant de l’environnement d’exécution.

### 9.3 `SHA256SUMS`

Tous les fichiers de données, d’inventaire et le manifest doivent être couverts par les contrôles d’intégrité selon une procédure déterministe évitant toute référence circulaire de checksum.

La convention exacte sera fixée dans le plan d’implémentation, mais elle doit permettre une vérification locale simple après téléchargement.

## 10. Sécurité et secrets

### 10.1 Clé Stripe dédiée

GitHub Actions utilise un secret distinct :

```text
STRIPE_BACKUP_KEY
```

Cette clé est une **restricted key** Stripe avec des droits de lecture uniquement et uniquement pour les ressources nécessaires au backup.

Elle est distincte de `STRIPE_SECRET_KEY` utilisée par le site/Netlify.

Les permissions doivent être minimales : lecture des ressources listées au §3, aucune création, modification, remboursement, suppression ou action financière.

### 10.2 Compte attendu

Le workflow doit valider l’identité du compte Stripe contre une valeur attendue non secrète, par exemple :

```text
STRIPE_EXPECTED_ACCOUNT_ID=acct_...
```

Une différence entre compte interrogé et compte attendu arrête l’exécution avant l’upload pCloud.

### 10.3 Secrets pCloud existants

Le workflow Stripe réutilise :

```text
PCLOUD_TOKEN
RCLONE_CRYPT_PASSWORD
RCLONE_CRYPT_PASSWORD2
```

Aucun de ces secrets ne doit apparaître dans les logs, le manifest, l’inventaire ou les fichiers NDJSON.

### 10.4 Classification de l’archive

L’archive Stripe est **hautement sensible** car elle contient :

- historique financier ;
- données client ;
- métadonnées Stripe ;
- potentiellement des champs sensibles intégrés aux objets bruts.

Elle ne doit jamais être stockée en clair sur pCloud. Le chemin autoritaire est uniquement `LMVCRYPT:`.

## 11. Validation locale avant upload

Aucun upload ne commence tant que l’archive locale n’a pas passé tous les contrôles suivants :

1. chaque appel Stripe requis a réussi ;
2. toutes les paginations sont terminées ;
3. chaque ligne NDJSON est un JSON valide ;
4. les IDs ne sont pas dupliqués dans les collections principales ;
5. les compteurs correspondent aux fichiers ;
6. les objets qui exposent `livemode` sont tous `true` ;
7. le compte correspond à `STRIPE_EXPECTED_ACCOUNT_ID` ;
8. le manifest est cohérent avec l’inventaire ;
9. les tailles et SHA256 correspondent aux fichiers ;
10. aucun secret d’environnement n’a été sérialisé par erreur.

Une catégorie critique impossible à récupérer fait échouer **l’intégralité du backup**.

## 12. Upload pCloud atomique

Le comportement doit rester aligné sur Supabase :

```text
archive locale complète et validée
        ↓
upload dans 02_Stripe/.incoming/<tier>/<backup_id>
        ↓
rclone cryptcheck
        ↓
copie vers 02_Stripe/<tier>/<backup_id>
        ↓
rclone cryptcheck
        ↓
_SUCCESS
        ↓
purge du staging
        ↓
publication du latest Stripe
```

Un run incomplet ou corrompu ne reçoit jamais `_SUCCESS`.

Si la publication du nouveau pointeur `latest` échoue après qu’un backup a été validé, le run doit signaler l’échec de publication et l’ancien `latest` doit rester exploitable. Le backup nouvellement validé demeure présent avec `_SUCCESS`.

Le comportement exact reste cohérent avec la mécanique existante de `upload-pcloud.sh`.

## 13. Gestion des erreurs Stripe

### 13.1 Erreurs transitoires

Les erreurs `429`, `5xx` et timeouts réseau peuvent être retentées avec un nombre borné de tentatives et un backoff progressif.

Le design cible est de l’ordre de :

```text
tentative initiale
attente ~5 s
retry 1
attente ~15 s
retry 2
attente ~30 s
retry 3 final
```

La stratégie d’implémentation doit tenir compte des retries automatiques éventuels du SDK Stripe afin d’éviter une multiplication incontrôlée des tentatives.

### 13.2 Erreurs d’autorisation

Une erreur `401` ou `403` n’est pas retentée en boucle. Le workflow échoue avec un message indiquant la catégorie qui n’a pas pu être lue, sans afficher la clé ni la réponse brute si elle contient des informations sensibles.

### 13.3 Échec partiel

Aucun backup partiel n’est publié.

Exemple : PaymentIntents complets + échec Refunds = run en échec, aucun `_SUCCESS`, aucun nouveau `latest` Stripe.

## 14. Logs GitHub Actions

Les logs peuvent afficher uniquement des informations opérationnelles non sensibles, par exemple :

```text
PaymentIntents: 18
Charges: 18
Refunds: 2
...
Validation locale: OK
Upload pCloud: OK
cryptcheck: OK
_SUCCESS: OK
```

Ils ne doivent pas afficher :

- nom, email ou adresse client ;
- JSON brut Stripe ;
- `client_secret` ;
- clé Stripe ;
- secret webhook ;
- token pCloud ;
- mots de passe `rclone crypt`.

## 15. Workflow GitHub Actions Stripe

Le workflow cible :

```text
.github/workflows/backup-stripe.yml
```

Propriétés requises :

- `permissions: contents: read` ;
- groupe de concurrence distinct, par exemple `lmv-stripe-backup` ;
- `cancel-in-progress: false` ;
- timeout borné ;
- Node 22, cohérent avec le workflow Supabase ;
- installation des dépendances du projet par `npm ci --ignore-scripts` ;
- installation de `rclone` ;
- validation explicite des secrets requis ;
- calcul de `backup_id` UTC et des tiers ;
- export/assemblage local ;
- upload de chaque tier ;
- rotation automatique seulement après succès d’un run planifié ;
- diagnostic non sensible conservé comme artifact GitHub avec rétention courte.

## 16. Fichiers envisagés

Le plan d’implémentation devra préserver les responsabilités suivantes :

### À créer

```text
.github/workflows/backup-stripe.yml
scripts/backup/backup-stripe.mjs
scripts/backup/assemble-stripe-backup.sh
scripts/backup/build-stripe-manifest.mjs
docs/operations/BACKUP_STRIPE_PCLOUD.md
docs/operations/RECOVERY_STRIPE_BACKUP.md
```

Tests dédiés à créer sous `tests/`, avec des noms précis fixés dans le plan.

### À modifier au strict nécessaire

```text
scripts/backup/upload-pcloud.sh
scripts/backup/publish-latest-backup.sh
```

`rotate-pcloud.sh` ne doit être modifié que si les tests prouvent qu’un paramétrage Stripe ne peut pas déjà fonctionner via `PCLOUD_BASE_PATH=02_Stripe`.

Aucun fichier métier Netlify, composant React, migration Supabase, fonction Stripe existante ou logique de réservation ne doit être modifié pour ce chantier.

## 17. Tests automatisés requis

Les tests doivent couvrir au minimum :

### Export Stripe
- pagination sur plusieurs pages pour chaque ressource listable ;
- pagination des line items d’une Checkout Session ;
- aucune limitation implicite à 20/100 objets ;
- conservation des objets bruts ;
- association explicite line item → Checkout Session ;
- refus des doublons ;
- refus d’un JSON invalide si une étape de transformation interne produit une donnée corrompue ;
- refus d’un objet `livemode=false` lorsque le champ existe ;
- refus d’un mauvais compte Stripe ;
- erreur d’une catégorie = échec global.

### Inventaire / manifest
- compteurs exacts ;
- tailles exactes ;
- SHA256 exacts ;
- manifest cohérent ;
- aucune variable secrète injectée dans manifest/inventaire ;
- validation d’archives vides seulement pour les catégories où zéro objet est légitime.

### pCloud
- `PCLOUD_BASE_PATH=02_Stripe` ;
- rétention daily 30 jours / weekly 365 jours ;
- monthly/yearly/manual/baseline jamais purgés automatiquement ;
- staging puis `cryptcheck` puis `_SUCCESS` ;
- aucun `_SUCCESS` après échec ;
- pointeur Stripe distinct du pointeur Supabase ;
- ancien `latest` conservé si une nouvelle publication échoue.

### Workflow
- cadence `17 3 * * *` ;
- workflow manual `manual|baseline` ;
- permissions minimales ;
- secrets requis sans valeur dans le YAML/log ;
- concurrence indépendante de Supabase ;
- rotation uniquement après succès planifié.

### Régression
- les tests backup Supabase existants doivent continuer de passer ;
- aucun test métier paiements/réservations/facturation ne doit être cassé ;
- `npm test` complet doit passer avant validation locale du chantier.

## 18. Premier baseline réel

Le système n’est pas considéré comme opérationnel après les seuls tests locaux.

Après implémentation, commit local, revue puis push autorisé, lancer un vrai :

```text
backup_kind = baseline
```

Le baseline Stripe permanent doit être validé par observation réelle des étapes suivantes :

1. workflow GitHub Actions réussi ;
2. identité du compte Stripe correcte ;
3. export de toutes les catégories ;
4. upload chiffré dans `02_Stripe/baseline/...` ;
5. `cryptcheck` réussi ;
6. `_SUCCESS` présent ;
7. pointeur `backup-download/stripe/latest.json` correct ;
8. téléchargement via `LMVCRYPT:` ;
9. contrôle local de `SHA256SUMS` ;
10. inventaire cohérent avec les fichiers ;
11. recherche de plusieurs opérations historiques connues.

## 19. Contrôle croisé Stripe ↔ Supabase

Le premier baseline doit permettre un contrôle documentaire entre l’archive Stripe directe et les données Supabase :

```text
PaymentIntent IDs  ↔ payments / booking_requests
Charge IDs         ↔ payments / stripe_balance_transactions
Refund IDs         ↔ opérations de remboursement
Payout IDs         ↔ stripe_payouts
```

Ce rapprochement sert à détecter d’éventuelles lacunes de synchronisation dans Supabase.

Il **ne détermine pas** la validité de l’archive Stripe : dans ce chantier, Stripe est la source directe de l’archive.

## 20. Procédure de récupération

Il n’existe pas de restauration Stripe équivalente à `pg_restore`/SQL.

Le test de récupération attendu est :

```text
pCloud brut chiffré
        ↓
rclone crypt avec les clés de récupération
        ↓
archive Stripe lisible
        ↓
vérification SHA256
        ↓
recherche des objets historiques
```

La documentation doit permettre de retrouver au minimum une opération par :

- PaymentIntent ID ;
- Charge ID ;
- Checkout Session ID ;
- Refund ID ;
- Payout ID.

La documentation doit préciser que la récupération fournit une **archive historique exploitable**, pas une réinjection des paiements dans Stripe.

## 21. Documentation opérationnelle

Créer :

```text
docs/operations/BACKUP_STRIPE_PCLOUD.md
docs/operations/RECOVERY_STRIPE_BACKUP.md
```

`BACKUP_STRIPE_PCLOUD.md` doit documenter :

- architecture ;
- secrets et clé restreinte ;
- périmètre des objets ;
- chemin pCloud ;
- cadence ;
- rétention ;
- baseline ;
- sécurité ;
- limites.

`RECOVERY_STRIPE_BACKUP.md` doit documenter :

- téléchargement via `LMVCRYPT:` ;
- déchiffrement ;
- SHA256 ;
- structure NDJSON ;
- recherche par IDs Stripe ;
- rapprochement documentaire ;
- limites de « restauration » ;
- reconfiguration manuelle d’un compte Stripe après incident si nécessaire.

## 22. Limites connues

Même validé, le système ne garantit pas :

- la présence d’un objet que Stripe ne rend déjà plus accessible à l’API au moment du premier baseline ;
- une recréation des transactions historiques dans un nouveau compte Stripe ;
- une restauration automatique des secrets Stripe ;
- une reproduction automatique de tous les paramètres de plateforme Stripe non exposés ou non inclus dans les ressources listées ;
- un instantané transactionnel atomique de toute la plateforme Stripe : les collections sont lues séquentiellement et peuvent évoluer pendant le run.

Cette dernière limite doit être documentée comme pour Supabase : un backup complet cohérent au niveau des objets récupérés n’est pas une photographie atomique de l’ensemble du compte à une milliseconde unique.

## 23. Critères d’acceptation finale

Le chantier « Stripe → pCloud » n’est marqué **OK** que si tous les critères suivants sont observés :

```text
tests automatisés ciblés : PASS
npm test complet : PASS
workflow baseline réel : PASS
compte Stripe attendu : PASS
livemode uniquement : PASS
pagination exhaustive : PASS
upload pCloud chiffré : PASS
cryptcheck : PASS
_SUCCESS : présent
latest Stripe distinct : PASS
SHA256 après récupération : PASS
inventaire réel : cohérent
recherche d’opérations historiques : PASS
absence de credentials injectés dans archive/logs : contrôlée
```

Un build Vite n’est requis que si l’implémentation touche finalement du code utilisé par le bundle web. Le design actuel ne prévoit aucune modification du frontend ni des fonctions métier Netlify ; le build peut néanmoins être relancé comme contrôle global si souhaité.

## 24. Règles de livraison du chantier

- développement par petits patches contrôlés ;
- tests avant déclaration de succès ;
- ne jamais afficher ou demander à l’utilisateur de coller un secret dans le chat ;
- commit local après validation ;
- **pas de push tant que l’utilisateur ne l’autorise pas**, afin d’éviter un déploiement Netlify inutile ;
- le premier push du chantier doit être suivi d’un baseline réel et de sa validation pCloud avant de considérer le système opérationnel.

## 25. Décision finale de conception

Le design retenu est donc :

> Une sauvegarde Stripe de production, directe, complète, autonome, brute et chiffrée, exécutée par un workflow GitHub indépendant à 03:17 UTC, conservée sous `02_Stripe`, utilisant une clé Stripe restreinte en lecture seule, réutilisant l’infrastructure pCloud/rclone existante, avec rétention identique à Supabase, pointeur `latest` Stripe distinct, échec total en cas d’export incomplet, baseline permanent et procédure de récupération documentée.

Cette spécification doit être relue et approuvée avant la rédaction du plan d’implémentation.
