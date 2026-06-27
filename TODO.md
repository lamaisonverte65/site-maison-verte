# TODO

Liste des évolutions décidées ou sérieusement envisagées pour les prochaines versions.

Le principe retenu : **simple, efficace, paramétrable manuellement, sans usine à gaz**.

---

# Prochaine évolution prioritaire : administration multi-utilisateurs

## Utilisateurs et accès

- [ ] Ajouter une page `Utilisateurs`
- [ ] Créer plusieurs comptes administrateurs
- [ ] Afficher la liste des utilisateurs
- [ ] Ajouter / modifier / désactiver un utilisateur
- [ ] Gérer le statut actif / inactif
- [ ] Permettre la réinitialisation du mot de passe par email
- [ ] Ne jamais stocker ou communiquer les mots de passe en clair
- [ ] Prévoir la suppression ou désactivation des anciens accès

## Permissions

Objectif : tout paramétrer manuellement avec des cases à cocher.

- [ ] Voir calendrier
- [ ] Créer réservation
- [ ] Modifier réservation
- [ ] Annuler réservation
- [ ] Bloquer / débloquer des dates
- [ ] Voir clients
- [ ] Modifier clients
- [ ] Supprimer clients
- [ ] Voir paiements
- [ ] Modifier paiements
- [ ] Rembourser Stripe
- [ ] Voir statistiques
- [ ] Modifier paramètres
- [ ] Gérer utilisateurs

## Sécurité propriétaire

- [ ] Empêcher d'avoir zéro propriétaire actif
- [ ] Empêcher de retirer les droits du dernier compte capable de gérer les utilisateurs
- [ ] Prévoir une possibilité de transfert de propriété si la maison et le site sont un jour vendus
- [ ] Sécuriser les droits côté Supabase, pas seulement côté interface React

---

# Journal des actions

À envisager après la gestion des utilisateurs.

- [ ] Enregistrer les actions importantes
- [ ] Qui a fait quoi
- [ ] À quelle date
- [ ] Sur quelle réservation ou quel client
- [ ] Garder une trace des modifications sensibles

Exemples :
- réservation créée
- réservation modifiée
- prix modifié
- paiement validé
- remboursement effectué
- client modifié
- accès utilisateur créé / désactivé

---

# Statistiques visiteurs

Amélioration prévue de la page statistiques.

- [ ] Ne plus compter les visites propriétaire
- [ ] Nombre total de visites
- [ ] Visites du jour
- [ ] Visites sur 7 jours
- [ ] Pages consultées
- [ ] Liens cliqués
- [ ] Origine approximative des visiteurs
- [ ] Pays / région si disponible
- [ ] Graphiques simples
- [ ] Filtre par période

Remarque : les données géographiques peuvent être faussées par VPN, réseau mobile ou proxy.

---

# Administration / confort

- [ ] Améliorer encore la lisibilité mobile si besoin
- [ ] Vérifier les cartes réservation sur mobile
- [ ] Vérifier l'impression des documents
- [ ] Améliorer le tableau de bord avec les informations utiles du jour
- [ ] Regrouper les évolutions avant déploiement pour limiter le nombre de deploys

---

# Méthode de travail

- [ ] Continuer les sauvegardes régulières du dossier de travail
- [ ] Nommer les sauvegardes avec version + date + statut
- [ ] Tester en local avant déploiement
- [ ] Regrouper les évolutions par version
- [ ] Déployer immédiatement uniquement les correctifs urgents
- [ ] Mettre à jour `CHANGELOG.md` à chaque version stable
