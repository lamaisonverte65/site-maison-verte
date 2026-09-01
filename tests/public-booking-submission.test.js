import test from "node:test";
import assert from "node:assert/strict";

const submissionModule = await import("../src/utils/publicBookingSubmission.js").catch(() => ({}));
const submitPublicBooking = submissionModule.submitPublicBooking;

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return body; },
});

test("only an explicit recorded booking response is a public success", async () => {
  assert.equal(typeof submitPublicBooking, "function");
  const success = await submitPublicBooking({ firstName: "Alice" }, { fetchImpl: async () => response(200, { success: true, bookingId: "booking-a" }) });
  const ambiguous = await submitPublicBooking({ firstName: "Alice" }, { fetchImpl: async () => response(200, { success: true }) });

  assert.deepEqual(success, { kind: "success", success: true, clearForm: true, reload: true, bookingId: "booking-a" });
  assert.equal(ambiguous.kind, "server_error");
  assert.equal(ambiguous.success, false);
  assert.equal(ambiguous.clearForm, false);
  assert.equal(ambiguous.reload, false);
});

test("a recorded booking with pending email delivery clears once without inviting a duplicate retry", async () => {
  const result = await submitPublicBooking({}, {
    fetchImpl: async () => response(202, { success: true, bookingId: "booking-a", confirmationPending: true }),
  });

  assert.equal(result.success, true);
  assert.equal(result.kind, "recorded_confirmation_pending");
  assert.equal(result.clearForm, true);
  assert.equal(result.reload, true);
  assert.equal(result.confirmationPending, true);
});

test("400, duplicate, rate-limit, and server failures preserve the form with distinct public messages", async () => {
  assert.equal(typeof submitPublicBooking, "function");
  const cases = [
    [400, "validation"],
    [409, "duplicate"],
    [429, "rate_limit"],
    [500, "server_error"],
  ];

  for (const [status, expectedKind] of cases) {
    const result = await submitPublicBooking({}, { fetchImpl: async () => response(status, { error: "secret internal detail" }) });
    assert.equal(result.kind, expectedKind);
    assert.equal(result.success, false);
    assert.equal(result.clearForm, false);
    assert.equal(result.reload, false);
    assert.doesNotMatch(result.message, /secret internal detail/);
  }
});

test("a date conflict has its own public outcome and asks the form to refresh only the dates", async () => {
  const result = await submitPublicBooking({}, {
    fetchImpl: async () => response(409, {
      code: "DATE_CONFLICT",
      error: "internal detail must not override the fixed public copy",
    }),
  });

  assert.deepEqual(result, {
    kind: "date_conflict",
    success: false,
    clearForm: false,
    reload: false,
    resetDates: true,
    refreshCalendar: true,
    message: "Une réservation vient d’être enregistrée sur tout ou partie de ces dates. Merci de choisir d’autres dates.",
  });
});

test("a network failure never becomes a recorded-booking success", async () => {
  assert.equal(typeof submitPublicBooking, "function");
  const result = await submitPublicBooking({}, { fetchImpl: async () => { throw new Error("socket detail"); } });

  assert.equal(result.kind, "network_error");
  assert.equal(result.success, false);
  assert.equal(result.clearForm, false);
  assert.equal(result.reload, false);
  assert.doesNotMatch(result.message, /socket detail/);
});

test("one submission attempt performs exactly one HTTP request", async () => {
  assert.equal(typeof submitPublicBooking, "function");
  let calls = 0;
  let requestedUrl = "";
  await submitPublicBooking({}, {
    fetchImpl: async (url) => {
      calls += 1;
      requestedUrl = url;
      return response(409, {});
    },
  });
  assert.equal(calls, 1);
  assert.equal(requestedUrl, "/api/booking-request");
});

test("a blocked request times out without claiming success or clearing the form", async () => {
  let timeoutDelay = null;
  let timeoutCallback = null;
  let clearedTimer = null;
  let requestSignal = null;

  const resultPromise = submitPublicBooking({ firstName: "Alice" }, {
    fetchImpl: async (_url, options) => {
      requestSignal = options.signal;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("internal abort detail");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    },
    setTimeoutImpl(callback, delay) {
      timeoutCallback = callback;
      timeoutDelay = delay;
      return "booking-timeout";
    },
    clearTimeoutImpl(timer) {
      clearedTimer = timer;
    },
  });

  assert.equal(typeof timeoutCallback, "function");
  timeoutCallback();
  const result = await resultPromise;

  assert.equal(timeoutDelay, 15_000);
  assert.equal(requestSignal.aborted, true);
  assert.equal(clearedTimer, "booking-timeout");
  assert.equal(result.kind, "timeout");
  assert.equal(result.success, false);
  assert.equal(result.clearForm, false);
  assert.equal(result.reload, false);
  assert.doesNotMatch(result.message, /abort|internal|technique/i);
});

test("an identical retry after a timeout remains a separate single request for server deduplication", async () => {
  const payload = { firstName: "Alice", guestPhone: "06 12 34 56 78" };
  const bodies = [];
  let firstTimeoutCallback = null;

  const first = submitPublicBooking(payload, {
    fetchImpl: async (_url, options) => {
      bodies.push(options.body);
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("request timed out");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    },
    setTimeoutImpl(callback) {
      firstTimeoutCallback = callback;
      return "first-timeout";
    },
    clearTimeoutImpl() {},
  });
  assert.equal(typeof firstTimeoutCallback, "function");
  firstTimeoutCallback();
  const timedOut = await first;

  const retry = await submitPublicBooking(payload, {
    fetchImpl: async (_url, options) => {
      bodies.push(options.body);
      return response(409, {});
    },
  });

  assert.equal(timedOut.kind, "timeout");
  assert.equal(retry.kind, "duplicate");
  assert.deepEqual(bodies, [JSON.stringify(payload), JSON.stringify(payload)]);
});
