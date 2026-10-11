import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const bash = process.env.BASH_TEST_BIN || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
const root = process.cwd().replaceAll('\\', '/');
const sql = 'SET statement_timeout = 0;\nCOPY "auth"."users" ("id") FROM stdin;\nu1\n\\.\nCOPY "public"."notes" ("text") FROM stdin;\nCOPY "storage"."objects" is user text\n\\.\nCOPY "storage"."objects" ("id") FROM stdin;\ns1\n\\.\nSELECT pg_catalog.setval(\'"auth"."refresh_tokens_id_seq"\', 9, true);\n';
function fixture(t, data = sql) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmv-test-')).replaceAll('\\', '/');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(`${dir}/database`); fs.mkdirSync(`${dir}/bin`);
  for (const [name, body] of Object.entries({ 'roles.sql':'-- roles\n', 'schema.sql':'-- schema\n', 'data.sql':data, 'auth-data.sql':sql })) fs.writeFileSync(`${dir}/database/${name}`, body);
  const sums = fs.readdirSync(`${dir}/database`).map(n => `${createHash('sha256').update(fs.readFileSync(`${dir}/database/${n}`)).digest('hex')}  ./database/${n}`).join('\n');
  fs.writeFileSync(`${dir}/SHA256SUMS`, sums+'\n');
  // Only the external PostgreSQL boundary is replaced; real shell and checksum/filter run.
  fs.writeFileSync(`${dir}/bin/psql`, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" >> "$CAPTURE"\nfor arg in "$@"; do if [[ "$arg" == *"SELECT count"* ]]; then echo "${TARGET_COUNT:-0}"; exit; fi; done\nwhile (( $# )); do if [[ "$1" == --file ]]; then shift; cat "$1" >> "$SQL_CAPTURE"; fi; shift; done\n', {mode:0o755});
  return dir;
}
function run(dir, extra={}) {
  return spawnSync(bash, ['-c', 'if command -v cygpath >/dev/null; then TEST_DIR="$(cygpath -u "$TEST_DIR")"; fi; export PATH="$TEST_DIR/bin:$PATH"; bash "$REPO/scripts/backup/verify-restore.sh" "$TEST_DIR"'], {encoding:'utf8', env:{...process.env, REPO:root, TEST_DIR:dir, CAPTURE:`${dir}/calls`, SQL_CAPTURE:`${dir}/sql`, RESTORE_DB_URL:'postgresql://postgres:pw@db.testref.supabase.co:5432/postgres', RESTORE_PROJECT_REF:'testref', SOURCE_PROJECT_REF:'sourceref', CONFIRM_TEST_RESTORE:'YES', ...extra}});
}
test('legacy baseline loads Auth once, omits Storage rows, preserves COPY payload and uses one write transaction', t => {
  const dir=fixture(t); const before=fs.readFileSync(`${dir}/database/data.sql`); const r=run(dir);
  assert.equal(r.status,0,r.stderr);
  const restored=fs.readFileSync(`${dir}/sql`,'utf8');
  assert.equal((restored.match(/^u1$/gm)||[]).length,1);
  assert.doesNotMatch(restored,/^s1$/m);
  assert.match(restored,/COPY "storage"\."objects" is user text/);
  assert.match(restored,/refresh_tokens_id_seq/);
  assert.equal((fs.readFileSync(`${dir}/calls`,'utf8').match(/--single-transaction/g)||[]).length,1);
  assert.deepEqual(fs.readFileSync(`${dir}/database/data.sql`),before);
});
for (const [name,env] of [['source target',{RESTORE_PROJECT_REF:'sourceref'}],['mismatched URI',{RESTORE_PROJECT_REF:'otherref'}],['production override',{CONFIRM_TEST_RESTORE:'',ALLOW_PRODUCTION_RESTORE:'I_ACCEPT_DATA_LOSS_RISK'}],['missing source',{SOURCE_PROJECT_REF:''}]]) {
  test(`rejects ${name} before database connection`,t=>{const dir=fixture(t);assert.notEqual(run(dir,env).status,0);assert.equal(fs.existsSync(`${dir}/calls`),false);});
}
test('rejects a partially restored target before writes',t=>{const dir=fixture(t);assert.notEqual(run(dir,{TARGET_COUNT:'1'}).status,0);assert.equal(fs.existsSync(`${dir}/sql`),false);});
test('corrupt baseline blocks before connection',t=>{const dir=fixture(t);fs.appendFileSync(`${dir}/database/data.sql`,'bad');assert.notEqual(run(dir).status,0);assert.equal(fs.existsSync(`${dir}/calls`),false);});
for (const [name,data] of [['unknown SQL',sql+'INSERT INTO storage.objects VALUES (1);\n'],['truncated COPY',sql+'COPY "storage"."objects" ("id") FROM stdin;\n1\n'],['absent Auth',sql.replace('"auth"."users"','"public"."users"')]]) {
  test(`rejects ${name} before connection`,t=>{const dir=fixture(t,data);assert.notEqual(run(dir).status,0);assert.equal(fs.existsSync(`${dir}/calls`),false);});
}
test('incomplete optional migration pair blocks before connection',t=>{const dir=fixture(t);fs.writeFileSync(`${dir}/database/migration-history-schema.sql`,'-- schema');assert.notEqual(run(dir).status,0);assert.equal(fs.existsSync(`${dir}/calls`),false);});
test('accepts the Supabase RESET ALL footer from the existing baseline',t=>{const dir=fixture(t,sql+'RESET ALL;\n');const r=run(dir);assert.equal(r.status,0,r.stderr);assert.match(fs.readFileSync(`${dir}/sql`,'utf8'),/RESET ALL;/);});
test('required SQL omitted from checksum list blocks before connection',t=>{const dir=fixture(t);const p=`${dir}/SHA256SUMS`;fs.writeFileSync(p,fs.readFileSync(p,'utf8').split('\n').filter(l=>!l.endsWith('/data.sql')).join('\n'));assert.notEqual(run(dir).status,0);assert.equal(fs.existsSync(`${dir}/calls`),false);});
test('new backup needs no auth-data file and removes Storage sequence resets',t=>{const dir=fixture(t,sql+'SELECT pg_catalog.setval(\'"storage"."legacy_seq"\', 4, true);\n');fs.unlinkSync(`${dir}/database/auth-data.sql`);const p=`${dir}/SHA256SUMS`;fs.writeFileSync(p,fs.readFileSync(p,'utf8').split('\n').filter(l=>!l.endsWith('/auth-data.sql')).join('\n'));const r=run(dir);assert.equal(r.status,0,r.stderr);assert.doesNotMatch(fs.readFileSync(`${dir}/sql`,'utf8'),/legacy_seq/);});

test('future backup excludes all Storage tables and does not create a second Auth dump',t=>{
  const dir=fixture(t);
  fs.writeFileSync(`${dir}/bin/supabase`,'#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$CAPTURE"\n');
  fs.writeFileSync(`${dir}/bin/psql`,'#!/usr/bin/env bash\necho f\n');
  const r=spawnSync(bash,['-c','if command -v cygpath >/dev/null; then TEST_DIR="$(cygpath -u "$TEST_DIR")"; fi; export PATH="$TEST_DIR/bin:$PATH"; export BACKUP_DIR="$TEST_DIR"; bash "$REPO/scripts/backup/backup-database.sh"'],{encoding:'utf8',env:{...process.env,REPO:root,TEST_DIR:dir,BACKUP_DIR:dir,SUPABASE_DB_URL:'not-a-real-connection',CAPTURE:`${dir}/dump-calls`}});
  assert.equal(r.status,0,r.stderr);
  const calls=fs.readFileSync(`${dir}/dump-calls`,'utf8').trim().split('\n');
  assert.equal(calls.length,3);
  assert.match(calls[2],/--data-only/);assert.match(calls[2],/-x storage\.\*/);
  assert.doesNotMatch(calls.join('\n'),/auth-data\.sql|--schema auth/);
});
