import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planDirectStripeAccounting } from '../netlify/functions/_lib/direct-stripe-accounting-import.js';
import { buildAccountingReconciliation } from '../netlify/functions/_lib/accounting-reconciliation.js';
const categories = [{ id: 'inc', code: 'rental_direct', entry_kind: 'income' }, { id: 'fee', code: 'payment_fees', entry_kind: 'expense' }];
const money = [
  { amount: 96, fee: 1.69, date: '2026-05-31', booking: 'b1' },
  { amount: 195, fee: 3.18, date: '2026-09-08', booking: 'b2' },
  { amount: 144, fee: 4.93, date: '2026-09-15', booking: 'b3' },
  { amount: 336, fee: 11.17, date: '2026-09-18', booking: 'b3' },
  { amount: 238.28, fee: 3.82, date: '2026-10-03', booking: 'b4' },
  { amount: 224, fee: 3.61, date: '2026-10-05', booking: 'b1' },
];
function fixture() {
  const payments = money.map((p, i) => ({
    id: `p${i + 1}`, booking_request_id: p.booking, payment_type: i % 2 ? 'balance' : 'deposit',
    status: 'paid', amount: p.amount, currency: 'eur', paid_at: `${p.date}T12:00:00Z`, stripe_payment_intent_id: `pi_${i}`,
  }));
  const transactions = money.map((p, i) => ({
    id: `bt_${i}`, payment_id: `p${i+1}`, payment_intent_id: `pi_${i}`, type: 'charge',
    amount: p.amount, fee: p.fee, net: Math.round((p.amount - p.fee) * 100) / 100, currency: 'eur',
  }));
  return { year: 2026, payments, transactions, entries: [], categories };
}
const build = (input) => planDirectStripeAccounting(input);

test('six real-style direct payments yield six incomes + six exact Stripe fees, no booking totals', () => {
  const result = build(fixture());
  assert.equal(result.readyCount, 6);
  assert.equal(result.blockedCount, 0);
  assert.equal(result.inserts.length, 12);
  assert.equal(result.grossToCreateCents, 123328);
  assert.equal(result.feesToCreateCents, 2840);
  assert.equal(result.inserts.filter(e => e.entry_kind === 'income').reduce((s,e) => s + Math.round(e.amount_ttc * 100), 0), 123328);
  assert.equal(result.inserts.filter(e => e.entry_kind === 'expense').reduce((s,e) => s + Math.round(e.amount_ttc * 100), 0), 2840);
  assert.equal(new Set(result.inserts.map(r => `${r.source}:${r.source_record_key}`)).size, 12);
  assert.ok(result.inserts.every(r => r.source === 'stripe' && r.metadata.payment_id && r.entry_date.startsWith('2026')));
});

test('after inserting entries, rerunning is idempotent and economic summary does not double count fees', () => {
  const original = fixture();
  const plan = build(original);
  const entries = plan.inserts.map((e,i) => ({ id: `entry${i}`, ...e, accounting_categories: { code: e.entry_kind === 'expense' ? 'payment_fees' : 'rental_direct' } }));
  const second = build({ ...original, entries });
  assert.equal(second.alreadyCount, 6);
  assert.equal(second.readyCount, 0);
  assert.equal(second.inserts.length, 0);
  const result = buildAccountingReconciliation({ year: 2026, payments: original.payments,
    stripeBalanceTransactions: original.transactions, accountingEntries: entries,
    bookings: original.payments.map(p => ({ id: p.booking_request_id })), refundOperations: [],
    externalFinancials: [], invoices: [], creditNotes: [], cleaningIssues: [], additionalCharges: [] });
  assert.equal(result.rows.length, 6);
  assert.equal(result.accountingSummary.receiptsCents, 123328);
  assert.equal(result.accountingSummary.paymentFeesCents, 2840);
  assert.equal(result.accountingSummary.economicNetCents, 120488);
  assert.equal(result.accountingSummary.expensesCents, 0);
  assert.ok(result.rows.every(r => r.accountingStatus === 'coherent' && r.accountingEntryIds.length === 2));
});

test('manual receipt for same booking/day/amount blocks import rather than duplicate', () => {
  const x = fixture();
  x.entries = [{ id: 'manual', source: 'manual', booking_request_id: 'b1', entry_kind: 'income',
    entry_date: '2026-05-31', amount_ttc: 96 }];
  const r = build(x);
  assert.equal(r.blockedCount, 1);
  assert.match(r.rows[0].reason, /déjà saisie/);
  assert.equal(r.inserts.filter(e => e.booking_request_id === 'b1' && e.entry_date === '2026-05-31').length, 0);
});

test('same amount as another payment but with different date and booking remains distinct', () => {
  const x = fixture();
  x.entries = [{ id: 'unrelated', source: 'manual', booking_request_id: 'elsewhere', entry_kind: 'income',
    entry_date: '2026-05-31', amount_ttc: 96 }];
  assert.equal(build(x).readyCount, 6);
});

