import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAdditionalChargeCreate,
  canTransitionAdditionalCharge,
} from '../netlify/functions/_lib/additional-charge.js';

test('additional charge accepts a positive owner-entered amount and free reason/message', () => {
  const result = validateAdditionalChargeCreate({
    bookingId: 'b1', category: 'cleaning', reasonLabel: 'Ménage partiel', amount: '37.50', customerMessage: 'Nettoyage complémentaire nécessaire.', cleaningIssueId: 'i1',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    bookingId: 'b1', category: 'cleaning', reasonLabel: 'Ménage partiel', amount: 37.5, customerMessage: 'Nettoyage complémentaire nécessaire.', cleaningIssueId: 'i1',
  });
});

test('additional charge rejects zero/negative amount and missing reason', () => {
  assert.equal(validateAdditionalChargeCreate({ bookingId:'b1', reasonLabel:'', amount:10 }).ok, false);
  assert.equal(validateAdditionalChargeCreate({ bookingId:'b1', reasonLabel:'Test', amount:0 }).ok, false);
  assert.equal(validateAdditionalChargeCreate({ bookingId:'b1', reasonLabel:'Test', amount:-1 }).ok, false);
});

test('additional charge transitions are explicit', () => {
  assert.equal(canTransitionAdditionalCharge('draft','payment_requested'), true);
  assert.equal(canTransitionAdditionalCharge('payment_requested','paid'), true);
  assert.equal(canTransitionAdditionalCharge('draft','cancelled'), true);
  assert.equal(canTransitionAdditionalCharge('paid','payment_requested'), false);
  assert.equal(canTransitionAdditionalCharge('cancelled','payment_requested'), false);
});
