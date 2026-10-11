import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('review validation endpoint separates read GET from explicit publish/refuse POST', async () => {
  const fn = await read('netlify/functions/guest-review-validation.js');
  const page = await read('src/pages/ReviewValidation.jsx');
  const app = await read('src/App.jsx');
  assert.match(fn, /request\.method === ["']GET["']/);
  assert.match(fn, /request\.method === ["']POST["']/);
  assert.match(fn, /verifyGuestReviewValidationToken/);
  assert.match(fn, /action === ["']publish["']/);
  assert.match(fn, /["']refuse["']/);
  assert.match(fn, /status:\s*["']published["']/);
  assert.match(fn, /status:\s*["']refused["']/);
  assert.match(fn, /currentStatus/);
  assert.match(page, /Publier/);
  assert.match(page, /Refuser/);
  assert.match(page, /Ouvrir dans l.admin/);
  assert.match(app, /ReviewValidation/);
  assert.match(app, /path === ["']\/avis-validation["']/);
});
