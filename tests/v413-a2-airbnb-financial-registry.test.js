import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function loadAccountingImport() {
  let accountingSource = read("src/utils/accountingImport.js");
  const statementSource = read("src/utils/bookingStatementImport.js");
  const overviewSource = read("src/utils/bookingOverviewImport.js");
  const statementUrl = dataUrl(statementSource);
  const overviewExecutable = overviewSource.replace(
    /import \{ matchBookingStatementReservations, parseCsvRows, repairBookingText \} from "\.\/bookingStatementImport\.js";/,
    `import { matchBookingStatementReservations, parseCsvRows, repairBookingText } from "${statementUrl}";`,
  );
  const overviewUrl = dataUrl(overviewExecutable);
  accountingSource = accountingSource
    .replace(
      /import \{ parseCsvRows, repairBookingText \} from "\.\/bookingStatementImport\.js";/,
      `import { parseCsvRows, repairBookingText } from "${statementUrl}";`,
    )
    .replace(
      /import \{ isBookingOverviewHeaders \} from "\.\/bookingOverviewImport\.js";/,
      `import { isBookingOverviewHeaders } from "${overviewUrl}";`,
    );
  return import(dataUrl(accountingSource));
}

async function loadExternalFinancials() {
  return import(dataUrl(read("src/utils/externalReservationFinancialImport.js")));
}

const statementCsv = [
  "Date,Arrivée au plus tard le,Type,Code de confirmation,Date de réservation,Date de début,Date de fin,Nuits,Voyageur,Logement,Détails,Code de référence,Devise,Montant,Versé,Frais de service,Frais de Versement sur carte bancaire,Frais de ménage,Revenus bruts,Taxes reversées par Airbnb,Année des revenus",
  '12/29/2025,01/05/2026,Payout,,,,,,,,"Transfert",G-PAYOUT,EUR,,385.60,,,,,,',
  '12/29/2025,,Réservation,HMQQBR2SYY,09/23/2025,12/28/2025,01/02/2026,5,Armelle,La Maison Verte,,,EUR,385.60,,14.40,,0.00,400.00,"28,80",2025',
  '05/30/2025,,Réservation,HMFEE123,05/17/2025,05/28/2025,05/30/2025,2,Muriel,La Maison Verte,,,EUR,150.00,,5.00,1.25,35.00,190.00,"11,52",2025',
].join("\n");

const reservationsCsv = [
  '"Code de confirmation","Statut","Nom du voyageur","Contact","# des adultes","# des enfants","# des bébés","Date de début","Date de fin","# des nuits","Réservée","Annonce","Revenus"',
  '"HMQQBR2SYY","Ancien voyageur","Armelle Dellangelo","","4","0","0","28/12/2025","02/01/2026","5","2025-09-23","La Maison Verte","385,60 €"',
].join("\n");

test("V4.13 A2 parses explicit Airbnb cleaning and preserves blank payout fee as NULL", async () => {
  const { parseAirbnbStatement } = await loadAccountingImport();
  const parsed = parseAirbnbStatement(statementCsv);
  assert.equal(parsed.items[0].bookedOn, "2025-09-23");
  assert.equal(parsed.items[0].arrivalDate, "2025-12-28");
  assert.equal(parsed.items[0].checkoutDate, "2026-01-02");
  assert.equal(parsed.items[0].paymentDate, "2025-12-29");
  assert.equal(parsed.payments[0].paymentDate, "2025-12-29");
  assert.equal(parsed.items[0].nights, 5);
  assert.equal(parsed.items[0].cleaningFee, 0);
  assert.equal(parsed.items[0].paymentFee, null);
  assert.equal(parsed.items[0].taxRemitted, 28.8);
  assert.equal(parsed.items[1].cleaningFee, 35);
  assert.equal(parsed.items[1].paymentFee, 1.25);
});

test("V4.13 A2 recognizes Airbnb reservations export and keeps occupancy detail", async () => {
  const { detectAccountingImportFormat, parseAirbnbReservations } = await loadAccountingImport();
  assert.equal(detectAccountingImportFormat(reservationsCsv), "airbnb_reservations");
  const parsed = parseAirbnbReservations(reservationsCsv);
  assert.equal(parsed.items[0].confirmationCode, "HMQQBR2SYY");
  assert.equal(parsed.items[0].adults, 4);
  assert.equal(parsed.items[0].children, 0);
  assert.equal(parsed.items[0].babies, 0);
  assert.equal(parsed.items[0].persons, 4);
  assert.equal(parsed.items[0].arrivalDate, "2025-12-28");
  assert.equal(parsed.items[0].checkoutDate, "2026-01-02");
  assert.equal(parsed.items[0].bookedOn, "2025-09-23");
  assert.equal(parsed.items[0].nights, 5);
  assert.equal(parsed.items[0].revenue, 385.6);
});

