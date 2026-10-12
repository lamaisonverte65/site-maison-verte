import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('latest pointer is published only after the final _SUCCESS marker', () => {
  const src = read('scripts/backup/upload-pcloud.sh');
  const success = src.indexOf('rclone copyto "$SUCCESS_FILE" "$REMOTE/_SUCCESS"');
  const publish = src.indexOf('publish-latest-backup.sh');
  assert.ok(success >= 0, '_SUCCESS upload must remain present');
  assert.ok(publish > success, 'latest pointer must be published only after _SUCCESS');
});

test('staging is purged after _SUCCESS even if latest pointer publication later fails', () => {
  const src = read('scripts/backup/upload-pcloud.sh');
  const success = src.indexOf('rclone copyto "$SUCCESS_FILE" "$REMOTE/_SUCCESS"');
  const purge = src.lastIndexOf('rclone purge "$STAGING"');
  const publish = src.indexOf('publish-latest-backup.sh');
  assert.ok(success >= 0 && purge > success && publish > purge);
});

test('latest pointer stores only non-sensitive metadata and a pCloud folder id', () => {
  const src = read('scripts/backup/publish-latest-backup.sh');
  assert.match(src, /backup_id/);
  assert.match(src, /tier/);
  assert.match(src, /completed_at_utc/);
  assert.match(src, /folder_id/);
  const jsonWriter = src.match(/node - \"\$BACKUP_ID\"[^]*?<<\'NODE\'\n([^]*?)\nNODE/)?.[1] || "";
  assert.match(jsonWriter, /backup_id/);
  assert.match(jsonWriter, /folder_id/);
  assert.doesNotMatch(jsonWriter, /PCLOUD_TOKEN|RCLONE_CRYPT_PASSWORD/);
});

test('latest publisher extracts the API access token from the rclone OAuth JSON without changing the rclone token', () => {
  const src = read('scripts/backup/publish-latest-backup.sh');
  assert.match(src, /access_token/);
  assert.match(src, /PCLOUD_AUTH_TOKEN/);
  assert.match(src, /RCLONE_CONFIG_LMVPCLOUD_TOKEN="\$PCLOUD_TOKEN"/);
  assert.match(src, /auth=\$\{PCLOUD_AUTH_TOKEN\}/);
  assert.doesNotMatch(src, /data-urlencode "auth=\$\{PCLOUD_TOKEN\}"/);
});

test('latest publisher encodes the logical crypt path and resolves its pCloud folder id', () => {
  const src = read('scripts/backup/publish-latest-backup.sh');
  assert.match(src, /cryptdecode\s+--reverse\s+"LMVCRYPT:"/);
  assert.match(src, /eapi\.pcloud\.com\/listfolder/);
  assert.match(src, /metadata\?\.folderid|metadata\.folderid/);
  const copyIndex = src.indexOf('rclone copyto \"$LATEST_FILE\" \"$TMP_REMOTE\"');
  const moveIndex = src.indexOf('rclone moveto \"$TMP_REMOTE\" \"$FINAL_REMOTE\"');
  assert.ok(copyIndex >= 0 && moveIndex > copyIndex);
  assert.match(src, /latest\.json\.tmp/);
  assert.match(src, /latest\.json/);
});

test('latest publisher rejects malformed backup ids before external calls', () => {
  const src = read('scripts/backup/publish-latest-backup.sh');
  const validation = src.indexOf('Invalid BACKUP_ID');
  const firstRclone = src.indexOf('rclone ');
  const firstCurl = src.indexOf('curl ');
  assert.ok(validation >= 0, 'BACKUP_ID validation must remain explicit');
  assert.ok(firstRclone > validation, 'BACKUP_ID must be validated before the first rclone call');
  assert.ok(firstCurl > validation, 'BACKUP_ID must be validated before the first pCloud API call');
  assert.match(src, /\^\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}_\[0-9\]\{6\}Z\$/);
});

test('latest publisher preserves 64-bit pCloud folder ids as decimal strings', () => {
  const src = read('scripts/backup/publish-latest-backup.sh');
  assert.doesNotMatch(src, /Number\.isSafeInteger/);
  assert.match(src, /const exactIds = input\.replace/);
  assert.match(src, /String\(payload\?\.metadata\?\.folderid/);
  assert.ok(src.includes('/^[1-9]\\d*$/.test(id)'));
});

test('latest publisher restricts tiers and rejects path traversal inputs', () => {
  const src = read('scripts/backup/publish-latest-backup.sh');
  assert.match(src, /daily\|weekly\|monthly\|yearly\|manual\|baseline/);
  assert.match(src, /\.\./);
  assert.match(src, /Invalid encrypted path/);
});
