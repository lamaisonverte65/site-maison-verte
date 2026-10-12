# La Maison Verte — Télécharger la dernière sauvegarde depuis l’admin

## But

L’administration propriétaire propose le bouton :

```text
Télécharger la dernière sauvegarde
```

Il permet de conserver ponctuellement sur un PC ou un disque externe une copie de la dernière sauvegarde Supabase terminée sur pCloud.

Le navigateur gère lui-même la destination du téléchargement : **aucun chemin local n’est enregistré dans le site**. Cela permet de changer de PC ou de disque sans modifier l’application.

## Qui peut utiliser le bouton

La fonction est réservée au profil `owner`.

- le propriétaire voit le bouton ;
- le compte `housekeeping` ne le voit pas ;
- la fonction Netlify vérifie également `ownerOnly` côté serveur : masquer le bouton n’est donc pas la mesure de sécurité principale.

## Quelle sauvegarde est téléchargée

Le système ne publie une sauvegarde comme « dernière sauvegarde » qu’après la fin du processus pCloud :

1. envoi chiffré vers le staging ;
2. premier `rclone cryptcheck` ;
3. copie vers le dossier final ;
4. second `rclone cryptcheck` ;
5. création de `_SUCCESS` ;
6. publication du petit pointeur `latest.json`.

Un run interrompu avant `_SUCCESS` ne doit donc pas remplacer la dernière sauvegarde valide connue.

## Fonctionnement du téléchargement

Le ZIP ne traverse pas Netlify.

```text
Admin owner
   ↓
fonction Netlify authentifiée
   ↓
pCloud Europe : getziplink
   ↓
URL HTTPS temporaire
   ↓
navigateur
   ↓
ZIP enregistré à l’endroit choisi par l’utilisateur
```

La fonction Netlify ne transporte que les quelques informations nécessaires pour obtenir le lien temporaire.

Le nom proposé suit ce format :

```text
La-Maison-Verte-Supabase-<backup_id>-encrypted.zip
```

Le suffixe `encrypted` est volontaire.

## Le ZIP local reste chiffré

Le ZIP contient la représentation **physique chiffrée** produite par `rclone crypt` sur pCloud :

- noms de fichiers chiffrés ;
- noms de dossiers chiffrés ;
- contenu des fichiers chiffré.

Il est donc normal de ne pas retrouver directement dans le ZIP des noms tels que :

```text
database/
inventory/
storage/
manifest.json
SHA256SUMS
```

Cette copie locale constitue une troisième copie indépendante, mais elle reste protégée si le disque ou le PC est perdu ou volé.

## Variable Netlify requise

Netlify doit disposer uniquement de :

```text
PCLOUD_TOKEN
```

Utiliser **la même valeur JSON OAuth rclone** que celle déjà enregistrée dans le secret GitHub `PCLOUD_TOKEN`. Le backend extrait uniquement son champ `access_token` pour les appels directs à l’API pCloud. Ne jamais coller cette valeur dans le code source ou dans un chat.

Les secrets suivants **ne doivent pas être ajoutés dans Netlify** :

```text
RCLONE_CRYPT_PASSWORD
RCLONE_CRYPT_PASSWORD2
```

Le site n’a aucune raison de déchiffrer la sauvegarde. Les deux secrets `rclone crypt` restent conservés séparément dans le coffre prévu pour la reprise après sinistre.

## Première mise en service

Après déploiement de la fonctionnalité :

1. ajouter `PCLOUD_TOKEN` aux variables d’environnement Netlify ;
2. déclencher une sauvegarde **manual** depuis GitHub Actions ;
3. attendre son succès complet ;
4. vérifier que `_SUCCESS` a bien été créé ;
5. ouvrir l’admin avec le compte owner ;
6. cliquer sur **Télécharger la dernière sauvegarde** ;
7. choisir le dossier local souhaité dans le navigateur ;
8. vérifier que le fichier téléchargé porte le suffixe `-encrypted.zip`.

Une ancienne sauvegarde créée avant l’installation de cette fonction reste valide, mais elle ne peut pas devenir automatiquement le pointeur `latest` tant qu’un nouveau run n’a pas publié ce pointeur.

## Conserver la copie locale

Le ZIP peut être placé librement, par exemple :

```text
Disque 6 To\Sauvegardes\La Maison Verte\
```

Ce chemin n’est qu’un exemple personnel : il n’est jamais codé dans le site.

Il n’est pas nécessaire de télécharger chaque sauvegarde quotidienne. Une copie locale ponctuelle, par exemple après une évolution importante ou périodiquement, complète la sauvegarde automatique pCloud.

## Relire ultérieurement le ZIP chiffré

En cas de besoin :

1. **extraire le ZIP** dans un dossier de travail ;
2. repérer le dossier qui contient directement les noms chiffrés rclone ;
3. créer ou réutiliser un remote `crypt` local dont la racine pointe sur ce dossier extrait ;
4. utiliser exactement les mêmes valeurs originales que pour `RCLONE_CRYPT_PASSWORD` et `RCLONE_CRYPT_PASSWORD2` ;
5. lister le remote déchiffrant ;
6. copier le contenu via ce remote vers un nouveau dossier en clair.

Exemple conceptuel de configuration :

```text
remote chiffré local : LMVLOCALCRYPT
backend               : crypt
remote                : <dossier extrait contenant les fichiers chiffrés>
password              : même secret crypt principal
password2             : même second secret / salt
filename_encryption   : standard
directory_name_encryption : true
```

Une fois ce remote configuré, une commande telle que :

```powershell
rclone lsf "LMVLOCALCRYPT:" --recursive
```

doit afficher les noms logiques déchiffrés du paquet. On peut ensuite copier le paquet en clair :

```powershell
rclone copy "LMVLOCALCRYPT:" "C:\LMV-Restore-Dechiffre" --create-empty-src-dirs
```

Le dossier ainsi reconstitué doit alors contenir les éléments usuels de la sauvegarde, notamment `database/`, `inventory/`, `storage/`, `manifest.json` et `SHA256SUMS`.

## Contrôles avant restauration

Après déchiffrement :

- vérifier la présence de `_SUCCESS` si celui-ci fait partie de l’archive physique téléchargée ;
- vérifier `SHA256SUMS` ;
- ne jamais modifier les fichiers originaux avant la vérification ;
- suivre ensuite `RESTORE_SUPABASE_BACKUP.md`.

La copie locale ne remplace pas la procédure de restauration validée : elle offre simplement une autre source depuis laquelle récupérer le même paquet.

## Sécurité des clés

Ne pas conserver l’unique copie des deux secrets `rclone crypt` :

- uniquement dans GitHub ;
- uniquement sur le PC qui contient le ZIP ;
- ou dans le même dossier que l’unique sauvegarde locale.

Sans les deux secrets corrects, le ZIP `encrypted` ne peut pas être transformé en paquet de restauration lisible.

## Test à effectuer après déploiement

La fonctionnalité n’est considérée opérationnelle qu’après un test réel :

- [ ] sauvegarde `manual` GitHub terminée ;
- [ ] `_SUCCESS` créé ;
- [ ] bouton visible avec le compte owner ;
- [ ] bouton absent avec housekeeping ;
- [ ] téléchargement direct pCloud démarré ;
- [ ] ZIP enregistré sur le PC ;
- [ ] ZIP effectivement chiffré ;
- [ ] copie extraite lisible via un remote `rclone crypt` utilisant les mêmes secrets.