test("V4.13 A2 statement populates proven Airbnb components only", async () => {
  const accounting = await loadAccountingImport();
  const financial = await loadExternalFinancials();
  const row = financial.airbnbStatementToFinancialRows(accounting.parseAirbnbStatement(statementCsv))
    .find((item) => item.external_reference === "HMQQBR2SYY");
  assert.equal(row.cleaning_fee, 0);
  assert.equal(row.tourist_tax_amount, 28.8);
  assert.equal(row.commission_amount, 14.4);
  assert.equal(row.payment_fee_amount, null);
  assert.equal(row.net_payout, 385.6);
  assert.equal(row.traveler_total, null);
  assert.equal(row.accommodation_amount, null);
  assert.equal(row.raw_snapshot.airbnb_statement.gross, 400);
});

test("V4.13 A2 reservations merge occupancy without overriding statement finance", async () => {
  const accounting = await loadAccountingImport();
  const financial = await loadExternalFinancials();
  const statementRow = financial.airbnbStatementToFinancialRows(accounting.parseAirbnbStatement(statementCsv))[0];
  const reservationsRow = financial.airbnbReservationsToFinancialRows(accounting.parseAirbnbReservations(reservationsCsv))[0];
  const merged = financial.mergeExternalFinancialRow(statementRow, reservationsRow);
  assert.equal(merged.adults_count, 4);
  assert.equal(merged.children_count, 0);
  assert.equal(merged.nights, 5);
  assert.equal(merged.cleaning_fee, 0);
  assert.equal(merged.tourist_tax_amount, 28.8);
  assert.equal(merged.net_payout, 385.6);
  assert.equal(merged.raw_snapshot.airbnb_statement.gross, 400);
  assert.equal(merged.raw_snapshot.airbnb_reservations.revenue, 385.6);
});

test("V4.13 A2 creates an accounting payment-fee expense only when explicitly present", async () => {
  const { parseAirbnbStatement, airbnbStatementToEntries } = await loadAccountingImport();
  const entries = airbnbStatementToEntries(parseAirbnbStatement(statementCsv), [
    { code: "rental_airbnb", id: "income" },
    { code: "platform_fees", id: "platform" },
    { code: "payment_fees", id: "payment" },
  ]);
  assert.equal(entries.some((entry) => entry.source_record_key === "airbnb:reservation:HMQQBR2SYY:payment_fee"), false);
  const payment = entries.find((entry) => entry.source_record_key === "airbnb:reservation:HMFEE123:payment_fee");
  assert.ok(payment);
  assert.equal(payment.entry_kind, "expense");
  assert.equal(payment.category_id, "payment");
  assert.equal(payment.amount_ttc, 1.25);
});

test("V4.13 A2 preserves Booking Statement priority", async () => {
  const financial = await loadExternalFinancials();
  const statement = financial.bookingStatementToFinancialRows({ items: [{
    kind: "reservation", reservationNumber: "5035284402", matchedBookingRequestId: null, currency: "EUR",
    arrivalDate: "2026-08-15", checkoutDate: "2026-08-23", gross: 667.66, commission: -94,
    paymentFee: -9.35, net: 564.31, paymentDate: "2026-08-27", paymentId: "PAY", line: 2,
  }]})[0];
  const overview = financial.bookingOverviewToFinancialRows({ items: [{
    reservationNumber: "5035284402", currency: "EUR", arrivalDate: "2026-08-15", checkoutDate: "2026-08-23",
    nights: 8, persons: 2, rooms: 1, originalAmount: 626.64, finalAmount: 626.64,
    commissionAmount: 90, paymentFee: 7, line: 2,
  }]})[0];
  const merged = financial.mergeExternalFinancialRow(statement, overview);
  assert.equal(merged.commission_amount, 94);
  assert.equal(merged.payment_fee_amount, 9.35);
  assert.equal(merged.net_payout, 564.31);
  assert.equal(merged.traveler_total, 667.66);
});

test("V4.13 A2 admin import synchronizes both Airbnb files into platform finance", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  const service = read("src/services/accountingService.js");
  assert.match(panel, /parseAirbnbReservations/);
  assert.match(panel, /airbnbReservationsToFinancialRows/);
  assert.match(panel, /airbnbStatementToFinancialRows/);
  assert.match(panel, /Airbnb Réservations/);
  assert.match(panel, /saveExternalReservationFinancials\(supabase, bookingPreview\.financialRows\)/);
  assert.match(panel, />Ménage<\/th>/);
  assert.match(panel, />Taxe Airbnb<\/th>/);
  assert.match(panel, /item\.cleaningFee == null \? "—" : money\(item\.cleaningFee\)/);
  assert.match(panel, /item\.taxRemitted == null \? "—" : money\(item\.taxRemitted\)/);
  assert.match(panel, /item\.paymentFee == null \? "—" : money\(item\.paymentFee\)/);
  assert.match(service, /totals\.paymentFee/);
});
