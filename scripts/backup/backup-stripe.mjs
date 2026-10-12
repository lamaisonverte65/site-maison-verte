import { mkdir, open, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COLLECTIONS = [
  ['payment_intents', ['finance', 'payment_intents.ndjson'], stripe => stripe.paymentIntents.list({ limit: 100 })],
  ['charges', ['finance', 'charges.ndjson'], stripe => stripe.charges.list({ limit: 100 })],
  ['refunds', ['finance', 'refunds.ndjson'], stripe => stripe.refunds.list({ limit: 100 })],
  ['balance_transactions', ['finance', 'balance_transactions.ndjson'], stripe => stripe.balanceTransactions.list({ limit: 100 })],
  ['payouts', ['finance', 'payouts.ndjson'], stripe => stripe.payouts.list({ limit: 100 })],
  ['disputes', ['finance', 'disputes.ndjson'], stripe => stripe.disputes.list({ limit: 100 })],
  ['customers', ['customers', 'customers.ndjson'], stripe => stripe.customers.list({ limit: 100 })],
  ['products', ['catalog', 'products.ndjson'], stripe => stripe.products.list({ limit: 100 })],
  ['prices', ['catalog', 'prices.ndjson'], stripe => stripe.prices.list({ limit: 100 })],
  ['webhook_endpoints', ['config', 'webhook_endpoints.ndjson'], stripe => stripe.webhookEndpoints.list({ limit: 100 })],
];


export function validateStripeBackupKey(value) {
  const key = String(value ?? '').trim();
  if (!key.startsWith('rk_live_')) {
    throw new Error('STRIPE_BACKUP_KEY must be a restricted production key');
  }
  return key;
}


function isSafeBackupError(error) {
  return /^(Non-live Stripe object|Duplicate Stripe|Stripe object without id|Webhook signing secret|Unexpected Stripe account|STRIPE_)/.test(String(error?.message ?? ''));
}

async function withCollectionContext(collectionName, operation) {
  try {
    return await operation();
  } catch (error) {
    if (isSafeBackupError(error)) throw error;
    throw new Error(`Stripe backup failed in ${collectionName}`, { cause: error });
  }
}

function assertLiveMode(item, collectionName) {
  if (item && Object.prototype.hasOwnProperty.call(item, 'livemode') && item.livemode !== true) {
    throw new Error(`Non-live Stripe object in ${collectionName}`);
  }
}

function assertStripeId(item, collectionName) {
  const id = typeof item?.id === 'string' ? item.id.trim() : '';
  if (!id) throw new Error(`Stripe object without id in ${collectionName}`);
  return id;
}

export async function writeNdjsonCollection({ iterable, filePath, collectionName, requireLiveMode = true }) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const handle = await open(filePath, 'w');
  const seen = new Set();
  let count = 0;
  const items = [];
  try {
    for await (const item of iterable) {
      const id = assertStripeId(item, collectionName);
      if (seen.has(id)) throw new Error(`Duplicate Stripe id in ${collectionName}`);
      seen.add(id);
      if (requireLiveMode) assertLiveMode(item, collectionName);
      if (collectionName === 'webhook_endpoints' && typeof item?.secret === 'string' && item.secret) {
        throw new Error('Webhook signing secret must never be archived');
      }
      await handle.write(`${JSON.stringify(item)}\n`);
      items.push(item);
      count += 1;
    }
  } finally {
    await handle.close();
  }
  return { count, items };
}

export async function writeCheckoutLineItems({ stripe, sessions, filePath }) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const handle = await open(filePath, 'w');
  let count = 0;
  try {
    for (const session of sessions) {
      const seenForSession = new Set();
      for await (const lineItem of stripe.checkout.sessions.listLineItems(session.id, { limit: 100 })) {
        const id = assertStripeId(lineItem, 'checkout_session_line_items');
        if (seenForSession.has(id)) throw new Error(`Duplicate Stripe line item id in Checkout Session ${session.id}`);
        seenForSession.add(id);
        await handle.write(`${JSON.stringify({ checkout_session_id: session.id, line_item: lineItem })}\n`);
        count += 1;
      }
    }
  } finally {
    await handle.close();
  }
  return count;
}

export async function exportStripeBackup({ stripe, outputDir, expectedAccountId, logger = console.log }) {
  if (!stripe) throw new Error('Stripe client is required');
  if (!outputDir) throw new Error('Stripe backup output directory is required');
  if (!expectedAccountId) throw new Error('STRIPE_EXPECTED_ACCOUNT_ID is required');

  const account = await withCollectionContext('account_identity', () => stripe.accounts.retrieve());
  if (account?.id !== expectedAccountId) {
    throw new Error(`Unexpected Stripe account: expected ${expectedAccountId}`);
  }

  for (const directory of ['account', 'finance', 'checkout', 'customers', 'catalog', 'config', 'inventory']) {
    await mkdir(path.join(outputDir, directory), { recursive: true });
  }
  await writeFile(path.join(outputDir, 'account', 'account.json'), `${JSON.stringify(account, null, 2)}\n`, 'utf8');

  const counts = {};
  for (const [collectionName, relativePath, getIterable] of COLLECTIONS) {
    const { count } = await withCollectionContext(collectionName, () => writeNdjsonCollection({
      iterable: getIterable(stripe),
      filePath: path.join(outputDir, ...relativePath),
      collectionName,
      requireLiveMode: true,
    }));
    counts[collectionName] = count;
    logger(`${collectionName}: ${count}`);
  }

  const sessionResult = await withCollectionContext('checkout_sessions', () => writeNdjsonCollection({
    iterable: stripe.checkout.sessions.list({ limit: 100 }),
    filePath: path.join(outputDir, 'checkout', 'checkout_sessions.ndjson'),
    collectionName: 'checkout_sessions',
    requireLiveMode: true,
  }));
  counts.checkout_sessions = sessionResult.count;
  logger(`checkout_sessions: ${sessionResult.count}`);

  counts.checkout_session_line_items = await withCollectionContext('checkout_session_line_items', () => writeCheckoutLineItems({
    stripe,
    sessions: sessionResult.items,
    filePath: path.join(outputDir, 'checkout', 'checkout_session_line_items.ndjson'),
  }));
  logger(`checkout_session_line_items: ${counts.checkout_session_line_items}`);

  await writeFile(
    path.join(outputDir, 'inventory', 'counts.json'),
    `${JSON.stringify(counts, null, 2)}\n`,
    'utf8',
  );

  return {
    accountId: account.id,
    apiVersion: typeof stripe.getApiField === 'function' ? (stripe.getApiField('version') ?? null) : null,
    counts,
  };
}

async function runCli() {
  const outputDir = process.env.BACKUP_DIR;
  const apiKey = process.env.STRIPE_BACKUP_KEY;
  const expectedAccountId = process.env.STRIPE_EXPECTED_ACCOUNT_ID;
  if (!outputDir) throw new Error('BACKUP_DIR is required');
  const validatedApiKey = validateStripeBackupKey(apiKey);
  if (!expectedAccountId) throw new Error('STRIPE_EXPECTED_ACCOUNT_ID is required');

  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(validatedApiKey, { maxNetworkRetries: 3 });
  await exportStripeBackup({ stripe, outputDir, expectedAccountId });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli().catch(error => {
    const message = String(error?.message ?? '');
    const safe = /^(STRIPE_|Stripe backup|Unexpected Stripe account|Non-live Stripe object|Duplicate Stripe|Stripe object without id|Webhook signing secret)/.test(message);
    console.error(safe ? message : 'Stripe backup failed.');
    process.exitCode = 1;
  });
}
