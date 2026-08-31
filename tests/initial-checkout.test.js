import test from "node:test";
import assert from "node:assert/strict";
import * as bookingActionsService from "../src/services/bookingActionsService.js";

const {
  createCheckoutSession: createCheckoutSessionFromBrowser,
  prepareInitialCheckoutBooking,
  buildInitialCheckoutAcceptanceContext,
} = bookingActionsService;

const initialCheckoutModule = await import("../netlify/functions/_lib/initial-checkout.js").catch(() => ({}));
const createInitialCheckout = initialCheckoutModule.createInitialCheckout;

const NOW = new Date("2026-08-31T10:00:00.000Z");
const BOOKING_ID = "11111111-1111-4111-8111-111111111111";

function booking(overrides = {}) {
  return {
    id: BOOKING_ID,
    status: "pending",
    owner_price: 320,
    estimated_total: 350,
    amount_paid: 0,
    payment_status: "unpaid",
    start_date: "2026-10-15",
    end_date: "2026-10-18",
    guest_first_name: "Alice",
    guest_last_name: "Martin",
    guest_email: "alice@example.test",
    acceptance_expires_at: null,
    stripe_checkout_session_id: null,
    payment_link: null,
    accepted_at: null,
    deposit_amount: 96,
    balance_amount: 224,
    deposit_status: "à payer",
    balance_status: "en attente",
    updated_at: "2026-08-31T09:00:00.000Z",
    ...overrides,
  };
}

function dependencies({ storedBooking = booking(), retrievedSession = null, retrieveError = null, saveError = null } = {}) {
  const state = { creates: [], retrieves: [], saves: [], booking: storedBooking };
  return {
    state,
    dependencies: {
      repository: {
        async getBooking() { return state.booking; },
        async saveCurrentSession(payload) {
          state.saves.push(payload);
          if (saveError) throw saveError;
          state.booking = { ...state.booking, ...payload.values };
          return state.booking;
        },
      },
      stripeGateway: {
        async createSession(parameters, options) {
          state.creates.push({ parameters, options });
          return {
            id: "cs_test_initial",
            url: "https://checkout.stripe.com/c/pay/cs_test_initial#token",
            status: "open",
          };
        },
        async retrieveSession(sessionId) {
          state.retrieves.push(sessionId);
          if (retrieveError) throw retrieveError;
          return retrievedSession;
        },
      },
    },
  };
}

test("the browser contract sends bookingId only even when legacy fields are supplied", async () => {
  let requestBody = null;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, async json() { return { url: "https://checkout.stripe.test", paymentType: "deposit", amount: 96 }; } };
  };

  try {
    const supabase = { auth: { async getSession() { return { data: { session: { access_token: "token" } } }; } } };
    await createCheckoutSessionFromBrowser(supabase, {
      id: BOOKING_ID,
      guest_email: "stored@example.test",
      start_date: "2026-10-15",
    }, 1);
    assert.deepEqual(requestBody, { bookingId: BOOKING_ID });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("server booking price, dates, identity, and email fully define the Stripe Session", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  const { state, dependencies: deps } = dependencies();

  await createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps });

  const session = state.creates[0].parameters;
  assert.equal(session.customer_email, "alice@example.test");
  assert.equal(session.line_items[0].price_data.unit_amount, 9600);
  assert.equal(session.line_items[0].price_data.product_data.description, "2026-10-15 → 2026-10-18");
  assert.equal(session.metadata.guest_first_name, "Alice");
  assert.equal(session.metadata.guest_last_name, "Martin");
});

test("a deposit is calculated as thirty percent of owner_price on the server", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  const { state, dependencies: deps } = dependencies();

  const result = await createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps });

  assert.equal(result.paymentType, "deposit");
  assert.equal(result.amount, 96);
  assert.equal(result.totalPrice, 320);
  assert.equal(state.creates[0].parameters.line_items[0].price_data.unit_amount, 9600);
});

test("a stay within thirty days uses the full server price", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  const { state, dependencies: deps } = dependencies({ storedBooking: booking({ start_date: "2026-09-20" }) });

  const result = await createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps });

  assert.equal(result.paymentType, "full");
  assert.equal(result.amount, 320);
  assert.equal(state.creates[0].parameters.line_items[0].price_data.unit_amount, 32000);
});

test("estimated_total is used only when owner_price is absent", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  const { state, dependencies: deps } = dependencies({ storedBooking: booking({ owner_price: null, estimated_total: 200 }) });

  const result = await createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps });

  assert.equal(result.totalPrice, 200);
  assert.equal(state.creates[0].parameters.line_items[0].price_data.unit_amount, 6000);
});

test("a missing booking is rejected before contacting Stripe", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  const { state, dependencies: deps } = dependencies({ storedBooking: null });

  await assert.rejects(
    createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps }),
    (error) => error.code === "booking_not_found" && error.statusCode === 404,
  );
  assert.equal(state.creates.length, 0);
});

