# ÉVOLUTIONS — LA MAISON VERTE — ÉTAT DE PILOTAGE AU 20/10/2026

> **Mise à jour du document historique V4.9 → V4.10.** Cette section est
> désormais la référence de suivi pour V4.13 et V4.14. Tout le contenu
> antérieur est conservé **sans modification** plus bas, à titre d'historique.
> Ses mentions « à faire », « en cours », « à déployer », ses références à
> des commits anciens et ses procédures ne constituent pas des consignes
> actuelles sans contrôle du code, du dépôt Git et, si nécessaire, de la
> production. Ne pas rouvrir un chantier validé sans anomalie démontrée.

## 1. Référence technique et règle de sécurité

- Application : React / Vite, Netlify Functions, Supabase, Stripe ; exploitation
  sur Windows et PowerShell.
- Dépôt : `lamaisonverte65/site-maison-verte`, branche `main`.
- Racine locale de travail :
  `C:\Users\pc\Desktop\Site La MaisonVerte\Site Maison Verte - V4\travail`.
- Référence Git connue avant publication V4.14 : `d99ca4b` ; branche locale
  `main` et `origin/main` identiques au dernier contrôle communiqué.
- **Environnement potentiellement connecté à Supabase PRODUCTION** : aucun
  test ne doit créer de dépense fictive ni provoquer d'écriture ou de
  remboursement réels.
- Aucun `git push`, déploiement Netlify ni migration SQL de production
  sans autorisation explicite du propriétaire.
- Ne jamais supprimer, déplacer ni ajouter automatiquement les fichiers
  privés non suivis, notamment `docs/MD/` et `docs/superpowers/`.
- Une facture émise reste immuable ; ne pas recréer une réservation pour
  corriger une erreur ; respecter le journal et les sources financières
  faisant autorité.

## 2. V4.13 — PUBLIÉE LE 20/10/2026 (CHANTIER CLOS)

- Dernier commit publié : **`d99ca4b`**.
- Cinq migrations SQL appliquées en production et six vérifications SQL
  finales réussies, selon la recette de publication.
- Publication Netlify confirmée le **20/10/2026 à 11 h 53**.
- Recette de prépublication : **1 041 tests réussis**, zéro échec ; build
  Vite réussi.
- Module « Taxe de séjour — Aure Louron » contrôlé dans l'administration
  en production. Le registre des prélèvements bancaires s'affiche sans erreur.
- Cas contrôlé, réservation Nathalie Roussille du 15 au 18 octobre 2026 :
  taxe contractuellement facturée **8,28 €** ; taxe réglementaire indicative
  **13,80 €** ; écart **5,52 €** ; trois nuits et deux personnes taxables.

**Points de suivi V4.13 non bloquants, ne faisant pas partie de V4.14 :**
rapprocher la taxe effectivement encaissée auprès du client ; vérifier
l'enregistrement lors du premier prélèvement bancaire Aure Louron réel.
Aucune réouverture de V4.13 n'est prévue sans anomalie démontrée.

## 3. V4.14-A/B — FRAIS ET DÉPENSES (R1 + CORRECTIONS R2)

### 3.1 Onglet « Frais » — réalisé localement

- Saisie **uniquement des frais effectivement payés** : date réelle,
  domaine/catégorie, libellé, fournisseur, montant TTC, mode de paiement,
  référence facultative du justificatif, traitement comptable et notes.
- Justificatifs PDF/photos classés manuellement sur le PC avec sauvegarde
  pCloud : **aucun stockage de justificatifs dans Supabase**.
- Réutilisation du **journal comptable existant**, sans second registre ;
  les frais manuels restent distincts des écritures automatiques.
- Formulaire R2 plus lisible sur ordinateur ; disposition responsive prévue
  sur tablette et smartphone, un champ par ligne sur petit écran, boutons
  tactiles et absence attendue de débordement horizontal.

### 3.2 Onglet « Dépenses » — réalisé localement

- Consultation commune des dépenses manuelles et automatiques provenant
  notamment de Booking, Airbnb et Stripe.
- Recherche et filtres par exercice, mois, dates, catégorie, fournisseur et
  origine ; total filtré, sous-totaux manuels/automatiques, répartitions
  par catégorie et par mois.
- R2 : tableaux de répartition lisibles sans défilement horizontal superflu,
  filtres avancés repliables et présentation en fiches sur smartphone lorsque
  nécessaire.
- Les immobilisations peuvent faire partie des dépenses affichées selon
  le traitement ; ne pas assimiler automatiquement cet écran à la liste
  des charges fiscalement déductibles.
- Les remboursements clients ne sont **pas** des charges d'exploitation.
  Les reversements de taxe de séjour Aure Louron restent séparés.

### 3.3 Filtres transversaux — réalisés localement après R2

- Nouveau composant de filtres partagé pour **Synthèse, Recettes,
  Remboursements, Frais et Immobilisations**.
- Recherche par libellé, tiers, référence ou justificatif ; filtres adaptés
  par mois, période, domaine, tiers, origine/source, type d'écriture et
  traitement selon l'onglet.
- Les filtres respectent le périmètre de chaque onglet et de l'exercice ;
  recherche sans distinction d'accents/majuscules ; possibilité d'effacer
  les critères.
- Dans Synthèse, les **comptages, totaux et solde indicatif** reflètent
  la sélection ; les remboursements sont conservés séparément des dépenses.
- Sur smartphone, recherche maintenue accessible et filtres avancés
  repliables. **Aucune écriture en base** par ces filtres de consultation.
- Écrans Dépenses, Imports, Rapprochement et Taxe de séjour : filtres ou
  commandes déjà présents préservés ; pas de refonte supplémentaire.

### 3.4 Validation réalisée et limites

| Vérification | Résultat au 20/10/2026 |
| --- | --- |
| V4.14-R1 avant correction responsive | 1 049/1 049 tests ; build OK |
| V4.14-R2 responsive | 1 053/1 053 tests ; build OK, 278 modules |
| V4.14-R2 + filtres transversaux | **1 058/1 058 tests**, 0 échec |
| Dernier `npm run build` local | **Réussi** : Vite 5.4.21 ; 280 modules ; 7,80 s |
| Dernier `git diff --check` rapporté avant le lot de filtres | Aucune erreur ; à relancer avant commit |
| Recette visuelle desktop | Frais, Dépenses, Synthèse et Recettes présentés et jugés satisfaisants |
| Recette fonctionnelle locale des filtres | Vérifications utilisateur effectuées et déclarées validées |
| Recette smartphone | **À effectuer après déploiement** |
| Publication V4.14 | **Non autorisée / non effectuée à ce stade** |

Ces validations ne constituent pas une preuve de fonctionnement sur tous
les téléphones, ni une nouvelle recette de production. Ne pas présenter
les contrôles non exécutés comme réalisés.

### 3.5 Migrations et sécurité des données

- **Aucune migration SQL prévue pour V4.14-A/B-R2 et les filtres.**
- Aucune modification demandée des fonctions Netlify pour ce périmètre.
- Aucune dépense fictive à créer dans la base de production.
- Les changements apportés au test historique
  `tests/v413-b1-refund-accounting-readonly.test.js` adaptent la vérification
  au nouvel écran Dépenses ; ils maintiennent l'interdiction de création
  manuelle de remboursement dans le journal.

## 4. RESTE À FAIRE — PUBLICATION V4.14

1. Vérifier l'état Git réel immédiatement avant préparation du commit :
   `git status --short`, `git diff --check`, `git diff --stat` et
   `git log -1 --oneline`. Les archives transmises ne remplacent pas cette
   vérification du dépôt Windows.
2. Contrôler les fichiers V4.14 nouveaux ou modifiés, y compris les nouveaux
   filtres, et préparer un **ajout Git sélectif**. Ne pas indexer
   `docs/MD/` ni les fichiers privés sous `docs/superpowers/`.
3. Intégrer la documentation mise à jour **seulement après confirmation de
   son chemin exact dans le dépôt** ; ne pas inventer son emplacement.
4. Préparer le commit et inspecter `git diff --cached --check` ainsi que la
   liste des fichiers indexés. Aucun commit, push ou publication sans accord.
5. Après autorisation explicite, publier sur GitHub/Netlify, vérifier l'état
   du déploiement puis réaliser la **recette smartphone** (navigation des
   onglets, formulaire Frais, filtres, répartitions et journal Dépenses).
6. Ne corriger que les anomalies réellement observées. Conserver le suivi
   V4.13 Aure Louron hors de ce chantier tant qu'il n'est pas bloquant.

---

# HISTORIQUE ANTÉRIEUR CONSERVÉ — DOCUMENT V4.9 → V4.10

Le texte qui suit est repris sans modification du document original de suivi
au 01/10/2026. Son ancien titre « état courant » ne s'applique qu'à cette
photographie historique du projet.

---

# ÉVOLUTIONS --- LA MAISON VERTE V4.9 → V4.10

# MISE À JOUR V4.10 --- ÉTAT COURANT AU 01/10/2026

> Cette section est l'index de pilotage courant. Le corps V4.9 conservé
> plus bas reste un historique utile des décisions et demandes, mais ses
> anciens statuts `À FAIRE`, `LOCAL`, `À DÉPLOYER` ou `À VÉRIFIER` ne
> doivent pas être exécutés sans confrontation à cet état V4.10, au code
> réel et, lorsque nécessaire, à l'état LIVE.

## A. Chantiers réalisés et validés

### A.1 Socle financier V4.10 --- VALIDÉ

Réalisé et validé :

-   migration additive du snapshot financier ;
-   `deposit_rate` paramétrable et snapshoté ;
-   `deposit_basis`, `deposit_amount`, `contract_total` ;
-   moteur central de devis/réservation ;
-   taxe exclue de la base d'acompte ;
-   Stripe consommateur des snapshots et non autorité tarifaire ;
-   paiement initial acompte/intégral ;
-   solde et consommateurs financiers alignés ;
-   paiement manuel séparé de la modification contractuelle ;
-   modifications de réservation avec prévisualisation avant
    confirmation ;
-   compatibilité legacy conservée sans backfill artificiel ;
-   annulation/remboursement aligné sur le contrat V1.5 ;
-   nettoyage des anciens textes/recalculs périphériques identifiés.

Ne pas rouvrir ce socle sans anomalie démontrée.

### A.2 Taxe de séjour --- SOCLE VALIDÉ / FIN DE CYCLE REPORTÉE

Réalisé :

-   classement courant indépendant des barèmes ;
-   quatre familles de règles réglementaires ;
-   versionnement des règles ;
-   moteur non classé et tarifs fixes ;
-   snapshot fiscal ;
-   collecte réelle et remboursement réel ;
-   simulateur admin ;
-   historique du classement réel LMV depuis le 15/02/2024 ;
-   registre réglementaire par nuit ;
-   synthèse mensuelle ;
-   séparation LMV / plateformes ;
-   affichage fonctionnel dans `Déclarations → Taxe de séjour`.

Validation :

-   A-5.1a : VALIDÉ LIVE ;
-   A-5.1b : VALIDÉ techniquement et fonctionnellement ;
-   A-5.2/A-5.3 : volontairement reportés jusqu'au premier cycle réel
    Aure-Louron.

À reprendre après le premier cas réel : état/récapitulatif Aure-Louron,
montant déclaré, montant versé, reçu/preuve et rapprochement
`calculé → déclaré → versé`.

### A.3 Finance / comptabilité admin --- LARGEMENT RÉALISÉE

Réalisé :

-   fondation comptable Supabase owner-only ;
-   catégories, écritures, immobilisations et synthèse annuelle ;
-   ajout/modification/suppression manuels ;
-   imports comptables Booking et Airbnb ;
-   remplacement atomique d'un snapshot annuel cumulatif par
    source/exercice ;
-   détection d'un réimport identique ;
-   saisie manuelle d'une recette ;
-   conservation des métadonnées utiles, dont la taxe reversée par
    Airbnb.

Références déjà rapprochées :

-   Booking 2025 : 38 réservations, brut 12 556,87 €, commissions +
    frais -1 941,75 €, net 10 615,12 € ;
-   Airbnb 2025 : brut 720,00 €, frais 25,92 €, net 694,08 €, taxe
    reversée 51,84 €.

### A.4 Admin / CRM / communications --- BLOC FERMÉ POUR V4.10

#### Double clic « Accepter » --- VALIDÉ

Le frontend verrouille immédiatement la soumission ; une seconde
soumission est bloquée pendant le traitement. Les protections
backend/Stripe existantes sont conservées. Tests intégrés.

#### Ajouter client / déduplication --- VALIDÉ

