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

test('R31 retention preserves baseline/manual/yearly and runs in preview by default', () => {
  const src = readRequired('scripts/backup/rotate-pcloud.sh');
  assert.match(src, /'daily:7'/);
  assert.match(src, /'weekly:4'/);
  assert.match(src, /'monthly:2'/);
  assert.match(src, /MODE="\$\{1:---dry-run\}"/);
  assert.match(src, /R31_ROTATION_APPLY_ACK/);
  assert.match(src, /_SUCCESS/);
  assert.match(src, /SHA256SUMS/);
  assert.match(src, /POINTER_TIER/);
  assert.match(src, /rclone purge "\$folder"/);
  assert.doesNotMatch(src, /purge_old_tier/);
});
