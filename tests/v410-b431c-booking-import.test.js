import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (path) => fs.readFileSync(path, "utf8");

test("B4.3.1C Booking parser separates stay dates from payment date", () => {
  const util = read("src/utils/bookingStatementImport.js");
  assert.match(util, /arrivalDate/);
  assert.match(util, /checkoutDate/);
  assert.match(util, /paymentDate/);
  assert.match(util, /entry_date: item\.paymentDate/);
});

test("B4.3.1C Booking import creates gross income and fee entries", () => {
  const util = read("src/utils/bookingStatementImport.js");
  assert.match(util, /rental_booking/);
  assert.match(util, /platform_fees/);
  assert.match(util, /payment_fees/);
  assert.match(util, /operation_group_key/);
  assert.match(util, /booking:payout:/);
});

test("B4.3.1C Booking import is idempotent and handles adjustments", () => {
  const util = read("src/utils/bookingStatementImport.js");
  assert.match(util, /sourceRecordKeys/);
  assert.match(util, /duplicate/);
  assert.match(util, /adjustment: true/);
  const migration = read("supabase/migrations/202609290003_v410_accounting_foundation.sql");
  assert.match(migration, /accounting_entries_source_record_unique_idx/);
});

test("B4.3.1C imports UI has preview and explicit validation", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(panel, /Importer un fichier/);
  assert.match(panel, /Prévisualisation/);
  assert.match(panel, /Valider l'import/);
  assert.match(panel, /Date d'encaissement/);
});

test("B4.3.1C Booking preview prioritizes persisted site reservations and keeps iCal as fallback", () => {
  const util = read("src/utils/bookingStatementImport.js");
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(util, /matchedBookingRequestId/);
  assert.match(util, /matched_persisted/);
  assert.match(util, /matched_calendar/);
  assert.match(panel, /from\("booking_requests"\)/);
  assert.match(panel, /Réservation du site retrouvée/);
  assert.match(panel, /netlify\/functions\/calendar/);
});


test("B4.3.1C exercise selector includes prior years and defaults to current year", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(panel, /new Date\(\)\.getFullYear\(\)/);
  assert.match(panel, /currentYear - 2/);
  assert.match(panel, /year=\{year\}/);
  assert.match(panel, /entry_date/);
});

test("B4.3.1C Booking preview keeps horizontal scrolling inside the panel", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(panel, /maxWidth: "100%"/);
  assert.match(panel, /overflowX: "auto"/);
  assert.match(panel, /minWidth: 0/);
});

test("B4.3.1C explains persisted-reservation matching before iCal fallback", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(panel, /réservations Booking déjà enregistrées dans le site/);
  assert.match(panel, /iCal Booking actuel n’est utilisé qu’en secours/);
});


test("B4.3.1C generalized imports support Airbnb and atomic replacement", () => {
  const util = read("src/utils/accountingImport.js");
  const service = read("src/services/accountingService.js");
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(util, /parseAirbnbStatement/);
  assert.match(util, /tax_remitted_by_airbnb/);
  assert.match(service, /admin_commit_accounting_import_snapshot/);
  assert.match(panel, /Remplacer l.import/);
  assert.match(panel, /Aucune donnée nouvelle/);
});

test("B4.3.1C manual receipt is platform agnostic and treatment labels are explicit", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(panel, /Encaissement manuel/);
  assert.match(panel, /Clévacances/);
  assert.match(panel, /Recette courante/);
  assert.match(panel, /Charge courante/);
});


test("B4.3.1C Booking format detection repairs real mojibake headers", () => {
  const util = read("src/utils/accountingImport.js");
  assert.match(util, /repairBookingText/);
  assert.match(util, /numero de reservation/);
  assert.match(util, /identifiant du paiement/);
});


