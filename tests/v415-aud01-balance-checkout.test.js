import test from "node:test";
import assert from "node:assert/strict";
import { openBalanceCheckout, isReusableBalanceSession } from "../netlify/functions/_lib/balance-checkout.js";

const NOW = Date.parse("2026-10-28T11:00:00Z");
const SITE_URL = "https://lamaisonverte65.fr";

function booking(overrides = {}) {
  return {
    id: "booking-1", status: "deposit_paid", balance_status: "en attente",
    contract_total: 100, deposit_rate: .3, deposit_basis: 100, deposit_amount: 30,
    amount_paid: 30, guest_email: "client@example.invalid", communication_language: "en",
    updated_at: "2026-10-28T08:00:00.000Z", balance_payment_stripe_session_id: null,
    ...overrides,
  };
}
function checkoutSession(id, opts = {}) {
  return {
    id, url: `https://checkout.stripe.com/c/pay/${id}`,
    status: "open", payment_status: "unpaid", mode: "payment", amount_total: 7000,
    currency: "eur", metadata: { booking_id: "booking-1", payment_type: "balance" },
    expires_at: Math.floor(NOW / 1000) + 1800, ...opts,
  };
}
function fixtures(initial = booking(), existing = []) {
  const sessions = new Map(existing.map(s => [s.id, structuredClone(s)]));
  const state = { row: structuredClone(initial), sessions, creates: [], expires: [], updates: 0, failStore: null, failRetrieve: null };
  const stripe = { checkout: { sessions: {
    async retrieve(id) {
      if (state.failRetrieve) throw state.failRetrieve;
      if (!sessions.has(id)) throw Object.assign(new Error("not found"), { code: "resource_missing" });
      return sessions.get(id);
    },
    async expire(id) {
      state.expires.push(id);
      const session = sessions.get(id);
      if (!session || session.status !== "open") throw new Error("cannot expire");
      session.status = "expired";
      return session;
    },
    async create(params, options) {
      if (state.failCreate) throw state.failCreate;
      const id = `cs_test_created_${state.creates.length + 1}`;
      const session = checkoutSession(id, {
        amount_total: params.line_items[0].price_data.unit_amount,
        metadata: params.metadata,
      });
      sessions.set(id, session);
      state.creates.push({ session, params, options });
      return session;
    },
  } } };
  const supabase = { from(table) {
    assert.equal(table, "booking_requests");
    return {
      update(values) {
        const filters = [];
        const query = {
          eq(name, val) { filters.push([name, val, "eq"]); return query; },
          is(name, val) { filters.push([name, val, "is"]); return query; },
          async select(columns) {
            assert.equal(columns, "id");
            state.updates++;
            if (state.failStore) return { data: null, error: state.failStore };
            const matches = filters.every(([name, val]) => state.row?.[name] == val);
            if (!matches) return { data: [], error: null };
            state.row = { ...state.row, ...values };
            return { data: [{ id: state.row.id }], error: null };
          },
        };
        return query;
      },
      select() { return {
        eq(name, val) { assert.equal(name, "id"); assert.equal(val, state.row.id); return this; },
        async single() { return { data: structuredClone(state.row), error: null }; },
      }; },
    };
  } };
  const open = (snapshot = structuredClone(state.row)) => openBalanceCheckout({ stripe, supabase, booking: snapshot, cents: 7000, siteUrl: SITE_URL, now: NOW });
  return { state, stripe, supabase, open };
}

test("AUD01: a second sequential visit reuses the same valid session without expiring or creating another", async () => {
  const fx = fixtures();
  const first = await fx.open();
  const second = await fx.open();
  assert.equal(first.kind, "redirect");
  assert.equal(second.kind, "redirect");
  assert.equal(first.url, second.url);
  assert.equal(fx.state.creates.length, 1);
  assert.deepEqual(fx.state.expires, []);
  assert.equal(fx.state.updates, 1);
  assert.match(fx.state.creates[0].params.success_url, /lang=en/);
});

test("AUD01: two concurrent first opens cannot replace each other's payable session", async () => {
  const fx = fixtures();
  const original = booking();
  const [a, b] = await Promise.all([fx.open(original), fx.open(original)]);
  assert.equal(a.kind, "redirect");
  assert.equal(b.kind, "redirect");
  assert.equal(a.url, b.url);
  assert.equal(fx.state.creates.length, 2);
  assert.equal(fx.state.expires.length, 1);
  assert.equal(fx.state.sessions.get(fx.state.row.balance_payment_stripe_session_id).status, "open");
  const orphan = [...fx.state.sessions.values()].filter(s => s.id !== fx.state.row.balance_payment_stripe_session_id && s.status === "open");
  assert.equal(orphan.length, 0);
});

test("AUD01: an expired prior session is replaced using a new idempotency key", async () => {
  const old = checkoutSession("cs_test_old", { status: "expired" });
  const fx = fixtures(booking({ balance_payment_stripe_session_id: old.id }), [old]);
  const result = await fx.open();
  assert.equal(result.kind, "redirect");
  assert.notEqual(fx.state.row.balance_payment_stripe_session_id, old.id);
  assert.deepEqual(fx.state.expires, []);
  assert.match(fx.state.creates[0].options.idempotencyKey, /^balance:booking-1:7000:/);
});

