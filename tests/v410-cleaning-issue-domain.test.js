import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCleaningIssueFromBooking,
  canTransitionCleaningIssue,
  validateCleaningIssueAction,
} from '../netlify/functions/_lib/cleaning-issue.js';

test('cleaning issue initializes amount from booking cleaning_fee snapshot', () => {
  const issue = buildCleaningIssueFromBooking({ id: 'booking-1', cleaning_fee: 50 }, { note: 'Ménage insuffisant', reportedBy: 'housekeeping-1' });
  assert.equal(issue.booking_request_id, 'booking-1');
  assert.equal(issue.amount_due, 50);
  assert.equal(issue.status, 'reported');
  assert.equal(issue.notes, 'Ménage insuffisant');
});

test('cleaning issue can be reported without a billable snapshot and records zero until owner review', () => {
  for (const cleaning_fee of [0, null, undefined, '', -1, 'abc']) {
    const issue = buildCleaningIssueFromBooking({ id: 'booking-1', cleaning_fee }, { note: 'Constat' });
    assert.equal(issue.amount_due, 0);
    assert.equal(issue.status, 'reported');
  }
});

test('cleaning issue transitions are explicit and terminal states stay closed', () => {
  assert.equal(canTransitionCleaningIssue('reported', 'confirmed'), true);
  assert.equal(canTransitionCleaningIssue('reported', 'cancelled'), true);
  assert.equal(canTransitionCleaningIssue('confirmed', 'payment_requested'), true);
  assert.equal(canTransitionCleaningIssue('payment_requested', 'paid'), true);
  assert.equal(canTransitionCleaningIssue('payment_requested', 'confirmed'), true);
  assert.equal(canTransitionCleaningIssue('paid', 'confirmed'), false);
  assert.equal(canTransitionCleaningIssue('cancelled', 'confirmed'), false);
});

test('cleaning issue action validation requires report note and allows only known actions', () => {
  assert.deepEqual(validateCleaningIssueAction({ action: 'report', bookingId: 'b1', note: '  Salle de bain non faite.  ' }), {
    ok: true,
    value: { action: 'report', bookingId: 'b1', note: 'Salle de bain non faite.' },
  });
  assert.equal(validateCleaningIssueAction({ action: 'report', bookingId: 'b1', note: ' ' }).ok, false);
  assert.equal(validateCleaningIssueAction({ action: 'confirm', bookingId: 'b1' }).ok, true);
  assert.equal(validateCleaningIssueAction({ action: 'cancel', bookingId: 'b1' }).ok, true);
  assert.equal(validateCleaningIssueAction({ action: 'pay', bookingId: 'b1' }).ok, false);
});
