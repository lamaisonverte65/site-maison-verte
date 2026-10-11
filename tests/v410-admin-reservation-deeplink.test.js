import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const admin = fs.readFileSync('src/pages/Admin.jsx','utf8');

test('admin supports direct reservation query used by owner alert email', () => {
  assert.match(admin, /params\.get\("reservation"\)/);
  assert.match(admin, /setSelectedRequest\(booking\)/);
  assert.match(admin, /setActiveTab\("reservations"\)/);
});