test("cancelled, refused, and expired bookings cannot create an initial Checkout", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  for (const status of ["cancelled", "refused", "expired"]) {
    const { state, dependencies: deps } = dependencies({ storedBooking: booking({ status }) });
    await assert.rejects(
      createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps }),
      (error) => error.code === "booking_status_incompatible" && error.statusCode === 409,
    );
    assert.equal(state.creates.length, 0);
  }
});

test("a booking with money already applied cannot create another initial Checkout", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  for (const paidBooking of [
    booking({ amount_paid: 96 }),
    booking({ status: "deposit_paid", amount_paid: 0 }),
    booking({ status: "fully_paid", payment_status: "paid" }),
  ]) {
    const { state, dependencies: deps } = dependencies({ storedBooking: paidBooking });
    await assert.rejects(
      createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps }),
      (error) => error.code === "booking_already_paid",
    );
    assert.equal(state.creates.length, 0);
  }
});

test("an expired acceptance is rejected and never extended", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  const expiry = "2026-08-31T09:59:59.000Z";
  const { state, dependencies: deps } = dependencies({
    storedBooking: booking({ status: "accepted", acceptance_expires_at: expiry }),
  });

  await assert.rejects(
    createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps }),
    (error) => error.code === "acceptance_expired" && error.statusCode === 409,
  );
  assert.equal(state.creates.length, 0);
  assert.equal(state.saves.length, 0);
});

test("zero, negative, and non-numeric server prices are rejected", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  for (const ownerPrice of [0, -20, "invalid"]) {
    const { state, dependencies: deps } = dependencies({ storedBooking: booking({ owner_price: ownerPrice }) });
    await assert.rejects(
      createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps }),
      (error) => error.code === "invalid_booking_price",
    );
    assert.equal(state.creates.length, 0);
  }
});

test("missing server customer data is rejected before Stripe creation", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  for (const incomplete of [
    booking({ guest_email: null }),
    booking({ start_date: null }),
    booking({ end_date: null }),
  ]) {
    const { state, dependencies: deps } = dependencies({ storedBooking: incomplete });
    await assert.rejects(
      createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps }),
      (error) => error.code === "missing_booking_data",
    );
    assert.equal(state.creates.length, 0);
  }
});

test("a new session becomes the unambiguous current session with one fixed acceptance deadline", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  const { state, dependencies: deps } = dependencies();

  const result = await createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps });

  assert.equal(result.acceptanceExpiresAt, "2026-09-01T10:00:00.000Z");
  assert.equal(state.saves.length, 1);
  assert.equal(state.saves[0].expectedStatus, "pending");
  assert.equal(state.saves[0].expectedUpdatedAt, "2026-08-31T09:00:00.000Z");
  assert.deepEqual(state.saves[0].values, {
    status: "accepted",
    payment_link: "https://checkout.stripe.com/c/pay/cs_test_initial#token",
    stripe_checkout_session_id: "cs_test_initial",
    acceptance_expires_at: "2026-09-01T10:00:00.000Z",
    accepted_at: "2026-08-31T10:00:00.000Z",
    deposit_amount: 96,
    balance_amount: 224,
    deposit_status: "à payer",
    balance_status: "en attente",
  });
});

test("an accepted retry returns the usable current link without Stripe creation or deadline extension", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  const expiry = "2026-09-01T09:00:00.000Z";
  const currentUrl = "https://checkout.stripe.com/c/pay/cs_test_current#token";
  const { state, dependencies: deps } = dependencies({
    storedBooking: booking({
      status: "accepted",
      acceptance_expires_at: expiry,
      stripe_checkout_session_id: "cs_test_current",
      payment_link: currentUrl,
    }),
  });

  const result = await createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps });

  assert.equal(result.url, currentUrl);
  assert.equal(result.acceptanceExpiresAt, expiry);
  assert.equal(state.creates.length, 0);
  assert.equal(state.retrieves.length, 0);
  assert.equal(state.saves.length, 0);
});

test("an accepted retry preserves the payment terms fixed when the current Session was created", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  const currentUrl = "https://checkout.stripe.com/c/pay/cs_test_current#token";
  const { dependencies: deps } = dependencies({
    storedBooking: booking({
      status: "accepted",
      start_date: "2026-09-30",
      acceptance_expires_at: "2026-09-02T10:00:00.000Z",
      stripe_checkout_session_id: "cs_test_current",
      payment_link: currentUrl,
      deposit_amount: 96,
      balance_amount: 224,
      deposit_status: "à payer",
    }),
  });

  const result = await createInitialCheckout({
    bookingId: BOOKING_ID,
    now: new Date("2026-09-01T10:00:00.000Z"),
    dependencies: deps,
  });

  assert.equal(result.paymentType, "deposit");
  assert.equal(result.amount, 96);
});

