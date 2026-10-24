import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateBookingLanguageChange } from "../netlify/functions/_lib/booking-language-policy.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const BOOKING_ID = "d6360c20-2de6-44e7-9325-5562513a167c";

test("R7 : FR, EN et ES acceptés sans changer l'identifiant de réservation", () => {
  for (const language of ["fr", "en", "es"]) {
    assert.deepEqual(validateBookingLanguageChange({ bookingId: BOOKING_ID, communicationLanguage: language }), {
      ok: true, bookingId: BOOKING_ID, communicationLanguage: language,
    });
  }
});

test("R7 : valeurs arbitraires et codes linguistiques non canoniques rejetés", () => {
  for (const invalid of ["de", "es-ES", "EN", "en ", "", null, 0]) {
    assert.equal(validateBookingLanguageChange({ bookingId: BOOKING_ID, communicationLanguage: invalid }).ok, false);
  }
});

test("R7 : tout champ métier supplémentaire est refusé, y compris le total", () => {
  for (const forbidden of ["contract_total", "total", "status", "guest_email", "payment_status", "owner_price", "customerId"]) {
    assert.equal(validateBookingLanguageChange({ bookingId: BOOKING_ID, communicationLanguage: "es", [forbidden]: 0 }).ok, false);
  }
});

test("R7 : entrées sans id UUID strict ou hors objet refusées", () => {
  for (const invalid of [null, [], "string", {}, { bookingId: "1", communicationLanguage: "en" }, { bookingId: 123, communicationLanguage: "en" }]) {
    assert.equal(validateBookingLanguageChange(invalid).ok, false);
  }
});

test("R7 : endpoint propriétaire, POST uniquement, validation avant mutation", () => {
  const source = read("../netlify/functions/update-booking-language.js");
  assert.match(source, /event\.httpMethod !== "POST"/);
  assert.match(source, /authorizeAdminRequest\(event, supabase, \{ ownerOnly: true \}\)/);
  assert.ok(source.indexOf("authorizeAdminRequest(") < source.indexOf("validateBookingLanguageChange(body)"));
  assert.ok(source.indexOf("validateBookingLanguageChange(body)") < source.indexOf('.from("booking_requests")'));
  assert.match(source, /\.update\(\{ communication_language: change\.communicationLanguage \}\)/);
  assert.match(source, /\.eq\("id", change\.bookingId\)/);
  assert.match(source, /\.select\("id,communication_language"\)/);
  assert.doesNotMatch(source, /contract_total|stripe|payment_intent|customer_notes|rpc\(/i);
});

test("R7 : sélection de langue indépendante de l'éditeur de réservation", () => {
  const panel = read("../src/components/admin/ReservationPanel.jsx");
  assert.match(panel, /GuestLanguagePreference booking=\{reservation\} onUpdated=\{onReservationUpdated\}/);
  assert.match(panel, /!isEditing && permissions\?\.isOwner && request\?\.id && !request\?\.uid/);
  assert.match(panel, /getBookingKind\(request\) !== "personal"/);
});

test("R7 : interface n'envoie que identifiant et langue via la session Supabase", () => {
  const component = read("../src/components/admin/reservation/GuestLanguagePreference.jsx");
  assert.match(component, /\.netlify\/functions\/update-booking-language/);
  assert.match(component, /Authorization: `Bearer \$\{session\.access_token\}`/);
  assert.match(component, /JSON\.stringify\(\{ bookingId: booking\.id, communicationLanguage: language \}\)/);
  assert.match(component, /onUpdated\?\.\(\)/);
  assert.doesNotMatch(component, /previewReservationEdit|buildEditPayload|update-booking-request|Stripe|contract_total/);
});

test("R7 : résumé affiche la langue sauvegardée, FR si réservation historique", () => {
  const summary = read("../src/components/admin/reservation/ReservationSummaryBlock.jsx");
  assert.match(summary, /Langue emails/);
  assert.match(summary, /normalizeGuestLanguage\(reservation\.communication_language\)/);
  const adapter = read("../src/adapters/reservationViewAdapter.js");
  assert.match(adapter, /\.\.\.request/);
  const service = read("../src/services/adminDataService.js");
  assert.match(service, /\.from\("booking_requests"\)\s*\.select\("\*"\)/);
});

test("R7 : réutilise la migration R2 existante sans migration financière", () => {
  const sql = read("../supabase/migrations/202610220001_v415_booking_communication_language.sql");
  assert.match(sql, /add column if not exists communication_language text not null default 'fr'/);
});
