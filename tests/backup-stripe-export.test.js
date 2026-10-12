import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { exportStripeBackup, validateStripeBackupKey } from '../scripts/backup/backup-stripe.mjs';

function iterable(items, error = null) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield structuredClone(item);
      if (error) throw error;
    },
  };
}

function live(prefix, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}_${String(index + 1).padStart(4, '0')}`,
    object: prefix,
    livemode: true,
    metadata: { ordinal: String(index + 1) },
  }));
}

function fakeStripe(overrides = {}) {
  const sessions = overrides.sessions ?? live('cs', 2);
  const lineItemsBySession = overrides.lineItemsBySession ?? new Map(
    sessions.map((session, index) => [session.id, live(`li${index + 1}`, index + 1).map(({ livemode, ...item }) => item)]),
  );
  const lists = {
    paymentIntents: overrides.paymentIntents ?? live('pi', 3),
    charges: overrides.charges ?? live('ch', 2),
    refunds: overrides.refunds ?? live('re', 1),
    balanceTransactions: overrides.balanceTransactions ?? live('txn', 4),
    payouts: overrides.payouts ?? live('po', 2),
    disputes: overrides.disputes ?? [],
    customers: overrides.customers ?? live('cus', 2),
    products: overrides.products ?? live('prod', 1),
    prices: overrides.prices ?? live('price', 2),
    webhookEndpoints: overrides.webhookEndpoints ?? live('we', 1),
  };
  const failureCollection = overrides.failureCollection;
  const api = {
    accounts: {
      retrieve: async () => structuredClone(overrides.account ?? { id: 'acct_expected', object: 'account', country: 'FR' }),
    },
    getApiField: (field) => field === 'version' ? '2026-09-30.test' : undefined,
    checkout: {
      sessions: {
        list: () => iterable(sessions, failureCollection === 'checkout_sessions' ? new Error('session list failed') : null),
        listLineItems: (sessionId) => iterable(
          lineItemsBySession.get(sessionId) ?? [],
          failureCollection === 'checkout_session_line_items' ? new Error('line item list failed') : null,
        ),
      },
    },
  };
  for (const [name, items] of Object.entries(lists)) {
    api[name] = {
      list: () => iterable(items, failureCollection === name ? new Error(`${name} failed`) : null),
    };
  }
  return api;
}

async function tempDir() {
  return mkdtemp(path.join(os.tmpdir(), 'lmv-stripe-export-'));
}

async function readNdjson(filePath) {
  const text = await readFile(filePath, 'utf8');
  return text.trim() ? text.trimEnd().split('\n').map(line => JSON.parse(line)) : [];
}



test('Stripe backup accepts only a production restricted key, never a standard secret key', () => {
  assert.equal(validateStripeBackupKey('rk_live_x'), 'rk_live_x');
  assert.throws(() => validateStripeBackupKey('sk_live_x'), /restricted production key/);
  assert.throws(() => validateStripeBackupKey('rk_test_x'), /restricted production key/);
  assert.throws(() => validateStripeBackupKey(''), /restricted production key/);
});
test('Stripe export consumes every item from every async iterable, including more than one API page', async () => {
  const outputDir = await tempDir();
  const paymentIntents = live('pi', 205);

  const result = await exportStripeBackup({
    stripe: fakeStripe({ paymentIntents }),
    outputDir,
    expectedAccountId: 'acct_expected',
    logger: () => {},
  });

  const written = await readNdjson(path.join(outputDir, 'finance', 'payment_intents.ndjson'));
  assert.equal(written.length, 205);
  assert.equal(written.at(-1).id, 'pi_0205');
  assert.equal(result.counts.payment_intents, 205);
  assert.equal(result.counts.checkout_sessions, 2);
  assert.equal(result.counts.checkout_session_line_items, 3);
});

test('Stripe export keeps raw objects and explicitly associates every line item with its Checkout Session', async () => {
  const outputDir = await tempDir();
  const session = { id: 'cs_raw', object: 'checkout.session', livemode: true, client_reference_id: 'LMV-42', metadata: { booking: '42' } };
  const lineItem = { id: 'li_raw', object: 'item', description: 'Séjour', amount_total: 12345, metadata: { keep: 'yes' } };

  await exportStripeBackup({
    stripe: fakeStripe({ sessions: [session], lineItemsBySession: new Map([[session.id, [lineItem]]]) }),
    outputDir,
    expectedAccountId: 'acct_expected',
    logger: () => {},
  });

  assert.deepEqual((await readNdjson(path.join(outputDir, 'checkout', 'checkout_sessions.ndjson')))[0], session);
  assert.deepEqual((await readNdjson(path.join(outputDir, 'checkout', 'checkout_session_line_items.ndjson')))[0], {
    checkout_session_id: 'cs_raw',
    line_item: lineItem,
  });
});

test('Stripe export rejects wrong account before writing a publishable backup', async () => {
  const outputDir = await tempDir();
  await assert.rejects(
    exportStripeBackup({ stripe: fakeStripe({ account: { id: 'acct_wrong', object: 'account' } }), outputDir, expectedAccountId: 'acct_expected', logger: () => {} }),
    /Unexpected Stripe account/,
  );
});

test('Stripe export rejects any object explicitly marked livemode false', async () => {
  const outputDir = await tempDir();
  const paymentIntents = [{ id: 'pi_test', object: 'payment_intent', livemode: false, description: 'must not leak' }];
  await assert.rejects(
    exportStripeBackup({ stripe: fakeStripe({ paymentIntents }), outputDir, expectedAccountId: 'acct_expected', logger: () => {} }),
    /Non-live Stripe object in payment_intents/,
  );
});

test('Stripe export rejects duplicate ids and duplicate line-item ids within one session', async () => {
  const firstDir = await tempDir();
  await assert.rejects(
    exportStripeBackup({ stripe: fakeStripe({ charges: [live('ch', 1)[0], live('ch', 1)[0]] }), outputDir: firstDir, expectedAccountId: 'acct_expected', logger: () => {} }),
    /Duplicate Stripe id in charges/,
  );

  const secondDir = await tempDir();
  const session = live('cs', 1)[0];
  const duplicate = { id: 'li_duplicate', object: 'item' };
  await assert.rejects(
    exportStripeBackup({ stripe: fakeStripe({ sessions: [session], lineItemsBySession: new Map([[session.id, [duplicate, duplicate]]]) }), outputDir: secondDir, expectedAccountId: 'acct_expected', logger: () => {} }),
    /Duplicate Stripe line item id/,
  );
});



test('Stripe export refuses any webhook signing secret instead of archiving it', async () => {
  const outputDir = await tempDir();
  const webhookEndpoints = [{ id: 'we_1', object: 'webhook_endpoint', livemode: true, secret: 'whsec_x' }];
  await assert.rejects(
    exportStripeBackup({ stripe: fakeStripe({ webhookEndpoints }), outputDir, expectedAccountId: 'acct_expected', logger: () => {} }),
    /webhook signing secret/i,
  );
});
test('one Stripe category failure fails completely with safe category context', async () => {
  const outputDir = await tempDir();
  await assert.rejects(
    exportStripeBackup({ stripe: fakeStripe({ failureCollection: 'refunds' }), outputDir, expectedAccountId: 'acct_expected', logger: () => {} }),
    error => {
      assert.match(error.message, /Stripe backup failed in refunds/);
      assert.equal(error.message.includes('refunds failed'), false);
      return true;
    },
  );
});

test('Stripe export never serializes credential environment values into inventory metadata', async () => {
  const outputDir = await tempDir();
  const secrets = ['rk_live_backup_secret_value', 'pcloud_secret_value', 'crypt_secret_value'];
  const previous = {
    STRIPE_BACKUP_KEY: process.env.STRIPE_BACKUP_KEY,
    PCLOUD_TOKEN: process.env.PCLOUD_TOKEN,
    RCLONE_CRYPT_PASSWORD: process.env.RCLONE_CRYPT_PASSWORD,
  };
  process.env.STRIPE_BACKUP_KEY = secrets[0];
  process.env.PCLOUD_TOKEN = secrets[1];
  process.env.RCLONE_CRYPT_PASSWORD = secrets[2];
  try {
    await exportStripeBackup({ stripe: fakeStripe(), outputDir, expectedAccountId: 'acct_expected', logger: () => {} });
    const inventory = await readFile(path.join(outputDir, 'inventory', 'counts.json'), 'utf8');
    for (const secret of secrets) assert.equal(inventory.includes(secret), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
