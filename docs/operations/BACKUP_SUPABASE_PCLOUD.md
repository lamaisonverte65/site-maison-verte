# La Maison Verte — Sauvegarde Supabase → pCloud Europe chiffrée

## But

Créer hors de Supabase une sauvegarde autonome de la base, de l’historique Auth, des fichiers Storage, des migrations et d’exports CSV lisibles. Le workflow GitHub Actions fonctionne même lorsque le PC est éteint.

Les sauvegardes envoyées à pCloud passent obligatoirement par `rclone crypt` : contenu, noms de fichiers et noms de dossiers sont chiffrés côté client avant l’envoi. Le compte pCloud ne reçoit donc jamais le paquet Supabase en clair.

## Secrets GitHub Actions

Dans **GitHub → Settings → Secrets and variables → Actions**, créer :

- `SUPABASE_DB_URL` : chaîne de connexion PostgreSQL **Session pooler** recommandée par Supabase, avec mot de passe correctement percent-encodé dans l’URL ;
- `SUPABASE_URL` : URL du projet Supabase ;
- `SUPABASE_SECRET_KEY` : clé serveur Supabase moderne recommandée ;
- `PCLOUD_TOKEN` : JSON OAuth rclone du compte pCloud EU ;
- `RCLONE_CRYPT_PASSWORD` : valeur **obscured** du mot de passe principal `rclone crypt` ;
- `RCLONE_CRYPT_PASSWORD2` : valeur **obscured** du second secret/salt `rclone crypt`.

Compatibilité temporaire : si le projet utilise encore une ancienne clé `service_role`, le workflow accepte `SUPABASE_SERVICE_ROLE_KEY` à la place de `SUPABASE_SECRET_KEY`. Ne pas configurer les deux sans nécessité.

Aucune valeur réelle ne doit être ajoutée au dépôt, à un fichier `.env` commité ou à cette documentation.

## Première configuration pCloud EU sur le PC

Cette configuration locale sert uniquement à autoriser pCloud et à fabriquer les secrets GitHub. Le backup quotidien restera ensuite exécuté dans GitHub Actions, même PC éteint.

1. installer rclone depuis la source officielle ;
2. lancer `rclone config` ;
3. créer un remote nommé `LMVPCLOUD`, de type `pcloud` ;
4. laisser `client_id` et `client_secret` vides sauf besoin spécifique ;
5. dans **Advanced config**, sélectionner le serveur Europe `eapi.pcloud.com` avant l’autorisation OAuth ;
6. autoriser rclone dans le navigateur pCloud ;
7. conserver la configuration locale tant que la mise en service n’est pas terminée.

Test sans modification de données :

```powershell
rclone lsd LMVPCLOUD:
```

Le workflow force lui aussi `eapi.pcloud.com` et ne stocke ni email ni mot de passe pCloud.

## Configurer `rclone crypt`

Créer ensuite un second remote local avec `rclone config` :

- nom : `LMVCRYPT` ;
- type : `crypt` ;
- remote à chiffrer : `LMVPCLOUD:La Maison Verte/Backups_Chiffres` ;
- chiffrement des noms de fichiers : `standard` ;
- chiffrement des noms de dossiers : activé ;
- mot de passe principal : fort et unique ;
- second mot de passe/salt : différent du premier et fort.

**Conserver les deux secrets originaux dans un gestionnaire de mots de passe ou autre coffre indépendant de GitHub et de pCloud. Ne jamais les perdre : sans eux, il devient impossible de déchiffrer les sauvegardes si la configuration rclone/GitHub est perdue.**

Les valeurs utilisées par le workflow doivent être au format `rclone obscure`. Si les deux secrets ont été choisis hors de `rclone config`, produire leurs valeurs obscured localement :

```text
rclone obscure "<mot-de-passe-principal>"
rclone obscure "<second-secret>"
```

Les sorties deviennent respectivement les secrets GitHub `RCLONE_CRYPT_PASSWORD` et `RCLONE_CRYPT_PASSWORD2`. `rclone obscure` n’est pas un coffre-fort : sa sortie doit elle aussi être traitée comme un secret et ne jamais être commitée ni envoyée dans un chat.

Si `LMVCRYPT` a été créé avec `rclone config`, ses champs `password` et `password2` sont déjà enregistrés sous forme obscured dans la configuration rclone et peuvent être utilisés comme secrets GitHub. Les secrets originaux restent néanmoins la clé de récupération à conserver séparément.

## Obtenir le token pCloud EU

Le remote `LMVPCLOUD` contient un champ `token` JSON obtenu lors de l’OAuth pCloud. Copier uniquement cette valeur JSON dans le secret GitHub `PCLOUD_TOKEN`.

Ne jamais transmettre ce token dans un chat. Après configuration GitHub, éviter les copies temporaires en clair.

## Arborescence pCloud avec chiffrement

Le seul chemin volontairement lisible côté pCloud est la racine technique :

```text
La Maison Verte/Backups_Chiffres/
```

Tout ce qui se trouve dessous est écrit par le remote `LMVCRYPT` et apparaît avec noms chiffrés dans l’interface pCloud. Il est donc normal de **ne pas** voir directement `01_Supabase`, `baseline`, `manifest.json`, etc. dans pCloud Web.

