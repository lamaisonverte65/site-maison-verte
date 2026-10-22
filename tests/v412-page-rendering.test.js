import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pageFingerprint } from './helpers/pageFingerprint.js';

const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/v412-page-fingerprints.json', import.meta.url), 'utf8'));

// La page d'accueil n'a pas changé : conserver la référence DOM V4.12.
test('MaisonVerte: extraction preserves the rendered DOM, classes and inline styles', async () => {
  const result = await pageFingerprint('MaisonVerte');
  assert.equal(result.hash, baseline.MaisonVerte);
});

// La V4.15 modifie intentionnellement le DOM du livret (sélecteur FR/EN/ES,
// images cliquables et textes localisés). Son empreinte V4.12 n'est plus valable.
// Préserver les invariants essentiels du rendu serveur français à la place.
test('LivretAccueil: 11 pages A4 et structure multilingue en rendu serveur', async () => {
  const { html } = await pageFingerprint('LivretAccueil');
  assert.match(html, /data-livret-lang="fr"/);
  assert.match(html, /id="livret-language"/);
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
