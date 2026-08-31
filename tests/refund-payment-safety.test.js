import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as bookingActionsService from "../src/services/bookingActionsService.js";

const refundModule = await import("../netlify/functions/_lib/refund-operation.js").catch(() => ({}));
const processRefundOperation = refundModule.processRefundOperation;
const normalizeRefundRequest = refundModule.normalizeRefundRequest;

const OPERATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOOKING_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function request(overrides = {}) {
  return {
    operationId: OPERATION_ID,
    bookingId: BOOKING_ID,
    action: "refund_only",
    refundOnly: true,
    cancellationType: "client",
    refundMode: "balance",
    refundAmount: 50,
    message: "Remboursement du solde",
    ...overrides,
  };
}

function allocation(overrides = {}) {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    operation_id: OPERATION_ID,
    payment_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    payment_intent_id: "pi_balance",
    amount_cents: 5000,
    currency: "eur",
    idempotency_key: `lmv-refund:${OPERATION_ID}:cccccccc-cccc-4ccc-8ccc-cccccccccccc`,
    operation_status: "pending",
    stripe_refund_id: null,
    ...overrides,
  };
}

function dependencies({
  acquiredAllocations = [allocation()],
  createError = null,
  recordError = null,
  finalOutcome = "succeeded",
  shouldNotify = true,
} = {}) {
  const state = {
    acquisitions: [],
    claims: [],
    stripeCreates: [],
    stripeRetrieves: [],
    stripeLists: [],
    recorded: [],
    failures: [],
    finalizations: [],
    notifications: [],
  };

  return {
    state,
    dependencies: {
      async acquireOperation(payload) {
        state.acquisitions.push(payload);
        return {
          operation: {
            id: payload.operationId,
            status: "pending",
            policy_label: "Remboursement solde choisi",
          },
          allocations: acquiredAllocations,
        };
      },
      async claimAllocation(payload) {
        state.claims.push(payload);
        return { outcome: "claimed_first_attempt" };
      },
      async createStripeRefund(payload, options) {
        state.stripeCreates.push({ payload, options });
        if (createError) throw createError;
        return { id: "re_test_balance", status: "succeeded", ...payload };
      },
      async retrieveStripeRefund(refundId) {
        state.stripeRetrieves.push(refundId);
        return { id: refundId, status: "succeeded" };
      },
      async listStripeRefundsPage(payload) {
        state.stripeLists.push(payload);
        return { data: [], has_more: false };
      },
      async recordStripeResult(payload) {
        state.recorded.push(payload);
        if (recordError) throw recordError;
        return { outcome: "recorded" };
      },
      async recordStripeFailure(payload) {
        state.failures.push(payload);
        return { outcome: "retryable" };
      },
      async finalizeOperation(operationId) {
        state.finalizations.push(operationId);
        return {
          outcome: finalOutcome,
          should_notify: shouldNotify,
          refunded_amount_cents: 5000,
          policy_label: "Remboursement solde choisi",
          action: "refund_only",
          booking: { id: BOOKING_ID, guest_email: "guest@example.test" },
        };
      },
      async notify(payload) {
        state.notifications.push(payload);
      },
    },
  };
}

test("a nominal refund uses the durable allocation and finalizes once", async () => {
  assert.equal(typeof processRefundOperation, "function");
  const { state, dependencies: deps } = dependencies();

  const result = await processRefundOperation({ request: request(), dependencies: deps });

  assert.equal(result.outcome, "succeeded");
  assert.equal(result.refundedAmount, 50);
  assert.equal(state.stripeCreates.length, 1);
  assert.equal(state.recorded.length, 1);
  assert.deepEqual(state.finalizations, [OPERATION_ID]);
  assert.equal(state.notifications.length, 1);
});

test("Stripe receives one stable idempotency key for the same durable allocation", async () => {
  assert.equal(typeof processRefundOperation, "function");
  const { state, dependencies: deps } = dependencies();

  await processRefundOperation({ request: request(), dependencies: deps });

  assert.deepEqual(state.stripeCreates[0].options, {
    idempotencyKey: `lmv-refund:${OPERATION_ID}:cccccccc-cccc-4ccc-8ccc-cccccccccccc`,
  });
  assert.equal(state.stripeCreates[0].payload.payment_intent, "pi_balance");
  assert.equal(state.stripeCreates[0].payload.amount, 5000);
  assert.equal(state.claims.length, 1);
});

