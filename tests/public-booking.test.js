import test from "node:test";
import assert from "node:assert/strict";
import * as publicBooking from "../netlify/functions/_lib/public-booking.js";

process.env.VITE_SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role";

const { buildPublicBookingEmails, validatePublicBookingPayload } = publicBooking;
const validateBooking = (payload) => validatePublicBookingPayload(payload, { cleaningFee: 50 });
const bookingEndpoint = await import("../netlify/functions/send-booking-request.js");

const validPayload = {
  guestFirstName: "Alice",
  guestLastName: "Martin",
  guestEmail: "alice@example.test",
  guestPhone: "+33 6 12 34 56 78",
  guestAddress: "12 rue des Pyrénées",
  guestPostalCode: "65240",
  guestCity: "Arreau",
  guestCountry: "France",
  adultsCount: 2,
  childrenCount: 1,
  childrenAges: "7 ans",
  babyBedNeeded: false,
  marketingConsent: true,
  guestMessage: "Séjour en famille",
  startDate: "2026-10-10",
  endDate: "2026-10-13",
  nights: 3,
  accommodationTotal: 420,
  contractAccepted: true,
  cleaningOption: true,
  website: "",
};

test("a normal anonymous booking request remains valid", () => {
  const result = validateBooking(validPayload);
  assert.equal(result.ok, true);
  assert.equal(result.booking.guest_email, "alice@example.test");
  assert.equal(result.booking.status, "pending");
  assert.equal(result.booking.nights, 3);
  assert.equal(result.booking.guest_address, "12 rue des Pyrénées");
  assert.equal(result.booking.guest_postal_code, "65240");
  assert.equal(result.booking.guest_city, "Arreau");
  assert.equal(result.booking.guest_country, "France");
});

test("postal coordinates are mandatory and bounded", () => {
  assert.equal(validateBooking({ ...validPayload, guestAddress: "" }).ok, false);
  assert.equal(validateBooking({ ...validPayload, guestPostalCode: "" }).ok, false);
  assert.equal(validateBooking({ ...validPayload, guestCity: "" }).ok, false);
  assert.equal(validateBooking({ ...validPayload, guestCountry: "" }).ok, false);
  assert.equal(validateBooking({ ...validPayload, guestAddress: "x".repeat(201) }).ok, false);
});

test("postal coordinates do not alter the anti-duplicate fingerprint", () => {
  const first = validateBooking(validPayload).booking;
  const second = validateBooking({ ...validPayload, guestAddress: "12 RUE DES PYRENEES", guestCity: "Autre ville" }).booking;
  assert.equal(publicBooking.createPublicBookingFingerprint(first), publicBooking.createPublicBookingFingerprint(second));
});

test("unexpected relay fields are rejected", () => {
  const result = validateBooking({ ...validPayload, recipient: "victim@example.test", html: "<b>spam</b>", paymentLink: "https://evil.test" });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 400);
});

test("honeypot and excessive fields are rejected", () => {
  assert.equal(validateBooking({ ...validPayload, website: "bot.example" }).ok, false);
  assert.equal(validateBooking({ ...validPayload, guestMessage: "x".repeat(1501) }).ok, false);
});

test("invalid dates, counts, and email are rejected", () => {
  assert.equal(validateBooking({ ...validPayload, guestEmail: "not-an-email" }).ok, false);
  assert.equal(validateBooking({ ...validPayload, endDate: "2026-10-09" }).ok, false);
  assert.equal(validateBooking({ ...validPayload, adultsCount: 4, childrenCount: 2 }).ok, false);
});

test("user data is escaped and recipients are fixed by the server", () => {
  const validated = validateBooking({ ...validPayload, guestFirstName: '<img src=x onerror="alert(1)">' });
  assert.equal(validated.ok, true);
  const emails = buildPublicBookingEmails(validated.emailModel, { ownerEmail: "owner@example.test" });
  assert.equal(emails.owner.to, "owner@example.test");
  assert.equal(emails.guest.to, "alice@example.test");
  assert.doesNotMatch(emails.owner.html, /<img src=x/);
  assert.match(emails.owner.html, /&lt;img/);
});

function storedCandidate(overrides = {}) {
  const validated = validateBooking(validPayload);
  return {
    ...validated.booking,
    id: "booking-existing",
    created_at: "2026-10-01T10:03:00.000Z",
    ...overrides,
  };
}

test("a strictly identical request inside the window is a duplicate", () => {
  assert.equal(typeof publicBooking.isDuplicatePublicBooking, "function");
  const incoming = validateBooking(validPayload).booking;
  assert.equal(publicBooking.isDuplicatePublicBooking([storedCandidate()], incoming, { now: new Date("2026-10-01T10:05:00.000Z") }), true);
});

