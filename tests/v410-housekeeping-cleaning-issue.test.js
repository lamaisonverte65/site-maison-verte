import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { toHousekeepingReservation } from '../netlify/functions/_lib/housekeeping-contract.js';

const service = fs.readFileSync('src/services/housekeepingService.js', 'utf8');
const endpoint = fs.readFileSync('netlify/functions/housekeeping.js', 'utf8');

test('housekeeping contract exposes cleaning issue status and note but not amount/payment references', () => {
  const row = { id:'b1', source:'direct', start_date:'2026-10-01', end_date:'2026-10-03' };
  const issue = { id:'i1', status:'reported', notes:'Cuisine non nettoyée', reported_at:'2026-10-03T10:00:00Z', amount_due:50, stripe_session_id:'cs_secret', payment_id:'p1' };
  const result = toHousekeepingReservation(row, [], issue);
  assert.deepEqual(result.cleaningIssue, { id:'i1', status:'reported', note:'Cuisine non nettoyée', reportedAt:'2026-10-03T10:00:00Z' });
  assert.doesNotMatch(JSON.stringify(result.cleaningIssue), /50|stripe|payment|cs_secret/);
});

test('housekeeping data endpoint loads cleaning issues and service exposes report action', () => {
  assert.match(endpoint, /booking_cleaning_issues/);
  assert.match(service, /reportCleaningIssue/);
  assert.match(service, /action:\s*"report"/);
  assert.match(service, /cleaning-issue/);
});
