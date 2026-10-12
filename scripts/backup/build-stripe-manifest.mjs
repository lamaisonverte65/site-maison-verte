import crypto from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STRIPE_NDJSON_FILES = [
  'finance/payment_intents.ndjson',
  'finance/charges.ndjson',
  'finance/refunds.ndjson',
  'finance/balance_transactions.ndjson',
  'finance/payouts.ndjson',
  'finance/disputes.ndjson',
  'checkout/checkout_sessions.ndjson',
  'checkout/checkout_session_line_items.ndjson',
  'customers/customers.ndjson',
  'catalog/products.ndjson',
  'catalog/prices.ndjson',
  'config/webhook_endpoints.ndjson',
];

const COUNT_KEY_BY_FILE = new Map([
  ['finance/payment_intents.ndjson', 'payment_intents'],
  ['finance/charges.ndjson', 'charges'],
  ['finance/refunds.ndjson', 'refunds'],
  ['finance/balance_transactions.ndjson', 'balance_transactions'],
  ['finance/payouts.ndjson', 'payouts'],
  ['finance/disputes.ndjson', 'disputes'],
  ['checkout/checkout_sessions.ndjson', 'checkout_sessions'],
  ['checkout/checkout_session_line_items.ndjson', 'checkout_session_line_items'],
  ['customers/customers.ndjson', 'customers'],
  ['catalog/products.ndjson', 'products'],
  ['catalog/prices.ndjson', 'prices'],
  ['config/webhook_endpoints.ndjson', 'webhook_endpoints'],
]);

const ARCHIVED_DATA_FILES = ['account/account.json', ...STRIPE_NDJSON_FILES, 'inventory/counts.json'];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function assertBackupIdentity(backupId, backupKind) {
  if (!/^\d{4}-\d{2}-\d{2}_\d{6}Z$/.test(String(backupId ?? ''))) {
    throw new Error('Invalid BACKUP_ID');
  }
  if (!['daily', 'weekly', 'monthly', 'yearly', 'manual', 'baseline'].includes(String(backupKind ?? ''))) {
    throw new Error('Invalid BACKUP_KIND');
  }
}

async function parseNdjson(filePath, relativePath) {
  const text = await readFile(filePath, 'utf8');
  const lines = text === '' ? [] : text.split('\n').filter((line, index, all) => line.length > 0 || index < all.length - 1);
  const objects = [];
  const seen = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) throw new Error(`Invalid NDJSON in ${relativePath} at line ${index + 1}`);
    let object;
    try {
      object = JSON.parse(line);
    } catch {
      throw new Error(`Invalid NDJSON in ${relativePath} at line ${index + 1}`);
    }
    const countKey = COUNT_KEY_BY_FILE.get(relativePath);
    const isLineItem = countKey === 'checkout_session_line_items';
    const raw = isLineItem ? object?.line_item : object;
    if (!isLineItem && raw && Object.prototype.hasOwnProperty.call(raw, 'livemode') && raw.livemode !== true) {
      throw new Error(`Non-live Stripe object in ${countKey}`);
    }
    if (countKey === 'webhook_endpoints' && typeof raw?.secret === 'string' && raw.secret) {
      throw new Error('Webhook signing secret must never be archived');
    }
    const id = typeof raw?.id === 'string' ? raw.id.trim() : '';
    if (!id) throw new Error(`Stripe object without id in ${countKey}`);
    const duplicateKey = isLineItem ? `${String(object?.checkout_session_id ?? '')}\u0000${id}` : id;
    if (isLineItem && !object?.checkout_session_id) throw new Error('Checkout line item missing checkout_session_id');
    if (seen.has(duplicateKey)) throw new Error(`Duplicate Stripe id in ${countKey}`);
    seen.add(duplicateKey);
    objects.push(object);
  }
  return objects;
}

async function detectStripeSdkVersion() {
  try {
    const lock = JSON.parse(await readFile(path.resolve('package-lock.json'), 'utf8'));
    const exact = lock?.packages?.['node_modules/stripe']?.version;
    if (typeof exact === 'string' && exact) return exact;
  } catch {}
  try {
    const pkg = JSON.parse(await readFile(path.resolve('package.json'), 'utf8'));
    const declared = pkg?.dependencies?.stripe;
    if (typeof declared === 'string' && declared) return declared;
  } catch {}
  return null;
}

export async function buildStripeManifest(backupDir, {
  backupId,
  backupKind,
  expectedAccountId,
  stripeSdkVersion = null,
  stripeApiVersion = null,
} = {}) {
  if (!backupDir || path.resolve(backupDir) === path.parse(path.resolve(backupDir || '.')).root) {
    throw new Error('Explicit non-root backup directory is required');
  }
  assertBackupIdentity(backupId, backupKind);
  if (!expectedAccountId) throw new Error('STRIPE_EXPECTED_ACCOUNT_ID is required');

  const accountPath = path.join(backupDir, 'account', 'account.json');
  const account = JSON.parse(await readFile(accountPath, 'utf8'));
  if (account?.id !== expectedAccountId) throw new Error('Unexpected Stripe account in backup');

  const countsPath = path.join(backupDir, 'inventory', 'counts.json');
  const counts = JSON.parse(await readFile(countsPath, 'utf8'));
  const expectedKeys = [...COUNT_KEY_BY_FILE.values()];
  for (const key of expectedKeys) {
    if (!Number.isSafeInteger(counts?.[key]) || counts[key] < 0) throw new Error(`Invalid count for ${key}`);
  }
  for (const key of Object.keys(counts)) {
    if (!expectedKeys.includes(key)) throw new Error(`Unexpected count key: ${key}`);
  }

  for (const relative of STRIPE_NDJSON_FILES) {
    const parsed = await parseNdjson(path.join(backupDir, relative), relative);
    const key = COUNT_KEY_BY_FILE.get(relative);
    if (parsed.length !== counts[key]) throw new Error(`Count mismatch for ${key}: expected ${counts[key]}, found ${parsed.length}`);
  }

  const files = {};
  for (const relative of ARCHIVED_DATA_FILES) {
    const absolute = path.join(backupDir, relative);
    const raw = await readFile(absolute);
    const fileStat = await stat(absolute);
    files[relative] = { size_bytes: fileStat.size, sha256: sha256(raw) };
  }

  const manifest = {
    format_version: 1,
    backup_id: backupId,
    backup_kind: backupKind,
    created_at_utc: new Date().toISOString(),
    stripe_account_id: account.id,
    livemode: true,
    stripe_sdk_version: stripeSdkVersion ?? await detectStripeSdkVersion(),
    stripe_api_version: stripeApiVersion ?? null,
    inventory: counts,
    exported_categories: expectedKeys,
    files,
  };

  await writeFile(path.join(backupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

async function runCli() {
  const backupDir = process.argv[2] || process.env.BACKUP_DIR;
  await buildStripeManifest(backupDir, {
    backupId: process.env.BACKUP_ID,
    backupKind: process.env.BACKUP_KIND,
    expectedAccountId: process.env.STRIPE_EXPECTED_ACCOUNT_ID,
    stripeSdkVersion: process.env.STRIPE_SDK_VERSION || null,
    stripeApiVersion: process.env.STRIPE_API_VERSION || null,
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli().catch(() => {
    console.error('Stripe backup manifest validation failed.');
    process.exitCode = 1;
  });
}
