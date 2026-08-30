# Vision métier — Droits et interfaces utilisateurs V4

## 1. Objet du document

Ce document fixe la **vision métier actuelle de référence** concernant les rôles utilisateurs, les droits d’accès et les interfaces d’administration de La Maison Verte.

Il remplace, pour ces sujets, les conceptions plus anciennes prévoyant une gestion très configurable des profils et permissions.

Principe directeur :

> **Ne pas complexifier l’outil pour des besoins hypothétiques.**
> L’interface actuelle doit répondre aux usages réels : un propriétaire et un ou plusieurs comptes ménage/accueil.

L’architecture technique peut rester extensible afin d’ajouter plus tard un nouveau rôle par évolution du code si un besoin réel apparaît.

---

# 2. Modèle utilisateur actuel

## 2.1 Propriétaire (`owner`)

Le propriétaire est le rôle d’autorité maximal.

Il dispose de l’ensemble des fonctions nécessaires à l’administration du site, notamment :

- gestion des réservations ;
- gestion des clients ;
- gestion des calendriers ;
- gestion des tarifs ;
- gestion des paiements ;
- gestion des remboursements ;
- gestion des communications ;
- gestion des utilisateurs ;
- gestion des comptes ménage ;
- accès aux données financières ;
- accès aux fonctions techniques nécessaires à l’exploitation.

Le rôle propriétaire est un **rôle système protégé**.

Il ne doit pas pouvoir être :

- créé par une opération utilisateur générique ;
- supprimé par une opération générique ;
- désactivé si cela laisse le système sans propriétaire ;
- remplacé implicitement par un autre rôle ;
- obtenu par modification de permissions.

Le transfert de propriété, s’il est utilisé, doit relever d’une procédure spécifique et sécurisée.

---

## 2.2 Ménage / accueil (`housekeeping`)

Le rôle ménage est un **profil système fixe**.

Plusieurs comptes ménage peuvent exister simultanément.

Le propriétaire doit pouvoir créer un deuxième ou troisième compte ménage si nécessaire.

Les droits du rôle ne sont pas configurables depuis l’interface.

### Informations visibles

Le ménage peut consulter les informations utiles à ses missions d’accueil, de ménage et de départ :

- calendrier ;
- arrivées ;
- départs ;
- nom et prénom du client ;
- téléphone du client ;
- email si utile ;
- nombre de personnes ;
- informations enfants ;
- lit bébé ;
- informations pratiques du séjour ;
- heure d’arrivée ;
- heure de départ particulière lorsqu’elle existe ;
- messages du client ;
- réponses/messages du propriétaire au client ;
- notes internes propriétaire destinées au ménage ;
- notes opérationnelles saisies par le ménage.

Le **téléphone** est une information particulièrement importante pour le rôle d’accueil.

### Informations financières

Le ménage ne doit voir **aucune information financière**.

Sont notamment exclus :

- prix du séjour ;
- acompte ;
- montant du solde ;
- statut payé / non payé ;
- frais Stripe ;
- remboursements ;
- payouts ;
- chiffre d’affaires ;
- statistiques financières ;
- détail des paiements ;
- tarifs administratifs.

Si un problème de paiement a une conséquence opérationnelle, le propriétaire transmet uniquement l’instruction utile au ménage par une note interne, téléphone ou autre moyen de contact adapté.

### Actions autorisées

Le ménage peut modifier uniquement les informations directement liées à son rôle opérationnel :

- heure d’arrivée ;
- heure de départ lorsqu’elle doit être renseignée ou corrigée ;
- sa propre note ménage / opérationnelle.

Ces mutations doivent être autorisées explicitement côté backend.

Le rôle ménage ne doit pas recevoir une permission générale de modification d’une réservation.

---

# 3. Communications

## 3.1 Interface propriétaire

Le propriétaire doit disposer d’une interface **Communications / Boîte de réception** permettant de regrouper au même endroit les échanges liés au client.

L’objectif est de retrouver facilement l’historique de la relation client sans devoir parcourir plusieurs écrans.

Cette interface peut regrouper :

- messages envoyés par le client ;
- réponses/messages envoyés par le propriétaire au client ;
- informations de communication utiles liées à la réservation.

Les emails automatiques peuvent être accessibles au propriétaire comme éléments d’historique, mais ils doivent être **clairement distingués visuellement** de la conversation humaine afin de ne pas noyer les échanges client/propriétaire.

Les journaux purement techniques restent séparés.

## 3.2 Interface ménage

Le ménage peut consulter :

- les messages du client ;
- les réponses/messages du propriétaire au client.

Il ne voit pas :

- les journaux techniques ;
- les emails automatiques en tant qu’historique système ;
- les données financières.

---

# 4. Notes internes

Les notes internes ne doivent pas être confondues avec les communications client.

Les catégories doivent rester distinctes.

## 4.1 Note propriétaire destinée au ménage

Le propriétaire peut laisser une note opérationnelle destinée au ménage.

Exemples :

- instruction particulière pour l’accueil ;
- problème à surveiller ;
- information pratique ;
- consigne liée à un séjour.

Cette note reste interne.

