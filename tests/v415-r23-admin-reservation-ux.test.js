import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getReservationPriceBreakdown } from "../src/utils/reservationPriceBreakdown.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const source = () => read("src/components/admin/ReservationPanel.jsx");

test("R23.1 : attente de paiement direct en vert clair opaque, avec texte foncé", () => {
  const calendar = read("src/components/CalendarAdmin.jsx");
  assert.match(calendar, /accepted:\s*"#86efac"/);
  assert.match(calendar, /const isAwaitingDirectPayment = !isAdminPersonal && !isBooking && !isAirbnb/);
  assert.match(calendar, /textColor: isAwaitingDirectPayment \? "#14532d" : undefined/);
  for (const [name, hex] of [
    ["pending", "#eab308"], ["deposit_paid", "#22c55e"],
    ["fully_paid", "#14532d"], ["booking", "#2563eb"], ["airbnb", "#dc2626"],
  ]) assert.ok(calendar.includes(`${name}: "${hex}"`), name);
  assert.match(calendar, /\["accepted", "deposit_pending", "payment_pending", "awaiting_payment"\]/);
  assert.match(calendar, /updateHalfDayEdge\(info\)/);
});

test("R23 : ventilation exacte issue du snapshot V4.10, ménage inclus dans la base d'acompte", () => {
  const r = { accommodation_net: 400, deposit_basis: 440, tourist_tax_amount: 8.4, contract_total: 448.4 };
  assert.deepEqual(getReservationPriceBreakdown(r), {
    accommodation: 400, cleaning: 40, touristTax: 8.4, total: 448.4,
  });
  assert.deepEqual(getReservationPriceBreakdown({
    accommodation_net: 300.01, deposit_basis: 300.01, tourist_tax_amount: 0, contract_total: 300.01,
  }), { accommodation: 300.01, cleaning: 0, touristTax: 0, total: 300.01 });
});

test("R23 : aucune ventilation inventée pour legacy ou snapshot incohérent", () => {
  const valid = { accommodation_net: 400, deposit_basis: 440, tourist_tax_amount: 8.4, contract_total: 448.4 };
  for (const invalid of [
    {},
    { contract_total: 448.4 },
    { ...valid, accommodation_net: null },
    { ...valid, deposit_basis: 390 },
    { ...valid, contract_total: 449 },
    { ...valid, tourist_tax_amount: -8.4 },
    { ...valid, accommodation_net: "erroné" },
  ]) assert.equal(getReservationPriceBreakdown(invalid), null);
  assert.doesNotMatch(read("src/utils/reservationPriceBreakdown.js"), /pricing_settings|get-pricing|supabase|fetch\(/);
});

test("R23 : prix détaillé présent dans la fiche pour toute demande disposant du snapshot", () => {
  const payment = read("src/components/admin/reservation/PaymentBlock.jsx");
  assert.match(payment, /getReservationPriceBreakdown\(request\)/);
  for (const label of ["Hébergement", "Forfait ménage", "Taxe de séjour", "Total contractuel"]) {
    assert.ok(payment.includes(label), label);
  }
  assert.match(payment, /Ventilation contractuelle indisponible/);
  assert.match(payment, /toPaymentView\(request, amounts\)/);
  assert.match(payment, /<Info label="CA confirmé"/);
});

test("R23 : communication prioritaire et éléments métier inchangés", () => {
  const panel = source();
  const summary = panel.indexOf("<ReservationSummaryBlock");
  const communication = panel.indexOf('aria-label="Communication et messages voyageurs"');
  const customer = panel.indexOf('aria-label="Client et séjour"');
  const finance = panel.indexOf('aria-label="Paiements et facturation"');
  const history = panel.indexOf('aria-label="Historique du dossier"');
  assert.ok(summary >= 0 && summary < communication && communication < customer && customer < finance && finance < history);
  for (const tag of ["GuestLanguagePreference", "ReservationContactLinks", "MessagesBlock", "CommunicationActions", "TimelineBlock", "HistoryBlock"]) {
    assert.equal((panel.match(new RegExp(`<${tag}\\b`, "g")) || []).length, 1, tag);
  }
  for (const tag of ["ReservationActionsBlock", "FinancialActionsBlock", "PostStayCleaningBlock", "AdditionalChargeBlock", "DocumentsBlock", "InvoiceBlock", "EditableReservationForm"]) {
    assert.ok(panel.includes(`<${tag}`), tag);
  }
  assert.match(panel, /ADMIN_PERMISSIONS\.viewCommunication/);
  assert.match(panel, /ADMIN_PERMISSIONS\.manageReservations/);
  assert.match(panel, /ADMIN_PERMISSIONS\.managePayments/);
});

test("R23 : style local limité à la fiche, responsive téléphone et boutons compacts", () => {
  const css = read("src/components/admin/reservation/reservationSheet.css");
  const panel = source();
  assert.match(panel, /className="reservation-sheet"/);
  assert.match(css, /\.reservation-sheet-communication/);
  assert.match(css, /\.reservation-summary-grid/);
  assert.match(css, /\.reservation-price-grid/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /@media \(max-width: 370px\)/);
  assert.match(css, /\.reservation-sheet \.reservation-sheet-group button/);
});
