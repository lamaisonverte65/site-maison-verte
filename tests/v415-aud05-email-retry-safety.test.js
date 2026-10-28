import test from 'node:test';
import assert from 'node:assert/strict';
import { runFailedEmailRetryBatch, retryRelevance } from '../netlify/functions/_lib/email-retry-core.js';
import { resendEmail } from '../netlify/functions/_lib/resend-email.js';

const now = new Date('2026-10-28T14:00:00.000Z');
const mail = Object.freeze({ from: 'Maison Verte <contact@lamaisonverte65.fr>', to: ['guest@example.invalid'], subject: 'Séjour', html: '<p>Message</p>' });
function entry(overrides = {}) {
  return { id: 'log-1', booking_request_id: 'booking-1', email_type: 'booking_decision:accepted',
    to_email: 'guest@example.invalid', status: 'error', created_at: '2026-10-27T10:00:00.000Z',
    retry_payload: { ...mail }, error_message: '429 too many requests',
    retry_attempts: 0, retry_next_at: null, retry_last_at: null, retry_exhausted_at: null, ...overrides };
}
function booking(overrides = {}) {
  return { id: 'booking-1', status: 'accepted', guest_email: 'guest@example.invalid',
    balance_status: 'pending', payment_status: 'pending', ...overrides };
}

function database({ emails = [entry()], bookings = [booking()], beforeBookingRead } = {}) {
  const state = { emails: emails.map(e => structuredClone(e)), bookings: bookings.map(e => structuredClone(e)), claims: 0, reads: 0 };
  class Query {
    constructor(table, patch = null) { this.table = table; this.patch = patch; this.conditions = []; this.limitCount = null; this.sort = null; }
    select(_columns) { return this.patch ? this.execute() : this; }
    update(patch) { return new Query(this.table, patch); }
    eq(k, v) { this.conditions.push(r => r[k] === v); return this; }
    gt(k, v) { this.conditions.push(r => r[k] > v); return this; }
    is(k, v) { this.conditions.push(r => r[k] === v); return this; }
    not(k, operator, v) { assert.equal(operator, 'is'); this.conditions.push(r => r[k] !== v); return this; }
    or(expression) {
      const parts = expression.split(',');
      assert.equal(parts[0], 'retry_next_at.is.null');
      const cutoff = parts[1].replace('retry_next_at.lte.', '');
      this.conditions.push(r => r.retry_next_at == null || r.retry_next_at <= cutoff);
      return this;
    }
    order(k, options) { this.sort = { k, asc: options.ascending }; return this; }
    limit(n) { this.limitCount = n; return this; }
    async maybeSingle() { const res = await this.execute(); return { data: res.data[0] || null, error: res.error }; }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
    async execute() {
      if (this.table === 'booking_requests') {
        state.reads++;
        if (beforeBookingRead) await beforeBookingRead(state);
      }
      const records = state[this.table === 'email_logs' ? 'emails' : 'bookings'];
      let found = records.filter(r => this.conditions.every(check => check(r)));
      if (this.sort) found.sort((a,b) => this.sort.asc ? String(a[this.sort.k]).localeCompare(String(b[this.sort.k])) : String(b[this.sort.k]).localeCompare(String(a[this.sort.k])));
      if (this.limitCount != null) found = found.slice(0, this.limitCount);
      if (this.patch) {
        for (const record of found) Object.assign(record, this.patch);
        if (this.patch.retry_next_at === '9999-12-31T23:59:59.000Z') state.claims += found.length;
      }
      return { data: found.map(r => structuredClone(r)), error: null };
    }
  }
  return { supabase: { from: table => new Query(table) }, state };
}
const success = async () => ({ ok: true, status: 200, json: async () => ({ id: 'provider-1' }) });
const failure = (status, message = 'rate limit') => async () => ({ ok: false, status, text: async () => message });
const run = (supabase, sendEmail = success, time = now) => runFailedEmailRetryBatch({ supabase, sendEmail, now: time });

// La qualification métier ne relance jamais un email devenu trompeur.
test('AUD-05 : acceptation initiale annulée/refusée/payée ne doit pas être renvoyée', () => {
  for (const status of ['cancelled', 'refused', 'expired', 'paid', 'deposit_paid', 'fully_paid']) {
    assert.equal(retryRelevance(entry(), booking({ status })).allowed, false, status);
  }
  assert.equal(retryRelevance(entry(), booking()).allowed, true);
});

