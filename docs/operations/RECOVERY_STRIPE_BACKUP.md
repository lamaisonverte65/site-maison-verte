# Récupération d'une sauvegarde Stripe pCloud

## But

Cette procédure sert à récupérer et exploiter une archive Stripe historique chiffrée. Elle ne restaure pas Stripe au sens d'une base de données : **on ne peut pas réinjecter ou recréer les anciens paiements Stripe** dans un nouveau compte comme s'ils venaient d'y être exécutés.

## Prérequis

- rclone configuré localement avec les mêmes clés de récupération `LMVCRYPT` ;
- accès pCloud ;
- espace disque local suffisant ;
- le `backup_id` et le tier à récupérer.

Ne jamais transmettre les mots de passe rclone, token pCloud ou clé Stripe dans un chat ou un document de récupération.

## 1. Lister les sauvegardes Stripe

PowerShell :

```powershell
rclone lsf "LMVCRYPT:02_Stripe" --dirs-only
rclone lsf "LMVCRYPT:02_Stripe/baseline" --dirs-only
rclone lsf "LMVCRYPT:02_Stripe/manual" --dirs-only
```

Une sauvegarde est considérée achevée uniquement si `_SUCCESS` est présent dans son répertoire logique.

## 2. Copier localement une archive déchiffrée

Exemple :

```powershell
$BackupId = "AAAA-MM-JJ_HHMMSSZ"
$Tier = "baseline"
$Dest = "D:\LMV-Restore-Stripe\$BackupId"

New-Item -ItemType Directory -Path $Dest -Force | Out-Null
rclone copy "LMVCRYPT:02_Stripe/$Tier/$BackupId" $Dest --progress
```

Le contenu écrit dans `$Dest` est déchiffré par `LMVCRYPT`.

## 3. Vérifier SHA256SUMS

Sous Windows PowerShell, `SHA256SUMS` peut être contrôlé sans WSL :

```powershell
$Root = "D:\LMV-Restore-Stripe\$BackupId"
$Errors = @()

Get-Content "$Root\SHA256SUMS" | ForEach-Object {
    if ($_ -match '^([0-9a-fA-F]{64})\s+\*?(.+)$') {
        $Expected = $Matches[1].ToLowerInvariant()
        $Relative = $Matches[2] -replace '^\.\\?', '' -replace '^\./', ''
        $Path = Join-Path $Root ($Relative -replace '/', '\')
        $Actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
        if ($Actual -ne $Expected) { $Errors += $Relative }
    }
}

if ($Errors.Count -eq 0) {
    Write-Host "OK - Tous les SHA256 correspondent" -ForegroundColor Green
} else {
    Write-Host "ERREUR SHA256 : $($Errors -join ', ')" -ForegroundColor Red
}
```

Ne poursuivre l'analyse que si tous les SHA256 correspondent.

## 4. Contrôler l'identité et l'inventaire

```powershell
Get-Content "$Root\manifest.json" -Raw | ConvertFrom-Json | Format-List
Get-Content "$Root\inventory\counts.json" -Raw | ConvertFrom-Json | Format-List
Get-Content "$Root\account\account.json" -Raw | ConvertFrom-Json | Select-Object id,country
```

Vérifier notamment :

- le `stripe_account_id` attendu ;
- `livemode = true` ;
- `backup_id` ;
- les compteurs des collections ;
- les versions Stripe enregistrées lorsqu'elles étaient disponibles.

## 5. Rechercher une opération historique

Les recherches suivantes restent locales et n'interrogent pas Stripe.

### PaymentIntent

```powershell
Select-String -Path "$Root\finance\payment_intents.ndjson" -SimpleMatch "pi_..."
```

### Charge

```powershell
Select-String -Path "$Root\finance\charges.ndjson" -SimpleMatch "ch_..."
```

### Checkout Session

```powershell
Select-String -Path "$Root\checkout\checkout_sessions.ndjson" -SimpleMatch "cs_..."
Select-String -Path "$Root\checkout\checkout_session_line_items.ndjson" -SimpleMatch "cs_..."
```

### Refund

```powershell
Select-String -Path "$Root\finance\refunds.ndjson" -SimpleMatch "re_..."
```

### Payout

```powershell
Select-String -Path "$Root\finance\payouts.ndjson" -SimpleMatch "po_..."
```

On peut ensuite convertir la ligne JSON trouvée :

```powershell
$Line = (Select-String -Path "$Root\finance\payment_intents.ndjson" -SimpleMatch "pi_...").Line | Select-Object -First 1
$Object = $Line | ConvertFrom-Json
$Object | Format-List
```

## 6. Rapprochement documentaire avec Supabase

Si une sauvegarde Supabase est également disponible, comparer les identifiants :

```text
PaymentIntent ↔ payments
Charge ↔ payments / stripe_balance_transactions
Refund ↔ opérations de remboursement
Payout ↔ stripe_payouts
```

Ce rapprochement sert à détecter d'éventuelles lacunes historiques de synchronisation. Supabase n'est pas le critère de validité de l'archive Stripe directe.

## 7. Limites de récupération

- Les objets archivés servent de preuve et de référence historique.
- L'archive ne recrée pas un compte Stripe et ne peut pas recréer/réinjecter les paiements historiques.
- Les secrets Stripe et secrets webhook ne sont volontairement pas archivés.
- Le backup est un export **non atomique** de plusieurs ressources API ; deux objets liés peuvent avoir été lus à quelques secondes d'écart.
- Les données client peuvent être présentes : conserver la copie locale comme donnée sensible et la supprimer lorsqu'elle n'est plus nécessaire.

## Validation minimale d'un exercice de récupération

Un exercice de récupération est réussi seulement si :

1. l'archive est copiée depuis `LMVCRYPT:02_Stripe/...` ;
2. tous les `SHA256SUMS` sont validés ;
3. le compte et `livemode` sont cohérents ;
4. l'inventaire est lisible ;
5. au moins un PaymentIntent, une Charge, une Checkout Session, un Refund s'il en existe et un Payout sont retrouvés par identifiant ;
6. aucun secret d'exécution n'est nécessaire pour lire les fichiers déjà déchiffrés.
