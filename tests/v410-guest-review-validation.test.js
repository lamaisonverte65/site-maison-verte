import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const helperPath = new URL('../netlify/functions/_lib/guest-review-validation.js', import.meta.url);

test('guest review helper validates payload, signs expiring tokens and escapes email HTML', async () => {
  const helper = await import(helperPath.href);
  const valid = helper.validateGuestReviewPayload({
    firstName: 'Frédéric', lastName: 'Test', email: 'fred@example.com', phone: '', rating: 5,
    comment: '<b>Parfait</b> & calme', stayPeriod: 'Octobre 2026',
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.review.status, 'pending');
  assert.equal(valid.review.display_name, 'Frédéric');

  const invalid = helper.validateGuestReviewPayload({ firstName: '', rating: 6, comment: 'x' });
  assert.equal(invalid.ok, false);

  const token = helper.createGuestReviewValidationToken('review-123', { secret: 'test-secret', nowMs: 1_000, ttlSeconds: 60 });
  assert.deepEqual(helper.verifyGuestReviewValidationToken(token, { secret: 'test-secret', nowMs: 30_000 }), { reviewId: 'review-123' });
  assert.throws(() => helper.verifyGuestReviewValidationToken(`${token}x`, { secret: 'test-secret', nowMs: 30_000 }), /invalide/i);
  assert.throws(() => helper.verifyGuestReviewValidationToken(token, { secret: 'test-secret', nowMs: 70_000 }), /expir/i);

  const email = helper.buildGuestReviewOwnerEmail(valid.review, 'https://example.test/avis-validation?token=abc', 'owner@example.com');
  assert.equal(email.to, 'owner@example.com');
  assert.match(email.subject, /Nouvel avis à valider/);
  assert.match(email.html, /Voir et valider l’avis/);
  assert.doesNotMatch(email.html, /<b>Parfait<\/b>/);
  assert.match(email.html, /&lt;b&gt;Parfait&lt;\/b&gt; &amp; calme/);
});
