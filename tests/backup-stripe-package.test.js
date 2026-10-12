import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { buildStripeManifest, STRIPE_NDJSON_FILES } from '../scripts/backup/build-stripe-manifest.mjs';

const countsByPath = {
  'finance/payment_intents.ndjson': 'payment_intents',
  'finance/charges.ndjson': 'charges',
  'finance/refunds.ndjson': 'refunds',
  'finance/balance_transactions.ndjson': 'balance_transactions',
  'finance/payouts.ndjson': 'payouts',
  'finance/disputes.ndjson': 'disputes',
  'checkout/checkout_sessions.ndjson': 'checkout_sessions',
  'checkout/checkout_session_line_items.ndjson': 'checkout_session_line_items',
  'customers/customers.ndjson': 'customers',
  'catalog/products.ndjson': 'products',
  'catalog/prices.ndjson': 'prices',
  'config/webhook_endpoints.ndjson': 'webhook_endpoints',
};

async function fixture({ empty = false } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lmv-stripe-package-'));
  const counts = {};
  await mkdir(path.join(dir, 'account'), { recursive: true });
  await mkdir(path.join(dir, 'inventory'), { recursive: true });
  await writeFile(path.join(dir, 'account', 'account.json'), JSON.stringify({ id: 'acct_expected', object: 'account', country: 'FR' }) + '\n');

  for (const relative of STRIPE_NDJSON_FILES) {
    const key = countsByPath[relative];
    await mkdir(path.dirname(path.join(dir, relative)), { recursive: true });
    if (empty) {
      await writeFile(path.join(dir, relative), '');
      counts[key] = 0;
      continue;
    }
    const object = relative.includes('checkout_session_line_items')
      ? { checkout_session_id: 'cs_1', line_item: { id: 'li_1', object: 'item' } }
      : { id: `${key}_1`, object: key, livemode: true };
    await writeFile(path.join(dir, relative), JSON.stringify(object) + '\n');
    counts[key] = 1;
  }
  await writeFile(path.join(dir, 'inventory', 'counts.json'), JSON.stringify(counts, null, 2) + '\n');
  return { dir, counts };
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

test('Stripe manifest validates every NDJSON line and reproduces exact counts', async () => {
  const { dir, counts } = await fixture();
  const manifest = await buildStripeManifest(dir, {
    backupId: '2026-10-12_120000Z',
    backupKind: 'manual',
    expectedAccountId: 'acct_expected',
    stripeSdkVersion: '22.1.1',
    stripeApiVersion: '2026-09-30.test',
  });
  assert.deepEqual(manifest.inventory, counts);
  assert.deepEqual(manifest.exported_categories.sort(), Object.keys(counts).sort());
});

test('Stripe manifest records exact file size and SHA256 without circular self-hash', async () => {
  const { dir } = await fixture();
  const manifest = await buildStripeManifest(dir, {
    backupId: '2026-10-12_120000Z', backupKind: 'manual', expectedAccountId: 'acct_expected', stripeSdkVersion: '22.1.1', stripeApiVersion: null,
  });
  assert.equal(Object.hasOwn(manifest.files, 'manifest.json'), false);
  assert.equal(Object.hasOwn(manifest.files, 'SHA256SUMS'), false);
  const relative = 'finance/payment_intents.ndjson';
  const raw = await readFile(path.join(dir, relative));
  assert.deepEqual(manifest.files[relative], { size_bytes: raw.length, sha256: sha256(raw) });
});

test('Stripe package rejects malformed NDJSON before checksums are accepted', async () => {
  const { dir } = await fixture();
  await writeFile(path.join(dir, 'finance', 'refunds.ndjson'), '{not json}\n');
  await assert.rejects(
    buildStripeManifest(dir, { backupId: '2026-10-12_120000Z', backupKind: 'manual', expectedAccountId: 'acct_expected', stripeSdkVersion: '22.1.1' }),
    /Invalid NDJSON in finance\/refunds\.ndjson/,
  );
});



test('Stripe package refuses an archived webhook signing secret', async () => {
  const { dir, counts } = await fixture();
  await writeFile(
    path.join(dir, 'config', 'webhook_endpoints.ndjson'),
    JSON.stringify({ id: 'we_1', object: 'webhook_endpoint', livemode: true, secret: 'whsec_x' }) + '\n',
  );
  counts.webhook_endpoints = 1;
  await writeFile(path.join(dir, 'inventory', 'counts.json'), JSON.stringify(counts) + '\n');
  await assert.rejects(
    buildStripeManifest(dir, { backupId: '2026-10-12_120000Z', backupKind: 'manual', expectedAccountId: 'acct_expected', stripeSdkVersion: '22.1.1' }),
    /webhook signing secret/i,
  );
});
test('Stripe package rejects a counts.json mismatch', async () => {
  const { dir, counts } = await fixture();
  counts.refunds = 99;
  await writeFile(path.join(dir, 'inventory', 'counts.json'), JSON.stringify(counts) + '\n');
  await assert.rejects(
    buildStripeManifest(dir, { backupId: '2026-10-12_120000Z', backupKind: 'manual', expectedAccountId: 'acct_expected', stripeSdkVersion: '22.1.1' }),
    /Count mismatch for refunds/,
  );
});

test('Stripe package accepts zero objects only as an explicit empty NDJSON collection', async () => {
  const { dir, counts } = await fixture({ empty: true });
  const manifest = await buildStripeManifest(dir, {
    backupId: '2026-10-12_120000Z', backupKind: 'baseline', expectedAccountId: 'acct_expected', stripeSdkVersion: '22.1.1',
  });
  assert.deepEqual(manifest.inventory, counts);
  assert.equal(Object.values(counts).every(value => value === 0), true);
});

test('Stripe manifest contains account id, backup identity, live mode, SDK/API version and exported categories', async () => {
  const { dir } = await fixture();
  const manifest = await buildStripeManifest(dir, {
    backupId: '2026-10-12_120000Z', backupKind: 'daily', expectedAccountId: 'acct_expected', stripeSdkVersion: '22.1.1', stripeApiVersion: '2026-09-30.test',
  });
  assert.equal(manifest.format_version, 1);
  assert.equal(manifest.backup_id, '2026-10-12_120000Z');
  assert.equal(manifest.backup_kind, 'daily');
  assert.equal(manifest.stripe_account_id, 'acct_expected');
  assert.equal(manifest.livemode, true);
  assert.equal(manifest.stripe_sdk_version, '22.1.1');
  assert.equal(manifest.stripe_api_version, '2026-09-30.test');
  assert.match(manifest.created_at_utc, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(manifest.exported_categories.length, 12);
});

test('Stripe manifest and inventory never contain credential environment values', async () => {
  const { dir } = await fixture();
  const secrets = ['rk_live_NEVER_ARCHIVE', 'PCLOUD_NEVER_ARCHIVE', 'CRYPT_NEVER_ARCHIVE'];
  const old = [process.env.STRIPE_BACKUP_KEY, process.env.PCLOUD_TOKEN, process.env.RCLONE_CRYPT_PASSWORD];
  [process.env.STRIPE_BACKUP_KEY, process.env.PCLOUD_TOKEN, process.env.RCLONE_CRYPT_PASSWORD] = secrets;
  try {
    await buildStripeManifest(dir, { backupId: '2026-10-12_120000Z', backupKind: 'manual', expectedAccountId: 'acct_expected', stripeSdkVersion: '22.1.1' });
    const joined = `${await readFile(path.join(dir, 'manifest.json'), 'utf8')}\n${await readFile(path.join(dir, 'inventory', 'counts.json'), 'utf8')}`;
    for (const secret of secrets) assert.equal(joined.includes(secret), false);
  } finally {
    if (old[0] === undefined) delete process.env.STRIPE_BACKUP_KEY; else process.env.STRIPE_BACKUP_KEY = old[0];
    if (old[1] === undefined) delete process.env.PCLOUD_TOKEN; else process.env.PCLOUD_TOKEN = old[1];
    if (old[2] === undefined) delete process.env.RCLONE_CRYPT_PASSWORD; else process.env.RCLONE_CRYPT_PASSWORD = old[2];
  }
});

test('assemble Stripe backup runs export then manifest then deterministic SHA256 and rejects nonempty BACKUP_DIR', () => {
  const source = readFileSync('scripts/backup/assemble-stripe-backup.sh', 'utf8');
  const exportAt = source.indexOf('backup-stripe.mjs');
  const manifestAt = source.indexOf('build-stripe-manifest.mjs');
  const checksumAt = source.indexOf('SHA256SUMS');
  assert.ok(exportAt >= 0 && manifestAt > exportAt && checksumAt > manifestAt);
  assert.match(source, /BACKUP_DIR must be empty|Backup directory must be empty/i);
  assert.match(source, /sort/);
});
