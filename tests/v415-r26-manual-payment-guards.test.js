import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ManualCheckoutError,
  isPayableManualSession,
  openManualPaymentCheckout,
  validateManualPaymentRequest,
  validateStoredManualPaymentForEmail,
} from '../netlify/functions/_lib/manual-payment-checkout.js';
import { retryRelevance } from '../netlify/functions/_lib/email-retry-core.js';

const NOW = Date.parse('2026-10-29T13:30:00Z');
const ID = 'booking-r26';
const url = id => `https://checkout.stripe.com/c/pay/${id}#secret`;
const booking = (patch = {}) => ({
  id: ID, status: 'deposit_paid', updated_at: '2026-10-29T12:00:00.000Z',
  contract_total: 200, deposit_rate: .3, deposit_basis: 200, deposit_amount: 60,
  amount_paid: 60, guest_email: 'guest@example.invalid',
  manual_payment_stripe_session_id: null,
  manual_payment_status: null, manual_payment_amount: null, manual_payment_link: null,
  manual_payment_reason: null, manual_payment_message: null,
  ...patch,
});
const session = (id, amount = 140, reason = 'solde', patch = {}) => ({
  id, url: url(id), status: 'open', payment_status: 'unpaid',
  mode: 'payment', currency: 'eur', customer_email: 'guest@example.invalid', amount_total: Math.round(amount * 100),
  expires_at: Math.floor(NOW / 1000) + 3600,
  metadata: { booking_id: ID, payment_type: 'manual', manual_reason: reason, manual_amount: String(amount) },
  ...patch,
});
function activeBooking(s = session('cs_test_old')) {
  return booking({ manual_payment_stripe_session_id: s.id, manual_payment_link: s.url,
    manual_payment_amount: s.amount_total / 100, manual_payment_reason: s.metadata.manual_reason,
    manual_payment_message: 'Merci', manual_payment_status: 'à payer' });
}

function fixture(initial = booking(), seeded = [], opts = {}) {
  const state = { booking: structuredClone(initial), sessions: new Map(seeded.map(s => [s.id, structuredClone(s)])),
    created: [], expired: [], updates: 0, reads: 0, sent: [], retrieveError: null, updateError: null, beforeCreate: null, beforeRead: null };
  const stripe = { checkout: { sessions: {
    async retrieve(id) {
      if (state.retrieveError) throw state.retrieveError;
      if (!state.sessions.has(id)) throw Object.assign(Error('not found'), { code: 'resource_missing' });
      return state.sessions.get(id);
    },
    async expire(id) {
      const s = state.sessions.get(id);
      if (!s || s.status !== 'open') throw Error('not open');
      s.status = 'expired'; state.expired.push(id); return s;
    },
    async create(parameters, options) {
      if (state.beforeCreate) await state.beforeCreate(state);
      const id = `cs_test_new_${state.created.length + 1}`;
      const s = session(id, parameters.line_items[0].price_data.unit_amount / 100,
        parameters.metadata.manual_reason, { metadata: structuredClone(parameters.metadata) });
      state.sessions.set(id, s);
      state.created.push({ parameters, options, session: s });
      return s;
    },
  } } };
  const supabase = { from(table) {
    assert.equal(table, 'booking_requests');
    return { update(patch) {
      const conditions = [];
      const query = {
        eq(field, expected) { conditions.push([field, expected]); return query; },
        is(field, expected) { conditions.push([field, expected]); return query; },
        async select(columns) {
          assert.equal(columns, 'id'); state.updates++;
          if (state.updateError) return { data: null, error: state.updateError };
          const all = conditions.every(([field, expected]) => state.booking?.[field] == expected);
          if (!all) return { data: [], error: null };
          state.booking = { ...state.booking, ...patch };
          return { data: [{ id: state.booking.id }], error: null };
        },
      };
      return query;
    } };
  } };
  async function readBooking(id) {
    assert.equal(id, ID);
    state.reads++;
    if (state.beforeRead) await state.beforeRead(state);
    return structuredClone(state.booking);
  }
  const makeParams = ({ amount = 140, reason = 'solde' } = {}) => ({
    mode: 'payment', line_items: [{ price_data: { unit_amount: Math.round(amount * 100) } }],
    metadata: { booking_id: ID, payment_type: 'manual', manual_reason: reason, manual_amount: String(amount) },
  });
  const open = (snapshot = structuredClone(state.booking), overrides = {}) => openManualPaymentCheckout({
    booking: snapshot,
    amount: overrides.amount ?? 140, reason: overrides.reason ?? 'solde', message: overrides.message ?? 'Merci',
    stripe, supabase, readBooking, now: NOW,
    createParameters: () => makeParams({ amount: overrides.amount ?? 140, reason: overrides.reason ?? 'solde' }),
    sendEmail: async (b, s) => { state.sent.push({ booking: structuredClone(b), id: s.id }); },
  });
  const verify = () => validateStoredManualPaymentForEmail({ stripe, readBooking, bookingId: ID, now: NOW });
  return { state, stripe, supabase, readBooking, open, verify };
}

