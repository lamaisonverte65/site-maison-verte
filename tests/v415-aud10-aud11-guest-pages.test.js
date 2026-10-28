import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { requestArrivalRecovery } from "../src/utils/requestArrivalRecovery.js";
import { guestFlowTranslations } from "../src/pages/guestFlowTranslations.js";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

const capture = (result) => {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (result instanceof Error) throw result;
      return result;
    },
  };
};

const input = { bookingId: "booking-abc", email: "client@example.test", lastName: "Test" };

test("AUD-11: une reponse HTTP 202 donne uniquement la confirmation generique", async () => {
  const mock = capture({ status: 202, ok: true });
  assert.equal(await requestArrivalRecovery(input, mock), true);
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].url, "/.netlify/functions/request-arrival-link");
  assert.equal(mock.calls[0].options.method, "POST");
  assert.equal(mock.calls[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(mock.calls[0].options.body), { ...input, website: "" });
});

test("AUD-11: la recuperation ne revele pas la presence d'une reservation", async () => {
  for (const language of ["fr", "en", "es"]) {
    const message = guestFlowTranslations[language].arrival.recoverySent;
    assert.match(message, /Si les informations|If the details|Si los datos/);
  }
  assert.equal(await requestArrivalRecovery(input, capture({ status: 202, ok: true })), true);
});

test("AUD-11: une reponse 200 ou 204 inattendue n'est pas une preuve de prise en charge", async () => {
  for (const status of [200, 204]) {
    await assert.rejects(requestArrivalRecovery(input, capture({ status, ok: true })), /unavailable/);
  }
});

test("AUD-11: le serveur peut retourner 429 sans afficher une fausse reussite", async () => {
  await assert.rejects(requestArrivalRecovery(input, capture({ status: 429, ok: false })), /unavailable/);
});

test("AUD-11: une erreur serveur 500 est traitee comme un echec", async () => {
  await assert.rejects(requestArrivalRecovery(input, capture({ status: 500, ok: false })), /unavailable/);
});

test("AUD-11: un probleme d'authentification/proxy n'est jamais interprete comme succes", async () => {
  await assert.rejects(requestArrivalRecovery(input, capture({ status: 403, ok: false })), /unavailable/);
});

test("AUD-11: une reponse absente n'est pas un succes", async () => {
  await assert.rejects(requestArrivalRecovery(input, capture(undefined)), /unavailable/);
});

test("AUD-11: une erreur reseau reste une erreur", async () => {
  await assert.rejects(requestArrivalRecovery(input, capture(new TypeError("Network error"))), /Network error/);
});

test("AUD-11: interface affiche une erreur generique lors d'un echec HTTP", () => {
  assert.match(app, /await requestArrivalRecovery\(\{ bookingId, email: recoveryEmail, lastName: recoveryLastName \}\)/);
  assert.match(app, /catch \(_\) \{\s*setRecoveryStatus\(t\.recoveryError\)/);
  assert.doesNotMatch(app, /await fetch\("\/\.netlify\/functions\/request-arrival-link"/);
});

test("AUD-10: /success ne pretend plus que le paiement a ete enregistre", () => {
  for (const language of ["fr", "en", "es"]) {
    const copy = guestFlowTranslations[language].success;
    assert.ok(!/✅/.test(copy.title));
    assert.ok(!/bien été enregistré|has been recorded|se ha registrado correctamente/i.test(copy.saved));
    assert.ok(!/vient de vous être envoyé|has been sent to you|hemos enviado/i.test(copy.email));
    assert.equal(copy.steps.length, 3);
  }
  assert.match(app, /function PaymentSuccess/);
  assert.match(app, /\{t\.saved\}/);
  assert.match(app, /\{t\.email\}/);
  assert.match(app, /if \(path === "\/success"\)/);
});

test("AUD-10: page neutre, sans coche de confirmation de paiement", () => {
  const paymentSuccess = app.split("function PaymentSuccess")[1].split("function PaymentCancel")[0];
  assert.doesNotMatch(paymentSuccess, /\n\s*✓\s*\n/);
  assert.match(paymentSuccess, /background: "#64748b"/);
});
