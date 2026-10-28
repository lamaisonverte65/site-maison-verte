import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getHomeCopy } from '../src/components/home/homeTranslations.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const expected = {
  fr: { wifi: /Wi-Fi 7/i, balcony: /sud-ouest/i },
  en: { wifi: /Wi-Fi 7/i, balcony: /south-west/i },
  es: { wifi: /Wi-Fi 7/i, balcony: /suroeste/i },
};

for (const language of ['fr', 'en', 'es']) {
  test(`R13.3 ${language}: l'accueil mentionne le Wi-Fi réel et le balcon sud-ouest`, () => {
    const benefits = getHomeCopy(language).presentation.benefits;
    assert.equal(benefits.length, 11, 'Conserver la structure de la présentation');
    assert.ok(benefits.some((benefit) => expected[language].wifi.test(benefit)));
    assert.ok(benefits.some((benefit) => expected[language].balcony.test(benefit)));
    assert.ok(!benefits.some((benefit) => /Sans Wi-Fi|No Wi-Fi|Sin Wi-Fi/i.test(benefit)));
  });
}

test('R13.3: les informations Wi-Fi du livret ne doivent pas être contredites par le site', () => {
  const booklet = read('src/components/booklet/BookletHouseRules.jsx');
  const home = getHomeCopy('fr').presentation.benefits.join(' ');
  assert.match(booklet, /Wi-Fi/i);
  assert.match(home, /Wi-Fi 7/);
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
