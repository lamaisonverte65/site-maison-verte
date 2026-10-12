import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const upload = readFileSync('scripts/backup/upload-pcloud.sh', 'utf8');
const publish = readFileSync('scripts/backup/publish-latest-backup.sh', 'utf8');
const rotate = readFileSync('scripts/backup/rotate-pcloud.sh', 'utf8');

test('existing pCloud upload supports an independent Stripe base path without changing the Supabase default', () => {
  assert.match(upload, /REMOTE_ROOT="\$\{PCLOUD_BASE_PATH:-01_Supabase\}"/);
  assert.match(upload, /LMVCRYPT:\$\{REMOTE_ROOT\}\/\$\{TIER\}\/\$\{BACKUP_ID\}/);
  assert.equal(upload.includes('02_Stripe'), false);
});

test('existing latest publisher supports a Stripe pointer root while keeping the Supabase default', () => {
  assert.match(publish, /POINTER_ROOT="\$\{PCLOUD_LATEST_ROOT:-La Maison Verte\/backup-download\}"/);
  assert.match(publish, /TMP_REMOTE="LMVPCLOUD:\$\{POINTER_ROOT\}\/latest\.json\.tmp"/);
  assert.match(publish, /FINAL_REMOTE="LMVPCLOUD:\$\{POINTER_ROOT\}\/latest\.json"/);
  assert.equal(publish.includes('backup-download/stripe'), false);
});

test('rotation remains parameterized by PCLOUD_BASE_PATH and purges only daily/weekly', () => {
  assert.match(rotate, /REMOTE_ROOT="\$\{PCLOUD_BASE_PATH:-01_Supabase\}"/);
  assert.match(rotate, /purge_old_tier daily 30/);
  assert.match(rotate, /purge_old_tier weekly 365/);
  assert.doesNotMatch(rotate, /purge_old_tier (monthly|yearly|manual|baseline)/);
});

test('_SUCCESS precedes latest publication and failed latest publication cannot delete the completed backup', () => {
  const successAt = upload.indexOf('rclone copyto "$SUCCESS_FILE" "$REMOTE/_SUCCESS"');
  const purgeAt = upload.indexOf('rclone purge "$STAGING"', successAt);
  const publishAt = upload.indexOf('publish-latest-backup.sh', successAt);
  assert.ok(successAt >= 0);
  assert.ok(purgeAt > successAt);
  assert.ok(publishAt > purgeAt);
  assert.doesNotMatch(upload.slice(publishAt), /rclone purge "\$REMOTE"/);
});
