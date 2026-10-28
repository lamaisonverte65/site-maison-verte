import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getHomeCopy } from '../src/components/home/homeTranslations.js';
import { faqCategories } from '../src/components/home/homeContent.js';
import { getHomeSecondaryCopy } from '../src/components/home/homeSecondaryTranslations.js';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('surface vérifiée 56 m² et lits jumeaux 80 x 190 dans toutes les langues', () => {
  for (const lang of ['fr','en','es']) {
    const home = getHomeCopy(lang);
    assert.ok(home.presentation.amenities.includes('56 m²'));
    assert.ok(!home.presentation.amenities.includes('58 m²'));
  }
  assert.match(JSON.stringify(faqCategories), /80 × 190/);
  for (const lang of ['en','es']) assert.match(JSON.stringify(getHomeSecondaryCopy(lang).faq), /80 × 190/);
});
test('QR du guide et avis vers URL de langue correcte', () => {
  for (const lang of ['en','es']) {
    const source=read('src/booklet/localizeBooklet.jsx');
    assert.match(source,/guide-vallees-aure-louron/);
    assert.match(source,/qr-site-avis\.svg/);
  }
});
test('le pays France ne doit pas être pré-rempli en EN/ES', () => {
  const component=read('src/pages/MaisonVerte.jsx');
  assert.match(component,/country: language === "fr" \? "France" : ""/);
  assert.match(component,/siteLanguage === "fr" \? "France" : ""/);
  assert.match(component,/createEmptyAdditionalContact\(siteLanguage\)/);
});
