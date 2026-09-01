# V4.7-A Atomic Direct Bookings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher atomiquement le chevauchement de deux occupations locales bloquantes et retourner un conflit métier explicite avant tout email.

**Architecture:** Une contrainte d’exclusion GiST partielle constitue l’autorité finale sur `booking_requests`. Une RPC `service_role` réalise le pré-check des demandes locales, blocs calendrier et occupations externes connues, réclame le fingerprint dans la même transaction, puis insère la demande `pending`; la fonction Netlify traduit le résultat pour le frontend.

**Tech Stack:** PostgreSQL/Supabase, Netlify Functions, React, Node test runner, Vite.

**Spec:** Mission utilisateur V4.7-A et design V4.7 validé dans cette conversation.

## Global Constraints

- Sources locales fermées : `NULL`, `direct`, `admin_client`, `admin_personal`.
- Sources externes connues et hors contrainte : `booking_import`, `airbnb_import`.
- Statuts bloquants : `pending`, `accepted`, `deposit_paid`, `paid`, `fully_paid`, `confirmed`.
- Sémantique des périodes : `[start_date, end_date)`.
- Aucun conflit externe persistant, email externe, changement Stripe/analytics, commit, push ou déploiement.

---

### Task 1: Contrats serveur et frontend

**Files:**
- Create: `tests/public-booking-atomic.test.js`
- Modify: `tests/public-booking-submission.test.js`
- Create: `netlify/functions/_lib/public-booking-request.js`
- Modify: `netlify/functions/send-booking-request.js`
- Modify: `src/utils/publicBookingSubmission.js`
- Modify: `src/pages/MaisonVerte.jsx`

**Interfaces:**
- Consumes: booking validé et fingerprint SHA-256 existant.
- Produces: résultats `created`, `duplicate`, `date_conflict`; HTTP 409 avec `DUPLICATE_REQUEST` ou `DATE_CONFLICT`.

- [ ] Écrire les tests échouants : mapping des résultats RPC, absence d’email hors `created`, message frontend distinct et conservation des coordonnées.
- [ ] Exécuter les tests ciblés et constater l’échec lié aux comportements absents.
- [ ] Extraire l’orchestration serveur minimale et remplacer le `SELECT`/`INSERT` séparé par la RPC.
- [ ] Adapter le frontend pour recharger le calendrier et réinitialiser uniquement les dates en cas de `DATE_CONFLICT`.
- [ ] Réexécuter les tests ciblés jusqu’au vert.

### Task 2: Invariant PostgreSQL et RPC atomique

**Files:**
- Create: `supabase/migrations/202609010001_v47a_atomic_direct_bookings.sql`
- Create: `tests/v47a-migration.test.js`
- Create: `docs/operations/v47a-direct-booking-overlap-precheck.sql`

**Interfaces:**
- Consumes: `claim_public_rate_limit`, `booking_requests`, `calendar_blocks`, `external_occupancies`.
- Produces: contrainte `booking_requests_no_overlapping_local_blockers` et RPC `create_public_booking_request_atomic(jsonb,text,timestamptz)` réservée au `service_role`.

- [ ] Écrire les tests échouants du contrat de migration et du pré-check non destructif.
- [ ] Exécuter les tests ciblés et constater l’absence de la migration/RPC.
- [ ] Ajouter le pré-check des sources et chevauchements, puis la contrainte d’exclusion GiST sans `btree_gist`.
- [ ] Ajouter la RPC : validation, contrôles `[)`, claim, insertion `pending`, résultat métier et rollback naturel sur erreur.
- [ ] Ajouter les droits `REVOKE`/`GRANT` et documenter la réversibilité.
- [ ] Réexécuter les tests ciblés jusqu’au vert.

### Task 3: Couverture des écritures et non-régressions

**Files:**
- Modify: `tests/v47a-migration.test.js`
- Modify: `tests/public-booking-atomic.test.js`

**Interfaces:**
- Consumes: contrainte/RPC et endpoint des tâches précédentes.
- Produces: couverture des cas A–L accessible sans base locale et scénario SQL exécutable sur un PostgreSQL de test.

- [ ] Ajouter les cas périodes séparées, chevauchantes, adjacentes, mise à jour, transition de statut, source externe, bloc et occupation externe connue.
- [ ] Ajouter un scénario de deux transactions réelles, conditionné à une base PostgreSQL de test explicitement fournie.
- [ ] Exécuter les tests ciblés; signaler sans ambiguïté si l’environnement local ne permet pas le scénario PostgreSQL réel.
- [ ] Vérifier que les migrations Stripe V4.5 restent inchangées et compatibles avec le prédicat.

### Task 4: Vérification finale sans commit

**Files:**
- Review: tous les fichiers modifiés de V4.7-A.

**Interfaces:**
- Consumes: implémentation complète.
- Produces: preuves fraîches de test/build/syntaxe/diff et rapport final.

- [ ] Exécuter les tests V4.7-A ciblés.
- [ ] Exécuter `npm test`.
- [ ] Exécuter `npm run build`.
- [ ] Exécuter `node --check` sur toutes les fonctions Netlify JavaScript.
- [ ] Exécuter `git diff --check`, scanner les secrets et vérifier l’absence de fichier V4.7-B.
- [ ] Examiner le diff complet et le statut Git; ne rien committer, pousser ou déployer.
