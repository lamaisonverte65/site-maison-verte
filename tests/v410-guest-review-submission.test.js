import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('public review submission goes through secured Netlify endpoint and sends owner notification', async () => {
  const fn = await read('netlify/functions/submit-guest-review.js');
  const page = await read('src/pages/MaisonVerte.jsx');
  assert.match(fn, /claim_public_rate_limit/);
  assert.match(fn, /createGuestReviewValidationToken/);
  assert.match(fn, /resendEmail/);
  assert.match(fn, /BOOKING_NOTIFICATION_EMAIL/);
  assert.match(fn, /guest_review_validation/);
  assert.match(fn, /notificationPending/);
  assert.match(page, /\.netlify\/functions\/submit-guest-review/);
  const submitSection = page.slice(page.indexOf('async function submitGuestReview'), page.indexOf('return (', page.indexOf('async function submitGuestReview')));
  assert.doesNotMatch(submitSection, /\.from\(["']guest_reviews["']\)\.insert/);
});