test('R26 : refus des demandes, annulations, expirations et réservations déjà soldées', () => {
  for (const s of ['pending', 'cancelled', 'expired', 'refused', 'confirmed', 'fully_paid']) {
    assert.throws(() => validateManualPaymentRequest(booking({ status: s }), 140, 'solde'), ManualCheckoutError);
  }
  assert.throws(() => validateManualPaymentRequest(booking({ amount_paid: 200 }), 1, 'complement'), /déjà soldée/);
});

test('R26 : solde contractuel et précision au centime (y compris contrats legacy)', () => {
  for (const n of [-1, 0, 140.001, 140.01, NaN, Infinity]) {
    assert.throws(() => validateManualPaymentRequest(booking(), n, 'solde'));
  }
  assert.equal(validateManualPaymentRequest(booking(), 140, 'solde'), 14000);
  assert.throws(() => validateManualPaymentRequest(booking(), 20, 'total'), /correspondre au restant/);
  assert.equal(validateManualPaymentRequest(booking({ contract_total: null, owner_price: 200, deposit_rate: null }), 130, 'total'), 13000);
  assert.throws(() => validateManualPaymentRequest(booking({ contract_total: null, owner_price: 200, deposit_rate: null }), 160, 'solde'), /dépasse/);
});

test('R26 : paiement Stripe terminé mais webhook en attente => aucun autre lien', async () => {
  const old = session('cs_test_paid', 140, 'solde', { status: 'complete', payment_status: 'paid' });
  const fx = fixture(activeBooking(old), [old]);
  await assert.rejects(fx.open(), /Paiement Stripe précédent/);
  assert.equal(fx.state.created.length, 0);
  assert.equal(fx.state.sent.length, 0);
});

test('R26 : demande identique => session active réutilisée sans nouvel email', async () => {
  const old = session('cs_test_current');
  const fx = fixture(activeBooking(old), [old]);
  const result = await fx.open();
  assert.equal(result.reused, true);
  assert.equal(result.emailSent, false);
  assert.equal(result.url, old.url);
  assert.equal(fx.state.created.length, 0);
  assert.equal(fx.state.expired.length, 0);
  assert.equal(fx.state.sent.length, 0);
});

test('R26 : relecture avant réutilisation bloque un état devenu annulé', async () => {
  const old = session('cs_test_current');
  const fx = fixture(activeBooking(old), [old]);
  fx.state.beforeRead = state => { state.booking.status = 'cancelled'; state.booking.updated_at = '2026-10-29T12:15:00Z'; };
  await assert.rejects(fx.open(), /état permettant/);
  assert.equal(fx.state.created.length, 0);
});

test('R26 : nouvelle session vérifiée, écriture CAS, relecture, un email et une trace', async () => {
  const fx = fixture();
  const result = await fx.open();
  assert.equal(result.reused, false);
  assert.equal(result.emailSent, true);
  assert.equal(fx.state.updates, 1);
  assert.equal(fx.state.sent.length, 1);
  assert.equal(fx.state.sent[0].id, result.sessionId);
  assert.equal(fx.state.booking.manual_payment_stripe_session_id, result.sessionId);
  assert.match(fx.state.created[0].options.idempotencyKey, /^manual:booking-r26:14000:/);
});

test('R26 : 2 créations concurrentes => un seul lien enregistré et un seul email', async () => {
  const fx = fixture();
  const original = structuredClone(fx.state.booking);
  const results = await Promise.allSettled([fx.open(original), fx.open(original)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason.statusCode === 409).length, 1);
  assert.equal(fx.state.created.length, 2);
  assert.equal(fx.state.expired.length, 1);
  assert.equal(fx.state.sent.length, 1);
  const winner = fx.state.booking.manual_payment_stripe_session_id;
  assert.equal(fx.state.sessions.get(winner).status, 'open');
  assert.ok(fx.state.created.some(c => c.session.id !== winner && c.session.status === 'expired'));
});

test('R26 : annulation concurrente pendant Stripe => session non attribuée expirée, pas de mail', async () => {
  const fx = fixture();
  fx.state.beforeCreate = state => {
    state.booking.status = 'cancelled'; state.booking.updated_at = '2026-10-29T13:31:00.000Z';
  };
  await assert.rejects(fx.open(), /réservation a changé/);
  assert.equal(fx.state.updates, 1);
  assert.equal(fx.state.expired.length, 1);
  assert.equal(fx.state.sent.length, 0);
});

