import test from "node:test";
import assert from "node:assert/strict";

process.env.VITE_SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role";

const recoveryModule = await import("../netlify/functions/_lib/arrival-link-recovery.js").catch(() => ({}));
const endpointModule = await import("../netlify/functions/request-arrival-link.js").catch(() => ({}));
const recoverArrivalLink = recoveryModule.recoverArrivalLink;

const now = new Date("2026-10-10T10:00:00.000Z");
const validInput = {
  bookingId: "booking-a",
  email: " alice@example.test ",
  lastName: " MARTIN ",
  website: "",
};
const booking = {
  id: "booking-a",
  status: "confirmed",
  guest_email: "Alice@Example.TEST",
  guest_last_name: "Martin",
  start_date: "2026-10-11",
  end_date: "2026-10-14",
  arrival_time: null,
  arrival_token_hash: null,
  arrival_token_expires_at: null,
  arrival_token_created_at: null,
};

function createDependencies({ storedBooking = booking, recent = false, sendError = null, ipAttemptAllowed = true, bookingAttemptAllowed = true } = {}) {
  const state = {
    emails: [],
    savedTokens: [],
    restoredTokens: [],
    history: [{ id: "old-log", email_type: "arrival_reminder", status: "sent" }],
  };
  return {
    state,
    dependencies: {
      now,
      siteUrl: "https://example.test",
      randomBytes: () => Buffer.alloc(32, 7),
      rateLimitKey: "ip-hash",
      repository: {
        async claimIpAttempt() { return ipAttemptAllowed; },
        async claimBookingAttempt() { return bookingAttemptAllowed; },
        async findBookingById() { return storedBooking; },
        async hasRecentRecovery() { return recent; },
        async saveToken(value) { state.savedTokens.push(value); return true; },
        async restoreToken(value) { state.restoredTokens.push(value); },
        async appendEmailLog(value) { state.history.push(value); },
      },
      mailer: {
        async sendArrivalLink(value) {
          state.emails.push(value);
          if (sendError) throw sendError;
          return { providerId: "email-1" };
        },
      },
      logger: { error() {} },
    },
  };
}

test("arrival-link recovery always returns the same opaque public response", async () => {
  assert.equal(typeof recoverArrivalLink, "function");
  const missing = createDependencies({ storedBooking: null });
  const mismatch = createDependencies();
  const failure = createDependencies({ sendError: new Error("provider unavailable") });

  const missingResult = await recoverArrivalLink(validInput, missing.dependencies);
  const mismatchResult = await recoverArrivalLink({ ...validInput, email: "wrong@example.test" }, mismatch.dependencies);
  const failureResult = await recoverArrivalLink(validInput, failure.dependencies);

  assert.deepEqual(missingResult, mismatchResult);
  assert.deepEqual(mismatchResult, failureResult);
  assert.equal(missingResult.statusCode, 202);
  assert.doesNotMatch(JSON.stringify(missingResult), /token|booking-a|alice@example/i);
});

test("a valid recovery sends the token only by email to the stored recipient", async () => {
  assert.equal(typeof recoverArrivalLink, "function");
  const { state, dependencies } = createDependencies();
  const result = await recoverArrivalLink(validInput, dependencies);

  assert.equal(result.statusCode, 202);
  assert.equal(state.emails.length, 1);
  assert.equal(state.emails[0].to, "Alice@Example.TEST");
  assert.match(state.emails[0].url, /^https:\/\/example\.test\/arrival\?booking=booking-a&token=[a-f0-9]{64}$/);
  assert.equal(state.savedTokens.length, 1);
  assert.notEqual(state.savedTokens[0].hash, state.emails[0].url.split("token=")[1]);
  assert.doesNotMatch(JSON.stringify(result), /[a-f0-9]{64}/);
});

test("a per-booking cooldown prevents repeated recovery emails", async () => {
  assert.equal(typeof recoverArrivalLink, "function");
  const { state, dependencies } = createDependencies({ recent: true });
  const result = await recoverArrivalLink(validInput, dependencies);

  assert.equal(result.statusCode, 202);
  assert.equal(state.emails.length, 0);
  assert.equal(state.savedTokens.length, 0);
});

