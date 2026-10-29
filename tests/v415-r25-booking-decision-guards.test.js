import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyManualBookingDecision,
  isCurrentBookingDecision,
  isDecisionStillCurrent,
  isKnownBookingDecision,
} from "../shared/bookingDecisionGuards.js";

const DATE = new Date("2026-10-29T12:00:00.000Z");
const initial = {
  id: "booking-1", status: "pending", guest_email: "guest@example.invalid",
  payment_link: "https://checkout.stripe.com/c/pay/cs_test_1",
  stripe_checkout_session_id: "cs_test_1", payment_status: null, updated_at: "2026-10-29T10:00:00.000Z",
};

function repository(row = initial, options = {}) {
  const state = { row: structuredClone(row), updates: [], reads: 0, filters: [], error: options.error || null };
  const supabase = {
    from(table) {
      assert.equal(table, "booking_requests");
      return {
        update(patch) {
          state.updates.push(patch);
          const filters = [];
          return {
            eq(key, value) { filters.push([key, value]); return this; },
            select(columns) { assert.equal(columns, "id"); return this; },
            async maybeSingle() {
              if (state.error) return { data: null, error: state.error };
              state.filters = filters;
              const matches = state.row && filters.every(([key, value]) => state.row[key] === value);
              if (!matches) return { data: null, error: null };
              state.row = { ...state.row, ...patch };
              return { data: { id: state.row.id }, error: null };
            },
          };
        },
        select(columns) {
          assert.equal(columns, "id,status,guest_email,payment_link,stripe_checkout_session_id,updated_at");
          return {
            eq(key, value) { assert.equal(key, "id"); assert.equal(value, initial.id); return this; },
            async maybeSingle() {
              state.reads++;
              return state.error ? { data: null, error: state.error } : { data: structuredClone(state.row), error: null };
            },
          };
        },
      };
    },
  };
  return { supabase, state };
}

test("R25 : refus possible uniquement de pending, avec condition atomique sur le statut", async () => {
  const { supabase, state } = repository(initial);
  await applyManualBookingDecision(supabase, initial, "refused", DATE);
  assert.equal(state.row.status, "refused");
  assert.equal(state.row.refused_at, DATE.toISOString());
  assert.equal(state.row.updated_at, DATE.toISOString());
  assert.deepEqual(state.filters, [["id", initial.id], ["status", "pending"]]);
  assert.equal(state.updates.length, 1);
});

test("R25 : confirmation possible uniquement de accepted, conserve la confirmation manuelle", async () => {
  const booking = { ...initial, status: "accepted", payment_status: null };
  const { supabase, state } = repository(booking);
  await applyManualBookingDecision(supabase, booking, "confirmed", DATE);
  assert.equal(state.row.status, "confirmed");
  assert.equal(state.row.payment_status, "manual_confirmed");
  assert.equal(state.row.confirmed_at, DATE.toISOString());
  assert.deepEqual(state.filters, [["id", initial.id], ["status", "accepted"]]);
});

test("R25 : confirmation conserve un payment_status existant", async () => {
  const booking = { ...initial, status: "accepted", payment_status: "manual_cash" };
  const { supabase, state } = repository(booking);
  await applyManualBookingDecision(supabase, booking, "confirmed", DATE);
  assert.equal(state.row.payment_status, "manual_cash");
});

test("R25 : action incohérente dans une fiche déjà périmée bloquée sans écriture", async () => {
  for (const [status, type] of [["accepted", "refused"], ["pending", "confirmed"], ["deposit_paid", "confirmed"], ["fully_paid", "confirmed"], ["cancelled", "refused"]]) {
    const b = { ...initial, status };
    const { supabase, state } = repository(b);
    await assert.rejects(applyManualBookingDecision(supabase, b, type, DATE), /statut/);
    assert.equal(state.updates.length, 0, status);
  }
});

test("R25 : paiement Stripe intervenu avant l'écriture bloque refus et confirmation", async () => {
  for (const [originalStatus, action, liveStatus] of [["pending", "refused", "deposit_paid"], ["accepted", "confirmed", "deposit_paid"], ["accepted", "confirmed", "fully_paid"]]) {
    const b = { ...initial, status: originalStatus };
    const { supabase, state } = repository({ ...b, status: liveStatus });
    await assert.rejects(applyManualBookingDecision(supabase, b, action, DATE), /modifiée entre-temps/);
    assert.equal(state.row.status, liveStatus);
  }
});

