import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = 'scripts/backup/rotate-pcloud.sh';
// Windows hosts validate the shell script with static tests; behavioral rclone mocks
// run on Unix/GitHub Actions to avoid PATH incompatibilities on Git Bash.
const shellTest = (name, fn) => test(name, { skip: process.platform === 'win32' ? 'Requires Unix bash' : false }, fn);
const mockScript = String.raw`#!/usr/bin/env bash
set -euo pipefail
command="$1"; target="\${2:-}"
case "$command" in
  cat)
    if [[ "$target" == *'/latest.json' ]]; then
      if [[ "\${FAKE_BAD_POINTER:-0}" == 1 ]]; then printf 'bad json\n'; else printf '{"tier":"daily","backup_id":"2026-11-10_090000Z"}\n'; fi
    elif [[ "$target" == *'/_SUCCESS' ]]; then
      tail="\${target#LMVCRYPT:01_Supabase/}"
      tier="\${tail%%/*}"
      id="\${tail#*/}"; id="\${id%/_SUCCESS}"
      if [[ "\${FAKE_BAD_BACKUP:-0}" == 1 && "$id" == '2026-11-02_090000Z' ]]; then exit 1; fi
      printf 'backup_id=%s\ntier=%s\ncompleted_at_utc=2026-11-10T10:00:00Z\n' "$id" "$tier"
    else exit 9; fi
    ;;
  lsf)
    if [[ "\${FAKE_LIST_FAIL:-0}" == 1 && "$target" == 'LMVCRYPT:01_Supabase/daily' ]]; then exit 7; fi
    case "$target" in
      'LMVCRYPT:01_Supabase') printf 'baseline/\ndaily/\nweekly/\nmonthly/\nmanual/\nyearly/\n.incoming/\n' ;;
      'LMVCRYPT:01_Supabase/baseline') printf '2026-10-11_093325Z/\n' ;;
      'LMVCRYPT:01_Supabase/daily') for i in $(seq -w 1 10); do printf '2026-11-%02d_090000Z/\n' "$((10#$i))"; done ;;
      'LMVCRYPT:01_Supabase/weekly') for i in $(seq 1 5); do printf '2026-10-%02d_090000Z/\n' "$i"; done ;;
      'LMVCRYPT:01_Supabase/monthly') for m in 08 09 10; do printf '2026-%s-01_090000Z/\n' "$m"; done ;;
      'LMVCRYPT:01_Supabase/manual'|'LMVCRYPT:01_Supabase/yearly') printf '2026-10-01_090000Z/\n' ;;
      LMVCRYPT:01_Supabase/*) printf 'manifest.json\nSHA256SUMS\n_SUCCESS\n' ;;
      *) exit 6 ;;
    esac
    ;;
  purge)
    printf '%s\n' "$target" >> "$FAKE_PURGE_LOG"
    ;;
  *) exit 5 ;;
esac`.replaceAll('\\${', '${');

function run(args = ['--dry-run'], variables = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lmv-r31-'));
  const rclone = join(dir, 'rclone');
  const log = join(dir, 'purges.log');
  writeFileSync(rclone, mockScript);
  chmodSync(rclone, 0o755);
  const outcome = spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      PCLOUD_TOKEN: 'test-token',
      RCLONE_CRYPT_PASSWORD: 'test-crypt',
      RCLONE_CRYPT_PASSWORD2: 'test-crypt2',
      PCLOUD_BASE_PATH: '01_Supabase',
      FAKE_PURGE_LOG: log,
      ...variables,
    },
    timeout: 12000,
  });
  const deletes = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : [];
  rmSync(dir, { recursive: true, force: true });
  return { ...outcome, deletes };
}

shellTest('R31 daily/weekly/monthly preview preserves 7/4/2 and never deletes', () => {
  const p = run();
  assert.equal(p.status, 0, p.stderr);
  assert.equal((p.stdout.match(/WOULD_DELETE: daily\//g) || []).length, 3, p.stdout);
  assert.equal((p.stdout.match(/WOULD_DELETE: weekly\//g) || []).length, 1, p.stdout);
  assert.equal((p.stdout.match(/WOULD_DELETE: monthly\//g) || []).length, 1, p.stdout);
  assert.equal(p.deletes.length, 0);
  assert.doesNotMatch(p.stdout, /WOULD_DELETE: (manual|yearly|baseline)/);
  assert.match(p.stdout, /KEEP: daily\/2026-11-10_090000Z/);
});

shellTest('R31 rejects actual purge without explicit acknowledgment', () => {
  const p = run(['--apply']);
  assert.notEqual(p.status, 0);
  assert.equal(p.deletes.length, 0);
});

shellTest('R31 actual purge stays within eligible roots when explicitly authorized', () => {
  const p = run(['--apply'], { R31_ROTATION_APPLY_ACK: 'JE_CONFIRME_LA_ROTATION_R31' });
  assert.equal(p.status, 0, p.stderr);
  assert.equal(p.deletes.length, 5, p.stdout);
  assert.ok(p.deletes.every(x => /^LMVCRYPT:01_Supabase\/(daily|weekly|monthly)\/\d{4}-/.test(x)));
  assert.ok(p.deletes.every(x => !x.includes('2026-11-10_090000Z')));
});

shellTest('R31 protects unverified backups and never counts them among retained copies', () => {
  const p = run(['--dry-run'], { FAKE_BAD_BACKUP: '1' });
  assert.equal(p.status, 0, p.stderr);
  assert.match(p.stdout, /SKIP: unverified backup daily\/2026-11-02_090000Z/);
  assert.doesNotMatch(p.stdout, /WOULD_DELETE: daily\/2026-11-02_090000Z/);
  assert.equal((p.stdout.match(/WOULD_DELETE: daily\//g) || []).length, 2);
});

shellTest('R31 fails closed on unreadable root or invalid latest pointer', () => {
  for (const variables of [{ FAKE_BAD_POINTER: '1' }, { FAKE_LIST_FAIL: '1' }]) {
    const p = run(['--apply'], { ...variables, R31_ROTATION_APPLY_ACK: 'JE_CONFIRME_LA_ROTATION_R31' });
    assert.notEqual(p.status, 0);
    assert.equal(p.deletes.length, 0);
  }
});

shellTest('R31 rejects invalid root outside the authorized backup namespaces', () => {
  const p = run(['--apply'], {
    R31_ROTATION_APPLY_ACK: 'JE_CONFIRME_LA_ROTATION_R31',
    PCLOUD_BASE_PATH: '03_Documents',
  });
  assert.notEqual(p.status, 0);
  assert.equal(p.deletes.length, 0);
});