L'ancien comportement créant immédiatement une fiche vide
`Nouveau client` a été supprimé.

Désormais :

-   ouverture d'un formulaire avant insertion ;
-   prénom + nom requis ;
-   email/téléphone facultatifs ;
-   recherche des clients existants ;
-   possibilité d'ouvrir le client correspondant ;
-   création seulement après validation ;
-   réutilisation des mécanismes CRM existants sans second système
    parallèle de déduplication.

#### Tableau Réservations : email / téléphone --- AUDITÉ, AUCUNE MODIFICATION RETENUE

Les coordonnées sont déjà :

-   prises en compte dans la recherche ;
-   présentes dans l'export CSV ;
-   visibles dans la fiche réservation ;
-   utilisées par les actions email/appel/SMS ;
-   utilisées pour le rapprochement réservation ↔ client.

Le tableau comportant déjà de nombreuses colonnes, l'ajout permanent de
deux colonnes supplémentaires est considéré inutile pour V4.10.

#### Communications / emails --- VALIDÉ POUR V4.10

Les catégories restent séparées : messages client, emails envoyés,
événements, notes ménage et notes internes.

#### `internal_notes` / `owner_message` --- VALIDÉ LIVE

Décision et implémentation :

-   `internal_notes` = notes internes admin actuelles, non envoyées au
    client ;
-   `owner_message` = legacy conservé en lecture uniquement ;
-   aucune migration automatique des anciennes valeurs ambiguës ;
-   les nouvelles écritures de notes internes utilisent `internal_notes`
    ;
-   le RPC de remboursement ne réécrit plus `owner_message` ;
-   `refund_reason` et `booking_events` conservent la traçabilité des
    remboursements.

Migration LIVE : `202610010001_v410_internal_notes.sql`.

Postflight LIVE :

-   colonne `internal_notes` présente ;
-   `owner_message` préservé ;
-   19 réservations historiques avec `owner_message` non vide, toutes
    conservées ;
-   0 copie historique vers `internal_notes` ;
-   commentaire de colonne conforme ;
-   `finalize_stripe_refund_operation(uuid)` présent et
    `SECURITY DEFINER` ;
-   aucune référence à `owner_message` dans ce RPC ;
-   `refund_reason` et `booking_events` présents.

#### Rôle `read_only` --- VALIDÉ / CLOS

Audit code : aucun rôle fonctionnel `read_only` actif ; seules des
traces historiques/tests subsistent.

Contrôle LIVE :

-   2 comptes actifs ;
-   0 rôle actif hors `owner` / `housekeeping` ;
-   0 compte `read_only` actif ;
-   0 compte `read_only` historique ;
-   contrainte `admin_users_active_role_allowed` présente et validée ;
-   contrainte `admin_users_active_auth_required` présente et validée ;
-   0 profil actif sans `auth_user_id`.

Aucune migration supplémentaire nécessaire.

#### Contacts supplémentaires --- ÉVOLUTION FUTURE

Le modèle avancé de contacts multiples reste une évolution facultative
et n'est pas un défaut bloquant de V4.10.

### A.5 Performance bundle --- RÉALISÉE

Le reliquat « bundle \> 500 kB » a été traité par lazy
loading/découpage.

Baseline après les derniers lots Admin/CRM/communications :

``` text
tests      398
pass       398
fail       0
Vite       5.4.21
modules    237
build      OK
```

Bundles principaux connus :

``` text
index               470.85 kB / 135.53 kB gzip
Admin               210.87 kB / 52.56 kB gzip
CalendarAdmin       293.88 kB / 86.04 kB gzip
DeclarationsPanel    37.75 kB / 10.75 kB gzip
PricingAdmin          33.71 kB /  7.79 kB gzip
LivretAccueil         46.19 kB /  9.45 kB gzip
```

Aucun warning de chunk \> 500 kB.

## B. NOUVEAU CHANTIER PRIORITAIRE --- FACTURATION CLIENT

### B.1 Besoin métier

Un client a demandé une facture de sa réservation. La Maison Verte doit
pouvoir produire ses propres factures sans dépendre de l'interface
Booking/Airbnb.

Le module doit couvrir dès sa première version :

-   réservations directes/site ;
-   réservations Booking lorsque les données importées sont suffisantes
    ;
-   architecture réutilisable ensuite pour Airbnb.

### B.2 Deux portes d'entrée, un seul moteur

Deux accès sont retenus :

1.  **Fiche réservation** : bouton/section `Facture` permettant de créer
    directement la facture de la réservation ouverte.
2.  **Onglet Admin `Factures`** : registre global des factures,
    recherche/filtrage et bouton `Créer une facture` avec choix
    préalable d'une réservation.

Ces deux accès doivent appeler **le même moteur de facturation**. Aucun
système parallèle « facture Booking » ne doit être créé.

### B.3 Cycle d'une facture

Avant émission, la facture est un brouillon modifiable.

À l'émission :

-   attribution d'un numéro unique selon la règle de numérotation à
    définir ;
-   date d'émission ;
-   snapshot figé des informations de facturation ;
-   génération PDF ;
-   conservation/archivage ;
-   possibilité de retrouver/télécharger la facture depuis la
    réservation et depuis l'onglet `Factures`.

Une facture émise ne doit pas être recalculée automatiquement si la
réservation ou la fiche client change ensuite.

Prévoir dès la conception la gestion future des corrections, annulations
et **avoirs**, sans nécessairement implémenter toutes les variantes dans
le premier lot.

### B.4 Source financière --- règle impérative

Pour une réservation directe V4.10, la facture doit consommer le
**snapshot contractuel** et les paiements réellement enregistrés. Elle
ne doit pas recalculer le prix, la promotion ou la taxe de séjour.

Pour Booking, le montant facturé au voyageur doit être distingué du
montant net reversé à La Maison Verte. Les commissions et frais Booking
sont des données comptables de La Maison Verte et ne doivent pas devenir
des lignes facturées au voyageur.

### B.5 Données Booking déjà disponibles dans les imports

L'analyse des exports Booking utilisés par La Maison Verte montre que le
relevé de réservations fournit notamment :

-   numéro de réservation ;
-   date de réservation ;
-   arrivée / départ ;
-   nom du réservant ;
-   nom du voyageur ;
-   nombre de personnes ;
-   nombre de nuitées ;
-   montant original ;
-   montant final ;
-   statut ;
-   devise.

Le relevé de paiements apporte notamment :

-   numéro de réservation ;
-   nom client ;
-   arrivée / départ ;
-   montant ;
-   commission ;
-   frais de paiement ;
-   net reversé ;
-   date de paiement ;
-   identifiant de paiement.

Le numéro de réservation Booking permet le rapprochement entre ces
données.

### B.6 Limite connue des données Booking

Les exports disponibles ne donnent pas toutes les coordonnées de
facturation du voyageur. En particulier, ne pas supposer disponibles :

-   adresse postale ;
-   email ;
-   téléphone ;
-   raison sociale ;
-   adresse professionnelle ;
-   numéro de TVA éventuel.

Cette absence n'est pas un blocage du module.

La facture possède son **propre snapshot de coordonnées de
facturation**. Si le client Booking demande une adresse, une société ou
d'autres mentions qui ne sont pas disponibles dans l'import, elles sont
saisies manuellement dans le brouillon à partir des informations
communiquées par le client.

Aucune donnée client ne doit être inventée.

### B.7 Point financier Booking encore à verrouiller

Avant automatisation complète d'une facture Booking, auditer précisément
la ventilation du montant importé :

-   hébergement ;
-   éventuel forfait ménage ;
-   taxe de séjour ;
-   sommes collectées/reversées par Booking.

Ne pas ajouter une taxe de séjour à un montant Booking sans avoir
démontré si elle est déjà incluse, séparée ou gérée par la plateforme.

### B.8 Registre Factures

L'onglet `Factures` doit permettre au minimum :

-   numéro ;
-   date d'émission ;
-   client ;
-   séjour ;
-   source (`Direct`, `Booking`, puis `Airbnb`) ;
-   montant ;
-   état ;
-   accès PDF ;
-   recherche et filtrage par année/source.

L'interface et les données financières restent **owner-only**.

## B.9 État d’avancement B4 / B4.1 / B4.1b — IMPLÉMENTÉ LOCALEMENT / CONTRÔLES TECHNIQUES OK

Le chantier Factures n’est plus au stade « nouveau / à concevoir ». Une première fondation fonctionnelle est désormais implémentée localement.

Réalisé dans les lots B4 / B4.1 :

- création d’un brouillon de facture Direct depuis une réservation ;
- la création initiale transmet uniquement `bookingRequestId` au backend : les données financières ne sont pas fournies par le navigateur ;
- snapshot client/facturation modifiable tant que la facture reste au statut brouillon ;
- infrastructure d’émission et d’archivage PDF engagée dans le module Factures ;
- prise en charge explicite des anciennes réservations Direct ne disposant pas du snapshot financier V4.10 complet ;
- pour ces réservations historiques, possibilité de compléter manuellement la ventilation financière lorsque celle-ci ne peut pas être démontrée automatiquement.

### B4.1b — reconstruction historique conservatrice

Une reconstruction automatique a été ajoutée pour les réservations historiques uniquement lorsque les données permettent de démontrer la ventilation sans hypothèse.

Conditions de prudence retenues :

- tarif applicable existant avant la réservation ;
- tarif non modifié depuis ;
- couverture démontrable de toutes les nuits ;
- correspondance exacte entre le calcul reconstruit et le total historique ;
- prise en compte de la chronologie des fonctions ménage, taxe et remise ;
- aucune taxe, remise ou ventilation n’est inventée lorsqu’elle n’est pas démontrable.

Si ces conditions ne sont pas réunies, le brouillon reste en **mode manuel de secours**.

Cas réel de référence `82090B28` :

- réservation du 14/09/2026 ;
- 6 nuits au tarif Toussaint historique de 80 € ;
- hébergement démontrable : **480,00 €** ;
- ménage : **0,00 €** ;
- taxe de séjour facturée : **0,00 €** ;
- le brouillon existant peut être mis à niveau sans être supprimé ;
- aucune émission et aucun numéro de facture ne doivent être consommés pendant cette reconstruction.

Les champs `cleaning_option=false` / `cleaning_fee=0` ajoutés ultérieurement par migration ne sont pas considérés, à eux seuls, comme une preuve historique. La reconstruction repose sur la combinaison des éléments datés et du tarif démontrable.

### Correction du test B4

Après B4.1b, le test `B4 direct draft creation sends only bookingRequestId` échouait parce qu’il recherchait `contract_total:` dans l’intégralité de `src/services/invoiceService.js`. Or `contract_total` est légitime dans la fonction séparée de mise à jour manuelle d’un brouillon historique.

Le test a donc été resserré sur la seule fonction `createDirectInvoiceDraft()`. La règle métier reste inchangée : **la création initiale du brouillon n’envoie que `bookingRequestId` et aucune donnée financière calculée par le frontend**.

### Validation technique locale après B4.1b

Dernier contrôle communiqué :

```text
tests      450
pass       450
fail       0
build      OK
```

B4.1b est donc **validé techniquement en local**.

### Validation fonctionnelle encore requise

Le prochain contrôle est le brouillon réel `82090B28` dans l’interface locale :

1. ouvrir le brouillon existant ;
2. utiliser `Tenter la reconstruction automatique` ;
3. vérifier **480,00 € / 0,00 € / 0,00 €** ;
4. vérifier qu’aucune facture n’est émise et qu’aucun numéro n’est consommé ;
5. seulement après ce contrôle, poursuivre le cycle d’émission de facture.

## C. PRÉALABLE FACTURATION DIRECTE --- ADRESSE DU RÉSERVANT

### C.1 Constat

Le formulaire direct du site ne demande actuellement pas l'adresse
postale du réservant.

Avant le développement du module Factures, auditer le modèle
`customers`, `booking_requests`, le formulaire public et le contrat pour
déterminer le stockage exact.

### C.2 Évolution retenue

Pour les nouvelles réservations directes, prévoir la collecte des
coordonnées postales du **réservant principal** :

-   adresse ;
-   code postal ;
-   ville ;
-   pays.

Ces informations ne sont pas demandées pour chaque voyageur.

Objectifs :

-   disposer d'une identité contractuelle plus complète ;
-   préremplir le contrat lorsque pertinent ;
-   préremplir la facture ;
-   éviter une ressaisie ultérieure pour les réservations directes.

### C.3 Règles d'architecture

-   ne pas inventer/backfiller d'adresse pour les anciennes réservations
    ;