test("B4.3.1C Booking entries propagate persisted booking_request_id to the RPC payload", async () => {
  const utilSource = read("src/utils/bookingStatementImport.js");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(utilSource).toString("base64")}`;
  const { bookingStatementToEntries } = await import(moduleUrl);
  const bookingRequestId = "fa7f8d2b-a7f0-451e-bf66-9a291720dd69";
  const statement = {
    items: [{
      kind: "reservation",
      duplicate: false,
      type: "Réservation",
      reservationNumber: "5035284402",
      arrivalDate: "2026-08-15",
      checkoutDate: "2026-08-23",
      guestName: "Anne Le Noach",
      paymentDate: "2026-08-27",
      paymentId: "X2LBzHB7HCvznxuM",
      gross: 667.66,
      commission: -94,
      paymentFee: -9.35,
      net: 564.31,
      matchedExternalUid: null,
      matchedBookingRequestId: bookingRequestId,
      matchStatus: "matched_persisted",
    }],
  };
  const categories = [
    { code: "rental_booking", id: "11111111-1111-1111-1111-111111111111" },
    { code: "platform_fees", id: "22222222-2222-2222-2222-222222222222" },
    { code: "payment_fees", id: "33333333-3333-3333-3333-333333333333" },
  ];

  const entries = bookingStatementToEntries(statement, categories);
  assert.equal(entries.length, 3);
  for (const entry of entries) {
    assert.equal(entry.booking_request_id, bookingRequestId);
    assert.equal(entry.metadata.booking_request_id, bookingRequestId);
  }
});


test("B4.2a Booking Overview is a deterministic recognized format", async () => {
  let accountingSource = read("src/utils/accountingImport.js");
  const overviewSource = read("src/utils/bookingOverviewImport.js");
  const statementSource = read("src/utils/bookingStatementImport.js");
  const statementUrl = `data:text/javascript;base64,${Buffer.from(statementSource).toString("base64")}`;
  const overviewExecutable = overviewSource.replace(
    /import \{ matchBookingStatementReservations, parseCsvRows, repairBookingText \} from "\.\/bookingStatementImport\.js";/,
    `import { matchBookingStatementReservations, parseCsvRows, repairBookingText } from "${statementUrl}";`
  );
  const overviewUrl = `data:text/javascript;base64,${Buffer.from(overviewExecutable).toString("base64")}`;
  accountingSource = accountingSource
    .replace(
      /import \{ parseCsvRows, repairBookingText \} from "\.\/bookingStatementImport\.js";/,
      `import { parseCsvRows, repairBookingText } from "${statementUrl}";`
    )
    .replace(
      /import \{ isBookingOverviewHeaders \} from "\.\/bookingOverviewImport\.js";/,
      `import { isBookingOverviewHeaders } from "${overviewUrl}";`
    );
  const accountingUrl = `data:text/javascript;base64,${Buffer.from(accountingSource).toString("base64")}`;
  const { detectAccountingImportFormat } = await import(accountingUrl);
  const overview = await import(overviewUrl);
  const sample = [
    '"Reservation number","Invoice number","Booked on","Arrival","Departure","Booker name","Guest name","Rooms","Persons","Room nights","Commission %","Original amount","Final amount","Commission amount","Payment fee","Status","Guest request","Currency","Hotel id","Property name","City","Country"',
    '"5035284402","1662881627","2026-06-19T17:21:54","2026-08-15","2026-08-23","LE NOACH Anne","LE NOACH Anne","1","2","8","15.00","626.640","626.6400","94.0000","9.35","OK","","EUR","11942320","La Maison Verte","Arreau","France"',
  ].join("\n");

  assert.equal(detectAccountingImportFormat(sample), "booking_overview");
  const parsed = overview.parseBookingOverview(sample);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].reservationNumber, "5035284402");
  assert.equal(parsed.items[0].persons, 2);
  assert.equal(parsed.items[0].nights, 8);
  assert.equal(parsed.items[0].finalAmount, 626.64);
  assert.equal(parsed.items[0].commissionAmount, 94);
  assert.equal(parsed.items[0].paymentFee, 9.35);
});

test("B4.2a Booking Overview preserves source semantics without inventing tax or cleaning", () => {
  const util = read("src/utils/bookingOverviewImport.js");
  assert.match(util, /originalAmount/);
  assert.match(util, /finalAmount/);
  assert.doesNotMatch(util, /touristTaxAmount/);
  assert.doesNotMatch(util, /cleaningFee/);
  assert.doesNotMatch(util, /travelerTotal/);
});


test("B4.2a-7 merges Statement and Overview and derives the confirmed historical breakdown", async () => {
  const utilSource = read("src/utils/externalReservationFinancialImport.js");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(utilSource).toString("base64")}`;
  const { bookingStatementToFinancialRows, bookingOverviewToFinancialRows, mergeExternalFinancialRow } = await import(moduleUrl);
  const bookingRequestId = "fa7f8d2b-a7f0-451e-bf66-9a291720dd69";

  const statementRows = bookingStatementToFinancialRows({ items: [{
    kind: "reservation", reservationNumber: "5035284402",
    matchedBookingRequestId: bookingRequestId, currency: "EUR",
    arrivalDate: "2026-08-15", checkoutDate: "2026-08-23",
    gross: 667.66, commission: -94, paymentFee: -9.35, net: 564.31,
    paymentDate: "2026-08-27", paymentId: "X2LBzHB7HCvznxuM",
    line: 2, type: "Réservation", guestName: "Anne Le Noach",
  }]});
  const overviewRows = bookingOverviewToFinancialRows({ items: [{
    reservationNumber: "5035284402", matchedBookingRequestId: bookingRequestId,
    currency: "EUR", arrivalDate: "2026-08-15", checkoutDate: "2026-08-23",
    nights: 8, persons: 2, rooms: 1, originalAmount: 626.64, finalAmount: 626.64,
    commissionAmount: 94, paymentFee: 9.35, line: 2,
  }]});

  const merged = mergeExternalFinancialRow(statementRows[0], overviewRows[0]);
  assert.equal(merged.booking_request_id, bookingRequestId);
  assert.equal(merged.traveler_total, 667.66);
  assert.equal(merged.commission_amount, 94);
  assert.equal(merged.payment_fee_amount, 9.35);
  assert.equal(merged.net_payout, 564.31);
  assert.equal(merged.nights, 8);
  assert.equal(merged.accommodation_amount, 626.64);
  assert.equal(merged.cleaning_fee, 0);
  assert.equal(merged.tourist_tax_amount, 41.02);
  assert.equal(merged.raw_snapshot.booking_statement.gross, 667.66);
  assert.equal(merged.raw_snapshot.booking_overview.final_amount, 626.64);
});