## 4.2 Note ménage

Le ménage peut saisir sa propre note opérationnelle.

Cette note doit rester séparée :

- du message du client ;
- de la réponse du propriétaire au client ;
- de la note propriétaire destinée au ménage.

## 4.3 Principe

Une interface peut regrouper visuellement certaines informations, mais les données métier doivent rester séparées afin d’éviter qu’une note interne soit envoyée ou affichée au client par erreur.

---

# 5. Profils personnalisés

## 5.1 Décision actuelle

L’interface d’administration ne doit **pas** permettre de créer un profil arbitraire avec une combinaison personnalisée de permissions.

Il n’est actuellement pas nécessaire de proposer :

- un éditeur de permissions ;
- des cases à cocher pour chaque droit ;
- un mode de permissions personnalisé ;
- un profil créé librement par le propriétaire.

## 5.2 Évolution future

Cette simplification ne bloque pas les évolutions futures.

Si un besoin réel apparaît, un nouveau rôle pourra être ajouté par modification du code.

Exemple possible :

`manager`

Ce rôle pourrait disposer de droits proches du propriétaire sans être propriétaire.

Il devra alors être :

1. défini métierment ;
2. implémenté explicitement ;
3. autorisé côté backend ;
4. représenté dans l’interface ;
5. testé ;
6. audité.

Il n’est pas nécessaire d’anticiper aujourd’hui ce besoin hypothétique.

---

# 6. Rôle `read_only`

Le rôle `read_only` n’est pas un besoin métier actuel.

Il ne doit plus faire partie des profils proposés par l’interface.

Le compte `read_only` actuellement existant doit être traité avec prudence :

1. vérifier qu’il n’est plus utilisé ;
2. vérifier qu’aucune donnée métier importante n’en dépend ;
3. le désactiver en priorité ;
4. vérifier que la désactivation supprime bien tout accès ;
5. envisager ensuite sa suppression propre si elle est réellement utile.

La suppression d’un compte utilisateur ne doit jamais supprimer :

- réservation ;
- client ;
- paiement ;
- communication ;
- historique métier.

La désactivation est préférable à une suppression immédiate.

---

# 7. Gestion des comptes ménage

Le propriétaire peut :

- créer un nouveau compte ménage ;
- désactiver un compte ménage ;
- réactiver un compte ménage si nécessaire ;
- éventuellement supprimer définitivement un compte devenu inutile, après contrôle.

La création d’un compte ménage ne doit pas donner accès à un choix libre de permissions.

Le nouveau compte reçoit les droits système fixes du rôle `housekeeping`.

---

# 8. Principe d’autorisation

L’interface ne constitue jamais une protection suffisante.

Une action interdite doit être refusée côté serveur même si :

- un bouton caché est appelé manuellement ;
- une requête est construite directement ;
- le frontend est modifié ;
- une ancienne URL ou fonction est appelée.

Les contrôles backend doivent correspondre au rôle réel.

Dans le modèle actuel :

- `owner` : autorité complète prévue par le système ;
- `housekeeping` : ensemble fixe d’actions opérationnelles ;
- autres rôles : non créables depuis l’interface actuelle.

---

# 9. Décisions historiques remplacées

Les conceptions suivantes doivent être considérées comme **anciennes ou différées** pour la version actuelle :

| Ancienne conception | Décision actuelle |
|---|---|
| Profils personnalisables | Non proposés |
| Permissions choisies par cases | Supprimées de l’interface |
| Mode `custom` pour créer librement un profil | Pas de besoin actuel |
| Mode `none` utilisateur | Pas de besoin actuel |
| Gestionnaire standard | Différé jusqu’à besoin réel |
| `read_only` standard | Abandonné pour l’usage courant |
| Housekeeping voit le statut du solde | Supprimé |
| Housekeeping ne modifie que sa note | Évolué : arrivée/départ aussi modifiables |
| Notes internes mélangées aux communications | Interdit |
| Communication dispersée | Centralisation souhaitée pour le propriétaire |

---

# 10. Conséquence pour `admin_users`

Avant toute migration Supabase définitive, le modèle `admin_users` doit être confronté à cette vision simplifiée.

La conception précédente basée sur :

- `permission_mode = role | custom | none` ;
- profils arbitraires ;
- hiérarchies générales de permissions ;

doit être réévaluée.

Le besoin métier actuel peut probablement être satisfait par un modèle beaucoup plus simple :

```text
owner
→ droits système complets et protégés

housekeeping
→ droits système fixes et protégés
```

Toute complexité supplémentaire doit être justifiée par un besoin réel avant d’être conservée.

---

# 11. Principe d’évolution

La règle générale pour les utilisateurs est :

> Construire aujourd’hui uniquement ce qui est utile aujourd’hui, tout en conservant un code suffisamment propre pour ajouter demain un nouveau rôle si un besoin réel apparaît.

Ce document constitue la référence métier actuelle pour les futures décisions concernant :

- `admin_users` ;
- rôles ;
- permissions ;
- interface Utilisateurs ;
- interface Housekeeping ;
- communications ;
- notes internes ;
- migrations Supabase associées.
