import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyAutoDirectStripeAccounting, syncAutoDirectStripeAccounting } from '../netlify/functions/_lib/auto-direct-stripe-accounting.js';
const payment = {
  id: 'p-1', booking_request_id: 'b-1', payment_type: 'deposit', amount: 195,
  currency: 'eur', status: 'paid', stripe_payment_intent_id: 'pi_1',
  stripe_checkout_session_id: 'cs_1', paid_at: '2026-09-08T18:52:13Z',
};
const charge = { id: 'txn-1', payment_id: 'p-1', payment_intent_id: 'pi_1', type: 'charge',
  amount: 195, fee: 3.18, net: 191.82, currency: 'eur' };
const categories = [{ id: 'inc', code: 'rental_direct', entry_kind: 'income' },
  { id: 'fee', code: 'payment_fees', entry_kind: 'expense' }];

function setup(overrides = {}) {
  const state = { payment: { ...payment }, charge: { ...charge }, entries: [], categories, ...overrides };
  const inserted = [];
  async function go() {
    return applyAutoDirectStripeAccounting({
      payment: state.payment,
      transactions: [state.charge], entries: state.entries, categories: state.categories,
      insertEntries: async (rows) => {
        inserted.push(...rows);
        state.entries.push(...rows.map((r,i) => ({ ...r, id: `e${inserted.length}-${i}` })));
      },
    });
  }
  return { state, inserted, go };
}

test('un acompte confirmé crée exactement sa recette et ses frais réels', async () => {
  const t = setup();
  assert.deepEqual(await t.go(), { outcome: 'created', created: 2 });
  assert.deepEqual(t.inserted.map(e => [e.entry_kind, e.amount_ttc]), [['income', 195], ['expense', 3.18]]);
  assert.deepEqual(t.inserted.map(e => e.entry_date), ['2026-09-08','2026-09-08']);
  assert.deepEqual(t.inserted.map(e => e.source_record_key), ['direct:payment:p-1','direct:fee:p-1']);
});

test('un webhook Stripe rejoué ne recrée rien', async () => {
  const t = setup();
  await t.go();
  assert.deepEqual(await t.go(), { outcome: 'already_recorded', created: 0 });
  assert.equal(t.state.entries.length, 2);
});

test('un paiement déjà importé manuellement dans le chantier B1 est reconnu', async () => {
  const t = setup();
  await t.go();
  assert.equal((await t.go()).outcome, 'already_recorded');
});

test('une transaction sans frais justificatifs ne crée pas de fausse charge à 0 €', async () => {
  const t = setup({ charge: { ...charge, fee: null } });
  const result = await t.go();
  assert.equal(result.outcome, 'needs_review');
  assert.equal(t.inserted.length, 0);
});

test('un centime discordant bloque toute écriture', async () => {
  const t = setup({ charge: { ...charge, net: 191.83 } });
  assert.equal((await t.go()).outcome, 'needs_review');
  assert.equal(t.inserted.length, 0);
});

test('une recette historique remboursée est comptabilisée une seule fois à sa date paid_at', async () => {
  for (const status of ['refunded', 'partially_refunded']) {
    const t = setup({ payment: { ...payment, status } });
    assert.deepEqual(await t.go(), { outcome: 'created', created: 2 });
    assert.deepEqual(t.inserted.map(e => e.entry_kind), ['income', 'expense']);
    assert.ok(t.inserted.every(e => e.entry_date === '2026-09-08'));
    assert.deepEqual(await t.go(), { outcome: 'already_recorded', created: 0 });
    assert.equal(t.state.entries.length, 2);
  }
});

test('un paiement non confirmé ne crée aucune recette comptable', async () => {
  for (const status of ['cancelled', 'requires_review', 'pending', 'failed']) {
    const t = setup({ payment: { ...payment, status } });
    assert.equal((await t.go()).outcome, 'not_eligible');
    assert.equal(t.inserted.length, 0);
  }
});

test('un paiement remboursé sans preuve du montant Stripe demeure à vérifier', async () => {
  const t = setup({ payment: { ...payment, status: 'refunded' }, charge: { ...charge, fee: null } });
  assert.equal((await t.go()).outcome, 'needs_review');
  assert.equal(t.inserted.length, 0);
});

test('un ménage ou paiement complémentaire reste à qualifier séparément', async () => {
  const t = setup({ payment: { ...payment, payment_type: 'manual' } });
  assert.equal((await t.go()).outcome, 'needs_review');
  assert.equal(t.inserted.length, 0);
});

test('un débit manuel déjà saisi pour la même réservation et montant bloque le duplicat', async () => {
  const t = setup({ entries: [{ id: 'manual1', source: 'manual', entry_kind: 'income', booking_request_id: 'b-1',
    entry_date: '2026-09-08', amount_ttc: 195 }] });
  assert.equal((await t.go()).outcome, 'needs_review');
  assert.equal(t.inserted.length, 0);
});

