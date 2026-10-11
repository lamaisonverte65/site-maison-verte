import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const endpoint = fs.readFileSync('netlify/functions/additional-charge.js','utf8');

test('additional charge mutations are owner-only and independent from contractual remaining due', () => {
  assert.match(endpoint, /authorizeAdminRequest\(event, supabase, \{ ownerOnly: true \}\)/);
  assert.match(endpoint, /booking_additional_charges/);
  assert.match(endpoint, /validateAdditionalChargeCreate/);
  assert.doesNotMatch(endpoint, /remainingContractualDue|recordedPaidAmount|contractualTotal/);
});

test('optional cleaning issue must belong to the same booking', () => {
  assert.match(endpoint, /cleaning_issue_id|cleaningIssueId/);
  assert.match(endpoint, /booking_request_id/);
});
