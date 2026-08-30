import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  filterVisibleExternalOccupations,
  parseHousekeepingReservationTarget,
  toHousekeepingExternalReservation,
  toHousekeepingReservation,
  validateHousekeepingNoteInput,
  validateHousekeepingReadRequest,
} from "../netlify/functions/_lib/housekeeping-contract.js";

const databaseRow = {
  id: "booking-1",
  source: "direct",
  start_date: "2026-09-12",
  end_date: "2026-09-19",
  guest_first_name: "Alice",
  guest_last_name: "Martin",
  guest_phone: "+33601020304",
  guest_email: "alice@example.test",
  adults_count: 2,
  children_count: 1,
  children_ages: "5 ans",
  baby_bed_needed: true,
  arrival_time: "17:30",
  departure_time: "08:15",
  practical_information: "Clés dans la boîte sécurisée.",
  message: "Nous arriverons après la randonnée.",
  owner_message: "Bienvenue, votre arrivée tardive est notée.",
  housekeeping_notes: "Préparer le lit bébé.",
  housekeeping_user_notes: "Lit installé dans la petite chambre.",
  owner_price: 1200,
  estimated_total: 1180,
  deposit_amount: 300,
  balance_amount: 900,
  payment_status: "paid",
  stripe_checkout_session_id: "cs_secret",
  stripe_fee_amount: 36,
  refund_amount: 50,
  stripe_payout_id: "po_secret",
  technical_log: "internal",
};

const noteHistory = [{
  id: "note-1",
  note: "Lit installé dans la petite chambre.",
  author_admin_user_id: "housekeeping-1",
  author_display_name: "Équipe ménage",
  created_at: "2026-09-12T18:00:00.000Z",
}];

test("housekeeping serializer returns the exact read-only operational contract and no financial data", () => {
  assert.deepEqual(toHousekeepingReservation(databaseRow, noteHistory), {
    id: "booking-1",
    source: "direct",
    startDate: "2026-09-12",
    endDate: "2026-09-19",
    guest: {
      firstName: "Alice",
      lastName: "Martin",
      phone: "+33601020304",
      email: "alice@example.test",
    },
    occupancy: {
      adults: 2,
      children: 1,
      childrenAges: "5 ans",
      babyBedNeeded: true,
    },
    stay: {
      arrivalTime: "17:30",
      departureTime: "08:15",
      practicalInformation: "Clés dans la boîte sécurisée.",
    },
    communications: {
      clientMessage: "Nous arriverons après la randonnée.",
    },
    internalNotes: {
      ownerForHousekeeping: "Préparer le lit bébé.",
      housekeeping: [{
        id: "note-1",
        note: "Lit installé dans la petite chambre.",
        authorAdminUserId: "housekeeping-1",
        authorDisplayName: "Équipe ménage",
        createdAt: "2026-09-12T18:00:00.000Z",
      }],
    },
  });
});

test("financial, payment, Stripe, refund, payout, and technical fields cannot cross the serializer", () => {
  const serialized = JSON.stringify(toHousekeepingReservation(databaseRow));
  for (const forbidden of [
    "owner_price", "estimated_total", "deposit", "balance", "payment",
    "paid", "stripe", "refund", "payout", "technical_log", "cs_secret", "po_secret",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, "i"), forbidden);
  }
});

test("historical owner_message is never classified as a client communication", () => {
  const result = toHousekeepingReservation(databaseRow, noteHistory);
  assert.equal(result.communications.clientMessage, databaseRow.message);
  assert.equal(Object.hasOwn(result.communications, "ownerReply"), false);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(databaseRow.owner_message));
  assert.equal(result.internalNotes.ownerForHousekeeping, databaseRow.housekeeping_notes);
  assert.equal(result.internalNotes.housekeeping[0].note, noteHistory[0].note);
  assert.doesNotMatch(JSON.stringify(result.communications), new RegExp(noteHistory[0].note));
});

test("external calendar occupancy uses only persisted enrichment and never treats iCal summary as a guest name", () => {
  const result = toHousekeepingExternalReservation({
    uid: "ics-1", source: "booking", start_date: "2026-10-01", end_date: "2026-10-05",
    title: "Reserved", guest_name: "Client Booking", nightly_price: 200,
  }, {
    guest_first_name: "Claire", guest_last_name: "Durand", guest_phone: "+33611111111",
    guest_email: "claire@example.test", children_count: 2, baby_bed_needed: false,
    arrival_time: "16:00", departure_time: "09:00", practical_information: "Code portail 1234",
    message: "Valeur locale sans provenance de communication",
    housekeeping_notes: "Deux lits enfants", housekeeping_user_notes: "Chambres prêtes",
    stripe_payout_id: "po_forbidden",
  }, noteHistory);
  assert.equal(result.id, "external:booking:ics-1");
  assert.equal(result.guest.firstName, "Claire");
  assert.equal(result.stay.departureTime, "09:00");
  assert.equal(result.communications.clientMessage, null);
  assert.equal(result.internalNotes.ownerForHousekeeping, "Deux lits enfants");
  assert.equal(result.internalNotes.housekeeping.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /price|stripe|payout|po_forbidden/i);
});

test("external calendar occupancy tolerates every unavailable customer field", () => {
  const result = toHousekeepingExternalReservation({
    external_uid: "ics-2", source: "airbnb", start_date: "2026-11-01", end_date: "2026-11-03",
    title: "Not available",
  });
  assert.deepEqual(result.guest, { firstName: null, lastName: null, phone: null, email: null });
  assert.deepEqual(result.occupancy, {
    adults: null, children: null, childrenAges: null, babyBedNeeded: null,
  });
  assert.deepEqual(result.communications, { clientMessage: null });
});

