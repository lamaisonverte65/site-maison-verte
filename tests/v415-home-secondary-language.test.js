import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { faqCategories } from '../src/components/home/homeContent.js';
import { getHomeSecondaryCopy, localizeFaqCategories } from '../src/components/home/homeSecondaryTranslations.js';

const source = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');

for (const language of ['en', 'es']) {
  test(`R10.2: activities fully localised in ${language} with four cards and original links`, () => {
    const copy = getHomeSecondaryCopy(language).activities;
    assert.ok(copy.heading && copy.intro && copy.offerTitle && copy.offerDescription && copy.offerPromotion && copy.offerButton);
    assert.ok(copy.guideTitle && copy.guideDescription && copy.guideButton && copy.usefulLinks);
    assert.equal(copy.cards.length, 4);
    assert.deepEqual(copy.cards.map(({ links }) => links.length), [7, 5, 7, 6]);
    for (const card of copy.cards) assert.ok(card.title && card.alt && card.text && card.links.every(Boolean));
    const component = source('../src/components/home/HomeActivities.jsx');
    assert.match(component, /localizePublicHref\("\/guide-vallees-aure-louron", language\)/);
    assert.match(component, /href=\{link\.url\}/);
  });
  test(`R10.2: FAQ ${language} keeps all questions, answers and existing links`, () => {
    const translated = localizeFaqCategories(faqCategories, language);
    assert.equal(translated.length, faqCategories.length);
    assert.deepEqual(translated.map(c => c.items.length), [7,4,4]);
    for (let i = 0; i < translated.length; i++) {
      assert.ok(translated[i].title && translated[i].title !== faqCategories[i].title);
      for (let j = 0; j < translated[i].items.length; j++) {
        const original = faqCategories[i].items[j], current = translated[i].items[j];
        assert.ok(current.question && current.answer);
        assert.notEqual(current.question, original.question);
        assert.notEqual(current.answer, original.answer);
        assert.equal(current.planUrl, original.planUrl);
        if (original.linkUrl === '/livret/procedure-boite-a-cles.webp') {
          assert.equal(current.linkUrl, `/livret/procedure-boite-a-cles-${language}.webp`);
        } else {
          assert.equal(current.linkUrl, original.linkUrl);
        }
      }
    }
  });
  test(`R10.2: review ${language} localises form fields without modifying stored guest texts`, () => {
    const copy = getHomeSecondaryCopy(language).reviews;
    for (const key of ['title','introduction','formTitle','submitted','publicationConsent','sending','send','alertFirstName','alertComment','googleCount','viewReviews']) {
      assert.ok(copy[key], `${language}: missing ${key}`);
    }
    assert.ok(copy.stars(1) && copy.stars(5));
    const page = source('../src/pages/MaisonVerte.jsx');
    assert.match(page, /getGuestReviewDisplay\(review\.comment, siteLanguage\)/);
    assert.match(page, /comment: reviewComment\.trim\(\)/);
    assert.match(page, /reviewCopy\?\.publicationConsent/);
  });
}

test('R10.2: French FAQ data and public booking form remain unchanged', () => {
  assert.equal(localizeFaqCategories(faqCategories,'fr'), faqCategories);
  assert.equal(getHomeSecondaryCopy('fr'), null);
  assert.equal(getHomeSecondaryCopy('xyz'), null);
  const page = source('../src/pages/MaisonVerte.jsx');
  assert.match(page, /<HomeFaq language=\{siteLanguage\} faqCategories=\{visibleFaqCategories\}/);
  assert.match(page, /<section id="reservation"/);
  assert.match(page, /id="formulaire-reservation"/);
  assert.match(page, /bookingSubmitLockRef/);
  assert.match(page, /<HomeActivities\s*\/>/);
});

test('R10.2: no altered external activity URL and no third-party automatic translation of review comments', () => {
  const activities = source('../src/components/home/HomeActivities.jsx');
  assert.match(activities, /https:\/\/www\.visit-neouvielle\.com\//);
  assert.match(activities, /https:\/\/zonazeropirineos\.com\/fr\//);
  const page = source('../src/pages/MaisonVerte.jsx');
  assert.doesNotMatch(page, /translate\(review\.comment/);
});