test('si seule la recette est déjà enregistrée, seules les commissions manquantes sont ajoutées', async () => {
  const t = setup();
  await t.go();
  const income = t.state.entries.find(e => e.entry_kind === 'income');
  t.state.entries = [income];
  t.inserted.length = 0;
  assert.deepEqual(await t.go(), { outcome: 'created', created: 1 });
  assert.equal(t.inserted[0].entry_kind, 'expense');
});

test('une transaction concurrente refusée par la contrainte UNIQUE ne fait pas de mise à jour', async () => {
  const result = await applyAutoDirectStripeAccounting({ payment, transactions: [charge], entries: [], categories,
    insertEntries: async () => { throw Object.assign(new Error('duplicate key'), { code: '23505' }); } });
  assert.deepEqual(result, { outcome: 'concurrent_write', created: 0 });
});

function fakeDb(state) {
  return { from(table) {
    const filters = [];
    const query = {
      select() { return this; }, eq(column, value) { filters.push([column, value]); return this; },
      in(column, values) { filters.push([column, values]); return this; },
      async maybeSingle() {
        const rows = selectRows();
        return { data: rows[0] || null, error: null };
      },
      then(resolve, reject) { return Promise.resolve({ data: selectRows(), error: null }).then(resolve, reject); },
      async insert(rows) {
        if (table !== 'accounting_entries') throw new Error('Unexpected insert');
        state.entries.push(...rows.map((e,i) => ({ ...e, id: `new-${i}` })));
        return { error: null };
      },
    };
    function selectRows() {
      const data = table === 'payments' ? [state.payment]
        : table === 'stripe_balance_transactions' ? state.transactions
        : table === 'accounting_entries' ? state.entries
        : table === 'accounting_categories' ? categories : [];
      return data.filter(row => filters.every(([key, expected]) => Array.isArray(expected)
        ? expected.includes(row[key]) : String(row[key]) === String(expected)));
    }
    return query;
  } };
}

test('le service serveur peut relire les transactions et devenir idempotent après insertion', async () => {
  const state = { payment, transactions: [charge], entries: [] };
  const db = fakeDb(state);
  assert.deepEqual(await syncAutoDirectStripeAccounting(db, { checkoutSessionId: 'cs_1' }), { outcome: 'created', created: 2 });
  assert.deepEqual(await syncAutoDirectStripeAccounting(db, { paymentId: 'p-1' }), { outcome: 'already_recorded', created: 0 });
});

test('le service peut rattraper une recette anciennement payée puis remboursée', async () => {
  const state = { payment: { ...payment, status: 'refunded' }, transactions: [charge], entries: [] };
  const db = fakeDb(state);
  assert.deepEqual(await syncAutoDirectStripeAccounting(db, { paymentId: 'p-1' }), { outcome: 'created', created: 2 });
  assert.deepEqual(await syncAutoDirectStripeAccounting(db, { paymentId: 'p-1' }), { outcome: 'already_recorded', created: 0 });
});

test('une session inconnue ne crée aucune écriture comptable', async () => {
  const state = { payment, transactions: [charge], entries: [] };
  const result = await syncAutoDirectStripeAccounting(fakeDb(state), { checkoutSessionId: 'cs_inconnu' });
  assert.equal(result.outcome, 'not_found');
  assert.equal(state.entries.length, 0);
});

test('un PaymentIntent lié à un autre paiement bloque la création', async () => {
  const state = { payment, transactions: [{ ...charge, payment_id: 'other' }], entries: [] };
  const result = await syncAutoDirectStripeAccounting(fakeDb(state), { checkoutSessionId: 'cs_1' });
  assert.equal(result.outcome, 'needs_review');
  assert.equal(state.entries.length, 0);
});

test('le webhook comptabilise après application, jamais avant, et sans bloquer les emails', () => {
  const file = fs.readFileSync(new URL('../netlify/functions/stripe-webhook.js', import.meta.url), 'utf8');
  const applyPosition = file.indexOf('const result = await processCheckoutSessionCompleted(');
  const autoPosition = file.indexOf('checkoutSessionId: stripeEvent.data.object.id');
  assert.ok(applyPosition >= 0 && autoPosition > applyPosition);
  assert.match(file, /result\.outcome === "applied" \|\| result\.outcome === "already_applied"/);
  assert.match(file, /catch \(error\) \{\s*console\.error\("Comptabilité Stripe automatique : rattrapage admin requis"/);
  assert.match(file, /row\?\.payment_id/);
});

test('la synchronisation programmée peut rattraper des frais apparus après le checkout', () => {
  const scheduled = fs.readFileSync(new URL('../netlify/functions/sync-stripe-finance.js', import.meta.url), 'utf8');
  assert.match(scheduled, /syncStripePaymentAccounting/);
  assert.match(scheduled, /schedule\("15 7 \* \* \*"/);
});
