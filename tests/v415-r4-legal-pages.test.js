import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGAL_COPY } from '../src/pages/legalTranslations.js';
const read = (path) => readFileSync(path, 'utf8');

test('R4 EN/ES: all sections of the French legal pages have translations', () => {
  for (const lang of ['en', 'es']) {
    const { mentions, privacy } = LEGAL_COPY[lang];
    assert.equal(mentions.sections.length, 6);
    assert.equal(privacy.sections.length, 9);
    assert.ok(mentions.sections.every((s) => s.heading && (s.paragraphs?.length || s.details?.length)));
    assert.ok(privacy.sections.every((s) => s.heading && (s.paragraphs?.length || s.items?.length)));
    assert.ok(privacy.sections[1].items.some((line) => /address|Dirección postal/i.test(line)));
    assert.ok(privacy.sections[1].items.some((line) => /additional contacts|contactos adicionales/i.test(line)));
    assert.ok(privacy.sections[1].items.some((line) => /language|Idioma/i.test(line)));
  }
});

test('R4: each legal page links to its own published contract PDF', () => {
  for (const lang of ['en', 'es']) {
    const docs = LEGAL_COPY[lang].mentions.sections[5].paragraphs[0];
    assert.equal(docs.href, `/documents/contrat-location-${lang}.pdf`);
    assert.doesNotMatch(docs.before, /\(in French\)|\(en francés\)/i);
  }
});

test('R4: only public legal paths are extended by App, not admin/payment routing', () => {
  const app = read('src/App.jsx');
  assert.match(app, /\?\:en\\\/\|es\\\//);
  assert.match(app, /mentions-legales/);
  assert.match(app, /politique-confidentialite/);
  assert.match(app, /path === "\/admin"/);
  assert.match(app, /path === "\/success"/);
});

test('R4: homepage footer links point to matching legal translations and PDFs', () => {
  const home = read('src/pages/MaisonVerte.jsx');
  assert.match(home, /\["Legal notice", "\/mentions-legales"\]/);
  assert.match(home, /\["Privacy policy", "\/politique-confidentialite"\]/);
  assert.match(home, /\["Aviso legal", "\/mentions-legales"\]/);
  assert.match(home, /\["Política de privacidad", "\/politique-confidentialite"\]/);
  assert.match(home, /`\/\$\{siteLanguage\}\$\{href\}`/);
  assert.match(home, /Rental agreement & booking terms/);
  assert.match(home, /\["Contrato y condiciones de reserva", contractPdfHref\]/);
  assert.match(home, /href=\{contractPdfHref\}/);
});

test('R4: original French legal text is preserved, with only disclosure additions in privacy', () => {
  const legal = read('src/pages/MentionsLegales.jsx');
  const privacy = read('src/pages/PolitiqueConfidentialite.jsx');
  assert.match(legal, /Propriété intellectuelle/);
  assert.match(legal, /Éditeur du site/);
  assert.match(privacy, /Bases légales/);
  assert.match(privacy, /adresse postale \(rue, code postal, ville et pays\)/);
  assert.match(privacy, /contacts supplémentaires indiqués par le réservant/);
  assert.match(privacy, /langue de communication choisie/);
  const translation = read('src/pages/TranslatedLegalPage.jsx');
  assert.match(translation, /name="robots" content="noindex,follow"/);
  assert.match(translation, /<Helmet htmlAttributes/);
});