test("a denied durable IP attempt remains opaque and performs no lookup or email", async () => {
  assert.equal(typeof recoverArrivalLink, "function");
  const { state, dependencies } = createDependencies({ ipAttemptAllowed: false });
  let bookingReads = 0;
  dependencies.repository.findBookingById = async () => { bookingReads += 1; return booking; };

  const result = await recoverArrivalLink(validInput, dependencies);

  assert.equal(result.statusCode, 202);
  assert.equal(bookingReads, 0);
  assert.equal(state.emails.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /limit|token|booking-a/i);
});

test("wrong identity cannot consume the per-booking recovery allowance", async () => {
  const { state, dependencies } = createDependencies();
  let bookingClaims = 0;
  dependencies.repository.claimBookingAttempt = async () => { bookingClaims += 1; return true; };

  const result = await recoverArrivalLink({ ...validInput, email: "wrong@example.test" }, dependencies);

  assert.equal(result.statusCode, 202);
  assert.equal(bookingClaims, 0);
  assert.equal(state.emails.length, 0);
});

test("a valid but booking-throttled recovery remains opaque and sends no email", async () => {
  const { state, dependencies } = createDependencies({ bookingAttemptAllowed: false });
  const result = await recoverArrivalLink(validInput, dependencies);

  assert.equal(result.statusCode, 202);
  assert.equal(state.emails.length, 0);
  assert.equal(state.savedTokens.length, 0);
});

test("simultaneous valid recoveries can claim one booking only once", async () => {
  assert.equal(typeof recoverArrivalLink, "function");
  const { state, dependencies } = createDependencies();
  let claimed = false;
  dependencies.repository.saveToken = async (value) => {
    await Promise.resolve();
    if (claimed) return false;
    claimed = true;
    state.savedTokens.push(value);
    return true;
  };

  const [first, second] = await Promise.all([
    recoverArrivalLink(validInput, dependencies),
    recoverArrivalLink(validInput, dependencies),
  ]);

  assert.deepEqual(first, second);
  assert.equal(state.savedTokens.length, 1);
  assert.equal(state.emails.length, 1);
});

test("issuing a replacement token appends history without deleting the old reminder", async () => {
  assert.equal(typeof recoverArrivalLink, "function");
  const { state, dependencies } = createDependencies();
  await recoverArrivalLink(validInput, dependencies);

  assert.deepEqual(state.history[0], { id: "old-log", email_type: "arrival_reminder", status: "sent" });
  assert.equal(state.history.length, 2);
  assert.equal(state.history[1].emailType, "arrival_link_reissue");
  assert.equal(state.history[1].status, "sent");
});

test("failed delivery restores the previous token state", async () => {
  assert.equal(typeof recoverArrivalLink, "function");
  const previous = {
    ...booking,
    arrival_token_hash: "a".repeat(64),
    arrival_token_expires_at: "2026-10-14T23:59:59.999Z",
    arrival_token_created_at: "2026-10-09T10:00:00.000Z",
  };
  const { state, dependencies } = createDependencies({ storedBooking: previous, sendError: new Error("provider unavailable") });
  await recoverArrivalLink(validInput, dependencies);

  assert.equal(state.restoredTokens.length, 1);
  assert.equal(state.restoredTokens[0].arrival_token_hash, previous.arrival_token_hash);
  assert.equal(state.history.at(-1).status, "error");
});

test("a delivered link stays valid when only history logging fails", async () => {
  assert.equal(typeof recoverArrivalLink, "function");
  const { state, dependencies } = createDependencies();
  dependencies.repository.appendEmailLog = async () => { throw new Error("log unavailable"); };

  const result = await recoverArrivalLink(validInput, dependencies);

  assert.equal(result.statusCode, 202);
  assert.equal(state.emails.length, 1);
  assert.equal(state.savedTokens.length, 1);
  assert.equal(state.restoredTokens.length, 0);
});

test("the recovery endpoint runs in the background so every caller receives the same immediate 202", () => {
  assert.equal(endpointModule.config?.background, true);
  assert.equal(endpointModule.config?.rateLimit, undefined);
});