-   définir après audit si l'adresse vit dans `customers`, dans un
    snapshot de réservation, ou dans les deux avec responsabilités
    clairement séparées ;
-   la facture émise conserve toujours son propre snapshot de
    facturation ;
-   une modification ultérieure de l'adresse du client ne doit pas
    modifier rétroactivement une facture émise ;
-   Booking/Airbnb restent compatibles avec une adresse absente jusqu'à
    saisie manuelle éventuelle.

## D. Chantiers encore réellement ouverts ou à revalider

  ---------------------------------------------------------------------------------
  Chantier                      État courant            Action
  ----------------------------- ----------------------- ---------------------------
  Coordonnées postales          À POURSUIVRE             Compléter/auditer le
  réservant direct                                      modèle/formulaire/contrat ;
                                                        conserver le snapshot propre
                                                        de la facture

  Facturation client Direct     EN COURS — B4.1b        Test fonctionnel réel
                                VALIDÉ TECHNIQUEMENT    82090B28, puis poursuivre
                                                        émission/numérotation/PDF/
                                                        archivage et validation

  Facturation Booking           À POURSUIVRE / AUDITER  Réutiliser le moteur unique ;
                                                        verrouiller les données et la
                                                        ventilation avant émission

  Ventilation facture Booking   À AUDITER               Déterminer exactement
                                                        hébergement/ménage/taxe
                                                        selon les données
                                                        réellement disponibles

  Validation production finale  NON TERMINÉE            Contrôler les parcours
  V4.10                                                 modifiés avant sauvegarde
                                                        de référence

  Taxe Aure-Louron              REPORTÉ                 Reprendre après premier
  déclaré/versé/rapprochement                           cycle réel

  Sauvegardes Supabase hors     À CONCEVOIR /           Export, rotation,
  plateforme / pCloud           IMPLÉMENTER             intégrité, restauration,
                                                        déclencheurs

  Archive Stripe indépendante   À CONCEVOIR /           Export/snapshot utile sans
                                IMPLÉMENTER             recréer Stripe

  Site public EN / ES           À FAIRE                 Internationalisation
                                                        réelle + SEO/hreflang

  Livret EN / ES                À FAIRE                 Versions synchronisées
                                                        après stabilisation FR

  Responsive global             À REVOIR                Laptop, tablette, mobile,
                                                        zoom,
                                                        header/menu/formulaires

  SEO / acquisition directe     À RÉAUDITER             Refaire l'audit après les
                                                        modifications récentes

  WhatsApp                      À DÉCIDER / FAIRE SI    Ligne/comptes, lien/QR
                                RETENU

  PanneauPocket / Scoop.it      FAIBLE PRIORITÉ         Vérifier l'intérêt réel

  Sauvegarde de référence V4.10 À FAIRE EN FIN DE CYCLE Après validation finale
  ---------------------------------------------------------------------------------

## E. Points historiques encore à auditer

Les anciens points suivants restent à confronter au code/état réel avant
toute modification :

-   validation production des avis directs ;
-   validation production boîte à clés / accès / parking / Wi-Fi ;
-   recherche de l'ancien numéro de téléphone sur les surfaces externes
    ;
-   reliquats DST/iCal ;
-   erreurs Supabase éventuellement masquées ;
-   dépendances et artefacts Git ;
-   email J+1 de fin de séjour : mécanisme existant confirmé ; les
    réservations plateformes sans email ne déclenchent naturellement pas
    l'envoi. Ne pas créer un second mécanisme. Si les imports
    plateformes fournissent un jour des coordonnées supplémentaires,
    décider explicitement si l'envoi J+1 reste réservé aux réservations
    directes.

Les anciens points suivants sont désormais **clos et ne doivent plus
revenir dans la file de travail** sauf régression :

-   bouton Admin `Ajouter client` / déduplication ;
-   colonnes email/téléphone du tableau Réservations ;
-   `read_only` ;
-   séparation notes internes / `owner_message` ;
-   double clic `Accepter` ;
-   bloc Communications/emails sur le périmètre audité.

## F. Évolutions explicitement futures / non prioritaires

À conserver sans les faire entrer dans le bouclage immédiat :

-   mini-espace séjour client ;
-   modèle avancé de contacts multiples ;
-   reconnaissance fine « a réservé » / « a séjourné » ;
-   extensions CRM non nécessaires au fonctionnement courant ;
-   sophistication hypothétique des rôles ou permissions.

## G. Ordre de bouclage recommandé au 01/10/2026

1.  **Valider fonctionnellement B4.1b sur le brouillon réel `82090B28`** :
    reconstruction automatique attendue à 480 / 0 / 0, sans émission ni
    consommation de numéro.
2.  **Poursuivre le module Factures Direct** : cycle d’émission,
    numérotation, PDF, archivage et registre, en validant chaque étape
    avant émission réelle.
3.  **Poursuivre les coordonnées postales du réservant direct** et leur
    articulation avec le snapshot propre de facturation.
4.  **Verrouiller la facturation Booking** : ventilation exacte du montant
    voyageur, ménage et taxe de séjour avant toute émission automatisée.
5.  Auditer les quelques anciens reliquats fonctionnels encore réellement
    ouverts.
6.  Faire les contrôles responsive / SEO / internationalisation selon la
    priorité retenue.
7.  Concevoir les sauvegardes Supabase/pCloud et l'archive Stripe.
8.  Effectuer la validation production finale V4.10.
9.  Créer seulement ensuite une nouvelle sauvegarde de référence.
10. Reprendre Aure-Louron après le premier cycle réel.

## H. Baseline technique actuelle

Dernier contrôle local connu après intégration de B4.1b et correction du
test B4 devenu trop large :

``` text
tests      450
pass       450
fail       0
build      OK
```

Cette baseline remplace la précédente référence 398/398 pour l’état local
courant. La migration `202610010001_v410_internal_notes.sql` reste exécutée
en production et son postflight est entièrement conforme. B4.1b est validé
techniquement en local mais son contrôle fonctionnel réel sur `82090B28`
reste à effectuer avant de considérer ce sous-lot comme fermé.

------------------------------------------------------------------------

# HISTORIQUE V4.9 CONSERVÉ

Le contenu ci-dessous est conservé pour les décisions métier, les
demandes initiales et la traçabilité. Pour le statut courant, utiliser
en priorité la section **MISE À JOUR V4.10** ci-dessus.

**Statut :** document maître de pilotage V4.9\
**Date de consolidation :** 2026-09-27\
**Transition :** la V4.8 est conservée comme sauvegarde de travail ; ce
fichier devient le document maître courant V4.9.\
**Principe :** aucun ordre de priorité imposé. Un point n'est terminé
qu'après vérification, tests adaptés et, si nécessaire, validation en
production.

## 0. Contexte de reprise et phases d'exécution

La V4.9 prend la suite de la sauvegarde de travail V4.8. Elle poursuit
la consolidation fonctionnelle, éditoriale et opérationnelle engagée
après la stabilisation V4.7. Le projet est déjà exploité en production ;
l'objectif n'est donc pas de reconstruire le site, mais de traiter
progressivement les évolutions restantes sans régression, en conservant
les acquis sécurité/finance/iCal/admin des versions précédentes.

Le travail est volontairement conduit **par petits lots cohérents**,
avec une séparation stricte entre préparation locale, validation,
commit, déploiement et contrôle en production. Les petits changements
ciblés et déterministes sont à réaliser de préférence directement
(lecture du code, PowerShell, diff Git, tests) ; Codex est réservé aux
tâches où son autonomie apporte une valeur réelle, afin d'éviter les
demandes d'autorisation inutiles et les modifications trop larges.

### Phases à exécuter pour chaque lot

1.  **Lecture / audit ciblé** : retrouver l'état réel du code et les
    règles déjà décidées.
2.  **Décision métier** : ne trancher que ce qui n'est pas déjà défini
    dans la documentation.
3.  **Modification locale minimale** : toucher uniquement les fichiers
    nécessaires.
4.  **Contrôles locaux** : diff humain, tests ciblés, suite complète
    adaptée, build, `git diff --check`.
5.  **Commit local** : séparer les lots cohérents ; aucun push
    implicite.
6.  **Déploiement groupé** : limiter les pushes Netlify intermédiaires ;
    demander une autorisation explicite avant tout push.
7.  **Validation production** : uniquement pour les fonctions réellement
    touchées, sans scénarios artificiels inutiles lorsqu'une lecture
    attentive du code suffit.
8.  **Mise à jour du présent document** : statut, décisions, tests,
    commits, déploiement et validation.

### État local de reprise au 23/09/2026

-   correctif calendrier admin : commit local `e79c7f2` ; non poussé ;
-   lot Wi-Fi site/livret : commit local `a8e5b4c` ; non poussé ;
-   lot livret accès/stationnement + QR Wi-Fi + QR/téléphone : commit
    local
    `87cf636 — feat(livret): ajout acces stationnement wifi et mise a jour telephone`
    ; non poussé ;
-   le livret intègre désormais le QR Wi-Fi avec mot de passe en clair,
    le nouveau QR téléphone, une page « Accès & stationnement », le
    sommaire actualisé et la pagination jusqu'à 10 ;
-   plans utilisés dans le livret : `public/livret/plan parking 3.png`
    et `public/livret/plan parking 4.png`, conservés comme images
    sources sans modification ;
-   QR téléphone scanné : OK ; QR Wi-Fi scanné : OK ; rendu visuel du
    sommaire et de la page parking validé ;
-   contrôles du lot `87cf636` : `git diff --check` OK, build Vite
    (`npm run build`) OK ;
-   lot ménage / contrat V1.2 / heure d'arrivée stable / boîte à clés /
    emails J-30-J-2 / livret : commit local
    `cd07bff — feat: finalise menage arrivee boite a cles et livret` ;
    non poussé ;
-   migration `202609240002_keybox_code.sql` exécutée avec succès en
    production ;
-   contrôles du lot `cd07bff` : suite **281/281**, build Vite OK,
    `git diff --check` contrôlé et dépôt Git propre après commit ;
-   aucun des commits locaux V4.8 ci-dessus n'a encore été
    poussé/déployé ;
-   la suppression locale de `qr-site-avis.svg` ne doit pas être
    conservée : décision métier révisée, les avis directs du site sont
    maintenus.

## 1. Objet et référence

Ce document remplace comme document de pilotage courant le plan
post-V4.7 et consolide trois sources de référence : - les demandes V4.8
récentes formulées dans le fil de travail ; -
`PLAN_DIRECTEUR_AUDIT_SECURITE_EVOLUTIONS post v4.7.md` pour les audits,
reliquats, sauvegardes, fiscalité, SEO, UX et dette technique ; -
`Vision_metier_droits_interfaces_utilisateurs_V4.md` pour les rôles,
droits, interfaces admin, communications et notes internes.

En cas de contradiction sur les rôles/droits/interfaces utilisateurs,
`Vision_metier_droits_interfaces_utilisateurs_V4.md` est la référence
métier actuelle et remplace les conceptions plus anciennes plus
configurables.

Acquis V4.7 à préserver : rôles owner/housekeeping sécurisés ; V4.5
Stripe/finance ; V4.6 analytics ; V4.7-A concurrence directe ; V4.7-B
conflits externes ; source `website` ; exclusion des blocs
Booking/Airbnb d'une nuit ; Supabase JS/Auth 2.113.0 ; révocation de
l'INSERT anon sur `booking_requests` ; mots de passe housekeeping
aléatoires ; occupations externes persistées ; export iCal avec statuts
bloquants `pending`, `accepted`, `deposit_paid`, `paid`, `fully_paid`,
`confirmed`.

Le correctif iCal a été déployé et Booking a ensuite pris en compte les
réservations du site.

## 2. Correctif calendrier admin --- VALIDÉ LOCALEMENT / À DÉPLOYER

Le calendrier revenait au mois courant lors du rafraîchissement. Cause :
`Admin.jsx` mettait `loading=true`, démontait `CalendarAdmin`, puis
FullCalendar remontait sur son mois initial.

Correction locale : garder `CalendarAdmin` monté pendant le
rafraîchissement si l'onglet calendrier est actif et sans erreur ;
conserver l'actualisation ; aucun `localStorage`/`gotoDate()` ; un vrai
reload peut revenir au mois courant ; bouton Aujourd'hui inchangé.

Fichiers : `src/pages/Admin.jsx`,
`src/components/admin/calendar/calendarRefreshPolicy.js`,
`tests/admin-calendar-refresh.test.js`. Contrôles de reprise : test
ciblé OK, suite **281/281**, build Vite OK, `git diff --check` et
`git diff --cached --check` OK.

