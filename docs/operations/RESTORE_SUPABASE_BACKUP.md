# La Maison Verte — Restauration de test Supabase

## Sécurité et compatibilité

Ne jamais utiliser la production. Créer un NOUVEAU projet Supabase jetable, isolé de l'application, des emails, paiements, webhooks et tâches planifiées. Le précédent « LMV Restore Test » est partiellement restauré : ne pas le réutiliser ni tenter de le nettoyer avec ces scripts.

Les scripts exigent SOURCE_PROJECT_REF et RESTORE_PROJECT_REF distinctes, une URL correspondant à la cible et CONFIRM_TEST_RESTORE=YES. Le contournement de production est supprimé. Ces contrôles reposent sur des références correctement renseignées depuis le Dashboard : un nom de variable ne prouve pas qu'une cible est de test.

La cible doit disposer des schémas gérés Supabase Auth/Storage et des extensions de inventory/extensions.tsv ; un PostgreSQL nu ne suffit pas. La baseline vient de PostgreSQL 17.6 / pg_dump 17.11 : utiliser postgres:17 et une cible PostgreSQL 17 compatible, y compris les versions Auth/Storage.

## Baseline 2026-10-11_093325Z

Conserver tous les fichiers originaux, manifest.json et SHA256SUMS inchangés. Audit : 103 checksums valides, 42 tables métier, 2 utilisateurs, 2 identités, 1 bucket privé, 1 PDF de 3 030 octets.

Les 26 blocs Auth sont identiques dans data.sql et auth-data.sql. Seul data.sql est chargé ; auth-data.sql reste archivé et vérifié, jamais restauré. Le lecteur exige exactement un bloc auth.users : il ne devine pas d'autre format ancien.

Après vérification des checksums, prepare-restore-data.awk produit un fichier temporaire privé sans les blocs COPY ni les séquences Storage. Les lignes à l'intérieur d'un COPY sont traitées comme des données. Une syntaxe inconnue ou un bloc tronqué bloque avant connexion. Ce lecteur strict du format Supabase --use-copy n'est pas un parseur SQL général. La baseline réelle a été contrôlée : 68 blocs Auth/métier conservés à l'identique, 5 blocs Storage retirés. Le fichier temporaire est supprimé en sortie. Les nouvelles sauvegardes excluent storage.* à la source et ne produisent plus auth-data.sql.

## 1. Contrôles locaux sans réseau

Récupérer si nécessaire le paquet via le remote déchiffrant rclone crypt, pas en téléchargeant les fichiers chiffrés bruts depuis pCloud. Ne pas refaire la baseline déjà présente.

```powershell
$ProjectRoot = 'C:\Users\pc\Desktop\Site La MaisonVerte\Site Maison Verte - V4\travail'
$BackupPath = 'C:\Users\pc\Desktop\LMV-Restore-Test\2026-10-11_093325Z'
Set-Location -LiteralPath $ProjectRoot
node --test 'tests/backup*.test.js'
if ($LASTEXITCODE -ne 0) { throw 'Échec des tests backup' }
node scripts/backup/restore-storage.mjs "$BackupPath"
if ($LASTEXITCODE -ne 0) { throw 'Échec du contrôle local du paquet' }
```

Prérequis : Node 22 ou plus récent et Git for Windows avec Bash à son emplacement habituel. Le contrôle Storage sans --apply vérifie le paquet et les inventaires sans requête réseau ni clé.

## 2. Définir la nouvelle cible de test

Remplacer les références par celles lues dans le Dashboard. Ne pas réutiliser l'ancienne URI. Saisir les secrets localement, jamais dans un chat.

```powershell
$env:SOURCE_PROJECT_REF = 'REFERENCE_DU_PROJET_SOURCE'
$env:RESTORE_PROJECT_REF = 'REFERENCE_DU_NOUVEAU_PROJET_TEST'
$env:CONFIRM_TEST_RESTORE = 'YES'
$secureUri = Read-Host 'URI PostgreSQL du NOUVEAU projet test, mot de passe percent-encodé' -AsSecureString
$env:RESTORE_DB_URL = [System.Net.NetworkCredential]::new('', $secureUri).Password
$env:RESTORE_SUPABASE_URL = "https://$($env:RESTORE_PROJECT_REF).supabase.co"
$secureKey = Read-Host 'Clé serveur du NOUVEAU projet test' -AsSecureString
$env:RESTORE_SECRET_KEY = [System.Net.NetworkCredential]::new('', $secureKey).Password
```

URI acceptées : directe postgres:motdepasse@db.<ref>.supabase.co:5432/postgres, ou Session pooler postgres.<ref>:motdepasse@aws-...pooler.supabase.com:5432/postgres, avec préfixe postgresql://. Suffixe facultatif ?sslmode=require ou ?sslmode=verify-full. Les autres paramètres et le port 6543 sont refusés. Storage accepte une clé cible sb_secret_... ou un JWT serveur service_role.