test("an ambiguous retry searches Stripe before considering any create", async () => {
  const { state, dependencies: deps } = dependencies({
    acquiredAllocations: [allocation({ operation_status: "in_progress" })],
  });
  deps.claimAllocation = async (payload) => {
    state.claims.push(payload);
    return { outcome: "already_in_progress" };
  };
  deps.listStripeRefundsPage = async (payload) => {
    state.stripeLists.push(payload);
    return {
      data: [{
        id: "re_recovered",
        status: "succeeded",
        metadata: { refund_operation_id: OPERATION_ID, refund_allocation_id: allocation().id },
      }],
      has_more: false,
    };
  };

  await processRefundOperation({ request: request(), dependencies: deps });

  assert.equal(state.stripeCreates.length, 0);
  assert.equal(state.stripeLists.length, 1);
  assert.equal(state.recorded[0].stripeRefundId, "re_recovered");
});

test("an exhaustive ambiguous retry with no metadata match stays blocked safely", async () => {
  const { state, dependencies: deps } = dependencies({
    acquiredAllocations: [allocation({ operation_status: "needs_reconciliation" })],
  });
  deps.claimAllocation = async () => ({ outcome: "already_ambiguous" });
  deps.listStripeRefundsPage = async (payload) => {
    state.stripeLists.push(payload);
    return {
      data: [{ id: "re_other", status: "succeeded", metadata: { refund_operation_id: "other" } }],
      has_more: false,
    };
  };

  const result = await processRefundOperation({ request: request(), dependencies: deps });

  assert.equal(result.outcome, "needs_reconciliation");
  assert.equal(result.reason, "stripe_refund_not_found_after_exhaustive_search");
  assert.equal(state.stripeCreates.length, 0);
  assert.equal(state.failures.length, 1);
  assert.equal(state.finalizations.length, 0);
});

test("multiple Stripe refunds with the same durable metadata stop reconciliation", async () => {
  const { state, dependencies: deps } = dependencies({
    acquiredAllocations: [allocation({ operation_status: "needs_reconciliation" })],
  });
  deps.claimAllocation = async () => ({ outcome: "already_ambiguous" });
  deps.listStripeRefundsPage = async (payload) => {
    state.stripeLists.push(payload);
    return {
      data: ["re_one", "re_two"].map((id) => ({
        id,
        status: "succeeded",
        metadata: { refund_operation_id: OPERATION_ID, refund_allocation_id: allocation().id },
      })),
      has_more: false,
    };
  };

  const result = await processRefundOperation({ request: request(), dependencies: deps });

  assert.equal(result.outcome, "needs_reconciliation");
  assert.equal(result.reason, "multiple_matching_stripe_refunds");
  assert.equal(state.stripeCreates.length, 0);
  assert.equal(state.recorded.length, 0);
});

test("ambiguous Stripe reconciliation paginates until every refund is inspected", async () => {
  const { state, dependencies: deps } = dependencies({
    acquiredAllocations: [allocation({ operation_status: "in_progress" })],
  });
  deps.claimAllocation = async () => ({ outcome: "already_in_progress" });
  deps.listStripeRefundsPage = async (payload) => {
    state.stripeLists.push(payload);
    if (!payload.startingAfter) {
      return {
        data: [{ id: "re_page_one", status: "succeeded", metadata: {} }],
        has_more: true,
      };
    }
    return {
      data: [{
        id: "re_page_two",
        status: "succeeded",
        metadata: { refund_operation_id: OPERATION_ID, refund_allocation_id: allocation().id },
      }],
      has_more: false,
    };
  };

  await processRefundOperation({ request: request(), dependencies: deps });

  assert.deepEqual(state.stripeLists.map((call) => call.startingAfter || null), [null, "re_page_one"]);
  assert.equal(state.recorded[0].stripeRefundId, "re_page_two");
  assert.equal(state.stripeCreates.length, 0);
});

test("an exact retry of a succeeded allocation creates no second Stripe refund or email", async () => {
  assert.equal(typeof processRefundOperation, "function");
  const { state, dependencies: deps } = dependencies({
    acquiredAllocations: [allocation({ operation_status: "succeeded", stripe_refund_id: "re_existing" })],
    finalOutcome: "already_succeeded",
    shouldNotify: false,
  });

  const result = await processRefundOperation({ request: request(), dependencies: deps });

  assert.equal(result.outcome, "already_succeeded");
  assert.equal(state.stripeCreates.length, 0);
  assert.equal(state.stripeRetrieves.length, 0);
  assert.equal(state.notifications.length, 0);
});