**Commit local :** `e79c7f2 — Fix admin calendar month persistence`.\
**Reste :** push groupé ultérieur puis validation en production du
maintien du mois affiché pendant les rafraîchissements.

## 2 bis. RÈGLES MÉTIER TRANSVERSALES OBLIGATOIRES

Ces règles viennent de la vision métier V4 et doivent être respectées
par **toute** évolution V4.8 touchant l'admin, les utilisateurs, les
clients, les réservations, les communications ou les données.

### Propriétaire (`owner`)

-   rôle d'autorité maximal ;
-   rôle système protégé ;
-   accès complet aux fonctions d'administration prévues ;
-   accès aux réservations, clients, calendriers, tarifs, paiements,
    remboursements, communications, utilisateurs et données financières
    ;
-   ne doit pas pouvoir être créé/supprimé/remplacé par une opération
    générique ;
-   ne doit pas être obtenu par simple modification de permissions ;
-   une désactivation ne doit jamais laisser le système sans
    propriétaire ;
-   tout éventuel transfert de propriété doit rester une procédure
    spécifique et sécurisée.

### Ménage / accueil (`housekeeping`)

-   profil système fixe ;
-   plusieurs comptes peuvent exister ;
-   pas d'éditeur de permissions ni de droits personnalisés dans
    l'interface ;
-   accès uniquement aux informations nécessaires à l'accueil, au ménage
    et au départ ;
-   le téléphone client est une information opérationnelle importante ;
-   email visible si utile ;
-   peut consulter les informations pratiques de séjour, arrivée/départ,
    messages client, réponses du propriétaire, notes propriétaire
    destinées au ménage et ses propres notes opérationnelles ;
-   peut modifier uniquement les champs explicitement prévus : heure
    d'arrivée, heure de départ lorsqu'elle doit être
    renseignée/corrigée, et sa propre note opérationnelle ;
-   ne doit jamais recevoir une permission générale de modification
    d'une réservation.

### Interdiction d'exposer les finances au ménage

Le rôle `housekeeping` ne doit voir **aucune donnée financière**,
notamment : - prix du séjour ; - acompte ; - solde ; - statut payé/non
payé ; - frais Stripe ; - remboursements ; - payouts ; - chiffre
d'affaires ; - statistiques financières ; - détail des paiements ; -
tarifs administratifs.

Toute évolution des tableaux Réservations/Clients/Calendrier devra
vérifier ce point explicitement.

### Communications

Le propriétaire doit disposer d'une interface Communications / Boîte de
réception centralisant la relation client.

À distinguer impérativement : - messages du client ; - réponses/messages
humains du propriétaire ; - emails automatiques ; - journaux techniques.

Les emails automatiques peuvent apparaître dans l'historique
propriétaire, mais doivent être clairement distingués des échanges
humains. Les journaux purement techniques restent séparés.

Le ménage peut voir les messages client et les réponses du propriétaire
utiles à l'accueil, mais pas les journaux techniques, ni les emails
automatiques comme historique système, ni les données financières.

### Notes internes

Ne jamais mélanger les catégories : - message client ; - réponse
propriétaire au client ; - note propriétaire destinée au ménage ; - note
opérationnelle du ménage.

Une note interne ne doit jamais pouvoir être envoyée ou affichée au
client par erreur.

### Profils et permissions

La V4.8 ne doit pas réintroduire : - profils personnalisables ; -
éditeur de permissions ; - mode `custom`/`none` générique ; - rôle
`read_only` comme profil standard ; - gestionnaire/manager hypothétique
sans besoin métier validé.

Si un nouveau rôle devient réellement nécessaire plus tard, il doit être
défini métierment, implémenté explicitement, autorisé côté backend,
représenté dans l'interface, testé et audité.

### Compte `read_only` historique --- À VÉRIFIER

S'il existe encore : 1. vérifier qu'il n'est plus utilisé ; 2. vérifier
qu'aucune donnée métier importante n'en dépend ; 3. le désactiver en
priorité ; 4. confirmer que la désactivation supprime bien l'accès ; 5.
envisager ensuite seulement une suppression propre.

La suppression/désactivation d'un compte utilisateur ne doit jamais
supprimer réservation, client, paiement, communication ou historique
métier.

### Autorisation backend

L'interface n'est jamais une protection suffisante. Toute action
interdite doit être refusée côté serveur même si : - un bouton caché est
appelé ; - une requête est construite manuellement ; - le frontend est
modifié ; - une ancienne URL/fonction est appelée.

Cette règle s'applique particulièrement aux évolutions V4.8 « Ajouter
client », colonnes Réservations, acceptation de réservation,
communications, comptes housekeeping et futur registre fiscal.

## 3. Wi-Fi 7 installé --- HARMONISÉ LOCALEMENT / À DÉPLOYER

Le Wi-Fi 7 est installé. La box est dédiée aux locataires et la
télévision est reliée directement à Internet par câble Ethernet.

Réalisé localement : équipements + Schema.org + livret + TV Ethernet
(`a8e5b4c`) ; QR Wi-Fi et mot de passe `lamaisonverte65` intégrés au
livret et validés par scan (`87cf636`) ; rappel avant séjour J-2 mis à
jour avec le Wi-Fi et son mot de passe (`cd07bff`).

Reste : éventuelles harmonisations sur plateformes externes, déploiement
groupé après autorisation explicite et validation production.

## 4. Nouveau téléphone dédié --- HARMONISÉ DANS LE CODE PUBLIC AUDITÉ / EXTERNE À VÉRIFIER

Nouveau numéro : **07 95 93 83 15** (`+33795938315`).

Réalisé localement pour le livret : - `public/livret/qr-telephone.svg` a
été régénéré et encode `tel:+33795938315` ; - le lien téléphone du
livret utilise désormais `tel:+33795938315` ; - QR téléphone testé par
scan : **OK** ; - modifications incluses dans le commit local `87cf636`
; non poussé.

L'audit antérieur avait identifié l'ancien numéro au minimum dans : -
`src/pages/AppelerRedirect.jsx` ; - `src/pages/LivretAccueil.jsx` ---
corrigé pour le bloc téléphone du livret ; - `src/pages/MaisonVerte.jsx`
(Schema.org, lien `tel:`, affichage visible) ; -
`src/pages/MentionsLegales.jsx`.

Le lot éditorial du 24/09/2026 a remplacé les dernières occurrences
publiques auditées dans `AppelerRedirect.jsx`, `MaisonVerte.jsx`
(Schema.org, lien `tel:`, affichage visible), `MentionsLegales.jsx`, le
livret et sa bannière contacts. La bannière PNG a été mise à jour et
optimisée à 1600×580 px (\~735 Ko).

Effectuer aussi une recherche Web de l'ancien numéro pour repérer les
pages où il est encore associé à La Maison Verte et corriger les sources
contrôlables.

## 5. WhatsApp --- À ÉTUDIER / FAIRE

Créer/configurer WhatsApp avec la nouvelle ligne. Étudier la gestion de
deux SIM et deux comptes sur le même téléphone, avec séparation claire
personnel/location (WhatsApp Business à considérer). Puis ajouter lien
WhatsApp au site et éventuellement QR code/livret.

## 6. Boîte à clés installée --- IMPLÉMENTÉE LOCALEMENT / À DÉPLOYER

La procédure est intégrée au livret sans y figer le code. La page
publique `/boite-a-cles` a été supprimée, ainsi que `BoiteACles.jsx`, sa
route publique et la fonction publique `get-keybox-code.js`.

Le code courant reste stocké dans `pricing_settings.keybox_code`. La
migration `202609240002_keybox_code.sql` a été exécutée avec succès en
production. L'admin permet de modifier et récupérer le code via l'action
authentifiée `get_keybox_code` de `save-price-rule.js` ; aucun
historique des anciens codes n'est prévu.

Le rappel J-2 récupère le code courant côté serveur et le communique au
voyageur. La procédure publique est l'image
`public/livret/procedure-boite-a-cles.png`, qui ne contient aucun code.
Le livret conserve la procédure et le rappel du `CLEAR` final sans code
figé.

Implémentation incluse dans `cd07bff`, avec **281/281 tests** et build
Vite validés.

Reste : renseigner/maintenir le code courant via l'admin, déployer le
lot après autorisation explicite et valider le parcours en production.

## 7. Revue complète des emails --- CONTENU CLIENT VALIDÉ / IMPLÉMENTATION À HARMONISER

Inventorier tous les emails automatiques/manuels : déclencheur,
destinataire, timing, objet, contenu, dates/montants/liens, informations
contractuelles, répétitions, double envoi et ton. Ajouter davantage
d'humanité sans perdre la précision.

Cette revue doit aussi vérifier l'intégration avec l'interface
Communications : les échanges humains doivent rester clairement séparés
des emails automatiques et des journaux techniques, conformément à la
vision métier V4.

Inclure au minimum : demande, décision, acompte, solde, rappels,
expiration, contrat, avant séjour, arrivée/boîte à clés, conflit
externe, modification, annulation/remboursement, fin de séjour,
remerciement/avis.

Réalisé dans `cd07bff` : email paiement intégral / J-30 enrichi avec les
informations d'arrivée, les serviettes, l'annonce de la boîte à clés, le
livret et le lien stable d'heure d'arrivée ; rappel J-2 réécrit avec
dates, horaires, souplesse d'arrivée, code courant de boîte à clés, page
`/boite-a-cles`, Wi-Fi, livret et le même lien stable d'heure d'arrivée.

La revue éditoriale du parcours client est désormais validée. Les emails
cibles sont : 1 demande reçue ; 2A demande acceptée/paiement ; 2B refus
; 2C expiration ; 3A confirmation après acompte ; 3B confirmation après
paiement intégral ; 4 demande de solde J-30 ; 5 confirmation du solde ;
6 rappel J-23 ; 7 rappel J-17 ; 8 dernière relance automatique J-10 ; 9
informations d'arrivée J-2 ; 10 remerciement J+1.

Parcours normal avec acompte : **1 → 2A → 3A → 4 → 5 → 9 → 10**.
Parcours paiement intégral : **1 → 2A → 3B → 9 → 10**. Les emails 6/7/8
constituent uniquement la branche de retard de paiement.

Un email interne propriétaire est également validé à J-17 après la
relance client : coordonnées cliquables, séjour, situation financière,
rappel que la réservation reste active et action recommandée **contacter
le client par téléphone**, avec lien direct vers la réservation dans
l'admin. Aucun second email interne J-10 n'est prévu.

### Fin de séjour / remerciement --- À VÉRIFIER

L'ancien plan mentionnait déjà « fin de séjour ». Vérifier si le
mécanisme existe, est seulement prévu ou absent. Ne créer qu'en
l'absence d'un mécanisme existant. Envisager remerciement, informations
de départ selon timing, demande d'avis et lien pertinent.

## 7 bis. Taxe de séjour, paiements, annulations et frais Stripe --- FONDATION TAXE/FORMULAIRE VALIDÉE / SUITE À IMPLÉMENTER

Décisions du 26/09/2026 à appliquer au formulaire, à Supabase, à Stripe,
au contrat, aux emails et à l'admin :

-   la taxe de séjour est une composante financière distincte du prix de
    l'hébergement et du forfait ménage ;

-   l'acompte de 30 % est calculé uniquement sur l'hébergement et le
    forfait ménage éventuellement choisi, **hors taxe de séjour** ;

-   dans le parcours acompte + solde, la taxe de séjour est encaissée
    intégralement avec le solde ;

-   si le voyageur choisit le paiement intégral dès la réservation, la
    taxe de séjour est encaissée avec ce paiement intégral ;

-   les emails et le contrat utilisent le montant fourni par le moteur
    central de taxe et ne recalculent jamais eux-mêmes la taxe ;

-   si une réservation est annulée et que le séjour n'a pas lieu, toute
    taxe de séjour déjà encaissée est remboursée au voyageur et ne peut
    pas constituer une indemnité d'annulation ;

-   lorsqu'un remboursement total est dû, les frais Stripe ne sont pas
    déduits du remboursement client : ils restent une charge de La
    Maison Verte ;

-   le suivi financier doit distinguer montant payé, montant remboursé,
    taxe remboursée, frais Stripe et éventuelle somme conservée au titre
    des conditions contractuelles d'annulation ;

-   le contrat doit distinguer clairement une annulation exceptionnelle
    à l'initiative du propriétaire, remboursée intégralement, d'une
    annulation/résolution consécutive au non-paiement du client ;

