# CHANGELOG

Historique des versions importantes du projet **La Maison Verte – Arreau**.

---

# v1.0.0 - 27/06/2026

## Statut

✅ Version stable  
✅ Site fonctionnel en production  
✅ Base de départ officielle pour le suivi des versions

Cette version correspond à l'état actuel du site au moment où le suivi de version est formalisé.

---

## Site public

- Site officiel de réservation directe pour **La Maison Verte – Arreau**
- Présentation complète de la maison
- Informations pratiques pour les voyageurs
- Pages et sections optimisées pour mobile et PC
- Galerie photos
- Mise en avant des avis externes Booking / Airbnb / Google
- Page guide / activités autour des vallées d'Aure et du Louron
- SEO optimisé
- Données structurées JSON-LD
- OpenGraph / partage réseaux sociaux
- Design responsive

---

## Réservation

- Calendrier public
- Demande de réservation en ligne
- Processus demande → acceptation/refus → paiement acompte → confirmation
- Acompte de 30 %
- Paiement du solde à J-30
- Gestion des statuts de réservation
- Affichage des informations client
- Gestion des messages clients
- Contrat de location
- Livret d'accueil
- Consentement / acceptation des conditions
- Emails automatiques liés aux étapes de réservation

---

## Paiement

- Intégration Stripe LIVE
- Paiement acompte
- Paiement solde
- Suivi des paiements dans l'administration
- Affichage des montants payés
- Suivi des frais Stripe
- Suivi du net Stripe
- Suivi des payouts / virements
- Prise en compte des tests remboursés et frais associés

---

## Administration

- Interface administrateur
- Connexion administrateur
- Tableau de bord
- Gestion des demandes
- Gestion des réservations
- Gestion des clients
- Gestion des paiements
- Calendrier administrateur
- Création de réservations personnelles
- Blocage / déblocage de périodes
- Commentaires internes
- Statistiques visiteurs
- Affichage des arrivées / départs / informations utiles
- Adaptations successives pour améliorer la lisibilité mobile et PC

---

## Calendriers

- Calendrier public
- Calendrier administrateur
- Import ICS Airbnb / Booking
- Export ICS du site
- Gestion des réservations externes
- Affichage de la source des réservations externes
- Améliorations d'affichage : semaine commençant le lundi, calendrier plus grand, meilleure lisibilité

---

## Emails / communication

- Envoi des demandes de réservation
- Email d'acceptation
- Email de refus
- Email de confirmation
- Email de fin de séjour
- Demande d'avis Google
- Message fidélité pour anciens clients
- Utilisation de Resend

---

## Clients

- Import / suivi des clients historiques
- Normalisation des téléphones
- Fiche client dans l'administration
- Historique des réservations
- Coordonnées client accessibles côté admin

---

## SEO / visibilité

- Optimisation du contenu
- Titres H1 / H2
- Textes orientés location directe
- Données structurées `VacationRental`
- OpenGraph
- Page guide local
- Google Search Console configurée
- Google Business Profile lié
- Images renommées et optimisées progressivement

---

## Statistiques

- Première page de statistiques visiteurs
- Comptage des visites
- Volonté d'exclure les visites propriétaire
- Évolution prévue vers des statistiques plus exploitables :
  - origine géographique
  - pages vues
  - liens cliqués
  - comportement de visite
  - graphiques

---

## Corrections et stabilisation déjà réalisées

- Corrections d'affichage mobile
- Corrections sur les cartes de réservation
- Ajustements lisibilité texte / fonds / photos
- Corrections liées à l'impression
- Corrections calendrier
- Corrections emails
- Corrections paiements et frais Stripe
- Corrections Git / Netlify après incident de dépôt local
- Vérification build / GitHub / Netlify
- Nettoyage du dépôt Git (suppression définitive de `dist` du suivi Git)
- Mise en place du versioning du projet
- Création des fichiers `README.md`, `CHANGELOG.md`, `TODO.md` et `IDEES.md`
- Amélioration du formulaire de réservation :
  - bouton toujours cliquable
  - message expliquant les informations manquantes
  - protection contre les doubles envois


---



---

## Architecture

- React + Vite
- Netlify
- Supabase
- Stripe
- Resend
- GitHub


## Remarque

Cette version est la première version officiellement documentée avec un suivi clair.  
Les évolutions futures partiront de cette base stable.


---

## Version de référence

Cette version constitue la première référence stable du projet.

Toute évolution future devra préserver la compatibilité avec les réservations existantes, les données clients et l'administration.

Sauvegarde de référence :

`MaisonVerte_v1.0.0_2026-06-27_STABLE.zip`
