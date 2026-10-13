import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readRequired } from './backup-test-helpers.js';

const builderUrl = pathToFileURL(join(process.cwd(), 'scripts/backup/build-contracts-archive.mjs')).href;
async function loadBuilder() { return import(`${builderUrl}?t=${Date.now()}-${Math.random()}`); }
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

async function fixture({ alias = 'V1.2' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'lmv-contracts-'));
  const sourceDir = join(root, 'public', 'documents');
  const archiveDir = join(root, 'archive');
  await mkdir(sourceDir, { recursive: true });
  const payloads = new Map([
    ['contrat-location-V1.1.pdf', Buffer.from('%PDF-v1.1\nA')],
    ['contrat-location-V1.2.pdf', Buffer.from('%PDF-v1.2\nB')],
  ]);
  for (const [name, bytes] of payloads) await writeFile(join(sourceDir, name), bytes);
  await writeFile(join(sourceDir, 'contrat-location.pdf'), payloads.get(`contrat-location-${alias}.pdf`));
  return { sourceDir, archiveDir, payloads };
}

test('builder archives immutable PDFs with deterministic manifest/checksums and validates explicit current version', async () => {
  const { buildContractsArchive } = await loadBuilder();
  const { sourceDir, archiveDir, payloads } = await fixture();
  const result = await buildContractsArchive({ sourceDir, archiveDir, currentVersion: 'v1.2' });
  assert.equal(result.currentVersion, 'V1.2');
  const manifest = JSON.parse(await readFile(join(archiveDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.current_version, 'V1.2');
  assert.equal(manifest.current_filename, 'contrat-location-V1.2.pdf');
  assert.equal(manifest.contract_count, 2);
  assert.deepEqual(manifest.contracts.map((x) => x.version), ['V1.1', 'V1.2']);
  assert.equal(manifest.contracts.filter((x) => x.current).length, 1);
  assert.equal(manifest.contracts.find((x) => x.current).version, 'V1.2');
  const sums = await readFile(join(archiveDir, 'SHA256SUMS'), 'utf8');
  assert.match(sums, new RegExp(`${sha(payloads.get('contrat-location-V1.1.pdf'))}  contrat-location-V1\\.1\\.pdf`));
  assert.doesNotMatch(sums, /contrat-location\.pdf/);
});

test('builder refuses alias mismatch and current-version/highest-version mismatch', async () => {
  const { buildContractsArchive } = await loadBuilder();
  const a = await fixture({ alias: 'V1.1' });
  await assert.rejects(() => buildContractsArchive({ sourceDir: a.sourceDir, archiveDir: a.archiveDir, currentVersion: 'v1.2' }), /alias.*not identical/i);
  const b = await fixture();
  await assert.rejects(() => buildContractsArchive({ sourceDir: b.sourceDir, archiveDir: b.archiveDir, currentVersion: 'v1.1' }), /highest contract version.*CURRENT_CONTRACT_VERSION/i);
});

test('pCloud script uses existing encrypted backup root, Europe endpoint, immutability and verification', () => {
  const src = readRequired('scripts/backup/archive-contracts-pcloud.sh');
  assert.match(src, /RCLONE_CONFIG_LMVPCLOUD_HOSTNAME=eapi\.pcloud\.com/);
  assert.match(src, /La Maison Verte\/Backups_Chiffres/);
  assert.match(src, /LMVCRYPT:\$\{REMOTE_ROOT\}/);
  assert.match(src, /--immutable/);
  assert.match(src, /rclone cryptcheck/);
  assert.match(src, /rclone deletefile "\$REMOTE\/_SUCCESS"/);
  assert.ok(src.indexOf('rclone deletefile "$REMOTE/_SUCCESS"') < src.indexOf('rclone copyto "$file"'));
  assert.doesNotMatch(src, /rclone purge\s+"?LMVCRYPT:03_Documents\/contrats/);
});

test('workflow is manual-only and isolated from Supabase/Stripe', () => {
  const src = readRequired('.github/workflows/archive-contracts-pcloud.yml');
  assert.match(src, /workflow_dispatch:/);
  assert.doesNotMatch(src, /\npush:/);
  assert.doesNotMatch(src, /schedule:/);
  assert.match(src, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(src, /build-contracts-archive\.mjs/);
  assert.match(src, /archive-contracts-pcloud\.sh/);
  assert.doesNotMatch(src, /SUPABASE_/);
  assert.doesNotMatch(src, /STRIPE_/);
});
