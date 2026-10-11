import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, readRequired } from './backup-test-helpers.js';

test('manifest inclut hashes, tailles et compteurs d’inventaire', () => {
  readRequired('scripts/backup/build-manifest.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lmv-manifest-'));
  fs.mkdirSync(path.join(tmp, 'database'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'inventory'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'database', 'schema.sql'), 'select 1;\n');
  fs.writeFileSync(path.join(tmp, 'inventory', 'public_tables.tsv'), 'public\ttest_table\t"public"."test_table"\n');
  fs.writeFileSync(path.join(tmp, 'inventory', 'storage_buckets.json'), '[]\n');
  fs.writeFileSync(path.join(tmp, 'inventory', 'storage_objects.json'), '[]\n');
  fs.writeFileSync(path.join(tmp, 'inventory', 'public_table_counts.tsv'), 'public\ttest_table\t1\ttest_table.csv\n');

  const run = spawnSync(process.execPath, [path.join(root, 'scripts/backup/build-manifest.mjs'), tmp], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_SHA: 'abc123' },
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
  assert.equal(manifest.git_commit, 'abc123');
  assert.equal(manifest.inventory.public_tables, 1);
  assert.ok(manifest.files.some((f) => f.path === 'database/schema.sql' && /^[a-f0-9]{64}$/.test(f.sha256)));
});


test('manifest refuse de fonctionner sans répertoire de backup explicite', () => {
  const script = path.join(root, 'scripts/backup/build-manifest.mjs');
  const env = { ...process.env };
  delete env.BACKUP_DIR;
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8', env });
  assert.notEqual(run.status, 0, 'le script doit refuser un répertoire implicite');
});