test('R26 : paiement entre enregistrement et email => aucun email, session expirée', async () => {
  const fx = fixture();
  fx.state.beforeRead = state => { state.booking.status = 'fully_paid'; state.booking.amount_paid = 200; };
  await assert.rejects(fx.open(), /état permettant/);
  assert.equal(fx.state.sent.length, 0);
  assert.equal(fx.state.expired.length, 1);
});

test('R26 : échec persistance SQL => session orpheline expirée et aucun email', async () => {
  const fx = fixture();
  fx.state.updateError = Error('database unavailable');
  await assert.rejects(fx.open(), /database unavailable/);
  assert.equal(fx.state.expired.length, 1);
  assert.equal(fx.state.sent.length, 0);
});

test('R26 : ancien lien ouvert est expiré avant l’attribution du nouveau', async () => {
  const old = session('cs_test_earlier', 75, 'acompte');
  const fx = fixture(activeBooking(old), [old]);
  const result = await fx.open();
  assert.equal(result.reused, false);
  assert.deepEqual(fx.state.expired, [old.id]);
  assert.equal(fx.state.sent.length, 1);
});

test('R26 : erreur de consultation Stripe => refus fermé sans créer de lien', async () => {
  const old = session('cs_test_earlier', 75, 'acompte');
  const fx = fixture(activeBooking(old), [old]);
  fx.state.retrieveError = Error('Stripe unreachable');
  await assert.rejects(fx.open(), /Stripe unreachable/);
  assert.equal(fx.state.created.length, 0);
  assert.equal(fx.state.sent.length, 0);
});

test('R26 : une session non conforme ne peut ni être réutilisée ni renvoyée', () => {
  const s = session('cs_test_current');
  const b = activeBooking(s);
  assert.equal(isPayableManualSession(s, b, NOW), true);
  for (const patch of [
    { status: 'expired' }, { payment_status: 'paid' }, { currency: 'usd' },
    { customer_email: 'other@example.invalid' },
    { amount_total: 13900 }, { url: 'https://evil.invalid/cs_test_current' },
    { expires_at: Math.floor(NOW / 1000) + 15 },
    { metadata: { ...s.metadata, booking_id: 'other' } },
    { metadata: { ...s.metadata, payment_type: 'balance' } },
  ]) assert.equal(isPayableManualSession({ ...s, ...patch }, b, NOW), false, String(patch.status||patch.url||patch.amount_total));
});

test('R26 : renvoi vérifié autorisé uniquement pour le lien Stripe actuel et payable', async () => {
  const s = session('cs_test_current');
  const fx = fixture(activeBooking(s), [s]);
  assert.equal((await fx.verify()).manual_payment_link, s.url);
  fx.state.booking.manual_payment_stripe_session_id = 'cs_test_replaced';
  await assert.rejects(fx.verify(), /n’est plus payable/);
});

test('R26 : renvoi bloqué si le dossier change durant la consultation Stripe', async () => {
  const s = session('cs_test_current');
  const fx = fixture(activeBooking(s), [s]);
  fx.state.beforeRead = state => {
    if (state.reads === 2) state.booking.updated_at = '2026-10-29T13:34:00Z';
  };
  await assert.rejects(fx.verify(), /modifiée/);
});

test('R26 : renvoi bloqué après confirmation Stripe et après expiration', async () => {
  const s = session('cs_test_current');
  const fx = fixture(activeBooking(s), [s]);
  fx.state.sessions.get(s.id).payment_status = 'paid';
  await assert.rejects(fx.verify(), /en cours de confirmation/);
  fx.state.sessions.get(s.id).payment_status = 'unpaid';
  fx.state.sessions.get(s.id).status = 'expired';
  await assert.rejects(fx.verify(), /n’est plus payable/);
});

test('R26 : le retry de mails manuels n’expédie jamais de vieux liens sans vérification Stripe', () => {
  for (const email_type of ['manual_payment:acompte', 'manual_payment:solde', 'manual_payment:total', 'manual_payment:complement', 'manual_payment_stored_link']) {
    const result = retryRelevance({ booking_request_id: ID, email_type, to_email: 'guest@example.invalid' }, booking());
    assert.equal(result.allowed, false, email_type);
    assert.match(result.reason, /Stripe/);
  }
  assert.equal(retryRelevance({ booking_request_id: ID, email_type: 'payment_confirmation:deposit', to_email: 'guest@example.invalid' }, booking()).allowed, true);
});

test('R26 : les deux endpoints exigent la sécurité partagée et l’admin décrit le lien réutilisé', () => {
  const path = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const create = path('netlify/functions/create-manual-payment-session.js');
  const resend = path('netlify/functions/send-manual-payment-email.js');
  const admin = path('src/pages/Admin.jsx');
  assert.match(create, /openManualPaymentCheckout/);
  assert.match(resend, /validateStoredManualPaymentForEmail/);
  assert.match(admin, /paymentResult\.reused/);
  assert.match(create, /amount: numericAmount/);
  assert.match(resend, /retry_payload: retryPayload/);
});
