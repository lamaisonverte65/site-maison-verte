# La Maison Verte — Restauration d’une sauvegarde Supabase

## Règle de sécurité

Ne jamais tester une restauration sur la base de production. Créer un projet/base Supabase de test ou un PostgreSQL jetable et vérifier l’URL cible avant toute commande.

Le script `verify-restore.sh` refuse de démarrer sauf si `CONFIRM_TEST_RESTORE=YES` est défini. Le contournement `ALLOW_PRODUCTION_RESTORE=I_ACCEPT_DATA_LOSS_RISK` existe uniquement pour une procédure de catastrophe maîtrisée et ne doit pas être utilisé pour un test.

## 1. Récupérer puis vérifier le paquet

Les fichiers pCloud sont chiffrés par `rclone crypt`. Ne jamais restaurer à partir d’une copie brute téléchargée directement depuis `La Maison Verte/Backups_Chiffres/` dans l’interface pCloud : noms et contenu y sont chiffrés.

Configurer un remote `LMVCRYPT` avec le même token pCloud et surtout les mêmes secrets `crypt`, puis télécharger la sauvegarde via la vue déchiffrée, par exemple :

```bash
rclone copy "LMVCRYPT:01_Supabase/baseline/<backup-id>" ./baseline-test
```

Puis vérifier :

```bash
cd <backup>
sha256sum -c SHA256SUMS
```

Toute différence bloque la restauration.

## 2. Préparer le projet cible

Avant restauration :

- créer une nouvelle cible Supabase de test ;
- vérifier/activer les extensions listées dans `inventory/extensions.tsv` ;
- reconfigurer les réglages Auth nécessaires ;
- noter que les clés API/JWT, fournisseurs Auth, Realtime, URLs de redirection et autres réglages de plateforme ne sont pas reconstruits automatiquement par les SQL ;
- vérifier `inventory/vault_summary.tsv` : des secrets Vault peuvent nécessiter une stratégie spécifique liée à la clé racine du projet.

## 3. Restaurer la base SQL

Définir la connexion cible :

```bash
export RESTORE_DB_URL='postgresql://...'
export CONFIRM_TEST_RESTORE=YES
bash scripts/backup/verify-restore.sh <backup>
```

Ordre appliqué :

1. `roles.sql` ;
2. `schema.sql` ;
3. `auth-data.sql` ;
4. `data.sql` ;
5. historique `supabase_migrations`.

`ON_ERROR_STOP=1` et des transactions sont utilisés afin qu’une erreur ne soit pas silencieuse. Selon la version de la cible Supabase, certaines lignes de rôles/ownership gérés peuvent demander une adaptation ; ne jamais ignorer une erreur sans l’analyser.

## 4. Restaurer Storage

Le SQL ne restaure pas les octets des fichiers Supabase Storage. Le dossier `storage/` contient la copie réelle des objets :

```text
storage/<bucket>/<chemin objet>
```

Recréer les buckets avec leurs propriétés à partir de `inventory/storage_buckets.json`, puis réimporter chaque fichier par l’API Storage avec une clé serveur de la **cible**. Ne pas insérer aveuglément des lignes dans `storage.objects` : l’API Storage doit rester l’autorité pour la réimportation des objets.

Vérifier ensuite le nombre d’objets par rapport à `inventory/storage_objects.json`.

## 5. Auth

`auth-data.sql` conserve les données Auth exportées. Une restauration sur un projet différent peut invalider les sessions/JWT existants et nécessiter une reconnexion. Les paramètres de fournisseurs, emails, URLs et clés doivent être recréés dans la plateforme cible.

## 6. Realtime et configuration Supabase

Contrôler manuellement :

- publications/paramètres Realtime ;
- extensions ;
- réglages Auth et redirections ;
- clés API ;
- éventuelles fonctions ou intégrations externes ;
- politiques RLS listées dans `inventory/policies.tsv` ;
- triggers listés dans `inventory/triggers.tsv`.

## 7. Validation métier

Comparer au minimum :

- nombres de lignes dans les tables métier avec `inventory/public_table_counts.tsv` ;
- comptes Auth avec `inventory/auth_summary.tsv` ;
- buckets/objets Storage ;
- réservations, paiements, factures/avoirs et taxe de séjour sur quelques cas historiques ;
- accès owner/housekeeping dans un environnement de test.

La sauvegarde n’est considérée opérationnellement restaurable qu’après ce test réel.
