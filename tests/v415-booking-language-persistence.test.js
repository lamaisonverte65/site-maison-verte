import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePublicBookingPayload, buildPublicBookingEmails, createPublicBookingFingerprint } from "../netlify/functions/_lib/public-booking.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const base = {
  guestFirstName: "Alex", guestLastName: "Martin", guestEmail: "alex@example.org", guestPhone: "+33612345678",
  guestAddress: "1 chemin du Test", guestPostalCode: "65240", guestCity: "Arreau", guestCountry: "France",
  adultsCount: 2, childrenCount: 0, babyBedNeeded: false, marketingConsent: false,
  guestMessage: "", startDate: "2026-12-25", endDate: "2026-12-28", nights: 3,
  accommodationTotal: 300, promotionCode: "", cleaningOption: true, cleaningObligationsAccepted: false,
  paymentPreference: "deposit", contractAccepted: true, website: "",
};
const modelWithMoney = (model) => ({...model, total: 350, accommodationGross: 300, accommodationTotal: 300, touristTaxAmount: 0, depositRate: 0.3});

test("V4.15: reservation FR legacy, EN et ES transmis au modèle et à la base", () => {
  for (const [input, lang] of [[undefined, "fr"], ["en", "en"], ["es-ES", "es"], ["de", "fr"]]) {
    const result = validatePublicBookingPayload({...base, ...(input ? {communicationLanguage: input} : {})}, {cleaningFee: 50});
    assert.equal(result.ok, true, result.error);
    assert.equal(result.booking.communication_language, lang);
    assert.equal(result.emailModel.communication_language, lang);
  }
});

test("V4.15: langue ne modifie pas l'empreinte deduplication ni les données financières", () => {
  const fr = validatePublicBookingPayload(base, {cleaningFee: 50});
  const es = validatePublicBookingPayload({...base, communicationLanguage: "es"}, {cleaningFee: 50});
  assert.equal(createPublicBookingFingerprint(fr.booking), createPublicBookingFingerprint(es.booking));
  assert.equal(fr.booking.estimated_total, es.booking.estimated_total);
  assert.equal(fr.booking.payment_preference, es.booking.payment_preference);
});

test("V4.15: email propriétaire reste FR, email voyageur localisé", () => {
  for (const [lang, label] of [["fr", "Votre demande"], ["en", "Your booking request"], ["es", "Su solicitud de reserva"]]) {
    const result = validatePublicBookingPayload({...base, communicationLanguage: lang}, {cleaningFee: 50});
    const emails = buildPublicBookingEmails(modelWithMoney(result.emailModel), {ownerEmail: "owner@example.org"});
    assert.equal(emails.owner.subject, "Nouvelle demande de réservation");
    assert.match(emails.owner.html, /Arrivée :/);
    assert.match(emails.guest.subject, new RegExp(label));
    assert.match(emails.guest.html, /350/);
    assert.match(emails.guest.html, /24 h|24 hours|24 horas/);
    assert.equal(emails.guest.to, "alex@example.org");
  }
});

test("V4.15: email traduits échappent les champs voyageurs et promotion", () => {
  const result = validatePublicBookingPayload({...base, guestFirstName:"<Alex>", communicationLanguage: "es"},{cleaningFee:50});
  assert.equal(result.ok, true);
  const m = modelWithMoney(result.emailModel);
  const guest = buildPublicBookingEmails(m, {ownerEmail:"owner@example.org"}).guest;
  assert.doesNotMatch(guest.html, /<Alex>/);
  assert.match(guest.html, /&lt;Alex&gt;/);
});

test("V4.15: migration altere seulement la creation atomique, et ajoute le champ", () => {
  const sql = read("../supabase/migrations/202610220001_v415_booking_communication_language.sql");
  assert.match(sql, /add column if not exists communication_language text not null default 'fr'/);
  assert.match(sql, /communication_language in \('fr', 'en', 'es'\)/);
  assert.match(sql, /create or replace function public.create_public_booking_request_atomic\(/);
  assert.match(sql, /status, communication_language, guest_first_name/);
  assert.match(sql, /then p_booking ->> 'communication_language' else 'fr' end/);
  assert.match(sql, /contract_total/);
  assert.match(sql, /exception when exclusion_violation/);
});

test("V4.15: navigateur transmet la langue depuis l'URL et non les calculs", () => {
  const jsx = read("../src/pages/MaisonVerte.jsx");
  assert.match(jsx, /communicationLanguage: guestLanguageFromUrl\(window.location.href\)/);
  assert.match(jsx, /submitPublicBooking\(/);
});
