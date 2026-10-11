import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { processCheckoutSessionCompleted } from '../netlify/functions/_lib/stripe-checkout-completed.js';

const migration = fs.readFileSync('supabase/migrations/202610090005_v410_cleaning_payment_webhook.sql', 'utf8');
const webhook = fs.readFileSync('netlify/functions/stripe-webhook.js', 'utf8');

test('cleaning checkout uses dedicated payment application and never contractual payment RPC', async () => {
  let regularCalls = 0;
  let cleaningCalls = 0;
  const result = await processCheckoutSessionCompleted({
    session: {
      id:'cs_clean', amount_total:5000, currency:'eur', payment_intent:'pi_clean', customer_email:'c@example.test',
      metadata:{ booking_id:'b1', payment_type:'manual', manual_reason:'cleaning', cleaning_issue_id:'i1' },
    },
    stripeEventCreated: 1790000000,
    dependencies: {
      getFinancialDetails: async () => ({ stripeFeeAmount:1, stripeNetAmount:49, stripeBalanceTransactionId:'txn1', stripeChargeId:'ch1' }),
      applyPayment: async () => { regularCalls += 1; return { outcome:'applied', booking:{} }; },
      applyCleaningPayment: async (payload) => { cleaningCalls += 1; assert.equal(payload.cleaningIssueId, 'i1'); return { outcome:'applied', booking:{ id:'b1' } }; },
      sendConfirmationEmail: async () => {},
      createArrivalCapability: () => ({ token:'arrival', hash:'hash' }),
    },
  });
  assert.equal(result.outcome, 'applied');
  assert.equal(cleaningCalls, 1);
  assert.equal(regularCalls, 0);
});

test('cleaning payment SQL is idempotent and does not mutate contract_total', () => {
  assert.match(migration, /apply_post_stay_cleaning_payment/i);
  assert.match(migration, /on conflict \(stripe_checkout_session_id\) do nothing/i);
  assert.match(migration, /status = 'paid'/i);
  assert.match(migration, /payment_id = v_payment_id/i);
  assert.doesNotMatch(migration, /update\s+public\.booking_requests/i);
  assert.doesNotMatch(migration, /contract_total\s*=/i);
});

test('stripe webhook wires the dedicated cleaning RPC', () => {
  assert.match(webhook, /applyCleaningPayment/);
  assert.match(webhook, /apply_post_stay_cleaning_payment/);
});


test('Stripe balance lookup keeps a payment that intentionally has no booking_request_id', () => {
  assert.match(webhook, /if \(payment\) \{[\s\S]*?return \{ booking: null, payment \};[\s\S]*?\}/);
});


test('cleaning payment records Stripe fee/net against the cleaning payment without booking aggregates', () => {
  assert.match(migration, /p_stripe_fee_amount\s+numeric/i);
  assert.match(migration, /insert into public\.stripe_balance_transactions/i);
  assert.match(migration, /booking_request_id,\s*payment_id/i);
  assert.match(migration, /null,\s*v_payment_id,\s*'manual'/i);
  const cleaningApplyBlock = webhook.slice(
    webhook.indexOf('async function applyCleaningPayment'),
    webhook.indexOf('async function applyCheckoutPayment'),
  );
  assert.match(cleaningApplyBlock, /p_stripe_fee_amount:\s*payload\.stripeFeeAmount/);
  assert.match(cleaningApplyBlock, /p_balance_transaction_id:\s*payload\.balanceTransactionId/);
});
