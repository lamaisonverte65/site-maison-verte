import test from "node:test";
import assert from "node:assert/strict";
import {
  expireBookingOpenCheckoutSessions,
  expireOpenCheckoutSession,
} from "../netlify/functions/_lib/stripe-checkout-session.js";

test("expireOpenCheckoutSession expires only open sessions", async () => {
  const expired = [];
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id) {
          return { id, status: id === "open" ? "open" : "complete" };
        },
        async expire(id) { expired.push(id); },
      },
    },
  };

  assert.equal(await expireOpenCheckoutSession(stripe, "open"), true);
  assert.equal(await expireOpenCheckoutSession(stripe, "complete"), false);
  assert.deepEqual(expired, ["open"]);
});

test("expireBookingOpenCheckoutSessions deduplicates current booking session ids", async () => {
  const retrieved = [];
  const expired = [];
  const stripe = {
    checkout: {
      sessions: {
        async retrieve(id) {
          retrieved.push(id);
          return { id, status: "open" };
        },
        async expire(id) { expired.push(id); },
      },
    },
  };

  await expireBookingOpenCheckoutSessions(stripe, {
    stripe_checkout_session_id: "cs_initial",
    balance_payment_stripe_session_id: "cs_balance",
    manual_payment_stripe_session_id: "cs_balance",
  });

  assert.deepEqual(retrieved, ["cs_initial", "cs_balance"]);
  assert.deepEqual(expired, ["cs_initial", "cs_balance"]);
});

test("resource_missing is treated as already non-payable", async () => {
  const stripe = {
    checkout: {
      sessions: {
        async retrieve() {
          const error = new Error("missing");
          error.code = "resource_missing";
          throw error;
        },
        async expire() {
          throw new Error("should not be called");
        },
      },
    },
  };

  assert.equal(await expireOpenCheckoutSession(stripe, "cs_missing"), false);
});
