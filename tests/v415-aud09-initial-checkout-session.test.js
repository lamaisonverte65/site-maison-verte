import test from "node:test";
import assert from "node:assert/strict";
import { createInitialCheckout, InitialCheckoutError } from "../netlify/functions/_lib/initial-checkout.js";

const NOW = new Date("2026-10-28T10:00:00.000Z");
const ID = "11111111-1111-4111-8111-111111111111";
const OLD_ID = "cs_test_old";
const NEW_ID = "cs_test_new";
const oldUrl = `https://checkout.stripe.com/c/pay/${OLD_ID}#secret`;
const newUrl = `https://checkout.stripe.com/c/pay/${NEW_ID}#secret`;

const standard = (overrides = {}) => ({
  id: ID,
  status: "accepted",
  owner_price: 320,
  amount_paid: 0,
  payment_status: "unpaid",
  start_date: "2026-12-15",
  end_date: "2026-12-18",
  guest_email: "test@example.invalid",
  guest_first_name: "Alice",
  guest_last_name: "Test",
  deposit_amount: 96,
  deposit_status: "à payer",
  balance_status: "en attente",
  accepted_at: "2026-10-28T09:00:00.000Z",
  acceptance_expires_at: "2026-10-29T09:00:00.000Z",
  updated_at: "2026-10-28T09:00:00.000Z",
  stripe_checkout_session_id: OLD_ID,
  payment_link: oldUrl,
  ...overrides,
});

function fixture({ initial = standard(), stripeSession = { id: OLD_ID, status: "open", url: oldUrl }, retrieveError = null, createError = null, writeError = null } = {}) {
  const state = { booking: initial, retrieves: [], creates: [], saves: [], idempotencyKeys: [] };
  const dependencies = {
    repository: {
      async getBooking() { return state.booking; },
      async saveCurrentSession(payload) {
        state.saves.push(payload);
        if (writeError) throw writeError;
        if (state.booking.status !== payload.expectedStatus || state.booking.updated_at !== payload.expectedUpdatedAt) {
          throw new InitialCheckoutError("booking_changed_concurrently", "Concurrent write", 409);
        }
        state.booking = { ...state.booking, ...payload.values, updated_at: "2026-10-28T10:00:00.001Z" };
        return state.booking;
      },
    },
    stripeGateway: {
      async retrieveSession(id) {
        state.retrieves.push(id);
        if (retrieveError) throw retrieveError;
        return stripeSession;
      },
      async createSession(parameters, options) {
        state.creates.push(parameters);
        state.idempotencyKeys.push(options?.idempotencyKey);
        if (createError) throw createError;
        return { id: NEW_ID, status: "open", url: newUrl };
      },
    },
  };
  return { state, dependencies };
}

const open = (overrides = {}) => ({ id: OLD_ID, status: "open", url: oldUrl, expires_at: Math.floor(NOW.getTime() / 1000) + 3600, ...overrides });
const pay = (deps) => createInitialCheckout({ bookingId: ID, now: NOW, dependencies: deps });

test("AUD-09: a locally valid link is checked at Stripe and reused only while open", async () => {
  const { state, dependencies } = fixture({ stripeSession: open() });
  const result = await pay(dependencies);
  assert.equal(result.url, oldUrl);
  assert.equal(result.reused, true);
  assert.equal(result.acceptanceExpiresAt, standard().acceptance_expires_at);
  assert.deepEqual(state.retrieves, [OLD_ID]);
  assert.equal(state.creates.length, 0);
  assert.equal(state.saves.length, 0);
});

test("AUD-09: expired local link is replaced, without extending acceptance or the financial snapshot", async () => {
  const { state, dependencies } = fixture({ stripeSession: { id: OLD_ID, status: "expired", url: oldUrl } });
  const result = await pay(dependencies);
  assert.equal(result.url, newUrl);
  assert.equal(result.reused, false);
  assert.equal(result.acceptanceExpiresAt, standard().acceptance_expires_at);
  assert.equal(result.amount, 96);
  assert.equal(state.saves.length, 1);
  assert.equal(state.saves[0].values.acceptance_expires_at, standard().acceptance_expires_at);
  assert.equal(state.saves[0].values.stripe_checkout_session_id, NEW_ID);
  assert.equal(state.creates[0].line_items[0].price_data.unit_amount, 9600);
});

test("AUD-09: completed Checkout is NOT replaced while webhook status is pending", async () => {
  const { state, dependencies } = fixture({ stripeSession: { id: OLD_ID, status: "complete", payment_status: "paid", url: oldUrl } });
  await assert.rejects(pay(dependencies), (error) => error.code === "checkout_payment_pending" && error.statusCode === 409);
  assert.equal(state.creates.length, 0);
  assert.equal(state.saves.length, 0);
});