-   conditions d'annulation client : plus de 30 jours avant l'arrivée =
    remboursement intégral ; à partir de J-30 et jusqu'à l'arrivée =
    acompte conservé et tout solde déjà encaissé remboursé ; **aucun
    seuil J-7 ne subsiste** ;

-

    le non-paiement du solde n'annule pas automatiquement la réservation
    :   les dates restent bloquées, la réservation reste active et le
        solde demeure dû ; le client doit contacter La Maison Verte s'il
        souhaite annuler ;

-   lorsque l'annulation intervient à partir de J-30 et que tout ou
    partie des nuitées annulées sont ensuite effectivement relouées, La
    Maison Verte rembourse après le séjour concerné la part de l'acompte
    conservé correspondant aux nuitées relouées, dans la limite de
    l'acompte initialement conservé ; ce traitement reste **manuel
    propriétaire** ;

-   la taxe de séjour reste intégralement remboursable lorsque le séjour
    n'est pas effectué.

Le document `TAXE_SEJOUR_PARAMETRAGE_ADMIN.md` constitue la
spécification fonctionnelle détaillée du chantier taxe de séjour.
L'implémentation technique reste soumise aux audits prévus de Supabase,
du calcul de prix, de Stripe, du contrat, des emails et de l'admin.

### Règle opérationnelle et déclaration annuelle de taxe --- DÉCISION VERROUILLÉE

La règle opérationnelle de taxe de séjour **n'expire pas automatiquement
en fin d'année**. Elle reste utilisée pour les nouvelles réservations
jusqu'à ce que le propriétaire valide et saisisse une nouvelle règle.

Le suivi fiscal devra distinguer :

-   **taxe collectée** : montant réellement facturé/encaissé selon le
    snapshot historique de chaque réservation ;
-   **taxe réglementaire à déclarer** : montant recalculé pour l'année
    de déclaration avec la règle réglementaire annuelle validée par le
    propriétaire ;
-   l'éventuel écart entre les deux doit être visible et traçable.

L'admin devra permettre de choisir/valider la règle réglementaire
utilisée pour une déclaration annuelle sans modifier les snapshots
historiques des réservations. Lorsqu'une nouvelle règle opérationnelle
entre en vigueur, la clôture de l'ancienne règle et l'insertion de la
nouvelle doivent être atomiques afin d'éviter tout chevauchement.

Un rappel propriétaire est prévu le **5 décembre de chaque année** pour
vérifier la règle applicable au 1er janvier suivant. Si elle est
inchangée, elle peut être marquée « règles vérifiées --- reconduites » ;
si elle change, une nouvelle règle est saisie avec sa date d'effet.
L'absence temporaire de publication ne bloque pas les réservations : la
règle opérationnelle courante continue de s'appliquer.

### Fondation taxe de séjour + CLIENTFIDELE + formulaire public --- VALIDÉE LE 27/09/2026

Le **lot 2** est validé de bout en bout pour le périmètre **formulaire
public → calcul serveur → réservation Supabase → emails de demande**.

Réalisé et validé :

-   migrations `202609270001_tourist_tax_and_loyalty_foundation.sql` et
    `202609270002_public_booking_v49_money_snapshot.sql` exécutées avec
    succès en production ;
-   tables/règles de fondation taxe et promotion créées avec RLS
    contrôlée ;
-   règle opérationnelle Aure-Louron 2026 **meublé non classé**
    enregistrée à partir du `2026-01-01` **sans `effective_to`** : elle
    reste applicable tant que le propriétaire ne la remplace pas
    explicitement ;
-   moteur central serveur de taxe avec calcul nuit par nuit et snapshot
    historique de la règle réellement utilisée ;
-   formulaire public relié à un calcul serveur autoritaire du prix ;
-   code `CLIENTFIDELE` actif : **-10 % sur l'hébergement uniquement**,
    hors forfait ménage et hors taxe de séjour ;
-   la taxe de séjour est calculée sur l'hébergement net après promotion
    ;
-   le forfait ménage n'est pas remisé ;
-   en parcours acompte, les 30 % portent sur **hébergement net + ménage
    choisi**, hors taxe de séjour ;
-   la taxe de séjour est intégralement reportée au solde ; en paiement
    intégral, elle entre dans le paiement intégral ;
-   la réservation conserve séparément hébergement brut, promotion,
    hébergement net, ménage, taxe, collecteur et snapshot fiscal ;
-   les emails de demande client et propriétaire détaillent désormais
    **hébergement brut → remise → hébergement après remise → ménage →
    taxe de séjour → total estimatif** lorsqu'une promotion est
    appliquée ;
-   sans promotion, le récapitulatif conserve un affichage simplifié de
    l'hébergement mais affiche également la taxe séparément.

Contrôles réalisés :

-   cas acompte avec ménage et `CLIENTFIDELE` : validé ;
-   cas sans ménage : validé ;
-   paiement intégral à plus de J-30 : validé ;
-   séjour à J-30 ou moins avec paiement intégral obligatoire : validé ;
-   test réel de bout en bout avec réservation `TESTV49 / LOT2` :
    formulaire, calcul, RPC, insertion Supabase, snapshot fiscal et
    emails vérifiés ;
-   exemple réel vérifié : hébergement brut 225,00 €, remise 22,50 €,
    hébergement net 202,50 €, ménage 50,00 €, taxe 14,58 €, total 267,08
    € ;
-   snapshot vérifié : 3 nuits, 2 adultes, 0 enfant, taxe totale 14,58
    €, règle 2026 ouverte sans date de fin ;
-   suite complète après correction des emails : **294/294 tests
    réussis, 0 échec** ;
-   réservations de test supprimées après validation.

La base de production contient donc la fondation et les migrations de ce
lot. Les modifications du **frontend et des Netlify Functions restent
locales, non commitées et non poussées/déployées** à ce stade.

Ce lot ne valide pas encore le paiement Stripe du solde, la nouvelle RPC
d'annulation/remboursement V1.5, l'interface admin Finance & fiscalité
ni le déploiement du frontend/functions.

### Paiement du solde --- lien durable La Maison Verte

Décision du 26/09/2026 : le parcours de paiement du solde conserve les
échéances **J-30, J-23, J-17 et J-10**, sans relance quotidienne et sans
période pendant laquelle le voyageur ne pourrait plus payer à cause de
l'expiration technique d'une Checkout Session Stripe.

Règle cible :

-   les emails J-30, J-23, J-17 et J-10 utilisent un **lien de paiement
    durable La Maison Verte**, propre à la réservation ;
-   ce lien ne doit pas être l'URL directe d'une Checkout Session Stripe
    ;
-   à chaque clic, le backend vérifie côté serveur la réservation, son
    état, le montant réellement restant dû et l'autorisation de payer ;
-   si le solde reste dû, le backend crée à cet instant une **nouvelle
    Checkout Session Stripe** avec le montant et les métadonnées
    attendus, puis redirige le voyageur vers Stripe ;
-   si le séjour est déjà entièrement payé, annulé ou n'est plus
    payable, aucune nouvelle Checkout Session ne doit être créée ; le
    voyageur reçoit un état explicite adapté ;
-   l'expiration technique d'une Checkout Session Stripe ne doit donc
    jamais créer de trou entre deux relances : un clic ultérieur sur le
    lien durable doit pouvoir générer une session fraîche tant que le
    solde reste dû ;
-   J-23, J-17 et J-10 restent des **relances métier** et non des
    mécanismes destinés à renouveler un lien Stripe expiré ;
-   l'**expiration métier de 24 h** reste réservée au paiement initial
    après acceptation de la demande (email 2A), car elle conditionne la
    confirmation de la réservation et la remise à disposition des dates
    en cas de non-paiement ; elle ne s'applique pas au parcours de
    solde.

L'implémentation devra réutiliser autant que possible les contrôles et
mécanismes de sécurité existants : lien non devinable/signé, validation
serveur autoritaire, idempotence contre double clic/double requête,
absence de confiance dans un montant transmis par le navigateur et
cohérence avec le webhook Stripe et l'état financier Supabase.

Contrôles minimaux du lot : paiement normal depuis J-30 ; réutilisation
du même lien plusieurs jours plus tard ; clic après expiration d'une
ancienne Checkout Session ; double clic ; clic après paiement déjà
effectué ; réservation annulée/non payable ; montant spécial
propriétaire ; acompte, forfait ménage et taxe de séjour correctement
ventilés ; absence de double paiement et de double email de
confirmation.

### Parcours de paiement initial --- CHOIX ACOMPTE / INTÉGRAL IMPLÉMENTÉ LOCALEMENT

Règle validée :

-   à plus de 30 jours de l'arrivée, le formulaire propose, non cochée
    par défaut, l'option « Je préfère régler la totalité du séjour en
    une seule fois » ;
-   sans choix explicite, le parcours reste acompte de 30 % puis solde ;
-   à J-30 ou moins, le paiement intégral est obligatoire ;
-   le backend reste autoritaire : à J-30 ou moins il impose `full`, et
    à plus de J-30 il n'accepte que les valeurs connues ;
-   `booking_requests.payment_preference` conserve `deposit` ou `full` ;
-   la migration correspondante a été exécutée avec succès en production
    ;
-   une réservation payée intégralement à plus de J-30 ne doit pas
    entrer dans le scheduler du solde ;
-   l'acompte porte uniquement sur hébergement + forfait ménage choisi,
    hors taxe de séjour.

### Contrat de location --- V1.5 RÉFÉRENCE COURANTE

Le contrat courant est **V1.5, applicable au 27 septembre 2026**.

Il intègre la règle de non-annulation automatique en cas de
non-paiement, la suppression complète de l'ancien seuil J-7, les règles
de remboursement de la taxe et des frais Stripe, ainsi que la clause de
relocation après annulation. La relocation est contrôlée et remboursée
manuellement par le propriétaire après la période de séjour initialement
prévue.

### Règles financières communes aux emails

Terminologie verrouillée :

-   **Total du séjour** : coût total du séjour, indépendamment de son
    état de paiement ;
-   **À payer maintenant** : somme demandée par l'email concerné ;
-   **Acompte reçu** : acompte effectivement reçu ;
-   **Solde restant / solde à régler** : somme encore due ;
-   **Séjour entièrement payé** : statut et non montant ;
-   la notion ambiguë **Total réglé** n'est plus utilisée.

Les emails ne recalculent ni prix ni taxe : ils consomment les valeurs
centrales de la réservation.

### Informations d'arrivée J-2 --- CONTENU VALIDÉ

Ordre de priorité : **adresse → récupération des clés → code boîte à
clés → procédure → accès/stationnement → heure d'arrivée → horaires →
Wi-Fi → livret → téléphone**.

Le code de boîte à clés reste dynamique et lu côté serveur depuis
Supabase. Les informations Wi-Fi sont volontairement fixes dans le
template J-2 :

-   réseau : `La Maison Verte` ;
-   mot de passe : `lamaisonverte65`.

Le plan combiné `public/livret/plan-acces.jpg` est la référence publique
retenue pour l'accès/stationnement lorsque ce format est utilisé.

### Fin de séjour, avis et fidélisation --- CODE CLIENTFIDELE IMPLÉMENTÉ / EMAIL J+1 À HARMONISER

L'email J+1 existant est conservé et doit être adapté, sans créer un
second mécanisme. Ordre retenu :

1.  retour privé : le voyageur est invité à **répondre directement à
    l'email**, sans formulaire spécifique ;
2.  avis publics : lien vers l'avis du site La Maison Verte et lien
    Google ;
3.  fidélisation : annonce d'une réduction de **10 % sur l'hébergement**
    pour une prochaine réservation directe avec le code
    **`CLIENTFIDELE`**, sans date d'expiration prévue.

Le code promotionnel constitue une nouvelle fonctionnalité V4.9 :
validation serveur obligatoire, réduction sur l'hébergement uniquement
(hors ménage et taxe de séjour), propagation cohérente dans le calcul,
le récapitulatif, Supabase, Stripe, le contrat et les emails. Le code
doit rester administrativement désactivable/paramétrable même s'il est
prévu sans expiration.

### Confirmation après demande publique --- MODAL LOCAL VALIDÉ

Après envoi d'une demande, le site affiche localement une confirmation
explicite avant rechargement : demande enregistrée, surveillance du
dossier spam, conseil d'ajouter l'adresse de La Maison Verte aux
contacts et rappel que le futur lien de confirmation/paiement initial ne
sera valable que 24 h. Le verrou anti-double-clic du formulaire est
conservé.

## 8. Forfait ménage --- IMPLÉMENTÉ LOCALEMENT / À DÉPLOYER