test("two concurrent deliveries rely on the same acquired allocation and Stripe key", async () => {
  assert.equal(typeof processRefundOperation, "function");
  const durableAllocation = allocation();
  const { state, dependencies: deps } = dependencies({ acquiredAllocations: [durableAllocation] });
  let finalized = false;
  deps.finalizeOperation = async () => {
    if (finalized) {
      return { outcome: "already_succeeded", should_notify: false, refunded_amount_cents: 5000, action: "refund_only" };
    }
    finalized = true;
    return { outcome: "succeeded", should_notify: true, refunded_amount_cents: 5000, action: "refund_only" };
  };

  await Promise.all([
    processRefundOperation({ request: request(), dependencies: deps }),
    processRefundOperation({ request: request(), dependencies: deps }),
  ]);

  assert.equal(new Set(state.stripeCreates.map((call) => call.options.idempotencyKey)).size, 1);
  assert.equal(state.notifications.length, 1);
});

test("a total refund processes deterministic deposit and balance allocations exactly once", async () => {
  const deposit = allocation({
    id: "10000000-0000-4000-8000-000000000001",
    payment_id: "20000000-0000-4000-8000-000000000001",
    payment_intent_id: "pi_deposit",
    amount_cents: 9600,
    idempotency_key: `lmv-refund:${OPERATION_ID}:10000000-0000-4000-8000-000000000001`,
  });
  const balance = allocation({
    id: "10000000-0000-4000-8000-000000000002",
    payment_id: "20000000-0000-4000-8000-000000000002",
    payment_intent_id: "pi_balance",
    amount_cents: 22400,
    idempotency_key: `lmv-refund:${OPERATION_ID}:10000000-0000-4000-8000-000000000002`,
  });
  const { state, dependencies: deps } = dependencies({ acquiredAllocations: [deposit, balance] });
  deps.finalizeOperation = async () => ({
    outcome: "succeeded",
    should_notify: true,
    refunded_amount_cents: 32000,
    action: "cancel_refund",
    booking: { id: BOOKING_ID },
  });

  const result = await processRefundOperation({
    request: request({ action: "cancel_refund", refundOnly: false, refundMode: "total" }),
    dependencies: deps,
  });

  assert.equal(result.refundedAmount, 320);
  assert.deepEqual(state.stripeCreates.map(({ payload }) => [payload.payment_intent, payload.amount]), [
    ["pi_deposit", 9600],
    ["pi_balance", 22400],
  ]);
  assert.equal(state.recorded.length, 2);
  assert.equal(state.notifications.length, 1);
});

test("a Stripe failure is recorded and the operation is not finalized", async () => {
  assert.equal(typeof processRefundOperation, "function");
  const { state, dependencies: deps } = dependencies({ createError: new Error("Stripe unavailable") });

  await assert.rejects(
    processRefundOperation({ request: request(), dependencies: deps }),
    /Stripe unavailable/,
  );

  assert.equal(state.failures.length, 1);
  assert.equal(state.finalizations.length, 0);
  assert.equal(state.notifications.length, 0);
});

test("Stripe success followed by a local write failure remains explicitly reconcilable", async () => {
  assert.equal(typeof processRefundOperation, "function");
  const { state, dependencies: deps } = dependencies({ recordError: new Error("Supabase write failed") });

  await assert.rejects(
    processRefundOperation({ request: request(), dependencies: deps }),
    (error) => error.code === "refund_needs_reconciliation" && /Supabase write failed/.test(error.message),
  );

  assert.equal(state.stripeCreates.length, 1);
  assert.equal(state.failures[0].stripeRefundId, "re_test_balance");
  assert.equal(state.failures[0].status, "stripe_succeeded");
  assert.equal(state.finalizations.length, 0);
});

test("a known non-final Stripe refund is retrieved instead of recreated", async () => {
  assert.equal(typeof processRefundOperation, "function");
  const { state, dependencies: deps } = dependencies({
    acquiredAllocations: [allocation({ operation_status: "needs_reconciliation", stripe_refund_id: "re_known" })],
  });

  await processRefundOperation({ request: request(), dependencies: deps });

  assert.deepEqual(state.stripeRetrieves, ["re_known"]);
  assert.equal(state.stripeCreates.length, 0);
  assert.equal(state.recorded[0].stripeRefundId, "re_known");
});

