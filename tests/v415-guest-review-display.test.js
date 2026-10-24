import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getGuestReviewDisplay, localizeGuestReviewStayPeriod } from '../src/components/home/guestReviewTranslations.js';
import { getHomeSecondaryCopy } from '../src/components/home/homeSecondaryTranslations.js';

const approvedSource = 'Un séjour parfait en famille (2 adultes et 2 enfants) ! La maison a été refaite à neuf très récemment : le rendu est à la fois authentique et moderne, avec une alliance réussie entre les matériaux traditionnels et le confort actuel.';

test('R10.2b: original French guest review is kept verbatim and truncated only in the visible card', () => {
  const review = getGuestReviewDisplay(approvedSource, 'fr');
  assert.equal(review.original, approvedSource);
  assert.equal(review.translated, false);
  assert.ok(review.text.startsWith('Un séjour parfait'));
  assert.ok(review.text.endsWith('…'));
});

test('R10.2b: manually approved Spanish excerpt is shown without modifying the published review', () => {
  const review = getGuestReviewDisplay(approvedSource, 'es');
  assert.equal(review.translated, true);
  assert.match(review.text, /estancia perfecta en familia/);
  assert.doesNotMatch(review.text, /séjour parfait/);
  assert.equal(review.original, approvedSource);
});

test('R10.2b: manually approved English excerpt is shown with its French original accessible', () => {
  const review = getGuestReviewDisplay(approvedSource, 'en');
  assert.equal(review.translated, true);
  assert.match(review.text, /perfect family stay/);
  assert.equal(review.original, approvedSource);
});

test('R10.2b: arbitrary future guest comments are never silently translated or invented', () => {
  for (const language of ['fr', 'en', 'es']) {
    const review = getGuestReviewDisplay('Merci pour cet accueil!', language);
    assert.equal(review.text, 'Merci pour cet accueil!');
    assert.equal(review.translated, false);
  }
});

test('R10.2b: month and singular opinion are localized correctly', () => {
  assert.equal(localizeGuestReviewStayPeriod('Octobre 2026', 'es'), 'octubre de 2026');
  assert.equal(localizeGuestReviewStayPeriod('Octobre 2026', 'en'), 'October 2026');
  assert.equal(localizeGuestReviewStayPeriod('Octobre 2026', 'fr'), 'Octobre 2026');
  assert.equal(getHomeSecondaryCopy('es').reviews.siteReviewsCount(1), 'Basado en 1 opinión publicada en nuestra web.');
  assert.equal(getHomeSecondaryCopy('en').reviews.siteReviewsCount(1), 'Based on 1 review published on our website.');
  assert.match(getHomeSecondaryCopy('es').reviews.siteReviewsCount(2), /2 opiniones publicadas/);
});

test('R10.2b: frontend displays translation with original disclosure and does not rewrite input comment', () => {
  const page = readFileSync(new URL('../src/pages/MaisonVerte.jsx', import.meta.url), 'utf8');
  assert.match(page, /getGuestReviewDisplay\(review.comment, siteLanguage\)/);
  assert.match(page, /displayedReview\.translated/);
  assert.match(page, /displayedReview\.original/);
  assert.match(page, /Extracto traducido del francés/);
  assert.match(page, /comment: reviewComment\.trim\(\)/);
});