La vue logique déchiffrée est :

```text
LMVCRYPT:01_Supabase/
  baseline/
  daily/
  weekly/
  monthly/
  yearly/
  manual/
```

## Contenu d’un backup

```text
database/
  roles.sql
  schema.sql
  data.sql
  migration-history-schema.sql
  migration-history-data.sql
exports/public/*.csv
inventory/
migrations/
storage/
manifest.json
SHA256SUMS
```

`schema.sql` et `data.sql` suivent la méthode Supabase CLI. `data.sql` contient déjà Auth ; aucun second dump Auth n’est produit. Le dump de données exclut toutes les tables `storage.*` avec `-x "storage.*"`. Les buckets et objets sont restaurés par l’API à partir des inventaires et des octets dans `storage/`.

## Inventaire dynamique

Aucune liste de tables métier n’est codée en dur. À chaque exécution, le workflow inventorie la base live : tables `public`, extensions, fonctions, triggers, politiques RLS, Auth, buckets et objets Storage. Un nouveau tableau ou objet ajouté plus tard doit donc être capturé sans modifier le script.

Le bucket privé `customer-invoices` est couvert automatiquement parce que l’inventaire lit `storage.buckets`/`storage.objects` et que le téléchargement utilise une clé serveur.

## Baseline

Dans **Actions → Backup Supabase to pCloud → Run workflow**, sélectionner `baseline` une seule fois.

Le script refuse de créer une nouvelle baseline lorsqu’une baseline terminée porte déjà son marqueur `_SUCCESS` dans la vue déchiffrée.

Après le premier run :

1. vérifier que le workflow GitHub est vert ;
2. depuis un rclone possédant les mêmes clés, exécuter `rclone lsf "LMVCRYPT:01_Supabase/baseline" --recursive` ;
3. vérifier dans cette vue déchiffrée `manifest.json`, `SHA256SUMS` et `_SUCCESS` ;
4. télécharger la baseline **via `LMVCRYPT`**, jamais en copiant directement les fichiers chiffrés depuis pCloud Web ;
5. suivre `RESTORE_SUPABASE_BACKUP.md` ;
6. n’accorder une confiance opérationnelle au planning qu’après un test de restauration réussi.

## Planning et rétention

Le workflow planifié s’exécute quotidiennement. Une même sauvegarde peut être copiée dans plusieurs niveaux :

- `daily` : 30 jours ;
- `weekly` : 365 jours ;
- `monthly` : jamais purgé automatiquement ;
- `yearly` : jamais purgé automatiquement ;
- `manual` : jamais purgé automatiquement ;
- `baseline` : jamais purgé automatiquement.

Seuls `daily` et `weekly` sont visés par `rotate-pcloud.sh`. La rotation passe elle aussi par `LMVCRYPT` ; elle n’opère jamais directement sur le contenu chiffré brut.

## Manifest et intégrité

`manifest.json` contient notamment : date UTC, ID, type, commit Git, versions d’outils disponibles, nombre de tables, compteurs Auth/Storage, tailles et SHA-256 des fichiers du paquet. `SHA256SUMS` protège le paquet final, manifest compris.

L’upload passe d’abord par `.incoming/` dans la vue chiffrée, puis est contrôlé avec `rclone cryptcheck`. Il est ensuite promu vers son dossier final, contrôlé une seconde fois avec `rclone cryptcheck`, et le marqueur `_SUCCESS` n’est créé qu’après réussite. Un dossier sans `_SUCCESS` n’est jamais une sauvegarde valide.

## Auth

Le dump de schéma et le dump de données ont des périmètres différents : les données Auth sont incluses dans `data.sql`. Elles sont sensibles ; le chiffrement client-side pCloud reste obligatoire. La baseline `2026-10-11_093325Z` reste inchangée : son `auth-data.sql` redondant reste couvert par les checksums, mais ne doit jamais être chargé en plus de `data.sql`. Voir la procédure de restauration pour le filtrage temporaire des anciennes données Storage.

Lors d’une reconstruction sur un autre projet, les paramètres Auth, clés API/JWT et fournisseurs externes doivent être reconfigurés séparément ; ils ne sont pas tous contenus dans le dump logique.

## Storage

Les fichiers sont téléchargés avec leur bucket et leur chemin d’objet. Les paramètres de buckets et métadonnées d’objets sont aussi conservés dans `inventory/`. Les règles/politiques Storage sont inventoriées et les migrations du dépôt sont copiées.

## Vault

L’inventaire signale si `vault.secrets` est utilisé. Un dump logique ne garantit pas qu’un secret Vault chiffré reste déchiffrable dans un nouveau projet doté d’une autre clé racine. Si `vault_summary.tsv` indique des secrets présents, traiter ce point séparément avant de considérer une reconstruction totale comme validée.

## Secrets à ne jamais partager dans un chat ou un ZIP

- mot de passe PostgreSQL ;
- `SUPABASE_DB_URL` réelle ;
- clé `SUPABASE_SECRET_KEY` / `service_role` ;
- `PCLOUD_TOKEN` ;
- secrets originaux `rclone crypt` ;
- valeurs `RCLONE_CRYPT_PASSWORD` et `RCLONE_CRYPT_PASSWORD2` ;
- JWT secrets.
