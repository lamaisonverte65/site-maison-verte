import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getHomeCopy } from '../src/components/home/homeTranslations.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const expected = {
  fr: { noWifi: /Sans Wi-Fi/i, balcony: /sud-ouest/i },
  en: { noWifi: /No Wi-Fi/i, balcony: /south-west/i },
  es: { noWifi: /Sin Wi-Fi/i, balcony: /suroeste/i },
};

for (const language of ['fr', 'en', 'es']) {
  test(`R13.3 ${language}: l'accueil ne promet pas de Wi-Fi et décrit le balcon sud-ouest`, () => {
    const benefits = getHomeCopy(language).presentation.benefits;
    assert.equal(benefits.length, 11, 'Conserver la structure de la présentation');
    assert.ok(benefits.some((benefit) => expected[language].noWifi.test(benefit)));
    assert.ok(benefits.some((benefit) => expected[language].balcony.test(benefit)));
    assert.ok(!benefits.some((benefit) => /Wi-Fi 7/i.test(benefit)));
  });
}

test('R13.3: aucun des emails d’arrivée FR/EN/ES ne communique un réseau ou mot de passe inexistant', () => {
  const french = read('netlify/functions/send-arrival-reminder.js');
  const localized = read('netlify/functions/_lib/guest-scheduled-emails.js');
  for (const [label, source] of [['FR', french], ['EN/ES', localized]]) {
    assert.doesNotMatch(source, /lamaisonverte65(?!\.fr)/i, `${label} : ancien mot de passe fictif`);
    assert.doesNotMatch(source, /<h3>Wi-Fi<\/h3>|\$\{t\.wifi\}/, `${label} : bloc Wi-Fi à supprimer`);
  }
  assert.doesNotMatch(localized, /wifi:\s*"Wi-Fi"|password:\s*"Password"|password:\s*"Contraseña"/);
  assert.doesNotMatch(french, /Mot de passe\s*:/);
});

test('R13.3: le correctif ne supprime ni code boîte à clés, ni lien arrivée, ni livret', () => {
  const french = read('netlify/functions/send-arrival-reminder.js');
  const localized = read('netlify/functions/_lib/guest-scheduled-emails.js');
  assert.match(french, /keyboxCode/);
  assert.match(french, /arrivalUrl/);
  assert.match(french, /\$\{SITE_URL\}\/livret/);
  assert.match(localized, /\$\{keyboxCode \? escapeHtml\(keyboxCode\)/);
  assert.match(localized, /button\(arrivalUrl,/);
  assert.match(localized, /\/livret\?lang=\$\{lang\}/);
  assert.match(localized, /buildLocalizedBalanceEmail/);
  assert.match(localized, /buildLocalizedReviewEmail/);
});