test('a one-cent Stripe mismatch blocks that payment; no inferred fee or net', () => {
  const x = fixture();
  x.transactions[0].net = 94.32; // expected 94.31
  const r = build(x);
  assert.equal(r.blockedCount, 1);
  assert.equal(r.readyCount, 5);
  assert.equal(r.rows[0].status, 'blocked');
  assert.ok(!r.inserts.some(e => e.metadata.payment_id === 'p1'));
});

test('ambiguous Stripe charge and missing Stripe fee block affected payments', () => {
  const x = fixture();
  x.transactions.push({ ...x.transactions[0], id: 'second-match' });
  x.transactions[1].fee = null;
  const r = build(x);
  assert.equal(r.blockedCount, 2);
});

test('a paid payment without paid_at is never assigned to an accounting year', () => {
  const x = fixture();
  x.payments[0].paid_at = null;
  assert.equal(build(x).readyCount, 5);
  const result = build({ ...x, selectedIds: ['p1'] });
  assert.equal(result.blockedCount, 1);
  assert.equal(result.inserts.length, 0);
});

test('refunds, cancelled, post-stay and non-euro payments cannot be imported automatically', () => {
  const x = fixture();
  x.payments[0].status = 'refunded';
  x.payments[1].status = 'cancelled';
  x.payments[2].payment_type = 'manual';
  x.payments[3].currency = 'usd';
  const r = build(x);
  assert.equal(r.blockedCount, 4);
  assert.equal(r.readyCount, 2);
});

test('an existing complete receipt with missing fee only creates fee, not income again', () => {
  const x = fixture();
  const first = build(x).inserts[0];
  x.entries.push({ id: 'existing', ...first });
  const r = build(x);
  assert.equal(r.readyCount, 6);
  assert.equal(r.inserts.filter(e => e.metadata.payment_id === 'p1').length, 1);
  assert.equal(r.inserts.find(e => e.metadata.payment_id === 'p1').entry_kind, 'expense');
});

test('a mismatched existing linked fee is not overwritten or assumed correct', () => {
  const x = fixture();
  const plan = build(x);
  const income = plan.inserts[0];
  const fee = plan.inserts[1];
  x.entries.push({ id: 'income', ...income }, { id: 'fee', ...fee, amount_ttc: 1.70 });
  const r = build(x);
  assert.equal(r.rows[0].status, 'blocked');
  assert.equal(r.inserts.some(e => e.metadata.payment_id === 'p1'), false);
});

test('a mismatched fee in reconciliation is reviewable but does not become a second economic expense', () => {
  const x = fixture();
  const imported = build(x).inserts.map((e,i) => ({ id: `e${i}`, ...e }));
  imported[1].amount_ttc = 1.70;
  const result = buildAccountingReconciliation({ year: 2026, payments: x.payments,
    stripeBalanceTransactions: x.transactions, accountingEntries: imported,
    bookings: [], refundOperations: [], externalFinancials: [], invoices: [], creditNotes: [],
    cleaningIssues: [], additionalCharges: [] });
  const row = result.rows.find(r => r.id === 'direct-payment:p1');
  assert.equal(row.accountingStatus, 'a_verifier');
  assert.ok(row.reasons.includes('direct_stripe_fee_mismatch'));
  assert.equal(result.rows.length, 6);
  assert.equal(result.accountingSummary.economicNetCents, 120488);
});

test('owner-only endpoint uses server-calculated INSERT, not a client-supplied accounting amount', () => {
  const endpoint = fs.readFileSync(new URL('../netlify/functions/admin-direct-stripe-accounting.js', import.meta.url), 'utf8');
  assert.match(endpoint, /authorizeAdminRequest\(event, supabase, \{ ownerOnly: true \}\)/);
  assert.match(endpoint, /supabase\.from\('accounting_entries'\)\.insert\(inserts\)/);
  assert.doesNotMatch(endpoint, /\.upsert\(inserts/);
  assert.match(endpoint, /plan\.blockedCount/);
  assert.match(endpoint, /selectedIds: ids/);
});

test('Import UI requires an explicit preview and confirmation before server POST', () => {
  const ui = fs.readFileSync(new URL('../src/components/admin/DirectStripeAccountingImport.jsx', import.meta.url), 'utf8');
  assert.match(ui, /window\.confirm\(/);
  assert.match(ui, /previewDirectStripeAccounting\(year\)/);
  assert.match(ui, /commitDirectStripeAccounting\(year, chosen\.map/);
  assert.doesNotMatch(ui, /useEffect\([^\n]+commitDirectStripeAccounting/);
});

test('one Stripe charge cannot justify two distinct Direct payment records', () => {
  const x = fixture();
  x.payments[1].stripe_payment_intent_id = x.payments[0].stripe_payment_intent_id;
  x.transactions[1].payment_intent_id = x.transactions[0].payment_intent_id;
  // Each payment now sees two charges: neither should be imported.
  const result = build(x);
  assert.equal(result.blockedCount, 2);
});
