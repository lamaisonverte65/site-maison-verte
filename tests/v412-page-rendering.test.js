import test from 'node:test';
import assert from 'node:assert/strict';
import { pageFingerprint } from './helpers/pageFingerprint.js';

// Le DOM complet de la V4.12 n'est plus une référence valide : la V4.15
// modifie volontairement l'accueil (navigation et contenus FR/EN/ES).
// Contrôler le HTML français réellement rendu côté serveur plutôt qu'un
// hash historique, tout en gardant les invariants du parcours visiteur.
test('MaisonVerte: sections, navigation et réservation conservées en rendu serveur français', async () => {
  const { html } = await pageFingerprint('MaisonVerte');

  for (const section of [
    'accueil', 'presentation', 'galerie', 'avis', 'faq',
    'reservation', 'activites', 'meteo', 'contact',
  ]) {
    assert.match(html, new RegExp(`<section\\b[^>]*\\bid="${section}"`), `Section manquante : ${section}`);
  }

  // Le français demeure la langue par défaut du rendu serveur.
  assert.match(html, /La Maison Verte/);
  assert.match(html, /Location de vacances dans les Hautes-Pyrénées/);
  assert.match(html, /Meublé de tourisme classé 3 étoiles/);

  // Navigation partagée et accès aux trois langues.
  assert.match(html, /id="public-language-header"/);
  for (const language of ['fr', 'en', 'es']) {
    assert.match(html, new RegExp(`<option value="${language}"`));
  }
  assert.match(html, /href="#reservation"/);
  assert.match(html, /href="#galerie"/);

  // Le formulaire et l'acceptation du contrat ne disparaissent pas.
  assert.match(html, /id="formulaire-reservation"/);
  assert.match(html, /class="booking-guest-grid"/);
  assert.match(html, /class="contract-acceptance-checkbox"/);
  assert.match(html, /href="\/documents\/contrat-location\.pdf"/);

  // Le classement et son illustration restent présents.
  assert.match(html, /src="\/classement\/panonceau-meuble-tourisme-3-etoiles-2026\.png"/);
});

// La V4.15 modifie intentionnellement le DOM du livret (sélecteur global,
// images cliquables et textes localisés). Préserver les invariants essentiels.
test('LivretAccueil: 11 pages A4 et structure multilingue en rendu serveur', async () => {
  const { html } = await pageFingerprint('LivretAccueil');
  assert.match(html, /data-livret-lang="fr"/);
  assert.match(html, /id="public-language-header"/);
  assert.match(html, /<option value="fr"/);
  assert.match(html, /<option value="en"/);
  assert.match(html, /<option value="es"/);
  const pages = html.match(/<section\b[^>]*class="livret-page(?:\s|")/g) || [];
  assert.equal(pages.length, 11, `Nombre de pages du livret : ${pages.length}`);
  assert.match(html, /id="boite-a-cles"/);
  assert.match(html, /<img\b[^>]*role="link"/);
  assert.match(html, /src="\/livret\/qr-guide\.svg"/);
  assert.match(html, /src="\/livret\/banniere-contacts-fr\.webp"/);
});