test('AUD-05 : accusés de demande non envoyés après acceptation et email propriétaire distinct', () => {
  assert.equal(retryRelevance(entry({ email_type: 'booking_request:guest' }), booking({ status: 'accepted' })).allowed, false);
  assert.equal(retryRelevance(entry({ email_type: 'booking_request:guest' }), booking({ status: 'pending' })).allowed, true);
  assert.equal(retryRelevance(entry({ email_type: 'booking_request:owner', to_email: 'owner@example.invalid' }), booking({ status: 'pending' })).allowed, true);
});

test('AUD-05 : expiration seulement après statut expired, refus seulement sur refused', () => {
  assert.equal(retryRelevance(entry({ email_type: 'booking_expired' }), booking()).allowed, false);
  assert.equal(retryRelevance(entry({ email_type: 'booking_expired' }), booking({ status: 'expired' })).allowed, true);
  assert.equal(retryRelevance(entry({ email_type: 'booking_decision:refused' }), booking({ status: 'refused' })).allowed, true);
  assert.equal(retryRelevance(entry({ email_type: 'balance:request' }), booking({ status: 'fully_paid' })).allowed, false);
  assert.equal(retryRelevance(entry({ email_type: 'balance:reminder_2' }), booking({ status: 'deposit_paid', balance_status: 'paid' })).allowed, false);
  assert.equal(retryRelevance(entry({ email_type: 'balance:request' }), booking({ status: 'deposit_paid' })).allowed, true);
});

test('AUD-05 : un email à une ancienne adresse ne doit pas partir', async () => {
  const { state, supabase } = database({ bookings: [booking({ guest_email: 'new@example.invalid' })] });
  const sent = [];
  const result = await run(supabase, async p => { sent.push(p); return success(); });
  assert.equal(result.skipped, 1);
  assert.equal(sent.length, 0);
  assert.ok(state.emails[0].retry_exhausted_at);
});

test('AUD-05 : erreur initiale réseau ambiguë -> revue humaine et aucun renvoi', async () => {
  const { state, supabase } = database({ emails: [entry({ error_message: 'network_error: socket closed' })] });
  let calls = 0;
  const result = await run(supabase, async () => { calls++; return success(); });
  assert.equal(result.review, 1);
  assert.equal(calls, 0);
  assert.match(state.emails[0].error_message, /preuve de refus/);
});


test('AUD-05 : réponse 500 de l’envoi initial -> aucune nouvelle expédition automatique', async () => {
  const { state, supabase } = database({ emails: [entry({ error_message: 'Internal Server Error' })] });
  let called = 0;
  const r = await run(supabase, async () => { called++; return success(); });
  assert.equal(called, 0);
  assert.equal(r.review, 1);
  assert.ok(state.emails[0].retry_exhausted_at);
});

test('AUD-05 : double ouverture concurrente -> un seul appel Resend et un claim atomique', async () => {
  const { state, supabase } = database();
  const keys = [];
  const send = async (payload, options) => {
    keys.push(options.idempotencyKey);
    await new Promise(resolve => setTimeout(resolve, 15));
    return success();
  };
  const responses = await Promise.all([run(supabase, send), run(supabase, send)]);
  assert.equal(state.claims, 1);
  assert.equal(keys.length, 1);
  assert.deepEqual(keys, ['lmv-email-retry/log-1']);
  assert.equal(responses.reduce((n, x) => n + x.sent, 0), 1);
  assert.equal(state.emails[0].status, 'sent');
});


test('AUD-05 : réservation annulée entre claim et POST -> envoi bloqué', async () => {
  const { state, supabase } = database({ beforeBookingRead: state => {
    if (state.reads === 2) state.bookings[0].status = 'cancelled';
  } });
  let sent = 0;
  const response = await run(supabase, async () => { sent++; return success(); });
  assert.equal(sent, 0);
  assert.equal(state.claims, 1);
  assert.equal(response.skipped, 1);
  assert.ok(state.emails[0].retry_exhausted_at);
});

test('AUD-05 : erreur Supabase avant le claim -> échec explicite sans envoi', async () => {
  const { state, supabase } = database({ beforeBookingRead: () => { throw Error('Database unavailable'); } });
  let sent = 0;
  await assert.rejects(run(supabase, async () => { sent++; return success(); }), /Database unavailable/);
  assert.equal(sent, 0);
  assert.equal(state.claims, 0);
  assert.equal(state.emails[0].status, 'error');
});

