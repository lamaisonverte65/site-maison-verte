import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emailDeliveryMode, evaluateEmailDelivery, emailAutomationAllowed,
  emailAutomationSkippedResponse, isKnownLiveDeployment,
} from "../netlify/functions/_lib/email-delivery-policy.js";
import { resendEmail } from "../netlify/functions/_lib/resend-email.js";

const preview = Object.freeze({
  CONTEXT: "deploy-preview",
  URL: "https://maisonverte-recette.netlify.app",
});
const allowlist = Object.freeze({
  ...preview,
  LMV_EMAIL_DELIVERY_MODE: "allowlist",
  LMV_EMAIL_ALLOWED_RECIPIENTS: "testeur@example.invalid",
});
const production = Object.freeze({
  CONTEXT: "production",
  URL: "https://lamaisonverte65.fr",
});
const payload = (to = "testeur@example.invalid", other = {}) => ({
  from: "La Maison Verte <contact@lamaisonverte65.fr>",
  to: [to], subject: "Recette V4.15", html: "<p>Test sans client réel</p>", ...other,
});

test("R13.3e : aucun envoi implicite en local, en preview ou sur un autre site Netlify", () => {
  assert.equal(emailDeliveryMode({}), "block");
  assert.equal(emailDeliveryMode(preview), "block");
  assert.equal(emailDeliveryMode({ CONTEXT: "production", URL: "https://recette.netlify.app" }), "block");
  assert.equal(emailDeliveryMode({ ...preview, LMV_EMAIL_DELIVERY_MODE: "live" }), "block");
  assert.equal(emailDeliveryMode({ ...preview, LMV_EMAIL_DELIVERY_MODE: "invalid" }), "block");
});

test("R13.3e : production canonique seule conserve le mode live", () => {
  assert.equal(isKnownLiveDeployment(production), true);
  assert.equal(emailDeliveryMode(production), "live");
  assert.equal(emailDeliveryMode({ ...production, LMV_EMAIL_DELIVERY_MODE: "block" }), "block");
  assert.equal(emailDeliveryMode({ ...production, LMV_EMAIL_DELIVERY_MODE: "allowlist" }), "allowlist");
});

test("R13.3e : contexte runtime explicite limité à la production", () => {
  const runtime = {
    URL: "https://lamaisonverte65.fr",
    LMV_RUNTIME_CONTEXT: "production",
  };
  assert.equal(isKnownLiveDeployment(runtime), true);
  assert.equal(emailDeliveryMode(runtime), "live");
  assert.equal(emailAutomationAllowed(runtime), true);
  assert.equal(emailDeliveryMode({ URL: runtime.URL }), "block");
  assert.equal(emailDeliveryMode({
    ...runtime, CONTEXT: "deploy-preview",
  }), "block");
  assert.equal(emailDeliveryMode({
    ...runtime, URL: "https://recette.netlify.app",
  }), "block");
});
test("R13.3e : allowlist absente ou invalide = refus", () => {
  assert.equal(evaluateEmailDelivery(payload(), { ...preview, LMV_EMAIL_DELIVERY_MODE: "allowlist" }).allowed, false);
  assert.equal(evaluateEmailDelivery(payload(), { ...allowlist, LMV_EMAIL_ALLOWED_RECIPIENTS: "*" }).allowed, false);
});

test("R13.3e : seuls les destinataires explicitement autorisés sont acceptés", () => {
  assert.equal(evaluateEmailDelivery(payload(), allowlist).allowed, true);
  assert.equal(evaluateEmailDelivery(payload("Testeur <TESTEUR@EXAMPLE.INVALID>"), allowlist).allowed, true);
  assert.equal(evaluateEmailDelivery(payload("client@example.com"), allowlist).allowed, false);
  assert.equal(evaluateEmailDelivery(payload(["testeur@example.invalid","client@example.com"]), allowlist).allowed, false);
});

