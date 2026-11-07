import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("R29 nav has an inline right-hand logout, no CRM or tax tabs and no refresh header", () => {
  const nav = read("src/components/admin/AdminTopBar.jsx");
  assert.match(nav, /<nav[^>]+styles\.tabs/);
  assert.match(nav, /navLogoutButton/);
  assert.doesNotMatch(nav, /label: "CRM"|key: "tourist_tax"|Imprimer le livret|Télécharger la dernière sauvegarde|Mes visites ignorées/);
});
test("R29 keeps CRM options under Clients and tax configuration under Tarifs", () => {
  const admin = read("src/pages/Admin.jsx");
  assert.match(admin, /activeTab === "customers"[\s\S]*<CrmPanel/);
  assert.match(admin, /<PricingAdmin mode="all"/);
  assert.match(read("src/components/PricingAdmin.jsx"), /pricing-tax-details/);
});
test("R29 communication omits scheduled automatic messages and displays human messages", () => {
  const panel = read("src/components/admin/communication/CommunicationPanel.jsx");
  const data = read("src/hooks/useCommunicationData.js");
  assert.doesNotMatch(panel, /EmailHistoryBlock|ScheduledMessagesPanel|MessageTemplatesBlock/);
  assert.match(data, /buildClientItem/);
  assert.match(data, /buildHistoricalOwnerNoteItem/);
  assert.match(data, /envoi non confirmé/);
});
test("R29 tax declaration is server-scoped to website/direct, never platform or admin-personal", () => {
  const tax = read("netlify/functions/admin-tourist-tax-declaration.js");
  assert.match(tax, /source === "website" \|\| source === "direct"/);
  assert.match(tax, /collector !== "platform"/);
  assert.match(tax, /collector === "la_maison_verte"/);
  assert.match(tax, /requiresSourceReview/);
  assert.doesNotMatch(tax, /\.in\("tourist_tax_collector"/);
});


test("R29 archives exclude bookkeeping events from owner messages and track event load errors", () => {
  const hook = read("src/hooks/useCommunicationData.js");
  const loads = read("src/services/adminLoadState.js");
  assert.doesNotMatch(hook, /"booking_refused", "booking_confirmed_manual", "booking_accepted"/);
  assert.match(hook, /const MANUAL_REPLY_EVENTS = new Set\(\["booking_refused", "booking_confirmed_manual"\]\)/);
  assert.match(loads, /communication: \["booking_events"\]/);
});
