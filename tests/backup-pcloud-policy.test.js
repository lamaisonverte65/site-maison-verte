import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('upload pCloud utilise OAuth/env et force la région Europe', () => {
  const src = readRequired('scripts/backup/upload-pcloud.sh');
  assert.match(src, /PCLOUD_TOKEN/);
  assert.match(src, /RCLONE_CONFIG_[A-Z0-9_]+_TYPE/);
  assert.match(src, /pcloud/);
  assert.match(src, /eapi\.pcloud\.com/);
  assert.match(src, /rclone (copy|copyto)/);
  assert.match(src, /rclone cryptcheck/);
  assert.match(src, /\.incoming/);
  assert.match(src, /_SUCCESS/);
  assert.match(src, /grep[^\n]*_SUCCESS/);
  assert.match(src, /baseline/);
  assert.match(src, /BACKUP_ID.*\^\[0-9\].*Z\$/s);
  assert.doesNotMatch(src, /PCLOUD_(USERNAME|PASSWORD)/);
});

test('rotation ne purge automatiquement que daily et weekly', () => {
  const src = readRequired('scripts/backup/rotate-pcloud.sh');
  assert.match(src, /daily/);
  assert.match(src, /weekly/);
  assert.match(src, /30/);
  assert.match(src, /365/);
  assert.doesNotMatch(src, /purge[^\n]*(monthly|yearly|manual|baseline)/i);
  assert.doesNotMatch(src, /(monthly|yearly|manual|baseline)[^\n]*purge/i);
});