test("R25 : refus/confirmation concurrents ne peuvent réussir deux fois", async () => {
  for (const [status, action] of [["pending", "refused"], ["accepted", "confirmed"]]) {
    const b = { ...initial, status };
    const { supabase, state } = repository(b);
    const outcomes = await Promise.allSettled([
      applyManualBookingDecision(supabase, b, action, DATE),
      applyManualBookingDecision(supabase, b, action, DATE),
    ]);
    assert.deepEqual(outcomes.map(r => r.status).sort(), ["fulfilled", "rejected"]);
    assert.equal(state.row.status, action);
  }
});

test("R25 : aucune modification en cas d'erreur Supabase et aucune décision inconnue", async () => {
  const failed = repository(initial, { error: new Error("Database unavailable") });
  await assert.rejects(applyManualBookingDecision(failed.supabase, initial, "refused", DATE), /Database unavailable/);
  assert.equal(failed.state.row.status, "pending");
  const { supabase, state } = repository(initial);
  await assert.rejects(applyManualBookingDecision(supabase, initial, "invalid", DATE), /inconnue/);
  assert.equal(state.updates.length, 0);
});

test("R25 : correspondance stricte type d'email / statut de réservation", () => {
  assert.equal(isKnownBookingDecision("accepted"), true);
  assert.equal(isKnownBookingDecision("refused"), true);
  assert.equal(isKnownBookingDecision("confirmed"), true);
  assert.equal(isKnownBookingDecision("invalid"), false);
  for (const [type, expected] of [["accepted", "accepted"], ["refused", "refused"], ["confirmed", "confirmed"]]) {
    for (const status of ["pending", "accepted", "deposit_paid", "paid", "confirmed", "fully_paid", "refused", "cancelled", "expired"]) {
      assert.equal(isCurrentBookingDecision(type, { ...initial, status }), status === expected, `${type}/${status}`);
    }
  }
});

test("R25 : une réservation annulée/payée pendant la préparation ne produit pas d'email", async () => {
  for (const status of ["deposit_paid", "fully_paid", "cancelled", "expired", "refused"]) {
    const stored = { ...initial, status: "accepted" };
    const { supabase, state } = repository({ ...stored, status });
    assert.equal(await isDecisionStillCurrent(supabase, "accepted", stored), false, status);
    assert.equal(state.reads, 1);
  }
});

test("R25 : changement d'adresse, de lien Stripe, de session ou du dossier bloque l'email", async () => {
  const stored = { ...initial, status: "accepted" };
  for (const changed of [
    { guest_email: "other@example.invalid" },
    { payment_link: "https://checkout.stripe.com/c/pay/cs_test_2" },
    { stripe_checkout_session_id: "cs_test_2" },
    { updated_at: "2026-10-29T11:59:00.000Z" },
    { id: "other-booking" },
  ]) {
    const { supabase } = repository({ ...stored, ...changed });
    assert.equal(await isDecisionStillCurrent(supabase, "accepted", stored), false);
  }
});

test("R25 : second contrôle accepte le dossier inchangé, refuse une lecture SQL erronée", async () => {
  const stored = { ...initial, status: "accepted" };
  assert.equal(await isDecisionStillCurrent(repository(stored).supabase, "accepted", stored), true);
  const failure = repository(stored, { error: new Error("Lecture SQL impossible") });
  await assert.rejects(isDecisionStillCurrent(failure.supabase, "accepted", stored), /Lecture SQL impossible/);
});

test("R25 : intégration : refus/confirmation n'appellent les emails qu'après le CAS", () => {
  const admin = readFileSync(new URL("../src/pages/Admin.jsx", import.meta.url), "utf8");
  assert.match(admin, /await applyManualBookingDecision\(supabase, request, "refused"\);[\s\S]*?await sendDecisionEmail\(supabase, request, "refused"/);
  assert.match(admin, /await applyManualBookingDecision\(supabase, request, "confirmed"\);[\s\S]*?await sendDecisionEmail\(supabase, request, "confirmed"/);
  assert.doesNotMatch(admin, /status:\s*"refused",\s*refused_at/);
  assert.doesNotMatch(admin, /status:\s*"confirmed",\s*payment_status:/);
});

test("R25 : intégration serveur : contrôle initial, nouvelle lecture et blocage avant Resend", () => {
  const source = readFileSync(new URL("../netlify/functions/send-booking-decision.js", import.meta.url), "utf8");
  const first = source.indexOf("if (!isCurrentBookingDecision(type, storedBooking))");
  const second = source.indexOf("if (!await isDecisionStillCurrent(supabase, type, storedBooking))");
  const send = source.indexOf("const response = await resendEmail(retryPayload)");
  assert.ok(first > -1 && second > first && send > second);
  assert.match(source, /statusCode:\s*409/);
});