test("AUD-09: a paid Stripe session remains blocked even if Stripe status is inconsistent", async () => {
  const { state, dependencies } = fixture({ stripeSession: open({ payment_status: "paid" }) });
  await assert.rejects(pay(dependencies), (error) => error.code === "checkout_payment_pending");
  assert.equal(state.creates.length, 0);
});

test("AUD-09: retrieve failure never falls back to an unverified local link or new Checkout", async () => {
  const { state, dependencies } = fixture({ retrieveError: new Error("Stripe network unavailable") });
  await assert.rejects(pay(dependencies), /Stripe network unavailable/);
  assert.equal(state.creates.length, 0);
  assert.equal(state.saves.length, 0);
});

test("AUD-09: an open session with missing, invalid or expired URL fails closed", async () => {
  for (const current of [open({ url: null }), open({ url: "https://example.invalid/pay" }), open({ expires_at: Math.floor(NOW.getTime() / 1000) - 1 })]) {
    const { state, dependencies } = fixture({ stripeSession: current });
    await assert.rejects(pay(dependencies), (error) => error.code === "checkout_session_unavailable");
    assert.equal(state.creates.length, 0);
    assert.equal(state.saves.length, 0);
  }
});

test("AUD-09: unexpected Stripe session ID or status cannot authorize another payment", async () => {
  for (const current of [open({ id: "cs_test_wrong" }), { id: OLD_ID, status: "pending", url: oldUrl }]) {
    const { state, dependencies } = fixture({ stripeSession: current });
    await assert.rejects(pay(dependencies), (error) => ["stripe_session_mismatch", "checkout_status_unknown"].includes(error.code));
    assert.equal(state.creates.length, 0);
  }
});

test("AUD-09: an open session can safely restore its Stripe URL if locally missing or stale", async () => {
  for (const payment_link of [null, "https://checkout.stripe.com/c/pay/cs_test_old#outdated"]) {
    const { state, dependencies } = fixture({ initial: standard({ payment_link }), stripeSession: open() });
    const result = await pay(dependencies);
    assert.equal(result.url, oldUrl);
    assert.equal(result.reused, true);
    assert.equal(state.creates.length, 0);
    assert.equal(state.saves.length, 1);
    assert.equal(state.saves[0].values.payment_link, oldUrl);
    assert.equal(state.saves[0].values.acceptance_expires_at, standard().acceptance_expires_at);
  }
});

test("AUD-09: expired replacement is never returned if CAS persistence fails", async () => {
  const { state, dependencies } = fixture({ stripeSession: { id: OLD_ID, status: "expired", url: oldUrl }, writeError: new InitialCheckoutError("booking_changed_concurrently", "Changed", 409) });
  await assert.rejects(pay(dependencies), (error) => error.code === "booking_changed_concurrently");
  assert.equal(state.creates.length, 1);
  assert.equal(state.saves.length, 1);
});

test("AUD-09: two concurrent opens of the same active session only retrieve and never replace", async () => {
  const { state, dependencies } = fixture({ stripeSession: open() });
  const [first, second] = await Promise.all([pay(dependencies), pay(dependencies)]);
  assert.equal(first.url, oldUrl);
  assert.equal(second.url, oldUrl);
  assert.equal(state.retrieves.length, 2);
  assert.equal(state.creates.length, 0);
  assert.equal(state.saves.length, 0);
});

test("AUD-09: two concurrent replacements cannot both overwrite booking session", async () => {
  const { state, dependencies } = fixture({ stripeSession: { id: OLD_ID, status: "expired", url: oldUrl } });
  const [first, second] = await Promise.allSettled([pay(dependencies), pay(dependencies)]);
  assert.equal([first, second].filter((x) => x.status === "fulfilled").length, 1);
  assert.equal([first, second].filter((x) => x.status === "rejected" && x.reason.code === "booking_changed_concurrently").length, 1);
  assert.equal(state.booking.stripe_checkout_session_id, NEW_ID);
  assert.equal(state.idempotencyKeys[0], state.idempotencyKeys[1]);
});

test("AUD-09: no retrieval or creation occurs for expired acceptance or paid local booking", async () => {
  for (const candidate of [standard({ acceptance_expires_at: "2026-10-28T09:59:59.000Z" }), standard({ amount_paid: 96 })]) {
    const { state, dependencies } = fixture({ initial: candidate, stripeSession: open() });
    await assert.rejects(pay(dependencies), (error) => ["acceptance_expired", "booking_already_paid"].includes(error.code));
    assert.equal(state.retrieves.length, 0);
    assert.equal(state.creates.length, 0);
  }
});

test("AUD-09: a valid-looking stored URL is replaced when Stripe no longer knows its session", async () => {
  const { state, dependencies } = fixture({ stripeSession: null });
  const result = await pay(dependencies);
  assert.deepEqual(state.retrieves, [OLD_ID]);
  assert.equal(result.url, newUrl);
  assert.equal(result.reused, false);
  assert.equal(state.creates.length, 1);
  assert.equal(state.saves[0].values.payment_link, newUrl);
});