Règle mise en œuvre : forfait ménage **50 €**, configurable dans
l'admin, optionnel et coché par défaut. S'il est choisi, il est ajouté
au total et entre dans le calcul de l'acompte et du solde. S'il est
refusé, le client accepte explicitement les obligations de ménage avec
version et horodatage. Le montant historique proposé est conservé avec
la réservation même lorsque l'option n'est pas choisie.

Le contrat V1.2 détaille les obligations de ménage. Les versions V1.1 et
V1.2 sont archivées et `contrat-location.pdf` correspond à la V1.2
utilisée par le site. Le livret et l'admin ont été adaptés. Le backend
recalcule le montant de manière autoritaire.

La migration ménage et ses politiques RLS owner-only ont été exécutées
et validées en production. L'implémentation finale est incluse dans
`cd07bff`. Contrôles : **281/281 tests**, build Vite OK et dépôt propre
après commit.

Reste : déploiement groupé après autorisation explicite puis validation
fonctionnelle en production.

## 9. Serviettes --- HARMONISÉES LOCALEMENT / À DÉPLOYER

Désormais fournies : **1 grande 70×140 cm + 1 petite 33×50 cm par
personne**. Le lot éditorial du 24/09/2026 a harmonisé cette information
sur le site et dans le livret. Les plateformes externes restent à
vérifier.

## 10. Congélateur et sèche-cheveux --- CONFIRMÉS / HARMONISÉS LOCALEMENT

Présence réelle confirmée pour les deux équipements. Le lot éditorial du
24/09/2026 a remplacé « Mini congélateur » par « Congélateur » sur le
site et ajouté le congélateur à l'inventaire cuisine du livret. Le
sèche-cheveux était déjà cohérent sur le site et dans le livret. Les
plateformes externes restent à vérifier.

## 11. Déchets / tri --- HARMONISÉ LOCALEMENT / À DÉPLOYER

La **poubelle de tri** est désormais indiquée sur le site et dans le
livret. Les consignes existantes sur les conteneurs près du parking du
Monument aux Morts sont conservées. Des compléments locaux (verre, jours
de collecte, signalétique) pourront être ajoutés seulement s'ils sont
utiles et vérifiés.

## 12. Plan parking / accès --- INTÉGRÉ AU LIVRET LOCALEMENT / INFORMATIONS D'ARRIVÉE À COMPLÉTER

Deux plans sources sont désormais utilisés dans le livret : -
`public/livret/plan parking 4.png` : plan général Arreau et environs ; -
`public/livret/plan parking 3.png` : plan détaillé centre-bourg, accès
et stationnements.

Règle impérative : ces images sources doivent être conservées telles
quelles. Elles sont intégrées comme images dans le livret sans
régénération, retouche ni réinterprétation.

Une nouvelle page **« Accès & stationnement »** a été ajoutée au livret
entre « Informations pratiques » et « Découvrir les vallées ».

Elle présente : - la situation générale d'Arreau au carrefour des
vallées d'Aure et du Louron ; - l'accès à La Maison Verte dans l'impasse
piétonne ; - l'approche possible par la rue de la Coutellerie pour
charger/décharger ; - l'avertissement concernant l'impossibilité d'y
faire demi-tour ; - les parkings gratuits proches, notamment Monument
aux Morts et église Notre-Dame.

Le sommaire du livret a été actualisé et la pagination décalée jusqu'à
la page 10.

Validation locale : - rendu visuel de la page parking : **OK** ; - rendu
du sommaire/pagination : **OK** ; - `git diff --check` : **OK** ; -
build Vite (`npm run build`) : **OK** ; - commit local `87cf636` ; non
poussé.

Le rappel avant séjour J-2 réutilise désormais les informations
pratiques d'arrivée dans le lot `cd07bff`.

Reste : valider le rendu et le parcours en production après déploiement.

## 13. Livret EN / ES --- À FAIRE

Créer versions papier anglaise et espagnole, synchronisées avec le
français. Stabiliser d'abord autant que possible Wi-Fi, serviettes,
boîte à clés, ménage, parking, tri, téléphone/WhatsApp et équipements.

## 14. Site EN / ES --- DÉCISION PRISE / À IMPLÉMENTER

Décision V4.8 : - traduire l'ensemble du **site public** en anglais et
espagnol ; - inclure formulaire de réservation, guide et livret web ; -
conserver l'**admin uniquement en français** ; - utiliser de vraies
versions localisées et non un simple bouton de traduction automatique
; - prévoir des URLs/langues distinctes, un sélecteur FR/EN/ES,
`hreflang`, métadonnées et SEO adaptés ; - conserver les différentes
langues synchronisées lors des évolutions futures.

## 15. Nouveau lien Airbnb --- AUDITÉ / LIEN STABLE CORRECT

L'audit des ZIP frais `src`, `netlify` et `public` a retrouvé l'URL
stable `https://www.airbnb.fr/rooms/1085595615567954443` dans le code
public et n'a pas détecté d'ancien lien concurrent dans le périmètre
audité. Les plateformes externes restent hors de ce contrôle.

## 15 bis. Avis directs du site --- RÉACTIVÉS LOCALEMENT / À DÉPLOYER

Décision révisée le 23/09/2026 : **conserver les avis directs laissés
sur le site**. Ils ont une valeur particulière pour les réservations
sans plateforme : ils peuvent rassurer les visiteurs sur l'existence
réelle du logement et du site de réservation directe.

État du code : - le mécanisme `guest_reviews` et le formulaire d'avis
existent déjà ; - le bloc « Avis clients La Maison Verte » est conservé
dans `MaisonVerte.jsx` derrière `ENABLE_SITE_REVIEWS` et est
actuellement désactivé temporairement ; - le livret contient déjà un
bloc « Avis Site » et référence `public/livret/qr-site-avis.svg`.

Réalisé localement le 24/09/2026 : `ENABLE_SITE_REVIEWS = true`, le
cadre Avis Site est donc réactivé. Le QR Avis Site reste à conserver. La
modération/publication et le rendu en production devront être vérifiés
après déploiement. Le bloc Booking affiche désormais **9,5/10 --- 50
expériences vécues**.

## 16. PanneauPocket Arreau / Scoop.it Vallée d'Aure-Louron --- À ÉTUDIER

Vérifier les URLs exactes, actualité, fiabilité et intérêt. Emplacement
pressenti : guide local/livret plutôt que page commerciale principale.

## 17. Admin --- Clients : Ajouter client

Ajouter bouton **Ajouter client** avec création : - sans réservation ; -
ou associée à une réservation.

Avant implémentation : - vérifier modèle `customers`, déduplication,
relations `booking_requests`, champs CRM et éventuel opt-in marketing
; - ne pas créer de doublon lorsqu'un même client réserve plusieurs fois
; - vérifier ce qui doit être accessible au rôle housekeeping ; - ne
jamais exposer d'information financière au housekeeping ; - faire
appliquer les droits côté backend, pas seulement par masquage de bouton
; - conserver l'historique métier si un compte utilisateur est
désactivé/supprimé.

## 18. Admin --- Réservations : email + téléphone

Ajouter colonnes **Email** et **Téléphone**.

Vérifier : - source des données ; - responsive ; - tri/recherche si
pertinent ; - droits d'accès ; - cohérence avec la fiche client ; -
visibilité housekeeping uniquement si utile à son rôle opérationnel ; -
aucune donnée financière supplémentaire exposée au housekeeping.

Le téléphone est explicitement considéré comme une information
importante pour le rôle d'accueil.

## 18 bis. Clients fidèles, contacts supplémentaires et historique voyageurs --- ÉVOLUTION FUTURE

### État actuel à conserver en tête

Le projet possède déjà une table `customers`, des rattachements
explicites par `customer_id` et des mécanismes de rapprochement
utilisant notamment l'email, le téléphone et, selon les chemins, le
nom/prénom.

L'audit réalisé en V4.8 montre toutefois que la notion de **client
fidèle** n'est pas encore suffisamment fiable pour être considérée comme
entièrement automatique :

-   `booking_count` existe et est utilisé dans l'admin pour identifier
    les clients fidèles, mais son alimentation automatique au fil des
    séjours n'est pas démontrée comme exhaustive ;
-   une demande issue du formulaire public crée d'abord une
    `booking_request` avec les coordonnées du réservataire et n'est pas
    nécessairement rattachée immédiatement et durablement à un
    `customer_id` ;
-   les rapprochements par email/téléphone permettent déjà de retrouver
    une partie de l'historique, mais ils ne couvrent pas les autres
    personnes ayant réellement participé au séjour.

### Évolution future souhaitée

Mettre en place une reconnaissance automatique et fiable des clients
ayant déjà eu une relation avec La Maison Verte, sans créer de doublons
ni de faux rapprochements.

Distinguer explicitement :

-   **a déjà réservé** : personne ayant été réservataire principal d'une
    réservation antérieure ;
-   **a déjà séjourné** : personne identifiée comme ayant participé à un
    séjour, même si elle n'en était pas le réservataire principal.

Cette distinction doit permettre, par exemple, qu'un conjoint, un ami ou
un membre de la famille ajouté comme contact lors d'un premier séjour
puisse être reconnu ultérieurement lorsqu'il effectue lui-même une
réservation.

### Coordonnées principales et supplémentaires

La réservation reste liée à un **email principal obligatoire** et à un
**téléphone principal obligatoire**, qui constituent les coordonnées de
référence du réservataire.

Prévoir ultérieurement la possibilité d'associer **0 à n coordonnées
supplémentaires** au séjour :

-   emails supplémentaires : destinataires des communications relatives
    au séjour lorsque cela est prévu ;
-   téléphones supplémentaires : contacts de secours utilisables
    manuellement, notamment si le téléphone principal ne répond pas.

Ne pas figer le modèle avec des colonnes `email_2`, `email_3`,
`phone_2`, `phone_3`. Préférer une structure dédiée permettant
d'associer plusieurs contacts/coordonnées à une réservation ou à un
client, avec type, rôle et caractère principal ou secondaire.

Avant implémentation, définir précisément les règles de normalisation,
déduplication et rapprochement (email, téléphone et identité) afin
d'éviter qu'une simple ressemblance ne fusionne deux personnes
distinctes.

Les coordonnées supplémentaires pourront à terme contribuer à la
reconnaissance de l'historique des voyageurs, mais leur présence dans
une réservation ne devra pas, à elle seule, produire un statut de
fidélité sans règle métier explicite.

### Mini-espace séjour --- REPORTÉ

