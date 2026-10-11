import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin review tab exposes pending count and pending reviews first with publish/refuse actions', async () => {
  const topbar = await read('src/components/admin/AdminTopBar.jsx');
  const panel = await read('src/components/admin/ReviewsPanel.jsx');
  assert.match(topbar, /reviewsPending/);
  assert.match(topbar, /Avis \(/);
  assert.match(panel, /pendingReviews/);
  assert.match(panel, /otherReviews/);
  assert.match(panel, /onUpdateReviewStatus\(review, ["']published["']\)/);
  assert.match(panel, /onUpdateReviewStatus\(review, ["']refused["']\)/);
});
