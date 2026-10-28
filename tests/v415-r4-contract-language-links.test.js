import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGAL_COPY } from '../src/pages/legalTranslations.js';
import { getBookingFormCopy } from '../src/components/home/bookingFormTranslations.js';

const homepage = readFileSync(new URL('../src/pages/MaisonVerte.jsx', import.meta.url), 'utf8');
const file = (name) => readFileSync(new URL(`../public/documents/${name}`, import.meta.url));

// Liens publics seulement : aucune mutation de l'URL contractuelle immuable dans le backend.
test('R4: les 3 PDF publics sont présents et non vides', () => {
  for (const name of ['contrat-location.pdf', 'contrat-location-en.pdf', 'contrat-location-es.pdf']) {
    const bytes = file(name);
    assert.ok(bytes.length > 10000, `${name} incomplet`);
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
  }
});

test('R4: formulaire de réservation et pied de page utilisent les PDF localisés', () => {
  assert.match(homepage, /const contractPdfHref = siteLanguage === "en"/);
  assert.match(homepage, /: siteLanguage === "es"/);
  assert.match(homepage, /href=\{contractPdfHref\}/);
  assert.match(homepage, /\["Rental agreement & booking terms", contractPdfHref\]/);
  assert.match(homepage, /\["Contrato y condiciones de reserva", contractPdfHref\]/);
  assert.match(homepage, /\["Contrat & conditions de réservation", contractPdfHref\]/);
});

test('R4: mentions légales EN et ES liées aux versions correspondantes', () => {
  for (const lang of ['en', 'es']) {
    const docs = LEGAL_COPY[lang].mentions.sections[5].paragraphs[0];
    assert.equal(docs.href, `/documents/contrat-location-${lang}.pdf`);
    assert.ok(getBookingFormCopy(lang).contractFrenchNotice.length > 20);
    assert.match(getBookingFormCopy(lang).contractFrenchNotice, lang === 'en' ? /French version/ : /versión francesa/);
  }
});
