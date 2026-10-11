import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('cleaning report only selects real booking_requests columns', () => {
  const endpoint = read('netlify/functions/cleaning-issue.js');
  const selectCall = endpoint.match(/select\("([^"]+)"\)\.eq\("id", bookingId\)/)?.[1] || '';
  assert.ok(selectCall, 'booking select must be found');
  assert.doesNotMatch(selectCall, /(^|,)display_name(,|$)/);
  assert.match(selectCall, /guest_first_name/);
  assert.match(selectCall, /guest_last_name/);
});


test('owner notification derives guest name from booking guest fields only', () => {
  const helper = read('netlify/functions/_lib/cleaning-owner-notification.js');
  assert.match(helper, /guest_first_name/);
  assert.match(helper, /guest_last_name/);
  assert.doesNotMatch(helper, /booking\?\.display_name/);
});
