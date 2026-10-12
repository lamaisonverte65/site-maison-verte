import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function docs() {
  return `${readFileSync('docs/operations/BACKUP_STRIPE_PCLOUD.md', 'utf8')}\n${readFileSync('docs/operations/RECOVERY_STRIPE_BACKUP.md', 'utf8')}`;
}

test('Stripe backup documentation fixes credentials, live-only scope, content and isolated pCloud path', () => {
  const src = docs();
  for (const token of ['STRIPE_BACKUP_KEY', 'STRIPE_EXPECTED_ACCOUNT_ID', '02_Stripe', '03:17 UTC', 'baseline']) assert.match(src, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  assert.match(src, /restricted|restreinte/i);
  assert.match(src, /lecture seule|read-only/i);
  assert.match(src, /production|livemode/i);
  assert.match(src, /STRIPE_SECRET_KEY.*ne doit|ne jamais.*STRIPE_SECRET_KEY/i);
  for (const category of ['payment_intents', 'charges', 'refunds', 'balance_transactions', 'payouts', 'disputes', 'checkout_sessions', 'checkout_session_line_items', 'customers', 'products', 'prices', 'webhook_endpoints']) {
    assert.match(src, new RegExp(category));
  }
  assert.match(src, /backup-download\/stripe\/latest\.json/);
});

test('Stripe docs describe retention, encrypted sensitivity and non-atomic snapshot limits', () => {
  const src = docs();
  assert.match(src, /daily[^\n]*30/i);
  assert.match(src, /weekly[^\n]*(365|12 mois)/i);
  assert.match(src, /monthly[^\n]*(illimit|permanent)/i);
  assert.match(src, /yearly[^\n]*(illimit|permanent)/i);
  assert.match(src, /manual[^\n]*(illimit|permanent|suppression explicite)/i);
  assert.match(src, /données client|données personnelles/i);
  assert.match(src, /rclone crypt|LMVCRYPT/i);
  assert.match(src, /non atomique|non-atomique/i);
  assert.match(src, /secret.*(logs|manifest)|logs.*secret/i);
});

test('Stripe recovery documentation covers verification, lookup identifiers and non-restorable payment history', () => {
  const src = docs();
  assert.match(src, /LMVCRYPT:02_Stripe/);
  assert.match(src, /SHA256SUMS/);
  assert.match(src, /Get-FileHash|sha256/i);
  for (const id of ['PaymentIntent', 'Charge', 'Checkout Session', 'Refund', 'Payout']) assert.match(src, new RegExp(id, 'i'));
  assert.match(src, /ne peut pas.*(réinject|recréer).*paiement|impossible.*réinject/i);
  assert.match(src, /PowerShell/i);
});

test('Stripe docs explain restricted-key setup without requesting or storing its value in documentation', () => {
  const src = docs();
  assert.match(src, /Dashboard Stripe/i);
  assert.match(src, /GitHub[^\n]*secret[^\n]*STRIPE_BACKUP_KEY/i);
  assert.match(src, /ne jamais.*(chat|documentation|dépôt|repository)/i);
  assert.doesNotMatch(src, /rk_(live|test)_[A-Za-z0-9]{8,}/);
  assert.doesNotMatch(src, /sk_(live|test)_[A-Za-z0-9]{8,}/);
});