test("AUD01: complete Stripe session prevents a second charge before webhook confirmation", async () => {
  const prior = checkoutSession("cs_test_paid", { status: "complete", payment_status: "paid" });
  const fx = fixtures(booking({ balance_payment_stripe_session_id: prior.id }), [prior]);
  assert.equal((await fx.open()).kind, "verifying");
  assert.equal(fx.state.creates.length, 0);
  assert.equal(fx.state.expires.length, 0);
});

test("AUD01: amount changed means existing open Checkout must expire before new session", async () => {
  const old = checkoutSession("cs_test_wrong_amount", { amount_total: 6000 });
  const fx = fixtures(booking({ balance_payment_stripe_session_id: old.id }), [old]);
  assert.equal((await fx.open()).kind, "redirect");
  assert.deepEqual(fx.state.expires, [old.id]);
  assert.equal(fx.state.sessions.get(old.id).status, "expired");
  assert.equal(fx.state.creates.length, 1);
});

test("AUD01: refusal to retrieve Stripe status does not create a potentially duplicate session", async () => {
  const prior = checkoutSession("cs_test_check");
  const fx = fixtures(booking({ balance_payment_stripe_session_id: prior.id }), [prior]);
  fx.state.failRetrieve = Object.assign(new Error("Stripe unavailable"), { code: "api_connection_error" });
  await assert.rejects(fx.open(), /Stripe unavailable/);
  assert.equal(fx.state.creates.length, 0);
});

test("AUD01: Supabase storage error expires newly created session instead of returning an untracked link", async () => {
  const fx = fixtures();
  fx.state.failStore = new Error("write unavailable");
  await assert.rejects(fx.open(), /write unavailable/);
  assert.equal(fx.state.creates.length, 1);
  assert.deepEqual(fx.state.expires, ["cs_test_created_1"]);
  assert.equal(fx.state.row.balance_payment_stripe_session_id, null);
});

test("AUD01: conflicting paid status after creation does not return a new payable link", async () => {
  const fx = fixtures();
  const base = booking();
  const original = fx.stripe.checkout.sessions.create;
  fx.stripe.checkout.sessions.create = async (...args) => {
    const result = await original(...args);
    fx.state.row = { ...fx.state.row, status: "fully_paid", updated_at: "2026-10-28T10:30:00Z", amount_paid: 100 };
    return result;
  };
  const result = await fx.open(base);
  assert.equal(result.kind, "verifying");
  assert.deepEqual(fx.state.expires, ["cs_test_created_1"]);
});

test("AUD01: a foreign, malformed or soon-expiring session is never reused", () => {
  const b = booking({ balance_payment_stripe_session_id: "cs_test_q" });
  assert.equal(isReusableBalanceSession(checkoutSession("cs_test_q"), b, 7000, NOW), true);
  assert.equal(isReusableBalanceSession(checkoutSession("cs_test_q", { metadata: { booking_id: "elsewhere", payment_type: "balance" } }), b, 7000, NOW), false);
  assert.equal(isReusableBalanceSession(checkoutSession("cs_test_q", { url: "https://evil.example/pay/cs_test_q" }), b, 7000, NOW), false);
  assert.equal(isReusableBalanceSession(checkoutSession("cs_test_q", { expires_at: Math.floor(NOW / 1000) + 1 }), b, 7000, NOW), false);
});


test("AUD01: Stripe failure during creation leaves the booking unchanged", async () => {
  const fx = fixtures();
  fx.state.failCreate = new Error("Stripe creation unavailable");
  await assert.rejects(fx.open(), /Stripe creation unavailable/);
  assert.equal(fx.state.row.balance_payment_stripe_session_id, null);
  assert.equal(fx.state.updates, 0);
});

test("AUD01: malformed Stripe-created Checkout URL cannot be persisted or sent", async () => {
  const fx = fixtures();
  const create = fx.stripe.checkout.sessions.create;
  fx.stripe.checkout.sessions.create = async (...args) => {
    const session = await create(...args);
    session.url = "https://lookalike.invalid/pay/cs_test_created_1";
    return session;
  };
  await assert.rejects(fx.open(), /inexploitable/);
  assert.deepEqual(fx.state.expires, ["cs_test_created_1"]);
  assert.equal(fx.state.updates, 0);
});


test("AUD01: checkout completed between first read and expiration is not replaced", async () => {
  const old = checkoutSession("cs_test_transition", { amount_total: 6000 });
  const fx = fixtures(booking({ balance_payment_stripe_session_id: old.id }), [old]);
  const retrieve = fx.stripe.checkout.sessions.retrieve;
  let reads = 0;
  fx.stripe.checkout.sessions.retrieve = async (id) => {
    const session = await retrieve(id);
    if (++reads === 2) { session.status = "complete"; session.payment_status = "paid"; }
    return session;
  };
  const result = await fx.open();
  assert.equal(result.kind, "verifying");
  assert.equal(fx.state.creates.length, 0);
  assert.deepEqual(fx.state.expires, []);
});