test("the same email and dates with a different message is not a duplicate", () => {
  assert.equal(typeof publicBooking.isDuplicatePublicBooking, "function");
  const incoming = validateBooking({ ...validPayload, guestMessage: "Message corrigé" }).booking;
  assert.equal(publicBooking.isDuplicatePublicBooking([storedCandidate()], incoming, { now: new Date("2026-10-01T10:05:00.000Z") }), false);
});

test("the same email and dates with different travelers is not a duplicate", () => {
  assert.equal(typeof publicBooking.isDuplicatePublicBooking, "function");
  const incoming = validateBooking({
    ...validPayload,
    adultsCount: 1,
    childrenCount: 0,
    childrenAges: "",
  }).booking;
  assert.equal(publicBooking.isDuplicatePublicBooking([storedCandidate()], incoming, { now: new Date("2026-10-01T10:05:00.000Z") }), false);
});

test("an identical request after the five-minute window is accepted again", () => {
  assert.equal(typeof publicBooking.isDuplicatePublicBooking, "function");
  const incoming = validateBooking(validPayload).booking;
  assert.equal(publicBooking.isDuplicatePublicBooking([storedCandidate({ created_at: "2026-10-01T09:59:59.000Z" })], incoming, { now: new Date("2026-10-01T10:05:00.000Z") }), false);
});

test("fingerprint normalization catches an accidental retransmission despite cosmetic formatting", () => {
  assert.equal(typeof publicBooking.isDuplicatePublicBooking, "function");
  const incoming = validateBooking(validPayload).booking;
  const candidate = storedCandidate({
    guest_first_name: " ALICE ",
    guest_email: "ALICE@EXAMPLE.TEST",
    guest_phone: "+33 (6) 12-34-56-78",
    message: "  Séjour   en famille  ",
  });
  assert.equal(publicBooking.isDuplicatePublicBooking([candidate], incoming, { now: new Date("2026-10-01T10:05:00.000Z") }), true);
});

test("usual French phone formats share one canonical deduplication value", () => {
  assert.equal(typeof publicBooking.canonicalizePhoneForBookingDeduplication, "function");
  const formats = [
    "06 12 34 56 78",
    "0612345678",
    "+33 6 12 34 56 78",
    "+33612345678",
    "0033 6 12 34 56 78",
  ];

  for (const phone of formats) {
    assert.equal(publicBooking.canonicalizePhoneForBookingDeduplication(phone), "+33612345678");
  }
});

test("equivalent French phone formats produce the same booking fingerprint", () => {
  const incoming = validateBooking({ ...validPayload, guestPhone: "06 12 34 56 78" }).booking;
  const candidate = storedCandidate({ guest_phone: "0033 6 12 34 56 78" });

  assert.equal(publicBooking.isDuplicatePublicBooking([candidate], incoming, { now: new Date("2026-10-01T10:05:00.000Z") }), true);
});

test("different French phone numbers keep different booking fingerprints", () => {
  const incoming = validateBooking({ ...validPayload, guestPhone: "06 12 34 56 79" }).booking;

  assert.equal(publicBooking.isDuplicatePublicBooking([storedCandidate()], incoming, { now: new Date("2026-10-01T10:05:00.000Z") }), false);
});

test("foreign and missing phone values remain deterministic without corruption", () => {
  assert.equal(publicBooking.canonicalizePhoneForBookingDeduplication("+44 20 7946 0958"), "+442079460958");
  assert.equal(publicBooking.canonicalizePhoneForBookingDeduplication("+442079460958"), "+442079460958");
  assert.equal(publicBooking.canonicalizePhoneForBookingDeduplication(undefined), "");
  assert.equal(publicBooking.canonicalizePhoneForBookingDeduplication(""), "");
});

test("the public booking endpoint uses the trusted Netlify context for its durable IP limit", () => {
  assert.equal(bookingEndpoint.config?.path, "/api/booking-request");
  assert.equal(bookingEndpoint.config?.rateLimit, undefined);
});

test("concurrent identical submissions rely on one atomic fingerprint claim", async () => {
  assert.equal(typeof publicBooking.claimPublicBookingSubmission, "function");
  const incoming = validateBooking(validPayload).booking;
  const seen = new Set();
  const repository = {
    async claimFingerprint(fingerprint) {
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    },
  };

  const [first, second] = await Promise.all([
    publicBooking.claimPublicBookingSubmission(repository, incoming),
    publicBooking.claimPublicBookingSubmission(repository, incoming),
  ]);

  assert.equal(Number(first) + Number(second), 1);
});
