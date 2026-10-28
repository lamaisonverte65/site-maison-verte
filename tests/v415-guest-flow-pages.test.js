import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { appendGuestLanguage, guestLanguageFromUrl } from "../shared/guestLocale.js";
import { guestFlowTranslations } from "../src/pages/guestFlowTranslations.js";
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("V4.15 flux voyageurs : FR sans changement, EN/ES avec query lang", () => {
  const success = "https://lamaisonverte65.fr/success?session_id={CHECKOUT_SESSION_ID}";
  const arrival = "https://lamaisonverte65.fr/arrival?booking=b&token=abcdef";
  assert.equal(appendGuestLanguage(success, "fr"), success);
  assert.equal(appendGuestLanguage(success, null), success);
  assert.equal(appendGuestLanguage(success, "it"), success);
  for (const lang of ["en", "es"]) {
    assert.equal(appendGuestLanguage(success, lang), `${success}&lang=${lang}`);
    assert.equal(appendGuestLanguage("https://lamaisonverte65.fr/cancel", lang), `https://lamaisonverte65.fr/cancel?lang=${lang}`);
    assert.equal(appendGuestLanguage(arrival, lang), `${arrival}&lang=${lang}`);
    assert.equal(guestLanguageFromUrl(appendGuestLanguage(arrival, lang)), lang);
    assert.equal(appendGuestLanguage(`${arrival}&lang=${lang}`, lang), `${arrival}&lang=${lang}`);
  }
  assert.equal(appendGuestLanguage("https://lamaisonverte65.fr/#a", "es"), "https://lamaisonverte65.fr/?lang=es#a");
});

test("V4.15 flux voyageurs : toutes les copies visibles existent dans les trois langues", () => {
  const fr = guestFlowTranslations.fr;
  for (const lang of ["en", "es"]) {
    const variant = guestFlowTranslations[lang];
    for (const kind of ["success", "cancel", "arrival"]) {
      assert.deepEqual(Object.keys(variant[kind]).sort(), Object.keys(fr[kind]).sort());
      for (const [key, value] of Object.entries(variant[kind])) {
        assert.ok(Array.isArray(value) ? value.every(Boolean) : typeof value === "string" && value.trim(), `${lang}.${kind}.${key}`);
      }
    }
  }
});

test("V4.15 flux voyageurs : les trois routes restent historiques, langues explicites seulement", () => {
  const app = read("src/App.jsx");
  for (const page of ["success", "cancel", "arrival"]) assert.ok(app.includes(`if (path === "/${page}")`));
  for (const component of ["PaymentSuccess", "PaymentCancel", "ArrivalTimePage"]) assert.ok(app.includes(`<${component} language={publicLanguage}`));
  for (const name of ["create-personal-booking.js", "create-manual-payment-session.js", "create-cleaning-payment-session.js", "create-additional-charge-session.js"]) {
    const content = read(`netlify/functions/${name}`);
    assert.match(content, /success_url: appendGuestLanguage\(/);
    assert.match(content, /cancel_url: appendGuestLanguage\(/);
  }
  assert.match(read("netlify/functions/pay-balance.js"), /openBalanceCheckout\(/);
  const balance = read("netlify/functions/_lib/balance-checkout.js");
  assert.match(balance, /success_url: appendGuestLanguage\(/);
  assert.match(balance, /cancel_url: appendGuestLanguage\(/);
  const initial = read("netlify/functions/_lib/initial-checkout.js");
  assert.match(initial, /success_url: appendGuestLanguage\(/);
  assert.match(initial, /cancel_url: appendGuestLanguage\(/);
  for (const name of ["stripe-webhook.js", "send-arrival-reminder.js", "_lib/arrival-link-recovery.js"]) {
    assert.match(read(`netlify/functions/${name}`), /appendGuestLanguage\(/);
  }
});

test("V4.15 livret : plans traduits invalides absents ; plans FR toujours affiches", () => {
  for (const lang of ["en", "es"]) for (const n of ["3", "4"])
    assert.equal(existsSync(new URL(`../public/livret/plan-parking-${n}-${lang}.webp`, import.meta.url)), false);
  const localize = read("src/booklet/localizeBooklet.jsx");
  assert.match(localize, /toujours afficher leurs originaux français/);
  for (const n of ["3", "4"]) assert.equal(existsSync(new URL(`../public/livret/plan-parking-${n}.webp`, import.meta.url)), true);
});
