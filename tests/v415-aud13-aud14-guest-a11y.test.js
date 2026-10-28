import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { balanceStatusPage } from "../netlify/functions/_lib/balance-page.js";
import { createBalancePaymentUrl, verifyBalanceToken } from "../netlify/functions/_lib/balance-link.js";
import { guestFlowTranslations } from "../src/pages/guestFlowTranslations.js";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const expected = {
  invalid: { fr: "Lien invalide", en: "Invalid link", es: "Enlace no válido" },
  notFound: { fr: "Réservation introuvable", en: "Booking not found", es: "Reserva no encontrada" },
  unavailable: { fr: "Paiement indisponible", en: "Payment unavailable", es: "Pago no disponible" },
  paid: { fr: "Séjour déjà réglé", en: "Stay already paid", es: "Estancia ya pagada" },
  verifying: { fr: "Paiement en cours de vérification", en: "Payment being verified", es: "Pago en verificación" },
  refresh: { fr: "Lien à actualiser", en: "Link needs refreshing", es: "Enlace por actualizar" },
  error: { fr: "Paiement momentanément indisponible", en: "Payment temporarily unavailable", es: "Pago temporalmente no disponible" },
};

test("AUD-13 : les 7 réponses du solde sont correctement localisées dans les trois langues", () => {
  for (const [kind, titles] of Object.entries(expected)) {
    for (const lang of ["fr", "en", "es"]) {
      const html = balanceStatusPage(kind, lang);
      assert.match(html, new RegExp(`<html lang="${lang}">`), `${kind}/${lang}`);
      assert.ok(html.includes(`<h1>${titles[lang]}</h1>`), `${kind}/${lang}`);
      assert.ok(html.includes(`href="https://lamaisonverte65.fr/${lang === "fr" ? "" : `${lang}/`}"`), `${kind}/${lang}`);
      assert.match(html, /<meta name="robots" content="noindex,follow">/);
    }
  }
});

test("AUD-13 : langue non reconnue = français et messages inconnus = échec neutre", () => {
  const html = balanceStatusPage("garbage", "it");
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /Paiement momentanément indisponible/);
  assert.doesNotMatch(html, /href="[^\"]*\/it\//);
});

test("AUD-13 : l'URL serveur est échappée dans le HTML", () => {
  const html = balanceStatusPage("paid", "en", 'https://lamaisonverte65.fr/" onmouseover="alert(1)');
  assert.doesNotMatch(html, /href="[^\"]*" onmouseover=/);
  assert.match(html, /&quot;/);
});

test("AUD-13 : le code vérifie le token avant la réservation et utilise la langue de la réservation", () => {
  const file = source("netlify/functions/pay-balance.js");
  assert.ok(file.indexOf("verifyBalanceToken(bookingId, token)") < file.indexOf('from("booking_requests")'));
  assert.ok(file.indexOf("language = normalizeGuestLanguage(booking.communication_language)") > file.indexOf('from("booking_requests")'));
  for (const kind of Object.keys(expected)) assert.ok(file.includes(`balanceStatusPage("${kind}", language, SITE_URL)`), kind);
  assert.match(file, /openBalanceCheckout\(/);
  assert.match(file, /statusCode: 303/);
  assert.match(file, /Cache-Control/);
});

test("AUD-14 : trois libellés associés aux champs d'arrivée (sans changer les requêtes)", () => {
  const app = source("src/App.jsx");
  for (const id of ["arrival-recovery-email", "arrival-recovery-surname", "arrival-time-input"]) {
    assert.match(app, new RegExp(`htmlFor="${id}"`));
    assert.match(app, new RegExp(`id="${id}"`));
  }
  assert.match(app, /requestArrivalRecovery\(/);
  assert.match(app, /update-arrival-time/);
});

test("AUD-14 : libellé horaire disponible dans les trois traductions", () => {
  assert.equal(guestFlowTranslations.fr.arrival.timeInputLabel, "Heure d’arrivée souhaitée");
  assert.equal(guestFlowTranslations.en.arrival.timeInputLabel, "Expected arrival time");
  assert.equal(guestFlowTranslations.es.arrival.timeInputLabel, "Hora prevista de llegada");
  assert.deepEqual(Object.keys(guestFlowTranslations.fr.arrival).sort(), Object.keys(guestFlowTranslations.en.arrival).sort());
  assert.deepEqual(Object.keys(guestFlowTranslations.fr.arrival).sort(), Object.keys(guestFlowTranslations.es.arrival).sort());
});

test("AUD-14 : toutes les descriptions françaises non vides des onze pages du livret ont une traduction", () => {
  const files = [
    "src/components/booklet/BookletWelcome.jsx", "src/components/booklet/BookletPractical.jsx",
    "src/components/booklet/BookletHouseRules.jsx", "src/components/booklet/BookletDiscover.jsx",
    "src/components/booklet/BookletInventory.jsx", "src/pages/LivretAccueil.jsx",
  ];
  const localizer = source("src/booklet/localizeBooklet.jsx");
  for (const file of files) {
    for (const [, attr, value] of source(file).matchAll(/(alt|aria-label)="([^"]+)"/g)) {
      const parsed = JSON.stringify(value);
      assert.ok(localizer.includes(`${parsed}: `), `${file} ${attr}: ${value}`);
    }
  }
  assert.match(localizer, /for \(const attribute of \["alt", "aria-label", "title"\]\)/);
  assert.match(localizer, /description \? `\$\{description\} — \$\{replacementProps\.title\}`/);
  assert.match(localizer, /lang === "fr" \|\| !value/);
});

test("AUD-13 : nouveaux liens du solde préservent le token et signalent la langue pour les liens invalides", () => {
  const previous = process.env.BALANCE_LINK_SECRET;
  process.env.BALANCE_LINK_SECRET = "test-secret-for-aud13-only";
  try {
    const fr = createBalancePaymentUrl("https://lamaisonverte65.fr", "b1", "fr");
    const en = createBalancePaymentUrl("https://lamaisonverte65.fr", "b1", "en");
    const es = createBalancePaymentUrl("https://lamaisonverte65.fr", "b1", "es");
    assert.equal(new URL(fr).searchParams.get("lang"), null);
    assert.equal(new URL(en).searchParams.get("lang"), "en");
    assert.equal(new URL(es).searchParams.get("lang"), "es");
    const token = new URL(fr).searchParams.get("token");
    assert.equal(new URL(en).searchParams.get("token"), token);
    assert.equal(new URL(es).searchParams.get("token"), token);
    assert.equal(verifyBalanceToken("b1", token), true);
    assert.equal(verifyBalanceToken("b2", token), false);
  } finally {
    if (previous === undefined) delete process.env.BALANCE_LINK_SECRET;
    else process.env.BALANCE_LINK_SECRET = previous;
  }
});

test("AUD-13 : les deux parcours d'envoi utilisent la langue de réservation", () => {
  for (const file of ["netlify/functions/check-balance-payments.js", "netlify/functions/create-balance-checkout-session.js"]) {
    const code = source(file);
    assert.match(code, /createBalancePaymentUrl\(process\.env\.URL \|\| "https:\/\/lamaisonverte65\.fr", booking\.id, emailLanguageForAudience\(booking\)\)/, file);
  }
});
