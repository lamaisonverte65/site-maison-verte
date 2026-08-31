import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const checkoutModule = await import("../netlify/functions/_lib/stripe-checkout-completed.js").catch(() => ({}));
const processCheckoutSessionCompleted = checkoutModule.processCheckoutSessionCompleted;

function checkoutSession(overrides = {}) {
  return {
    id: "cs_test_current",
    amount_total: 7000,
    currency: "eur",
    payment_intent: "pi_test_current",
    customer_email: "guest@example.test",
    metadata: {
      booking_id: "11111111-1111-4111-8111-111111111111",
      payment_type: "deposit",
    },
    ...overrides,
  };
}

function dependencies({ outcome = "applied", reviewReason = null } = {}) {
  const state = { applications: [], emails: [] };
  return {
    state,
    dependencies: {
      async getFinancialDetails() {
        return {
          stripeFeeAmount: 1.65,
          stripeNetAmount: 68.35,
          stripeBalanceTransactionId: "txn_test_current",
          stripeChargeId: "ch_test_current",
        };
      },
      async applyPayment(payload) {
        state.applications.push(payload);
        return {
          outcome,
          review_reason: reviewReason,
          booking: outcome === "applied" ? {
            id: payload.bookingId,
            guest_email: "guest@example.test",
            amount_paid: 70,
            status: "deposit_paid",
          } : null,
        };
      },
      async sendConfirmationEmail(payload) {
        state.emails.push(payload);
      },
    },
  };
}

test("a first completed Checkout Session is atomically applied and sends one confirmation", async () => {
  assert.equal(typeof processCheckoutSessionCompleted, "function");
  const { state, dependencies: deps } = dependencies();

  const result = await processCheckoutSessionCompleted({
    session: checkoutSession(),
    stripeEventCreated: 1788170400,
    dependencies: deps,
  });

  assert.equal(result.outcome, "applied");
  assert.equal(state.applications.length, 1);
  assert.equal(state.applications[0].stripePaidAt, "2026-08-31T10:00:00.000Z");
  assert.equal(state.applications[0].amount, 70);
  assert.equal(state.emails.length, 1);
});

test("a replayed Checkout Session performs no email or secondary business effect", async () => {
  assert.equal(typeof processCheckoutSessionCompleted, "function");
  const { state, dependencies: deps } = dependencies({ outcome: "already_applied" });

  const result = await processCheckoutSessionCompleted({
    session: checkoutSession(),
    stripeEventCreated: 1788170400,
    dependencies: deps,
  });

  assert.equal(result.outcome, "already_applied");
  assert.equal(state.applications.length, 1);
  assert.equal(state.emails.length, 0);
});

test("two deliveries of the same session keep one payment, one amount application, and one email", async () => {
  assert.equal(typeof processCheckoutSessionCompleted, "function");
  const state = { sessions: new Set(), amountPaid: 0, events: 0, emails: 0 };
  const deps = {
    async getFinancialDetails() {
      return {
        stripeFeeAmount: 1.65,
        stripeNetAmount: 68.35,
        stripeBalanceTransactionId: "txn_test_current",
        stripeChargeId: "ch_test_current",
      };
    },
    async applyPayment(payload) {
      if (state.sessions.has(payload.checkoutSessionId)) return { outcome: "already_applied" };
      state.sessions.add(payload.checkoutSessionId);
      state.amountPaid += payload.amount;
      state.events += 1;
      return {
        outcome: "applied",
        booking: { id: payload.bookingId, amount_paid: state.amountPaid, status: "deposit_paid" },
      };
    },
    async sendConfirmationEmail() { state.emails += 1; },
  };

  await processCheckoutSessionCompleted({ session: checkoutSession(), stripeEventCreated: 1788170400, dependencies: deps });
  await processCheckoutSessionCompleted({ session: checkoutSession(), stripeEventCreated: 1788170400, dependencies: deps });

  assert.equal(state.sessions.size, 1);
  assert.equal(state.amountPaid, 70);
  assert.equal(state.events, 1);
  assert.equal(state.emails, 1);
});

test("an incompatible paid session is kept for review without a normal confirmation email", async () => {
  assert.equal(typeof processCheckoutSessionCompleted, "function");
  const { state, dependencies: deps } = dependencies({
    outcome: "review_required",
    reviewReason: "booking_cancelled",
  });

  const result = await processCheckoutSessionCompleted({
    session: checkoutSession(),
    stripeEventCreated: 1788170400,
    dependencies: deps,
  });

  assert.deepEqual(result, { outcome: "review_required", reviewReason: "booking_cancelled" });
  assert.equal(state.emails.length, 0);
});

test("a legitimate balance payment keeps its type and amount at the atomic boundary", async () => {
  assert.equal(typeof processCheckoutSessionCompleted, "function");
  const { state, dependencies: deps } = dependencies();

  await processCheckoutSessionCompleted({
    session: checkoutSession({
      id: "cs_test_balance",
      amount_total: 16300,
      metadata: {
        booking_id: "11111111-1111-4111-8111-111111111111",
        payment_type: "balance",
      },
    }),
    stripeEventCreated: 1788170400,
    dependencies: deps,
  });

  assert.equal(state.applications[0].paymentType, "balance");
  assert.equal(state.applications[0].amount, 163);
  assert.equal(state.emails.length, 1);
});

