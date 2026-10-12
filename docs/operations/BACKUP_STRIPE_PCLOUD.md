# Sauvegarde Stripe → pCloud — exploitation

## Objectif

La sauvegarde Stripe conserve une archive directe du compte Stripe **production / livemode**, indépendante de Supabase. Elle complète la sauvegarde Supabase : Stripe reste la source d'exécution des paiements, tandis que l'archive permet de conserver les objets historiques nécessaires à la preuve financière, au rapprochement et à la reconstruction documentaire après incident.

Cette archive est hautement sensible : les objets bruts peuvent contenir des **données client / données personnelles** et certains champs sensibles propres aux objets Stripe. Elle est envoyée vers pCloud uniquement à travers **rclone crypt / `LMVCRYPT`**.

## Architecture

```text
Stripe production
  → GitHub Actions (lecture seule)
  → export NDJSON complet
  → inventaire + manifest + SHA256SUMS
  → rclone crypt
  → LMVCRYPT:02_Stripe/<tier>/<backup_id>
```

Le workflow est `.github/workflows/backup-stripe.yml` et s'exécute chaque jour à **03:17 UTC**, après la sauvegarde Supabase de 02:17 UTC. Il peut aussi être lancé manuellement avec `manual` ou `baseline`.

Le premier `baseline` validé est permanent.

## Identité et secrets

Le workflow utilise :

- `STRIPE_BACKUP_KEY` : **restricted key Stripe en lecture seule / read-only**, dédiée à la sauvegarde ;
- `STRIPE_EXPECTED_ACCOUNT_ID` : identifiant de compte attendu, stocké comme variable GitHub non secrète ;
- `PCLOUD_TOKEN` ;
- `RCLONE_CRYPT_PASSWORD` ;
- `RCLONE_CRYPT_PASSWORD2`.

`STRIPE_SECRET_KEY` ne doit **jamais** être utilisée par ce workflow de sauvegarde.

Aucune valeur de clé, token ou mot de passe ne doit apparaître dans le dépôt, la documentation, les logs, le manifest, l'inventaire ou les fichiers de diagnostic.
Le **secret de signature webhook** ne doit jamais être archivé non plus ; si Stripe en renvoyait un dans un objet `webhook_endpoint`, le backup doit échouer au lieu de le conserver.

### Création de la restricted key

Depuis le **Dashboard Stripe**, créer une clé restreinte dédiée au backup et accorder uniquement la lecture des ressources nécessaires : paiements, charges, remboursements, balance transactions, payouts, disputes, Checkout Sessions, clients, produits, prix, webhook endpoints et informations de compte nécessaires à l'identification.

Enregistrer sa valeur uniquement dans le **GitHub secret `STRIPE_BACKUP_KEY`**. Ne jamais copier cette valeur dans un chat, une documentation ou le dépôt/repository.

Configurer séparément `STRIPE_EXPECTED_ACCOUNT_ID` avec l'identifiant du compte de production attendu. Le workflow s'arrête si l'identité reçue ne correspond pas.

## Données exportées

Chaque backup est complet, autonome et non incrémental. Les collections sont paginées jusqu'au bout, sans filtre temporel :

```text
finance/payment_intents.ndjson
finance/charges.ndjson
finance/refunds.ndjson
finance/balance_transactions.ndjson
finance/payouts.ndjson
finance/disputes.ndjson
checkout/checkout_sessions.ndjson
checkout/checkout_session_line_items.ndjson
customers/customers.ndjson
catalog/products.ndjson
catalog/prices.ndjson
config/webhook_endpoints.ndjson
```

Chaque ligne NDJSON contient l'objet Stripe brut. Pour `checkout_session_line_items`, une enveloppe minimale ajoute `checkout_session_id` autour du `line_item` brut afin de conserver la relation avec la Checkout Session.

S'ajoutent :

- `account/account.json` ;
- `inventory/counts.json` ;
- `manifest.json` ;
- `SHA256SUMS`.

## Contrôles avant publication

Un backup n'est publiable que si :

1. le compte Stripe correspond à `STRIPE_EXPECTED_ACCOUNT_ID` ;
2. tout objet qui expose `livemode` est bien `true` ;
3. toutes les paginations se terminent ;
4. chaque ligne NDJSON est un JSON valide ;
5. les IDs ne sont pas dupliqués dans leur collection ;
6. les compteurs réels correspondent à `inventory/counts.json` ;
7. `manifest.json` est cohérent ;
8. `SHA256SUMS` est construit ;
9. l'upload chiffré passe `rclone cryptcheck`.

Un échec d'une seule catégorie fait échouer le run entier. Aucun `_SUCCESS` ni nouveau pointeur `latest` n'est publié pour un backup partiel.

## pCloud et pointeur latest

Racine chiffrée logique :

```text
LMVCRYPT:02_Stripe/
```

Le pointeur non sensible Stripe est distinct de celui de Supabase :

```text
La Maison Verte/backup-download/stripe/latest.json
```

Le pointeur Supabase existant reste :

```text
La Maison Verte/backup-download/latest.json
```

Stripe ne doit jamais remplacer ce pointeur Supabase.

## Rétention

- `daily` : 30 jours ;
- `weekly` : 365 jours / 12 mois ;
- `monthly` : conservation illimitée ;
- `yearly` : conservation permanente ;
- `manual` : conservation permanente sauf suppression explicite ;
- `baseline` : conservation permanente.

Seuls `daily` et `weekly` sont purgés automatiquement.

## Logs et diagnostic

Les logs peuvent afficher uniquement des informations non sensibles : catégorie, compteur, identifiant de run, type de backup, tiers, commit et succès/échec des contrôles.

Les **secrets ne doivent jamais apparaître dans les logs ou le manifest**. Les objets Stripe bruts eux-mêmes ne doivent pas être imprimés dans les logs.

Le diagnostic GitHub Actions est conservé 14 jours et ne contient jamais le backup brut.

## Limites

- L'archive ne peut conserver que ce que l'API Stripe expose encore au moment de l'export.
- Le premier baseline permanent est donc important pour figer l'historique accessible à cette date.
- La collecte de plusieurs ressources Stripe est **non atomique** : un paiement peut évoluer entre deux requêtes API du même backup. Le manifest donne un instant de création de l'archive mais ne transforme pas l'export en snapshot transactionnel global.
- Cette sauvegarde ne remplace pas la configuration sécurisée des clés Stripe et secrets webhook.
- Elle ne permet pas de réinjecter les paiements historiques dans un nouveau compte Stripe.

## Mise en service réelle

Le chantier n'est considéré opérationnel qu'après : tests locaux complets, push autorisé, création de la restricted key, premier run `baseline`, `cryptcheck`, présence de `_SUCCESS`, téléchargement via `LMVCRYPT`, validation de `SHA256SUMS` et recherche de plusieurs opérations historiques connues.