test("only current unresolved external occupations remain visible to housekeeping", () => {
  const occupations = [
    { id: "occ-1", source: "booking", external_uid: "raw", is_current: true },
    { id: "occ-2", source: "booking", external_uid: "converted", is_current: true },
    { id: "occ-3", source: "airbnb", external_uid: "stale", is_current: false },
  ];
  const actions = [{
    source: "booking",
    uid: "converted",
    status: "applied",
    is_active: true,
    created_booking_ids: ["booking-1"],
    created_block_ids: [],
  }];

  assert.deepEqual(filterVisibleExternalOccupations(occupations, actions), [occupations[0]]);
});

test("pending, inactive, or empty actions do not hide a current external occupation", () => {
  const occupation = { id: "occ-1", source: "booking", external_uid: "uid-1", is_current: true };
  const actions = [
    { source: "booking", uid: "uid-1", status: "pending", is_active: true, created_booking_ids: ["booking-1"] },
    { source: "booking", uid: "uid-1", status: "applied", is_active: false, created_booking_ids: ["booking-1"] },
    { source: "booking", uid: "uid-1", status: "applied", is_active: true, created_booking_ids: [], created_block_ids: [] },
  ];
  assert.deepEqual(filterVisibleExternalOccupations([occupation], actions), [occupation]);
});

test("external target identifiers preserve the complete ICS UID for restricted updates", () => {
  assert.deepEqual(parseHousekeepingReservationTarget("booking-1"), {
    kind: "booking", id: "booking-1",
  });
  assert.deepEqual(parseHousekeepingReservationTarget("external:booking:uid:with:colons"), {
    kind: "external", source: "booking", uid: "uid:with:colons",
  });
  assert.equal(parseHousekeepingReservationTarget("external:booking:").ok, false);
});

test("housekeeping note input accepts only a target and a non-empty bounded note", () => {
  assert.deepEqual(
    validateHousekeepingNoteInput({ reservationId: "booking-1", note: "  Linge déposé.  " }),
    { ok: true, value: { reservationId: "booking-1", note: "Linge déposé." } },
  );
});

test("housekeeping note input rejects reservation mutations, client mutations, supplied authors, and generic updates", () => {
  for (const input of [
    { reservationId: "booking-1", field: "arrival_time", value: "18:00" },
    { reservationId: "booking-1", field: "departure_time", value: "08:00" },
    { reservationId: "booking-1", updates: { guest_phone: "+33600000000" } },
    { reservationId: "booking-1", note: "Note", authorAdminUserId: "chosen-author" },
    { reservationId: "booking-1", updates: { arrival_time: "18:00", owner_price: 1 } },
  ]) {
    const result = validateHousekeepingNoteInput(input);
    assert.equal(result.ok, false, JSON.stringify(input));
    assert.equal(result.statusCode, 400);
  }
});

test("housekeeping note target and text are required and bounded", () => {
  assert.equal(validateHousekeepingNoteInput({ reservationId: "", note: "Note" }).ok, false);
  assert.equal(validateHousekeepingNoteInput({ reservationId: "booking-1", note: "  " }).ok, false);
  assert.equal(validateHousekeepingNoteInput({ reservationId: "booking-1", note: "x".repeat(2001) }).ok, false);
});

test("the housekeeping reservation endpoint accepts only its read action", () => {
  assert.deepEqual(validateHousekeepingReadRequest({ action: "list" }), { ok: true });
  for (const input of [
    { action: "update", reservationId: "booking-1", field: "arrival_time", value: "18:00" },
    { action: "create_note", reservationId: "booking-1", note: "Note" },
    { action: "list", owner_price: true },
    {},
  ]) {
    const result = validateHousekeepingReadRequest(input);
    assert.equal(result.ok, false, JSON.stringify(input));
    assert.equal(result.statusCode, 400);
  }
});

test("housekeeping read and note endpoints have no iCal or outbound network dependency", () => {
  const readEndpoint = readFileSync("netlify/functions/housekeeping.js", "utf8");
  const noteEndpoint = readFileSync("netlify/functions/housekeeping-notes.js", "utf8");
  const source = `${readEndpoint}\n${noteEndpoint}`;
  assert.match(readEndpoint, /from\("external_occupancies"\)/);
  assert.doesNotMatch(source, /node-ical|fromURL|AIRBNB_ICAL_URL|BOOKING_ICAL_URL|fetch\s*\(/);
  assert.doesNotMatch(source, /select\s*\(\s*["']\*["']\s*\)/);
});

test("housekeeping endpoint selects only columns present in the audited production schema", () => {
  const source = readFileSync("netlify/functions/housekeeping.js", "utf8");
  assert.doesNotMatch(source, /owner_message/);
  assert.doesNotMatch(source, /departure_time|practical_information/);
  assert.match(source, /external_occupation_id/);
  assert.match(source, /\.eq\("is_current", true\)/);
  assert.match(source, /from\("external_calendar_actions"\)/);
});

test("production audit block 34 no longer expects excluded or speculative housekeeping fields", () => {
  const source = readFileSync("docs/operations/supabase-production-readonly-migration-audit.sql", "utf8");
  assert.doesNotMatch(source, /'owner_message'/);
  assert.doesNotMatch(source, /'departure_time'|'practical_information'/);
});
