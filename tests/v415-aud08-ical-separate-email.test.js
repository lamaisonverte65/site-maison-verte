import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  externalCalendarRunPolicy,
  missingActionsFromSuccessfulSources,
  collectExternalCalendarFeeds,
  persistExternalOccupancies,
} from "../netlify/functions/_lib/external-calendar-alerts.js";

const live = { CONTEXT: "production", URL: "https://lamaisonverte65.fr" };
const runtime = { URL: "https://lamaisonverte65.fr", LMV_RUNTIME_CONTEXT: "production" };
const preview = { CONTEXT: "deploy-preview", URL: "https://maisonverte-preview.netlify.app" };

test("AUD-08 : production peut synchroniser sans autoriser l'envoi d'emails", () => {
  assert.deepEqual(externalCalendarRunPolicy(live), { syncAllowed: true, alertEmailsAllowed: true });
  assert.deepEqual(externalCalendarRunPolicy({ ...live, LMV_EMAIL_DELIVERY_MODE: "block" }), {
    syncAllowed: true, alertEmailsAllowed: false,
  });
  assert.deepEqual(externalCalendarRunPolicy({ ...live, LMV_EMAIL_DELIVERY_MODE: "allowlist" }), {
    syncAllowed: true, alertEmailsAllowed: false,
  });
  assert.deepEqual(externalCalendarRunPolicy(runtime), { syncAllowed: true, alertEmailsAllowed: true });
});

test("AUD-08 : local, preview, faux domaine et contexte contradictoire ne synchronisent jamais", () => {
  for (const env of [
    {}, preview,
    { ...preview, LMV_EMAIL_DELIVERY_MODE: "live" },
    { CONTEXT: "production", URL: "https://essai.netlify.app" },
    { ...runtime, CONTEXT: "deploy-preview" },
    { URL: "https://lamaisonverte65.fr" },
    { CONTEXT: "production", URL: "http://lamaisonverte65.fr" },
  ]) {
    assert.deepEqual(externalCalendarRunPolicy(env), { syncAllowed: false, alertEmailsAllowed: false });
  }
});

test("AUD-08 : une source indisponible ne peut provoquer une fausse alerte de réservation disparue", () => {
  const actions = [
    { id: 1, source: "booking", uid: "uid-deja-present" },
    { id: 2, source: "booking", uid: "uid-disparu" },
    { id: 3, source: "airbnb", uid: "uid-airbnb" },
    { id: 4, source: "booking", uid: "uid-alerte", alert_status: "missing_alerted" },
    { id: 5, source: "booking", uid: "" },
  ];
  const current = {
    uids: new Set(["booking\u0000uid-deja-present"]),
    successfulSources: ["booking"],
  };
  assert.deepEqual(missingActionsFromSuccessfulSources(actions, current).map((row) => row.id), [2]);
  assert.deepEqual(missingActionsFromSuccessfulSources(actions, { uids: new Set(), successfulSources: [] }), []);
});

test("AUD-08 : retour d'une source réactive seulement les contrôles de cette source", () => {
  const actions = [
    { source: "airbnb", uid: "u1" },
    { source: "booking", uid: "u2" },
  ];
  assert.deepEqual(missingActionsFromSuccessfulSources(actions, {
    uids: new Set(["booking\u0000u2"]), successfulSources: ["AIRBNB", "booking"],
  }), [actions[0]]);
});

test("AUD-08 : panne Airbnb conserve ses occupations sans réconciliation ni disparition", async () => {
  const fetched = await collectExternalCalendarFeeds([
    { source: "booking", url: "booking.test" },
    { source: "airbnb", url: "airbnb.test" },
  ], async (url) => {
    if (url === "airbnb.test") throw new Error("ICS unavailable");
    return { a: { type: "VEVENT", uid: "book1", start: "2026-11-01", end: "2026-11-05" } };
  }, (v) => v.slice(0, 10));
  const calls = [];
  await persistExternalOccupancies({
    async upsertOccupancies(rows) { calls.push(["upsert", rows[0].source]); },
    async retireUnseenOccupancies(source) { calls.push(["retire", source]); },
  }, fetched.occupations, "2026-10-28T13:00:00.000Z", fetched.successfulSources);
  assert.deepEqual(calls, [["upsert", "booking"], ["retire", "booking"]]);
  assert.deepEqual(missingActionsFromSuccessfulSources([{ source: "airbnb", uid: "u" }], fetched), []);
});

test("AUD-08 : le cron découple la mise à jour iCal et les alertes, sans permettre le traitement en preview", () => {
  const source = readFileSync("netlify/functions/check-external-calendar-alerts.js", "utf8");
  assert.match(source, /if \(!policy\.syncAllowed\)/);
  assert.match(source, /runExternalCalendarAlerts\(\{ sendAlertEmails: policy\.alertEmailsAllowed \}\)/);
  assert.match(source, /if \(!sendAlertEmails\) return \{ claimed: 0, sent: 0/);
  assert.match(source, /if \(!sendAlertEmails\) return \{ checked: 0, missing: 0/);
  assert.match(source, /missingActionsFromSuccessfulSources\(actions, current\)/);
  const saveIndex = source.indexOf("await persistExternalOccupancies(");
  const conflictIndex = source.indexOf("await reconcileSuccessfulExternalSources(");
  assert.ok(saveIndex >= 0 && conflictIndex > saveIndex);
});