L'idée d'un accès client sécurisé permettant de consulter et
éventuellement modifier certaines informations du séjour (coordonnées,
informations d'arrivée, etc.) est conservée comme évolution possible,
mais **n'est pas à implémenter dans le lot V4.8 actuel**.

Le chantier immédiat doit rester limité aux évolutions déjà décidées,
sans transformer la gestion de l'heure d'arrivée et des communications
en espace client complet.

## 19. Accepter réservation : double clic --- À VÉRIFIER

Vérifier si double clic/deux requêtes peuvent produire double
traitement, double état, double création Stripe, double email ou autre
effet. Contrôler l'idempotence côté serveur, pas seulement l'UI.

## 20. Tarif spécial et lien Stripe --- BUG HISTORIQUE CORRIGÉ / TESTS À CONSERVER

Le problème existait historiquement mais a été corrigé.

Vérifications actuelles : - demande publique acceptée avec tarif modifié
:   le montant saisi est enregistré dans `owner_price`, puis utilisé
    côté serveur pour le Checkout ; - l'acompte de 30 % est calculé sur
    ce tarif spécial ; - le solde utilise également `owner_price` ; -
    réservation client créée depuis l'admin/calendrier : le montant
    saisi est enregistré comme total et utilisé pour Stripe ; - paiement
    manuel (`acompte`, `solde`, `total / tarif promo`, `complément`) :
    Stripe utilise le montant explicitement saisi ; - réservation
    personnelle/non-client : aucun paiement Stripe n'est attendu et les
    champs financiers sont volontairement à zéro.

Conclusion : - **pas de bug actuel démontré** ; - conserver des tests de
non-régression sur les différents chemins afin d'éviter le retour du
problème.

## 21. Sauvegardes Supabase --- DÉCISION PRISE / À CONCEVOIR TECHNIQUEMENT

Contexte : - le projet utilise le plan gratuit Supabase ; - la
plateforme ne doit donc pas être considérée comme une sauvegarde
suffisante à elle seule ; - une sauvegarde manuelle pré-V4.7 existe
(`schema.sql`, `data.sql`, `roles.sql`, SHA256).

Destination retenue : - ouvrir un **compte pCloud dédié La Maison
Verte**, distinct du compte personnel, avec une adresse email Maison
Verte ; - utiliser pCloud comme stockage hors plateforme ; - une copie
PC occasionnelle peut compléter mais n'est pas nécessaire en continu ; -
l'email sert éventuellement de notification, pas de stockage principal.

Stratégie validée : - sauvegarde automatique après événements métier
importants, avec temporisation/déduplication pour éviter plusieurs
archives quasi simultanées ; - événements cibles : nouvelle réservation
directe, paiement d'acompte, paiement du solde, remboursement,
annulation ou modification financière significative ; - les simples
changements provenant des calendriers Booking/Airbnb ne justifient pas à
eux seuls une nouvelle sauvegarde ; - sauvegarde quotidienne uniquement
s'il y a eu des changements depuis la précédente ; - bouton admin **«
Créer une sauvegarde maintenant »** pour une sauvegarde manuelle avant
migration, opération sensible ou déclaration fiscale ; - rotation,
contrôle d'intégrité/hash et procédure de restauration à prévoir.

Le déclenchement précis, le format des archives et la méthode technique
d'envoi vers pCloud restent à concevoir.

## 22. Archive Stripe --- DÉCISION PRISE / À CONCEVOIR

Conserver un historique auditable des données utiles : Payment Intents,
Checkout Sessions, Charges, Balance Transactions, Refunds, Payouts et
liens avec les réservations.

Décision : - mutualiser autant que possible le stockage avec le compte
pCloud dédié ; - éviter les sauvegardes lourdes sans nécessité ; -
prévoir surtout des exports/snapshots cohérents aux moments utiles,
notamment paiements, remboursements et clôture/déclaration fiscale ; -
permettre une sauvegarde/export manuel depuis l'admin si cela simplifie
l'exploitation.

Objectif : disposer d'une archive indépendante et exploitable, sans
chercher à recréer Stripe.

## 23. Admin --- Finance & fiscalité --- À CONCEVOIR

Créer dans l'admin propriétaire une **page dédiée « Finance & fiscalité
»** réservée à la lecture, au suivi et aux opérations financières et
fiscales de La Maison Verte. L'objectif est d'éviter de disperser ces
informations entre plusieurs écrans et d'obtenir une lecture claire,
exploitable au quotidien comme au moment des déclarations.

Cette page ne doit être accessible qu'au rôle `owner`. Elle ne doit
exposer aucune donnée financière au rôle `housekeeping`.

### 23.1 Organisation générale

Prévoir une vue par **année**, avec navigation entre les exercices et
une synthèse annuelle immédiatement lisible. À l'intérieur de l'année,
organiser les informations en trois ensembles cohérents :

1.  **Paiements et rapprochements** ;
2.  **Taxe de séjour** ;
3.  **Fiscalité / déclaration d'impôts**.

La page doit privilégier une synthèse claire en premier niveau, puis
permettre d'accéder au détail nécessaire sans surcharger l'écran.

Le registre financier servant de source doit rester **append-only** :
corrections traçables, aucun écrasement silencieux, recalcul intégral
des synthèses et sauvegarde indépendante.

### 23.2 Paiements et rapprochements

Centraliser au minimum :

-   réservation, source et dates du séjour ;
-   prix hébergement et forfait ménage ;
-   taxe de séjour distincte ;
-   acompte, solde et paiement intégral ;
-   montants effectivement encaissés ;
-   remboursements au voyageur ;
-   taxe de séjour remboursée ;
-   éventuelle somme conservée au titre des conditions d'annulation ;
-   frais Stripe ;
-   net propriétaire ;
-   payout Stripe, identifiant et date de virement ;
-   dates financières utiles ;
-   corrections et références associées.

La synthèse doit notamment permettre de lire le **CA encaissé**, les
remboursements, les frais Stripe, le net, les ventilations par
source/mois, les totaux annuels, le rapprochement
Stripe/réservations/payouts et les éventuels écarts.

Les frais Stripe restent une charge de La Maison Verte et doivent être
suivis séparément des remboursements et des sommes éventuellement
conservées au titre des conditions d'annulation.

### 23.3 Taxe de séjour

Créer un bloc dédié au suivi de la taxe de séjour, sans la confondre
avec le chiffre d'affaires de l'hébergement.

Afficher et historiser au minimum :

-   taxe calculée pour chaque réservation ;
-   taxe effectivement encaissée ;
-   taxe remboursée en cas d'annulation ;
-   montant net de taxe restant à déclarer/reverser ;
-   période de déclaration concernée ;
-   statut de la déclaration ;
-   date de déclaration ;
-   montant déclaré ;
-   date et montant du paiement/reversement ;
-   référence ou justificatif lorsqu'il existe.

La page doit permettre de préparer clairement le **paiement et la
déclaration de la taxe de séjour** auprès de la collectivité compétente,
tout en conservant l'historique des périodes déjà traitées.

Le calcul réglementaire reste géré par le moteur central défini dans
`TAXE_SEJOUR_PARAMETRAGE_ADMIN.md` ; cette page de synthèse ne doit pas
introduire un second calcul indépendant.

### 23.4 Fiscalité / déclaration d'impôts

Conserver une synthèse fiscale par année permettant de préparer puis
d'archiver la déclaration d'impôts liée à l'activité.

Centraliser :

-   année concernée ;
-   régime fiscal applicable ;
-   recettes/montants servant de base à la déclaration ;
-   déclaration concernée ;
-   cases ou lignes à utiliser ;
-   montant à déclarer ;
-   montant effectivement déclaré ;
-   date de déclaration ;
-   références, notes et justificatifs utiles.

Les cases, lignes et règles de déclaration doivent être documentées
**par année**, car elles peuvent évoluer. Une règle fiscale d'une année
ne doit pas être appliquée automatiquement à une autre sans validation.

### 23.5 Sauvegarde, exports et traçabilité

Cette page doit s'articuler avec les chantiers **Sauvegardes Supabase**
(point 21) et **Archive Stripe** (point 22), sans recréer leurs
fonctions.

Prévoir à terme, lorsque cela simplifie l'exploitation :

-   export/sauvegarde des données financières et fiscales utiles ;
-   conservation des justificatifs ou de leurs références ;
-   sauvegarde manuelle avant une déclaration fiscale ou une opération
    financière sensible ;
-   historique des corrections et validations.

L'objectif n'est pas de recréer un logiciel comptable complet, mais de
disposer dans l'admin d'un **tableau de bord financier et fiscal fiable,
lisible et auditable**, adapté à l'exploitation réelle de La Maison
Verte.

## 24. SEO / acquisition directe --- À AUDITER ET AMÉLIORER

Technique : titres, meta descriptions, canonical, sitemap, robots,
données structurées, `VacationRental`/`LodgingBusiness`, images,
performances, contenu local, coordonnées/équipements.

Miniatures : `og:image`, dimensions/ratio, image principale,
`twitter:image`, propriétés image Schema.org, indexation images, Search
Console, favicon/miniatures pertinentes. Ne pas supposer que `og:image`
seul contrôle Google.

Positionnement naturel : **réservation directe**, **de particulier à
particulier**, **sans intermédiaire**, **sans frais de plateforme**
lorsque factuellement exact, Arreau, Vallée d'Aure, Saint-Lary,
ski/randonnée selon pertinence.

Plateformes : Leboncoin, PAP, GreenGo, Sportihome ; étudier coût,
commission, visibilité, redirection, iCal, paiement, lien vers site,
intérêt. PAP est en cours d'ajout.

## 25. Responsive / mise en page --- À FAIRE

Bug observé sur portable 14" : titre « La Maison Verte » chevauche menu.
Faire revue globale : 1280, 1366, autres laptops, zoom 100/125 %, grand
desktop, tablette, mobile, orientation, header, breakpoints, polices,
menu, titres, boutons/formulaires, calendriers pertinents. Objectif :
aucune superposition/perte fonctionnelle.

## 25 bis. CONSTATS DÉJÀ VÉRIFIÉS DANS LE CODE

-   **Email de fin de séjour / remerciement : existe déjà.**
    `send-stay-review-request.js` envoie automatiquement à J+1 après le
    départ un email « Merci pour votre séjour à La Maison Verte » avec
    demande d'avis site + Google. Il faut le revoir/humaniser si
    nécessaire, pas en créer un second.
-   **Congélateur :** présence physique confirmée ; libellé «
    Congélateur » harmonisé sur le site et ajouté à l'inventaire cuisine
    du livret.
-   **Sèche-cheveux :** présence physique confirmée ; déjà cohérent sur
    le site et dans le livret.
-   **Serviettes :** fourniture harmonisée localement : 1 grande 70×140
    cm + 1 petite 33×50 cm par personne.
-   **Wi-Fi :** équipements + Schema.org + TV Ethernet commités dans
    `a8e5b4c` ; QR Wi-Fi et code `lamaisonverte65` intégrés au livret et
    validés par scan dans `87cf636` ; rappel J-2 mis à jour dans
    `cd07bff`. Restent éventuelles plateformes externes, déploiement et
    validation production.
-   **Tri :** poubelle de tri et consignes harmonisées sur le site et
    dans le livret ; conteneurs du Monument aux Morts conservés.
-   **Airbnb :** URL stable auditée dans les ZIP frais ; aucune ancienne
    URL concurrente détectée dans le périmètre local.
-   **Téléphone :** nouveau QR et lien téléphone du livret passés à
    `07 95 93 83 15` / `+33795938315`, QR testé par scan OK, commit
    `87cf636`. Le remplacement exhaustif de l'ancien numéro dans le
    reste du site, emails, SEO/Schema.org et plateformes reste à
    effectuer.
-   **Parking / accès :** nouvelle page « Accès & stationnement »
    intégrée au livret avec les deux plans sources
    `public/livret/plan parking 3.png` et
    `public/livret/plan parking 4.png` ; sommaire/pagination mis à jour
    et rendu local validé ; rappel J-2 enrichi dans `cd07bff`. Reste la
    validation production.
-   **Bouton Accepter :** le modal actuel n'a pas d'état
    `submitting`/`disabled`; le double déclenchement reste à corriger
    côté UI et à sécuriser côté serveur.
-   **Avis directs du site :** bloc public réactivé localement via
    `ENABLE_SITE_REVIEWS = true`; QR Avis Site à conserver. Booking
    affiche 9,5/10 et 50 expériences vécues.

## 26. Reliquats antérieurs à ne pas oublier

-   **Emails/doubles envois :** décision, paiement, arrivée, expiration,
    conflit externe, rappel, fin de séjour.
-   **Erreurs Supabase masquées :** distinguer zéro résultat, accès
    refusé, erreur réseau, erreur serveur.
-   **Dates/DST/iCal :** revoir seuils autour DST et risques UTC/iCal ;
    conserver robustesse des flux.
-   **Analytics :** validé avec anomalie réseau Firefox résiduelle à
    surveiller.
-   **Performance :** bundle historiquement \>500 kB ; lazy
    loading/imports dynamiques/séparation admin-public à réévaluer.
-   **Dépendances :** jamais `npm audit fix --force` sans analyse ;
    tests/build/smoke test.
-   **Artefacts Git :** nettoyage futur, faible priorité.

## 27. Checklist exhaustive V4.8

-   [x] Calendrier admin : correctif validé localement et commit
    `e79c7f2`
-   [ ] Calendrier admin : push/déploiement/validation production
-   [x] Wi-Fi : équipements + Schema.org + livret + TV Ethernet (commit
    `a8e5b4c`)
-   [x] Wi-Fi : QR/code intégrés au livret et QR testé par scan
    (`87cf636`)
-   [x] Wi-Fi : rappel J-2 mis à jour avec code de connexion (`cd07bff`)
-   [ ] Wi-Fi : vérifications externes + validation production
-   [x] Nouveau téléphone dans le code public audité + bannière contacts
    ; recherche Web externe restante
-   [x] QR téléphone régénéré/remplacé + lien livret mis à jour + scan
    validé (`87cf636`)
-   [ ] Recherche Web ancien téléphone
-   [ ] WhatsApp nouvelle ligne / double SIM / 2 comptes
-   [ ] Lien WhatsApp + QR si retenu
-   [x] Boîte à clés : procédure sans code + admin authentifié + J-2
    dynamique ; ancienne page publique et endpoint public supprimés
-   [ ] Boîte à clés : code courant à renseigner + validation production
-   [x] Heure d'arrivée : lien stable consultable/modifiable jusqu'à fin
    de séjour + récupération (`cd07bff`)
-   [x] Inventaire/audit des principaux emails du parcours
    réservation/séjour
-   [x] Contenu cible des emails clients 1 à 10 validé
-   [ ] Emails clients : harmoniser l'implémentation avec les contenus
    validés
-   [x] Fin de séjour/remerciement : mécanisme J+1 déjà existant
-   [x] Fin de séjour/remerciement : contenu cible validé
-   [ ] Fin de séjour/remerciement : implémenter retour privé + avis
    site/Google + fidélité
-   [x] Forfait ménage : 50 € optionnel + formulaire/calcul/contrat
    V1.2/livret/admin (`cd07bff`)
-   [ ] Forfait ménage : déploiement/validation production
-   [x] Serviettes : 70×140 + 33×50/personne harmonisées site/livret
-   [x] Congélateur : présence confirmée + site/livret harmonisés
-   [x] Sèche-cheveux : présence confirmée + site/livret cohérents
-   [x] Poubelle de tri : site/livret harmonisés ; compléments locaux
    éventuels seulement si utiles
-   [x] Plans parking : sources `public/livret/plan parking 3.png` et
    `public/livret/plan parking 4.png`
-   [x] Plan parking : intégré au livret + sommaire/pagination + rendu
    local validé (`87cf636`)
-   [x] Plan parking : informations d'arrivée réutilisées dans le rappel
    J-2 (`cd07bff`)
-   [ ] Plan parking : validation production
-   [ ] Livret anglais
-   [ ] Livret espagnol
-   [x] Site EN/ES : décision --- traductions complètes du public, admin
    FR
-   [x] Lien Airbnb stable audité et correct dans le périmètre local
-   [x] Avis directs du site : décision de conservation/réactivation
-   [x] Cadre Avis Site réactivé localement ; QR à conserver ;
    validation production restante
-   [ ] PanneauPocket Arreau
-   [ ] Scoop.it Vallée d'Aure-Louron
-   [ ] Admin Clients : Ajouter client avec/sans réservation
-   [ ] Admin Réservations : email
-   [ ] Admin Réservations : téléphone
-   [ ] Évolution future : fiabiliser la reconnaissance automatique des
    clients fidèles
-   [ ] Évolution future : distinguer « a déjà réservé » / « a déjà
    séjourné »
-   [ ] Évolution future : emails/téléphones supplémentaires sans modèle
    `email_2`/`phone_2`
-   [ ] Évolution future : reconnaître les autres voyageurs identifiés
    lors d'un séjour
-   [ ] Évolution future : mini-espace séjour sécurisé (reporté)
-   [ ] Bouton Accepter : double clic/idempotence
-   [x] Tarif spécial Stripe : bug historique corrigé, chemins vérifiés
    ; conserver tests
-   [ ] Paiement solde : lien durable La Maison Verte pour
    J-30/J-23/J-17/J-10
-   [ ] Paiement solde : Checkout Session Stripe fraîche créée au clic
    après contrôle serveur
-   [ ] Paiement solde : idempotence/double clic/ancien lien/déjà
    payé/annulé testés
-   [x] Paiement initial : choix acompte/intégral défini et migration
    `payment_preference` exécutée en production
-   [ ] Paiement initial : harmoniser Stripe/emails avec taxe de séjour
    et contenus validés
-   [x] Annulation : suppression du seuil J-7 + non-annulation
    automatique validées
-   [ ] Annulation/remboursement : adapter la RPC de production à la
    règle V1.5
-   [ ] Annulation : relocation après annulation gérée manuellement par
    le propriétaire
-   [x] Email interne propriétaire J-17 : contenu et déclenchement
    métier validés
-   [ ] Email interne propriétaire J-17 : implémenter lien direct vers
    la réservation
-   [x] Fidélité : fondation `CLIENTFIDELE` -10 % hébergement,
    validation serveur, règle `promotion_rules` et calcul formulaire
    validés
-   [ ] Fidélité : interface admin de paramétrage/désactivation à
    intégrer
-   [x] Taxe de séjour : fondation Supabase + moteur central serveur +
    snapshot historique par nuit validés
-   [x] Taxe de séjour : règle opérationnelle 2026 non classé ouverte
    sans expiration automatique validée en production
-   [x] Formulaire public : CLIENTFIDELE + taxe + ménage +
    acompte/intégral validés de bout en bout
-   [x] Emails de demande client/propriétaire : détail
    hébergement/remise/ ménage/taxe/total validé
-   [x] Lot 2 : suite complète **294/294**, test réel Supabase/emails
    validé, réservations de test supprimées
-   [ ] Lot 2 : commit local puis push/déploiement frontend/functions
    après autorisation explicite
-   [ ] Sauvegarde Supabase automatique +
    rotation/intégrité/restauration
-   [x] Stockage sauvegardes décidé --- compte pCloud dédié La Maison
    Verte
-   [ ] Archive Stripe automatique
-   [ ] Admin Finance & fiscalité : page owner dédiée et structurée par
    année
-   [ ] Finance : registre source append-only + synthèse annuelle
    recalculée
-   [ ] Finance : rapprochements Stripe/réservations/payouts + écarts
-   [ ] Finance : paiements, remboursements, frais Stripe et net
    propriétaire
-   [ ] Taxe de séjour : synthèse collectée/remboursée/à déclarer/à
    reverser
-   [ ] Taxe de séjour : historique des déclarations, paiements et
    justificatifs
-   [ ] Fiscalité : synthèse annuelle + régime + montants à
    déclarer/déclarés
-   [ ] Fiscalité : cases/références/justificatifs documentés par année
-   [ ] SEO technique
-   [ ] `og:image` / `twitter:image` / Schema.org images
-   [ ] Indexation images / Search Console
-   [ ] SEO réservation directe / particulier à particulier / sans
    intermédiaire
-   [ ] PAP / GreenGo / Sportihome / Leboncoin
-   [ ] Responsive titre/menu et revue multi-résolutions
-   [ ] Owner reste unique/protégé
-   [ ] Housekeeping reste profil fixe sans permissions personnalisables
-   [ ] Housekeeping : aucune donnée financière dans les nouveaux écrans
-   [ ] Housekeeping : téléphone/email opérationnels visibles seulement
    si utile
-   [ ] Communications : échanges humains séparés des emails
    automatiques
-   [ ] Communications : journaux techniques séparés
-   [ ] Notes client/propriétaire/ménage strictement séparées
-   [ ] Autorisations V4.8 contrôlées côté backend
-   [ ] Aucun retour des profils personnalisables / mode custom
-   [ ] Compte read_only historique vérifié/désactivé si encore présent
-   [ ] Désactivation/suppression utilisateur sans perte de données
    métier
-   [ ] Erreurs Supabase masquées
-   [ ] Revue DST/dates/iCal
-   [ ] Revue doubles emails
-   [ ] Bundle/performance à réévaluer
-   [ ] Dette/artefacts Git à réévaluer

## 28. POINTS RESTANT À CONFIRMER OU À DÉFINIR TECHNIQUEMENT

Les principales décisions métier sont désormais prises.

Le lot `cd07bff` a constitué la base locale du forfait ménage, du lien
stable d'heure d'arrivée, de la boîte à clés, du rappel J-2 et du
livret. Depuis, le contrat courant a évolué jusqu'à la **V1.5** et
l'architecture publique de la boîte à clés a été durcie (suppression de
la page et de l'endpoint publics). Ces éléments restent à déployer et à
valider en production.

Restent notamment les chantiers déjà inscrits dans ce document :
poursuite de la revue éditoriale des emails non encore repris ;
recherche Web externe de l'ancien téléphone ; traductions FR/EN/ES ;
avis directs ; double clic du bouton Accepter ; sauvegardes pCloud ;
archive Stripe ; page admin Finance & fiscalité ; SEO ; responsive ;
contrôles des rôles/droits et reliquats techniques. Les évolutions de
fidélité, contacts supplémentaires et mini-espace séjour restent
explicitement futures/reportées.

Aucune nouvelle évolution n'est ajoutée à ce stade.

## 28 bis. Journal de validation du lot `cd07bff`

**Commit local :**
`cd07bff — feat: finalise menage arrivee boite a cles et livret`.

Périmètre : ménage et contrat V1.2 ; lien stable d'heure d'arrivée et
récupération ; boîte à clés et code courant administrable ; emails
paiement intégral/J-30 et J-2 ; Wi-Fi J-2 ; procédure boîte à clés dans
le livret.

Validation locale du 24/09/2026 : **281/281 tests réussis** ; build Vite
production réussi ; avertissement bundle \>500 kB non bloquant ;
`git diff --check` sans anomalie de code source (avertissements CRLF et
espaces internes au PDF généré seulement) ; `git status --short` vide
après commit.

Le commit est local uniquement : aucun push Git/Netlify n'a été effectué
pour ce lot. La migration boîte à clés a déjà été exécutée explicitement
en production.

## 28 ter. Journal du lot éditorial de transition V4.8 → V4.9

Périmètre validé le 24/09/2026 : Wi-Fi 7 ; téléphone public ; serviettes
; congélateur ; sèche-cheveux ; poubelle de tri ; lien Airbnb ; avis
directs ; compteur Booking ; texte ménage du livret ; bannière contacts.

Fichiers modifiés : `public/livret/banniere-contacts.png`,
`src/pages/AppelerRedirect.jsx`, `src/pages/LivretAccueil.jsx`,
`src/pages/MaisonVerte.jsx`, `src/pages/MentionsLegales.jsx`. La
bannière contacts PNG est conservée pour le code et l'impression,
redimensionnée à 1600×580 px pour environ 735 Ko.

Validation locale : **281/281 tests réussis** ; build Vite production
réussi (230 modules, avertissement bundle \>500 kB non bloquant) ;
`git diff --check` sans erreur, avec uniquement les avertissements
LF→CRLF déjà connus.

**Commit/push : à confirmer dans ce document dès réception du retour
Git.** Ne pas inventer le hash ni considérer le déploiement comme validé
avant contrôle en production.

## 29. Méthode V4.9

Ne pas envoyer toute la V4.9 comme une unique mission de modification.
Faire d'abord un audit/lecture du code, puis des lots cohérents.
Rechercher les règles dans la documentation avant d'inventer. Pour
chaque lot : diagnostic, modification minimale, tests ciblés, suite
complète adaptée, build, `git diff --check`, revue humaine.

### Choix de l'outil

-   **PowerShell / Git / lecture directe** par défaut pour recherches,
    contrôles, petits remplacements ciblés et modifications
    déterministes ;
-   **Codex** seulement lorsque la tâche bénéficie réellement de son
    autonomie (plusieurs fichiers, automatisation, logique complexe,
    migration, refactor), afin d'éviter les demandes d'autorisation
    répétitives et les erreurs de portée ;
-   toujours relire le diff réel après une modification, quel que soit
    l'outil.

Les commits locaux peuvent être séparés ; limiter les pushes Netlify
intermédiaires. Toute écriture/migration Supabase production exige
autorisation explicite. Tout push Git déclenchant Netlify exige
autorisation explicite. Après déploiement, valider en production les
fonctions touchées.

Mettre ce document à jour après chaque décision, test, commit,
déploiement et validation. Passer à **VALIDÉ** uniquement après
vérification.

## 30. DOCUMENTS DE RÉFÉRENCE V4.9

### Référence métier utilisateurs / interfaces

`Vision_metier_droits_interfaces_utilisateurs_V4.md`

À considérer comme autorité actuelle pour : - `admin_users` ; - rôles
; - permissions ; - interface Utilisateurs ; - interface Housekeeping
; - communications ; - notes internes ; - migrations Supabase associées.

Principe : **ne pas complexifier l'outil pour des besoins
hypothétiques**.

### Référence audit / feuille de route post-V4.7

`PLAN_DIRECTEUR_AUDIT_SECURITE_EVOLUTIONS post v4.7.md`

À conserver comme source historique pour : - audit sécurité ; -
sauvegardes ; - registre fiscal ; - SEO ; - responsive ; - iCal/DST ; -
emails ; - analytics ; - performance/dette technique ; - journal des
validations V4.7.

Les statuts anciens de ce document doivent toutefois être confrontés à
l'état réel actuel avant exécution : plusieurs sujets V4.7 ont été
corrigés depuis sa rédaction.

### Règle de gouvernance documentaire

Lorsqu'une mission Codex rencontre une ambiguïté métier : 1. rechercher
d'abord dans ces documents et dans les autres documents
métier/contrat/CGV du projet ; 2. distinguer règle métier et simple état
technique historique ; 3. ne pas réintroduire une conception
explicitement remplacée ; 4. demander une décision uniquement si les
documents ne permettent pas de trancher.
