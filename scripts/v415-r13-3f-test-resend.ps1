# V4.15 R13.3f — à lancer UNIQUEMENT sur le PC local, jamais dans Supabase SQL Editor.
param([switch]$Restants)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot 'v415-r13-3f-test-resend.mjs'
Set-Location -LiteralPath $root

Write-Host "ETAPE 1 : aperçu local (aucun envoi)" -ForegroundColor Cyan
& node $script --preview
if ($LASTEXITCODE -ne 0) { throw 'Préparation des modèles échouée.' }
$preview = Join-Path $root 'docs\MD\RECETTE_V415_R13_3F_APERCUS_REELS.html'
Start-Process -FilePath $preview
if ($Restants) {
    Write-Host "`nETAPE 2 : les huit messages restants vers lamaisonverte65@gmail.com" -ForegroundColor Yellow
    Write-Host 'A executer uniquement apres confirmation Delivered dans Resend ET reception du premier message dans Gmail.'
    $reply = Read-Host 'Pour ENVOYER les huit restants, saisis exactement ENVOYER 8 TESTS (sinon Entree)'
    $approved = 'ENVOYER 8 TESTS'
    $nodeArgs = @('--send-remaining', '--confirm=OUI-8-TESTS')
} else {
    Write-Host "`nETAPE 1 : UN SEUL email de test vers lamaisonverte65@gmail.com" -ForegroundColor Yellow
    Write-Host 'FR: demande recue. Les huit autres restent BLOQUES.'
    $reply = Read-Host 'Pour ENVOYER le premier email, saisis exactement ENVOYER 1 TEST (sinon Entree)'
    $approved = 'ENVOYER 1 TEST'
    $nodeArgs = @('--send-one', '--confirm=OUI-1-TEST')
}
if ($reply -cne $approved) {
    Write-Host 'Envoi annulé. Aucun email envoyé.' -ForegroundColor Green
    exit 0
}
$originalTestOnly = [Environment]::GetEnvironmentVariable('LMV_R13_3F_TEST_ONLY','Process')
$originalKey = [Environment]::GetEnvironmentVariable('RESEND_API_KEY','Process')
try {
    [Environment]::SetEnvironmentVariable('LMV_R13_3F_TEST_ONLY','1','Process')
    if (-not $originalKey) {
        $secureKey = Read-Host 'Clé API Resend (saisie masquée, non enregistrée)' -AsSecureString
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
        try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        if (-not $key) { throw 'Clé Resend manquante. Aucun envoi.' }
        [Environment]::SetEnvironmentVariable('RESEND_API_KEY',$key,'Process')
        $key = $null
        $secureKey.Dispose()
    }
    & node $script @nodeArgs
    if ($LASTEXITCODE -ne 0) { throw 'Envoi interrompu : voir message ci-dessus. Ne pas relancer sans vérifier les emails déjà reçus.' }
    if ($Restants) {
        Write-Host 'Huit envois demandes. Controle leur statut dans Resend et leur reception Gmail.' -ForegroundColor Green
    } else {
        Write-Host 'Un seul envoi demande. Controle le statut Delivered dans Resend et la reception Gmail AVANT de continuer.' -ForegroundColor Green
    }
}
finally {
    [Environment]::SetEnvironmentVariable('LMV_R13_3F_TEST_ONLY',$originalTestOnly,'Process')
    [Environment]::SetEnvironmentVariable('RESEND_API_KEY',$originalKey,'Process')
}