test("B4.2a-4 Overview stays outside the accounting snapshot pipeline", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(panel, /externalFinancialOnly/);
  assert.match(panel, /saveExternalReservationFinancials/);
  assert.match(panel, /ne créent aucune écriture comptable/);
  assert.match(panel, /bookingStatementToFinancialRows/);
});


test("B4.2a-5 identical Booking Statement still synchronizes platform finance without replacing accounting", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(panel, /accountingAlreadyCurrent = Boolean\(bookingPreview\.sameFile\)/);
  assert.match(panel, /Synchroniser uniquement le registre financier plateforme/);
  assert.match(panel, /if \(!accountingAlreadyCurrent\) \{\s*await saveAccountingImportSnapshot/s);
  assert.match(panel, /Registre financier Booking synchronisé ; comptabilité inchangée/);
  assert.match(panel, /preview\.sameFile && preview\.source === "booking" \? "Synchroniser le registre financier"/);
});

test("B4.2a-5 newer cumulative Booking Statement keeps finance sync plus atomic accounting replacement", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  const financeCall = panel.indexOf("await saveExternalReservationFinancials(supabase, bookingStatementToFinancialRows(bookingPreview.statement))");
  const accountingCall = panel.indexOf("await saveAccountingImportSnapshot(supabase, { ...bookingPreview");
  assert.ok(financeCall >= 0);
  assert.ok(accountingCall > financeCall);
  assert.match(panel, /const replacing = Boolean\(bookingPreview\.activeBatch\)/);
});

test("B4.2a-5 Overview remains reimportable through idempotent source-reference upsert", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  const service = read("src/services/accountingService.js");
  assert.match(panel, /await saveExternalReservationFinancials\(supabase, bookingPreview\.financialRows\)/);
  assert.match(service, /\.upsert\(merged, \{ onConflict: "source,external_reference" \}\)/);
  assert.match(service, /mergeExternalFinancialRow\(existing, row\)/);
});

