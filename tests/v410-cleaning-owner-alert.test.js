import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const endpoint = fs.readFileSync('netlify/functions/cleaning-issue.js','utf8');
const helper = fs.readFileSync('netlify/functions/_lib/cleaning-owner-notification.js','utf8');
const home = fs.readFileSync('src/components/admin/AdminHomePanel.jsx','utf8');
const stats = fs.readFileSync('src/hooks/useAdminStats.js','utf8');
const admin = fs.readFileSync('src/pages/Admin.jsx','utf8');

test('new cleaning report emails owner with note and direct reservation admin link', () => {
  assert.match(endpoint, /sendCleaningOwnerNotification/);
  assert.match(helper, /BOOKING_NOTIFICATION_EMAIL/);
  assert.match(helper, /Ouvrir la réservation dans l.admin/);
  assert.match(helper, /\/admin\?reservation=/);
  assert.match(helper, /notes|note/i);
});

test('admin home exposes unresolved cleaning issue counter', () => {
  assert.match(stats, /cleaningIssuesPending/);
  assert.match(home, /Signalements ménage à traiter/);
  assert.match(admin, /cleaningIssues={cleaningIssues}|cleaningIssues=\{cleaningIssues\}/);
});

test('cleaning owner email always targets the public production admin, never Netlify dev URL', () => {
  assert.match(helper, /https:\/\/lamaisonverte65\.fr/);
  assert.doesNotMatch(helper, /process\.env\.URL/);
  assert.doesNotMatch(helper, /siteUrl\s*=\s*process\.env\.URL/);
});