test("a full payment with the exact contractual amount remains applicable", async () => {
  assert.equal(typeof processCheckoutSessionCompleted, "function");
  const { state, dependencies: deps } = dependencies();

  const result = await processCheckoutSessionCompleted({
    session: checkoutSession({
      id: "cs_test_full_exact",
      amount_total: 32000,
      metadata: {
        booking_id: "11111111-1111-4111-8111-111111111111",
        payment_type: "full",
      },
    }),
    stripeEventCreated: 1788170400,
    dependencies: deps,
  });

  assert.equal(result.outcome, "applied");
  assert.equal(state.applications[0].amount, 320);
  assert.equal(state.emails.length, 1);
});

test("an underpaid full payment is retained at its real Stripe amount without confirmation", async () => {
  assert.equal(typeof processCheckoutSessionCompleted, "function");
  const { state, dependencies: deps } = dependencies({ outcome: "review_required", reviewReason: "full_amount_mismatch" });

  const result = await processCheckoutSessionCompleted({
    session: checkoutSession({
      id: "cs_test_full_underpaid",
      amount_total: 100,
      metadata: {
        booking_id: "11111111-1111-4111-8111-111111111111",
        payment_type: "full",
      },
    }),
    stripeEventCreated: 1788170400,
    dependencies: deps,
  });

  assert.deepEqual(result, { outcome: "review_required", reviewReason: "full_amount_mismatch" });
  assert.equal(state.applications[0].amount, 1);
  assert.equal(state.emails.length, 0);
});

test("an overpaid full payment is retained for review without booking confirmation", async () => {
  assert.equal(typeof processCheckoutSessionCompleted, "function");
  const { state, dependencies: deps } = dependencies({ outcome: "review_required", reviewReason: "full_amount_mismatch" });

  const result = await processCheckoutSessionCompleted({
    session: checkoutSession({
      id: "cs_test_full_overpaid",
      amount_total: 32100,
      metadata: {
        booking_id: "11111111-1111-4111-8111-111111111111",
        payment_type: "full",
      },
    }),
    stripeEventCreated: 1788170400,
    dependencies: deps,
  });

  assert.deepEqual(result, { outcome: "review_required", reviewReason: "full_amount_mismatch" });
  assert.equal(state.applications[0].amount, 321);
  assert.equal(state.emails.length, 0);
});

test("a replayed balance payment sends no second confirmation", async () => {
  assert.equal(typeof processCheckoutSessionCompleted, "function");
  const { state, dependencies: deps } = dependencies({ outcome: "already_applied" });

  const result = await processCheckoutSessionCompleted({
    session: checkoutSession({
      id: "cs_test_balance",
      amount_total: 16300,
      metadata: {
        booking_id: "11111111-1111-4111-8111-111111111111",
        payment_type: "balance",
      },
    }),
    stripeEventCreated: 1788170400,
    dependencies: deps,
  });

  assert.equal(result.outcome, "already_applied");
  assert.equal(state.applications[0].paymentType, "balance");
  assert.equal(state.emails.length, 0);
});

test("the migration acquires the Checkout Session once before all applied business mutations", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310001_secure_stripe_checkout_webhook.sql", import.meta.url), "utf8").catch(() => "");

  assert.match(sql, /on conflict \(stripe_checkout_session_id\) do nothing/i);
  assert.match(sql, /if not coalesce\(v_payment_acquired, false\) then[\s\S]*already_applied/i);
  assert.match(sql, /update public\.booking_requests/i);
  assert.match(sql, /insert into public\.booking_events/i);
  assert.match(sql, /status = 'expired'/i);
});

test("review-required payments cannot enter booking payment aggregates", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310001_secure_stripe_checkout_webhook.sql", import.meta.url), "utf8").catch(() => "");

  assert.match(sql, /'requires_review'/i);
  assert.match(sql, /booking_request_id[\s\S]*null/i);
  assert.match(sql, /'requires_review'[\s\S]*coalesce\(p_amount, 0\)/i);
  assert.match(sql, /review_required/i);
});

test("the full payment SQL contract rejects both sides of a one-cent amount mismatch", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310001_secure_stripe_checkout_webhook.sql", import.meta.url), "utf8").catch(() => "");

  assert.match(sql, /p_payment_type = 'full'[\s\S]*abs\(p_amount - v_total_due\) > 0\.01[\s\S]*full_amount_mismatch/i);
  assert.match(sql, /v_applied_amount := p_amount/i);

  const requiresReview = (paid, due) => Math.abs(paid - due) > 0.01;
  assert.equal(requiresReview(320, 320), false);
  assert.equal(requiresReview(1, 320), true);
  assert.equal(requiresReview(321, 320), true);
});

test("initial and balance compatibility are decided from Stripe time, current session, and positive balance", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310001_secure_stripe_checkout_webhook.sql", import.meta.url), "utf8").catch(() => "");

  assert.match(sql, /p_stripe_paid_at\s*>\s*v_booking\.acceptance_expires_at/i);
  assert.match(sql, /v_booking\.status in \('cancelled', 'refused', 'expired'\)/i);
  assert.match(sql, /if coalesce\(v_booking\.payment_link, ''\) <> '' then[\s\S]*position\(p_checkout_session_id in v_booking\.payment_link\)[\s\S]*elsif coalesce\(v_booking\.stripe_checkout_session_id, ''\) <> p_checkout_session_id/i);
  assert.match(sql, /balance_payment_link[\s\S]*p_checkout_session_id/i);
  assert.match(sql, /v_remaining_due\s*<=\s*0/i);
});