test("an accepted retry announces the server total instead of a different frontend price", async () => {
  assert.equal(typeof buildInitialCheckoutAcceptanceContext, "function");
  const frontendPrice = 250;
  const currentUrl = "https://checkout.stripe.com/c/pay/cs_test_current#token";
  const { dependencies: deps } = dependencies({
    storedBooking: booking({
      status: "accepted",
      owner_price: 320,
      acceptance_expires_at: "2026-09-01T09:00:00.000Z",
      stripe_checkout_session_id: "cs_test_current",
      payment_link: currentUrl,
    }),
  });

  const checkoutSession = await createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps });
  const context = buildInitialCheckoutAcceptanceContext(checkoutSession, 45);

  assert.equal(context.totalPrice, 320);
  assert.notEqual(context.totalPrice, frontendPrice);
  assert.equal(context.emailExtras.paymentAmount, 96);
  assert.match(context.eventMessage, /320 €/);
  assert.doesNotMatch(context.eventMessage, /250 €/);
  assert.deepEqual(context.eventMetadata, {
    price: 320,
    paymentLink: currentUrl,
    paymentType: "deposit",
  });
});

test("an accepted booking recovers the current Stripe Session URL without extending acceptance", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  const expiry = "2026-09-01T09:00:00.000Z";
  const recoveredUrl = "https://checkout.stripe.com/c/pay/cs_test_current#recovered";
  const { state, dependencies: deps } = dependencies({
    storedBooking: booking({
      status: "accepted",
      acceptance_expires_at: expiry,
      stripe_checkout_session_id: "cs_test_current",
      payment_link: null,
    }),
    retrievedSession: { id: "cs_test_current", url: recoveredUrl, status: "open", expires_at: 1788256800 },
  });

  const result = await createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps });

  assert.equal(result.url, recoveredUrl);
  assert.equal(result.acceptanceExpiresAt, expiry);
  assert.deepEqual(state.retrieves, ["cs_test_current"]);
  assert.equal(state.creates.length, 0);
  assert.equal(state.saves[0].values.acceptance_expires_at, expiry);
  assert.equal(state.saves[0].values.stripe_checkout_session_id, "cs_test_current");
});

test("an accepted booking creates a replacement only when no current Stripe Session exists", async () => {
  assert.equal(typeof createInitialCheckout, "function");
  const expiry = "2026-09-01T09:00:00.000Z";
  const { state, dependencies: deps } = dependencies({
    storedBooking: booking({
      status: "accepted",
      acceptance_expires_at: expiry,
      stripe_checkout_session_id: "cs_test_missing",
      payment_link: null,
    }),
    retrievedSession: null,
  });

  const result = await createInitialCheckout({ bookingId: BOOKING_ID, now: NOW, dependencies: deps });

  assert.equal(result.url, "https://checkout.stripe.com/c/pay/cs_test_initial#token");
  assert.equal(result.acceptanceExpiresAt, expiry);
  assert.equal(state.creates.length, 1);
  assert.equal(state.saves[0].values.acceptance_expires_at, expiry);
});

function pendingWriteSupabase({ row = { id: BOOKING_ID }, error = null } = {}) {
  const state = { table: null, values: null, filters: [] };
  const query = {
    eq(field, value) { state.filters.push([field, value]); return query; },
    select() { return query; },
    async maybeSingle() { return { data: row, error }; },
  };
  return {
    state,
    client: {
      from(table) {
        state.table = table;
        return {
          update(values) { state.values = values; return query; },
        };
      },
    },
  };
}

test("owner_price is persisted only while the booking is still pending", async () => {
  assert.equal(typeof prepareInitialCheckoutBooking, "function");
  const { state, client } = pendingWriteSupabase();

  await prepareInitialCheckoutBooking(client, booking(), 320, "Tarif proposé");

  assert.equal(state.table, "booking_requests");
  assert.deepEqual(state.filters, [["id", BOOKING_ID], ["status", "pending"]]);
  assert.equal(state.values.owner_price, 320);
  assert.equal(state.values.owner_message, "Tarif proposé");
});

test("a failed or stale pending owner_price write stops before Checkout creation", async () => {
  assert.equal(typeof prepareInitialCheckoutBooking, "function");
  const stale = pendingWriteSupabase({ row: null });
  const failed = pendingWriteSupabase({ error: { message: "database unavailable" } });

  await assert.rejects(
    prepareInitialCheckoutBooking(stale.client, booking(), 320, "Tarif proposé"),
    /plus en attente/i,
  );
  await assert.rejects(
    prepareInitialCheckoutBooking(failed.client, booking(), 320, "Tarif proposé"),
    /database unavailable/i,
  );
});