## 3. Restaurer le SQL

```powershell
docker run --rm `
  -e RESTORE_DB_URL -e RESTORE_PROJECT_REF -e SOURCE_PROJECT_REF `
  -e CONFIRM_TEST_RESTORE `
  -v "${BackupPath}:/backup:ro" `
  -v "${ProjectRoot}\scripts\backup:/scripts:ro" `
  postgres:17 bash /scripts/verify-restore.sh /backup
if ($LASTEXITCODE -ne 0) { throw 'Restauration SQL arrêtée : analyser avant de continuer' }
```

Le script refuse une cible contenant des tables public, utilisateurs Auth, buckets ou objets Storage. Rôles, schéma, données filtrées et historique optionnel sont chargés dans UNE invocation psql et UNE transaction, avec ON_ERROR_STOP=1. session_replication_role = replica évite les blocages sur triggers et FK circulaires.

L'historique supabase_migrations est optionnel ; une paire incomplète bloque avant connexion. Les migrations Git restent archivées : ne pas les rejouer globalement après le dump, notamment celle qui crée le bucket par insertion SQL.

Une erreur SQL annule la transaction, mais les séquences et certains effets externes ne sont pas transactionnels. Après un échec, analyser et repartir d'une nouvelle cible jetable ; pas de reprise idempotente promise.

## 4. Storage par l'API

Uniquement après succès SQL :

```powershell
node scripts/backup/restore-storage.mjs "$BackupPath" --apply
if ($LASTEXITCODE -ne 0) { throw 'Storage arrêté : cible potentiellement partielle' }
```

Le script vérifie à nouveau le paquet, exige zéro bucket cible, recrée les buckets avec visibilité, limite de taille et types MIME, puis envoie les octets aux noms originaux avec upsert=false. Chaque objet est retéléchargé avec authentification et comparé au SHA-256 sauvegardé. Aucun effacement ni écrasement. Arrêt sur erreur HTTP ou incohérence.

Storage n'est pas transactionnel avec PostgreSQL : un échec peut laisser une restauration partielle. Ne pas relancer aveuglément. Buckets analytics/vector, versionnés, avec cycle de vie ou autodétection AVIF active : refus et procédure dédiée requise.

IDs internes, propriétaires, dates et versions sont régénérés par Storage. L'inventaire existant ne conserve pas owner_id ni user_metadata des objets. Cette procédure ne les reconstitue pas. La baseline utilise un bucket privé avec accès par fonctions serveur ; vérifier ces accès. Toute future restauration dépendant de ces propriétés nécessitera une extension du format de sauvegarde.

## 5. Validation réelle encore obligatoire

- Comparer les comptes métier à inventory/public_table_counts.tsv et Auth à inventory/auth_summary.tsv (baseline : 2 utilisateurs, 2 identités).
- Vérifier le bucket privé customer-invoices, ses limites, et 2026/LMV-2026-0001.pdf (3 030 octets), puis son accès depuis l'application de test isolée.
- Vérifier les FK circulaires et liens métier : replica désactive leurs contrôles durant le chargement ; l'absence d'erreur ne prouve pas la cohérence.
- Comparer politiques RLS, fonctions et triggers aux inventaires. Le schéma standard ne couvre pas nécessairement les personnalisations Auth/Storage. La baseline n'inventorie aucune politique personnalisée dans ces schémas ; ses triggers Storage utilisent les fonctions gérées. Auditer les écarts pour les futures sauvegardes.
- Reconfigurer Auth (fournisseurs, emails, redirections, clés), extensions et Realtime. Les sessions/JWT peuvent nécessiter une reconnexion.
- Examiner inventory/vault_summary.tsv : zéro secret Vault dans la baseline ; d'autres paquets peuvent exiger les clés de chiffrement d'origine.
- Vérifier réservations, paiements, factures/avoirs, taxe de séjour et accès owner/housekeeping sans déclencher d'effets réels.

Les inventaires, dumps et fichiers sont collectés successivement, sans snapshot atomique commun. Une activité concurrente peut créer des écarts ; les contrôles de comptes et métier restent nécessaires. Ce correctif ne change ni planification, ni rétention pCloud, ni secrets.

Après le test :

```powershell
Remove-Item Env:RESTORE_DB_URL, Env:RESTORE_SECRET_KEY -ErrorAction SilentlyContinue
$secureUri = $null
$secureKey = $null
```

## Références

- [Restauration Supabase CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Schéma Storage et API](https://supabase.com/docs/guides/storage/schema/design)
- [Création des buckets](https://supabase.com/docs/reference/javascript/storage-createbucket)
- [Upload Storage](https://supabase.com/docs/reference/javascript/storage-from-upload)

Les tests locaux et la vérification du paquet ne remplacent pas une restauration réelle complète sur une nouvelle cible Supabase.
