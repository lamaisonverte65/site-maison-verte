import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const endpoint = fs.readFileSync('netlify/functions/cleaning-issue.js', 'utf8');

test('cleaning issue endpoint allows authenticated housekeeping report but owner-only financial decisions', () => {
  assert.match(endpoint, /authorizeAdminRequest\(event, supabase\)/);
  assert.match(endpoint, /action === "report"/);
  assert.match(endpoint, /!auth\.isOwner/);
  assert.match(endpoint, /Droit propriétaire requis/i);
  assert.match(endpoint, /action === "confirm"/);
  assert.match(endpoint, /action === "cancel"/);
});

test('cleaning issue endpoint takes amount only from booking cleaning_fee snapshot', () => {
  assert.match(endpoint, /select\("id,cleaning_fee/);
  assert.match(endpoint, /buildCleaningIssueFromBooking/);
  assert.doesNotMatch(endpoint, /body\.amount|data\.amount|input\.amount/);
});


test('reporting is not blocked by source or cleaning_option while billing stays blocked without a positive snapshot', () => {
  assert.doesNotMatch(endpoint, /booking\.cleaning_option\s*!==\s*false/);
  assert.match(endpoint, /Number\(issue\.amount_due\)\s*<=\s*0/);
});