test("an explicit acquisition error stops before Stripe", async () => {
  assert.equal(typeof processRefundOperation, "function");
  const { state, dependencies: deps } = dependencies();
  deps.acquireOperation = async () => { throw new Error("Supabase acquisition failed"); };

  await assert.rejects(
    processRefundOperation({ request: request(), dependencies: deps }),
    /Supabase acquisition failed/,
  );
  assert.equal(state.stripeCreates.length, 0);
});

test("refund input normalization fixes immutable action and integer custom cents", () => {
  assert.equal(typeof normalizeRefundRequest, "function");

  assert.deepEqual(normalizeRefundRequest({
    operationId: OPERATION_ID,
    bookingId: BOOKING_ID,
    action: "cancel_refund",
    refundOnly: true,
    refundMode: "custom",
    refundAmount: "12.34",
    cancellationType: "client",
    message: "Test",
  }), {
    operationId: OPERATION_ID,
    bookingId: BOOKING_ID,
    action: "refund_only",
    refundOnly: true,
    refundMode: "custom",
    refundAmount: 12.34,
    refundAmountCents: 1234,
    cancellationType: "client",
    message: "Test",
  });

  assert.throws(
    () => normalizeRefundRequest({ operationId: "not-a-uuid", bookingId: BOOKING_ID }),
    (error) => error.code === "invalid_refund_operation_id",
  );
});

test("the frontend refund contract sends the stable operation identifier", async () => {
  let body = null;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, async json() { return { success: true }; } };
  };

  try {
    const supabase = { auth: { async getSession() { return { data: { session: { access_token: "token" } } }; } } };
    await bookingActionsService.refundBookingPayment(supabase, { id: BOOKING_ID }, {
      operationId: OPERATION_ID,
      action: "refund_only",
      refundOnly: true,
      refundMode: "balance",
      refundAmount: 50,
      cancellationType: "client",
      message: "Remboursement du solde",
    });
    assert.equal(body.operationId, OPERATION_ID);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("one refund modal keeps one operation id while a new modal gets a new intention", () => {
  assert.equal(typeof bookingActionsService.createRefundOperationId, "function");
  assert.equal(typeof bookingActionsService.buildRefundSubmission, "function");

  const generated = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];
  const firstModal = { refundOperationId: bookingActionsService.createRefundOperationId(() => generated.shift()) };
  const secondModal = { refundOperationId: bookingActionsService.createRefundOperationId(() => generated.shift()) };

  const firstAttempt = bookingActionsService.buildRefundSubmission(firstModal, { refundMode: "balance" });
  const retry = bookingActionsService.buildRefundSubmission(firstModal, { refundMode: "balance" });
  const newIntention = bookingActionsService.buildRefundSubmission(secondModal, { refundMode: "balance" });

  assert.equal(firstAttempt.operationId, firstModal.refundOperationId);
  assert.equal(retry.operationId, firstAttempt.operationId);
  assert.notEqual(newIntention.operationId, firstAttempt.operationId);
});

test("the refund migration exists before its behavioral contracts are checked", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310002_secure_stripe_refunds.sql", import.meta.url), "utf8").catch(() => "");
  assert.notEqual(sql, "");
});

test("the migration reserves immutable refund intentions before Stripe", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310002_secure_stripe_refunds.sql", import.meta.url), "utf8").catch(() => "");

  assert.match(sql, /create table(?: if not exists)? public\.refund_operations/i);
  assert.match(sql, /add column if not exists operation_id uuid/i);
  assert.match(sql, /p_operation_id[\s\S]*booking_request_id is distinct from p_booking_id/i);
  assert.match(sql, /refund_mode is distinct from p_refund_mode/i);
  assert.match(sql, /custom_amount_cents is distinct from p_custom_amount_cents/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /insert into public\.refunds/i);
});

test("succeeded refunds and every non-terminal reservation reduce integer-cent availability", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310002_secure_stripe_refunds.sql", import.meta.url), "utf8").catch(() => "");

  assert.match(sql, /amount_cents bigint/i);
  assert.match(sql, /v_succeeded_cents/i);
  assert.match(sql, /v_reserved_cents/i);
  for (const status of ["pending", "in_progress", "stripe_succeeded", "needs_reconciliation", "failed"]) {
    assert.match(sql, new RegExp(`'${status}'`, "i"));
  }
  assert.match(sql, /v_payment_cents\s*-\s*v_succeeded_cents\s*-\s*v_reserved_cents/i);
  assert.doesNotMatch(sql, /operation_status[\s\S]{0,120}(created_at|updated_at)\s*</i);
});

