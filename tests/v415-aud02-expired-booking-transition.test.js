import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../netlify/functions/check-expired-bookings.js', import.meta.url), 'utf8')
  .replace(/^import\s+.*;\r?\n/gm, '')
  .replace('export const handler = schedule(', 'const handler = schedule(');

function makeHarness(overrides = {}) {
  const booking = {
    id: 'reservation-test', status: 'accepted', amount_paid: 0,
    acceptance_expires_at: '2020-01-01T00:00:00Z',
    guest_email: 'client@example.invalid', guest_first_name: 'Client', guest_last_name: 'Test',
    start_date: '2027-05-01', end_date: '2027-05-08', payment_preference: 'deposit',
    communication_language: 'fr', ...overrides.booking,
  };
  const state = { booking, emails: [], events: [], stripeExpiry: 0, updates: 0, filters: [], error: overrides.updateError || null };
  const clone = (x) => ({ ...x });
  const supabase = {
    from(table) {
      if (table === 'booking_events') return { insert: async (rows) => { state.events.push(...rows); return { error: null }; } };
      if (table === 'email_logs') return { insert: async () => ({ error: null }) };
      assert.equal(table, 'booking_requests');
      let op = 'read', payload = null;
      const clauses = [];
      const query = {
        select(cols) {
          if (op === 'update') {
            state.updates++;
            state.filters.push({ clauses: [...clauses], select: cols });
            if (overrides.beforeUpdate) overrides.beforeUpdate(state);
            if (state.error) return Promise.resolve({ data: null, error: state.error });
            const current = state.booking;
            const allowed = clauses.every(([field, operator, value]) => {
              if (operator === 'eq') return current[field] === value;
              if (operator === 'lt') return current[field] != null && current[field] < value;
              if (operator === 'or') {
                assert.equal(value, 'amount_paid.is.null,amount_paid.eq.0');
                return current.amount_paid == null || Number(current.amount_paid) === 0;
              }
              throw Error(`Unexpected update condition ${field}/${operator}`);
            });
            if (!allowed) return Promise.resolve({ data: [], error: null });
            Object.assign(current, payload);
            return Promise.resolve({ data: overrides.missingReturning ? null : [clone(current)], error: null });
          }
          return query;
        },
        update(value) { op = 'update'; payload = value; return query; },
        eq(field, value) { clauses.push([field, 'eq', value]); return query; },
        lt(field, value) { clauses.push([field, 'lt', value]); return query; },
        not() { return query; },
        or(value) { clauses.push(['amount_paid', 'or', value]); return query; },
        then(resolve, reject) {
          const result = (state.booking.status === 'accepted' && state.booking.acceptance_expires_at < new Date().toISOString())
            ? [clone(state.booking)] : [];
          return Promise.resolve({ data: result, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const stripe = {};
  const context = vm.createContext({
    process: { env: {} }, console: { error() {} }, Date,
    createClient: () => supabase, Stripe: class { constructor() { return stripe; } },
    emailAutomationAllowed: () => true, emailAutomationSkippedResponse: () => ({}),
    schedule: (_, fn) => fn,
    expireBookingOpenCheckoutSessions: async () => {
      state.stripeExpiry++;
      if (overrides.stripeFailure) throw Error('stripe_failure');
    },
    resendEmail: async (payload) => { state.emails.push(payload); return { ok: true, json: async () => ({ id: 'fake' }) }; },
    escapeHtml: (value) => String(value),
    emailLanguageForAudience: () => 'fr', buildLocalizedExpiredEmail: () => null,
  });
  vm.runInContext(source + '\n globalThis.testHandler = handler;', context, { filename: 'check-expired-bookings.js' });
  return { state, run: async () => {
    const response = await context.testHandler();
    assert.equal(response.statusCode, 200);
    return JSON.parse(response.body);
  } };
}

test('AUD-02: successful transition sends guest and owner only after confirmed update', async () => {
  const { state, run } = makeHarness();
  const result = await run();
  assert.equal(result.processed.length, 1);
  assert.equal(result.skipped.length, 0);
  assert.equal(state.booking.status, 'expired');
  assert.equal(state.booking.payment_status, 'expired');
  assert.equal(state.emails.length, 2);
  assert.equal(state.events.length, 1);
  assert.equal(state.stripeExpiry, 1);
  assert.deepEqual(state.filters[0], {
    clauses: [
      ['id', 'eq', 'reservation-test'],
      ['status', 'eq', 'accepted'],
      ['acceptance_expires_at', 'lt', state.filters[0].clauses[2][2]],
      ['amount_paid', 'or', 'amount_paid.is.null,amount_paid.eq.0'],
    ],
    select: '*',
  });
  assert.equal(state.events[0].event_type, 'booking_expired');
});

test('AUD-02: concurrent payment changes status -> no false expiration email', async () => {
  const { state, run } = makeHarness({ beforeUpdate: ({ booking }) => { booking.status = 'paid'; booking.amount_paid = 100; } });
  const result = await run();
  assert.equal(result.processed.length, 0);
  assert.equal(result.skipped[0].reason, 'expiration_not_applied');
  assert.equal(state.booking.status, 'paid');
  assert.equal(state.emails.length, 0);
  assert.equal(state.events.length, 0);
});

test('AUD-02: payment recorded before status change blocks expiration', async () => {
  const { state, run } = makeHarness({ beforeUpdate: ({ booking }) => { booking.amount_paid = 30; } });
  const result = await run();
  assert.equal(result.skipped[0].reason, 'expiration_not_applied');
  assert.equal(state.booking.status, 'accepted');
  assert.equal(state.emails.length, 0);
});

test('AUD-02: concurrent cancellation blocks guest and owner emails', async () => {
  const { state, run } = makeHarness({ beforeUpdate: ({ booking }) => { booking.status = 'cancelled'; } });
  const result = await run();
  assert.equal(result.skipped[0].reason, 'expiration_not_applied');
  assert.equal(state.booking.status, 'cancelled');
  assert.equal(state.emails.length, 0);
});

test('AUD-02: deadline extension blocks stale candidate', async () => {
  const { state, run } = makeHarness({ beforeUpdate: ({ booking }) => { booking.acceptance_expires_at = '3000-01-01T00:00:00Z'; } });
  const result = await run();
  assert.equal(result.skipped[0].reason, 'expiration_not_applied');
  assert.equal(state.emails.length, 0);
  assert.equal(state.booking.status, 'accepted');
});

test('AUD-02: no RETURNING row is not treated as a successful expiration', async () => {
  const { state, run } = makeHarness({ missingReturning: true });
  const result = await run();
  assert.equal(result.skipped[0].reason, 'expiration_not_applied');
  assert.equal(state.emails.length, 0);
  assert.equal(state.events.length, 0);
});

test('AUD-02: Supabase update errors prevent notifications', async () => {
  const { state, run } = makeHarness({ updateError: { message: 'database unavailable' } });
  const result = await run();
  assert.equal(result.skipped[0].reason, 'database unavailable');
  assert.equal(state.emails.length, 0);
});

test('AUD-02: Stripe expiration error prevents DB transition and emails', async () => {
  const { state, run } = makeHarness({ stripeFailure: true });
  const result = await run();
  assert.match(result.skipped[0].reason, /stripe_expiration_failed/);
  assert.equal(state.updates, 0);
  assert.equal(state.booking.status, 'accepted');
  assert.equal(state.emails.length, 0);
});

test('AUD-02: two job invocations never send twice for same booking', async () => {
  const { state, run } = makeHarness();
  await run(); await run();
  assert.equal(state.emails.length, 2);
  assert.equal(state.events.length, 1);
  assert.equal(state.updates, 1);
});

test('AUD-02: already-paid and not-yet-due bookings cannot expire', async () => {
  for (const booking of [
    { amount_paid: 30 },
    { status: 'paid' },
    { acceptance_expires_at: '3000-01-01T00:00:00Z' },
  ]) {
    const { state, run } = makeHarness({ booking });
    const result = await run();
    assert.equal(result.processed.length, 0);
    assert.equal(state.emails.length, 0);
  }
});