test('AUD-05 : réponse HTTP 429 -> même clé au prochain essai et délai respecté', async () => {
  const { state, supabase } = database();
  const keys = [];
  const send = async (_payload, options) => { keys.push(options.idempotencyKey); return keys.length === 1 ? failure(429)() : success(); };
  const first = await run(supabase, send);
  assert.equal(first.failed, 1);
  assert.equal(state.emails[0].retry_attempts, 1);
  assert.equal(state.emails[0].retry_next_at, '2026-10-28T14:15:00.000Z');
  await run(supabase, send, new Date('2026-10-28T14:10:00.000Z'));
  assert.equal(keys.length, 1);
  const second = await run(supabase, send, new Date('2026-10-28T14:16:00.000Z'));
  assert.equal(second.sent, 1);
  assert.deepEqual(keys, ['lmv-email-retry/log-1', 'lmv-email-retry/log-1']);
});

test('AUD-05 : échec réseau du retry -> arrêt des reprises automatiques', async () => {
  const { state, supabase } = database();
  const outcome = await run(supabase, failure(0, 'network_error: lost response'));
  assert.equal(outcome.review, 1);
  assert.ok(state.emails[0].retry_exhausted_at);
  assert.equal(state.emails[0].status, 'error');
  const again = await run(supabase);
  assert.equal(again.sent, 0);
});

test('AUD-05 : réponse fournisseur 500 -> revue humaine sans second envoi automatique', async () => {
  const { state, supabase } = database();
  await run(supabase, failure(500, 'server failure'));
  assert.ok(state.emails[0].retry_exhausted_at);
});

test('AUD-05 : crash durant l’envoi -> claim bloqué et aucun deuxième envoi', async () => {
  const { state, supabase } = database();
  await assert.rejects(run(supabase, async () => { throw new Error('process stopped'); }), /process stopped/);
  assert.equal(state.emails[0].retry_next_at, '9999-12-31T23:59:59.000Z');
  assert.equal((await run(supabase)).sent, 0);
});

test('AUD-05 : le nouvel email envoyé ensuite empêche la reprise du précédent', async () => {
  const emails = [entry(), entry({ id: 'log-new', status: 'sent', retry_payload: null, created_at: '2026-10-28T12:00:00.000Z' })];
  const { state, supabase } = database({ emails });
  const result = await run(supabase);
  assert.equal(result.skipped, 1);
  assert.ok(state.emails[0].retry_exhausted_at);
});

test('AUD-05 : une ligne sans réservation et valide peut être reprise', async () => {
  const { state, supabase } = database({ emails: [entry({ booking_request_id: null, email_type: 'owner_site_notification' })] });
  assert.equal((await run(supabase)).sent, 1);
  assert.equal(state.emails[0].status, 'sent');
});

test('AUD-05 : lignes non dues filtrées avant limite, les due sont traitées', async () => {
  const delayed = Array.from({length: 55}, (_, i) => entry({ id: `wait-${i}`, created_at: '2026-10-20T00:00:00Z', retry_next_at: '2026-10-30T00:00:00Z' }));
  const due = entry({ id: 'due-1', created_at: '2026-10-28T13:00:00Z' });
  const { state, supabase } = database({ emails: [...delayed, due] });
  const result = await run(supabase);
  assert.equal(result.sent, 1);
  assert.equal(state.emails.find(e => e.id === 'due-1').status, 'sent');
});

test('AUD-05 : la passerelle Resend n’ajoute la clé que si demandée', async () => {
  const headers = [];
  const env = { CONTEXT: 'deploy-preview', URL: 'https://recette.netlify.app', LMV_EMAIL_DELIVERY_MODE: 'allowlist', LMV_EMAIL_ALLOWED_RECIPIENTS: 'guest@example.invalid' };
  const fetchImpl = async (_url, opts) => { headers.push(opts.headers); return success(); };
  await resendEmail(mail, { env, fetchImpl, apiKey: 'FAKE', idempotencyKey: 'lmv-email-retry/log-1' });
  await resendEmail(mail, { env, fetchImpl, apiKey: 'FAKE' });
  assert.equal(headers[0]['Idempotency-Key'], 'lmv-email-retry/log-1');
  assert.equal(headers[1]['Idempotency-Key'], undefined);
});