test("allocation modes isolate deposit and balance while retaining the full-payment deposit floor", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310002_secure_stripe_refunds.sql", import.meta.url), "utf8").catch(() => "");

  assert.match(sql, /status in \('paid', 'partially_refunded'\)/i);
  assert.match(sql, /payment_type = 'deposit'[\s\S]*manual_reason = 'acompte'/i);
  assert.match(sql, /payment_type = 'balance'[\s\S]*manual_reason in \('solde', 'complement'\)/i);
  assert.match(sql, /payment_type = 'full'[\s\S]*manual_reason = 'total'/i);
  assert.match(sql, /v_contract_deposit_cents/i);
  assert.match(sql, /v_payment_cents\s*-\s*v_contract_deposit_cents\s*-\s*v_succeeded_cents\s*-\s*v_reserved_cents/i);
  assert.match(sql, /paid_at asc nulls last[\s\S]*created_at asc[\s\S]*id asc/i);
});

test("a partial balance refund can be followed by another without touching the deposit", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310002_secure_stripe_refunds.sql", import.meta.url), "utf8").catch(() => "");

  assert.match(sql, /status in \('paid', 'partially_refunded'\)/i);
  assert.match(sql, /where r\.payment_id = v_payment\.id and r\.status = 'succeeded'/i);
  assert.match(sql, /when v_payment_refunded_cents >= round\(v_payment\.amount \* 100\)::bigint then 'refunded'/i);
  assert.match(sql, /when v_payment_refunded_cents > 0 then 'partially_refunded'/i);
  assert.match(sql, /payment_type = 'balance'[\s\S]*manual_reason in \('solde', 'complement'\)/i);
});

test("requires_review is excluded and several refunds may legitimately share one payment intent", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310002_secure_stripe_refunds.sql", import.meta.url), "utf8").catch(() => "");

  assert.match(sql, /status in \('paid', 'partially_refunded'\)/i);
  assert.doesNotMatch(sql, /unique\s+(?:index|constraint)[\s\S]{0,120}stripe_payment_intent_id/i);
  assert.match(sql, /create unique index refunds_idempotency_key_uidx/i);
  assert.match(sql, /create unique index refunds_operation_payment_uidx/i);
});

test("refund RPCs are service-role-only and finalization is locally idempotent", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310002_secure_stripe_refunds.sql", import.meta.url), "utf8").catch(() => "");

  assert.match(sql, /security definer/gi);
  assert.match(sql, /revoke all on function public\.acquire_stripe_refund_operation[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.acquire_stripe_refund_operation[\s\S]*to service_role/i);
  assert.match(sql, /if v_operation\.status = 'succeeded'[\s\S]*already_succeeded/i);
  assert.match(sql, /insert into public\.booking_events/i);
});

test("a database claim makes pending the only state allowed to create at Stripe", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310002_secure_stripe_refunds.sql", import.meta.url), "utf8").catch(() => "");

  assert.match(sql, /create or replace function public\.claim_stripe_refund_allocation/i);
  assert.match(sql, /if v_refund\.operation_status = 'pending'[\s\S]*set operation_status = 'in_progress'/i);
  assert.match(sql, /'outcome', 'claimed_first_attempt'/i);
  assert.match(sql, /'outcome', 'already_' \|\| v_refund\.operation_status/i);
  assert.match(sql, /grant execute on function public\.claim_stripe_refund_allocation[\s\S]*to service_role/i);
});

test("refund mutation RPCs use booking payments operation allocation lock order", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608310002_secure_stripe_refunds.sql", import.meta.url), "utf8").catch(() => "");
  const functionBody = (name, nextName) => {
    const start = sql.indexOf(`create or replace function public.${name}`);
    const end = nextName ? sql.indexOf(`create or replace function public.${nextName}`, start + 1) : sql.length;
    assert.notEqual(start, -1, `${name} must exist`);
    return sql.slice(start, end);
  };
  const assertOrder = (body) => {
    const booking = body.indexOf("lock booking_requests");
    const payments = body.indexOf("lock payments");
    const operation = body.indexOf("lock refund_operations");
    const allocation = body.indexOf("lock refunds allocation");
    assert.ok(booking >= 0 && booking < payments && payments < operation && operation < allocation);
  };

  assertOrder(functionBody("claim_stripe_refund_allocation", "record_stripe_refund_result"));
  assertOrder(functionBody("record_stripe_refund_result", "record_stripe_refund_failure"));
  assertOrder(functionBody("record_stripe_refund_failure", "finalize_stripe_refund_operation"));
});