test("B4.2a-7 derives the confirmed historical Booking breakdown without hard-coded tax/VAT rates", async () => {
  const source = read("src/utils/externalReservationFinancialImport.js");
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const { deriveBookingHistoricalBreakdown, buildBookingInvoiceCandidate } = await import(url);
  const anne = deriveBookingHistoricalBreakdown({
    source: "booking", external_reference: "5035284402", booking_request_id: "fa7f8d2b-a7f0-451e-bf66-9a291720dd69",
    start_date: "2026-08-15", traveler_total: 667.66,
    accommodation_amount: null, cleaning_fee: null, tourist_tax_amount: null,
    provenance: { traveler_total: "booking_statement:montant" },
    raw_snapshot: {
      booking_overview: { final_amount: 626.64 },
      booking_statement: { gross: 667.66 },
    },
  });
  assert.equal(anne.accommodation_amount, 626.64);
  assert.equal(anne.cleaning_fee, 0);
  assert.equal(anne.tourist_tax_amount, 41.02);
  assert.match(anne.provenance.cleaning_fee, /^business_rule:/);
  assert.equal(anne.provenance.accommodation_amount, "derived:booking_overview:final_amount");
  assert.doesNotMatch(source, /\/\s*1\.10|0\.072|7\.2\s*\/\s*100/);

  const candidate = buildBookingInvoiceCandidate(anne);
  assert.equal(candidate.ready, true);
  assert.equal(candidate.total_amount, 667.66);
  assert.deepEqual(candidate.financial_snapshot, {
    accommodation_net: 626.64, cleaning_fee: 0, tourist_tax_amount: 41.02,
    contract_total: 667.66, invoice_ready: true, draft_origin: "booking_external_financial_registry",
  });
});

test("B4.2a-7 does not assume zero cleaning for future Booking stays", async () => {
  const source = read("src/utils/externalReservationFinancialImport.js");
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const { deriveBookingHistoricalBreakdown, buildBookingInvoiceCandidate } = await import(url);
  const future = deriveBookingHistoricalBreakdown({
    source: "booking", external_reference: "future", start_date: "2026-09-15", traveler_total: 700,
    accommodation_amount: null, cleaning_fee: null, tourist_tax_amount: null, provenance: {},
    raw_snapshot: { booking_overview: { final_amount: 650 }, booking_statement: { gross: 700 } },
  });
  assert.equal(future.accommodation_amount, null);
  assert.equal(future.cleaning_fee, null);
  assert.equal(future.tourist_tax_amount, null);
  assert.equal(buildBookingInvoiceCandidate(future).ready, false);
});

test("B4.2a-7 Statement financial values keep precedence if Overview is reimported later", async () => {
  const source = read("src/utils/externalReservationFinancialImport.js");
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const { mergeExternalFinancialRow } = await import(url);
  const existing = {
    source: "booking", external_reference: "6782419743", start_date: "2026-08-10",
    commission_amount: 71.15, payment_fee_amount: 8,
    provenance: { commission_amount: "booking_statement:commission", payment_fee_amount: "booking_statement:frais_service_paiement" },
    raw_snapshot: { booking_statement: { gross: 500 } },
  };
  const overview = {
    source: "booking", external_reference: "6782419743", start_date: "2026-08-10",
    commission_amount: 71.14, payment_fee_amount: 8,
    provenance: { commission_amount: "booking_overview:commission_amount", payment_fee_amount: "booking_overview:payment_fee" },
    raw_snapshot: { booking_overview: { final_amount: 470 } },
  };
  const merged = mergeExternalFinancialRow(existing, overview);
  assert.equal(merged.commission_amount, 71.15);
  assert.equal(merged.provenance.commission_amount, "booking_statement:commission");
});

test("B4.2a-7 identical Booking Statement UI describes finance-only synchronization", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(panel, /Lignes à synchroniser/);
  assert.match(panel, /Registre financier uniquement/);
  assert.match(panel, /Remplacement comptable \+ synchronisation/);
});
