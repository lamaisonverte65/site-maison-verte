# Archivage des contrats versionnés vers pCloud

## Objectif

Archiver séparément les contrats de location immuables `public/documents/contrat-location-V*.pdf` dans le stockage pCloud déjà utilisé par La Maison Verte, via le remote chiffré `LMVCRYPT`.

Vue déchiffrée :

```text
LMVCRYPT:03_Documents/contrats/
  contrat-location-V1.1.pdf
  contrat-location-V1.2.pdf
  ...
  manifest.json
  SHA256SUMS
  _SUCCESS
```

Les factures et avoirs restent couverts par la sauvegarde Supabase et ne sont pas dupliqués ici.

## Source et version courante

`contrat-location.pdf` reste l'alias public courant mais n'est pas archivé. Avant toute copie, le builder vérifie :

1. que `CURRENT_CONTRACT_VERSION` dans `netlify/functions/_lib/contract-version.js` correspond à la plus haute version PDF présente ;
2. que `contrat-location.pdf` est octet pour octet identique à ce PDF versionné courant.

L'historique initial est V1.1 à V1.5. `effective_from` reste `null` dans le manifest tant qu'une date historique fiable n'est pas disponible : aucune date n'est inventée.

## Immutabilité

Chaque PDF versionné est copié avec `rclone --immutable`. Une relance avec les mêmes octets est idempotente ; un même nom avec un contenu différent fait échouer l'archivage au lieu de remplacer l'historique.

Le script vérifie aussi qu'aucune version déjà présente à distance n'a disparu du snapshot local. Il ne purge jamais `03_Documents/contrats`.

`_SUCCESS` est supprimé avant toute mutation puis recréé uniquement après `rclone cryptcheck` réussi.

## Configuration pCloud

Le script réutilise l'infrastructure existante :

- pCloud Europe : `eapi.pcloud.com` ;
- racine cryptée : `La Maison Verte/Backups_Chiffres` ;
- vue déchiffrée documents : `LMVCRYPT:03_Documents/contrats` ;
- secrets GitHub existants : `PCLOUD_TOKEN`, `RCLONE_CRYPT_PASSWORD`, `RCLONE_CRYPT_PASSWORD2`.

## Déclenchement

Le workflow `.github/workflows/archive-contracts-pcloud.yml` est **manuel uniquement** (`workflow_dispatch`). Il n'est déclenché ni à chaque push ni selon une planification.

À chaque nouvelle version : ajouter le nouveau PDF versionné, mettre à jour l'alias courant et `CURRENT_CONTRACT_VERSION`, exécuter les tests, puis lancer volontairement le workflow d'archivage.

## Récupération

Avec un rclone local configuré avec les mêmes clés crypt :

```powershell
rclone copy "LMVCRYPT:03_Documents/contrats" ".\LMV-Contrats-Restauration" --progress
```

Vérifier ensuite `SHA256SUMS`. L'archive est valide uniquement si `_SUCCESS` est présent et si les SHA256 correspondent.