test("R13.3e : contrôle exhaustif des copies CC / BCC", () => {
  assert.equal(evaluateEmailDelivery(payload(undefined, { cc: ["client@example.com"] }), allowlist).allowed, false);
  assert.equal(evaluateEmailDelivery(payload(undefined, { bcc: ["client@example.com"] }), allowlist).allowed, false);
  assert.equal(evaluateEmailDelivery(payload(undefined, { cc: ["testeur@example.invalid"], bcc: ["testeur@example.invalid"] }), allowlist).allowed, true);
  assert.equal(evaluateEmailDelivery(payload(undefined, { headers: { Bcc: "client@example.com" } }), allowlist).allowed, false);
  assert.equal(evaluateEmailDelivery(payload(undefined, { cc: "client@example.com, testeur@example.invalid" }), allowlist).allowed, false);
  assert.equal(evaluateEmailDelivery({from:"", subject:"", to:[]}, allowlist).allowed, false);
});

test("R13.3e : passerelle Resend ne lance aucun appel réseau si la politique refuse", async () => {
  let called = 0;
  const response = await resendEmail(payload("client@example.com"), {
    env: allowlist, apiKey: "FAKE",
    fetchImpl: async () => { called++; throw new Error("Interdit"); },
  });
  assert.equal(response.ok, false);
  assert.equal(response.status, 403);
  assert.match(await response.text(), /email_guard_recipient_not_allowed/);
  assert.equal(called, 0);
});

test("R13.3e : un email fictif allowlisté passe via le fetch injecté", async () => {
  const calls = [];
  const response = await resendEmail(payload(), {
    env: allowlist, apiKey: "FAKE",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ id: "fake" }) };
    },
  });
  assert.equal(response.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/api\.resend\.com\/emails$/);
  assert.deepEqual(JSON.parse(calls[0].options.body).to, ["testeur@example.invalid"]);
});

test("R13.3e : toutes les tâches planifiées sont désactivées en mode recette", () => {
  assert.equal(emailAutomationAllowed({}), false);
  assert.equal(emailAutomationAllowed(allowlist), false);
  assert.equal(emailAutomationAllowed(production), true);
  assert.match(emailAutomationSkippedResponse().body, /email_test_automation_disabled/);
});

test("R13.3e : aucune fonction n'accède directement à l'API Resend sauf la passerelle", async () => {
  const { readdirSync } = await import("node:fs");
  const files = [
    ...readdirSync("netlify/functions").filter((f) => f.endsWith(".js")).map((f) => `netlify/functions/${f}`),
    ...readdirSync("netlify/functions/_lib").filter((f) => f.endsWith(".js")).map((f) => `netlify/functions/_lib/${f}`),
  ];
  for (const file of files) {
    if (file === "netlify/functions/_lib/resend-email.js") continue;
    assert.doesNotMatch(readFileSync(file, "utf8"), /api\.resend\.com\/emails/i, file);
  }
  for (const file of ["netlify/functions/request-arrival-link.js","netlify/functions/check-external-calendar-alerts.js"]) {
    assert.match(readFileSync(file, "utf8"), /resendEmail\(/, file);
  }
});

test("R13.3e : cinq crons métier sont bloqués hors production et iCal dispose d'un garde indépendant", () => {
  const files=[
    "check-balance-payments", "check-expired-bookings", "send-arrival-reminder",
    "send-stay-review-request", "retry-failed-emails",
  ];
  for (const name of files) {
    const code=readFileSync(`netlify/functions/${name}.js`, "utf8");
    assert.match(code,/import \{ emailAutomationAllowed, emailAutomationSkippedResponse \}/,name);
    assert.match(code,/export const handler = schedule\([\s\S]*?if \(!emailAutomationAllowed\(\)\) return emailAutomationSkippedResponse\(\);/,name);
  }
  const ical = readFileSync("netlify/functions/check-external-calendar-alerts.js", "utf8");
  assert.match(ical, /const policy = externalCalendarRunPolicy\(\)/);
  assert.match(ical, /if \(!policy\.syncAllowed\)/);
  assert.match(ical, /sendAlertEmails: policy\.alertEmailsAllowed/);
  assert.doesNotMatch(ical, /if \(!emailAutomationAllowed\(\)\)/);
});
