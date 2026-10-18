import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAccountingReconciliation } from '../netlify/functions/_lib/accounting-reconciliation.js';
import { buildAccountingImportHistory } from '../src/utils/accountingImportHistory.js';
import { importExerciseYear } from '../src/utils/accountingImport.js';
import { deriveBookingHistoricalBreakdown } from '../src/utils/externalReservationFinancialImport.js';

const base = (overrides = {}) => ({
  year: 2025, bookings: [], payments: [], refundOperations: [], stripeBalanceTransactions: [],
  externalFinancials: [], accountingEntries: [], invoices: [], creditNotes: [], cleaningIssues: [], additionalCharges: [],
  ...overrides,
});
const ref = 'HMQQBR2SYY';
const airbnb2025 = {
  source: 'airbnb', external_reference: ref, payment_date: '2025-12-29',
  traveler_total: null, tourist_tax_amount: 28.8, commission_amount: 14.40,
  payment_fee_amount: null, net_payout: 385.60,
  provenance: { tourist_tax_amount: 'airbnb_statement:taxes_reversees_par_airbnb' },
  raw_snapshot: { airbnb_statement: { confirmation_code: ref, gross: 400, service_fee: -14.40, net: 385.60 } },
};
const entries = [
  { id: 'income', source: 'airbnb', external_reference: ref, entry_date: '2025-12-29', entry_kind: 'income', amount_ttc: 400, source_record_key: `airbnb:reservation:${ref}:gross` },
  { id: 'fee', source: 'airbnb', external_reference: ref, entry_date: '2025-12-29', entry_kind: 'expense', amount_ttc: 14.4, source_record_key: `airbnb:reservation:${ref}:service_fee` },
];

test('2025 Airbnb financial snapshot joins its explicit journal gross exactly once', () => {
  const result = buildAccountingReconciliation(base({externalFinancials:[airbnb2025],accountingEntries:entries}));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].accountingStatus, 'coherent');
  assert.deepEqual(new Set(result.rows[0].accountingEntryIds), new Set(['income', 'fee']));
  assert.equal(result.rows[0].grossKnownCents, 40000);
  assert.equal(result.accountingSummary.receiptsCents, 40000);
  assert.equal(result.accountingSummary.economicNetCents, 38560);
  assert.equal(result.rows[0].fiscalStatus, 'a_verifier');
  assert.equal(result.rows[0].touristTaxCents, null);
  assert.equal(result.taxSummary.totalGrossAmountCents, 0);
});

test('same Airbnb reference in other year never consumes historical journal entry', () => {
  const result = buildAccountingReconciliation(base({
    year: 2026,
    externalFinancials: [{...airbnb2025,payment_date:'2026-01-03'}],
    accountingEntries: entries,
  }));
  assert.equal(result.rows[0].accountingStatus, 'a_verifier');
  assert.ok(result.rows[0].reasons.includes('accounting_entry_year_mismatch'));
  assert.equal(result.rows[0].accountingEntryIds.length, 0);
});

test('unknown Airbnb statement gross is never inferred from journal, service fees or net', () => {
  const external = {...airbnb2025,raw_snapshot:{}};
  const result = buildAccountingReconciliation(base({externalFinancials:[external],accountingEntries:entries}));
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows.find(row => row.id === `platform:airbnb:${ref}`).grossKnownCents, null);
  assert.equal(result.rows.find(row => row.id === `platform:airbnb:${ref}`).accountingStatus, 'a_verifier');
});

test('journal reference plus overview without payment date is not counted as a fully synchronized financial record', () => {
  const result = buildAccountingImportHistory({ year:2025, entries, batches:[], financialRows:[{
    id:'financial',source:'airbnb',external_reference:ref,start_date:'2025-12-28',payment_date:null,
  }]});
  assert.equal(result.summary.unmatchedIncome, 0);
  assert.equal(result.summary.incomeWithoutDatedRegistry, 1);
  assert.deepEqual(result.incomeWithoutDatedRegistryRows.map(row => row.id), ['income']);
});

test('multi-year transactions explain the blocking rule without writing data', () => {
  assert.throws(() => importExerciseYear([
    { entry_date:'2024-01-01' }, { entry_date:'2025-01-01' }
  ]), /plusieurs exercices \(2024, 2025\)/);
  assert.equal(importExerciseYear([{entry_date:'2025-04-11'}]), 2025);
});

test('import guide cites real formats and distinguishes financial transactions from reservation lists', () => {
  const guide = fs.readFileSync('src/components/admin/AccountingImportGuide.jsx', 'utf8');
  const panel = fs.readFileSync('src/components/admin/DeclarationsPanel.jsx', 'utf8');
  const endpoint = fs.readFileSync('netlify/functions/admin-accounting-reconciliation.js','utf8');
  assert.match(guide,/2025-01-01_to_2025-12-31_statements/);
  assert.match(guide,/reservation_statements_overview/);
  assert.match(guide,/airbnb_01_2025-12_2025/);
  assert.match(guide,/reservations-3.csv/);
  assert.match(panel,/<AccountingImportGuide\s*\/>/);
  assert.match(panel,/activeBatch\?\.file_sha256 === hash \? activeBatch : null/);
  assert.match(endpoint,/EXTERNAL_FIELDS = .*raw_snapshot/);
});


test('Booking source-backed tourist tax cannot be overwritten by a derived remainder', () => {
  const row = { source:'booking', start_date:'2025-04-01', traveler_total:200,
    tourist_tax_amount:12, accommodation_amount:188, cleaning_fee:0,
    provenance:{ tourist_tax_amount:'booking_explicit:tourist_tax' },
    raw_snapshot:{booking_statement:{gross:200},booking_overview:{final_amount:180}},
  };
  const computed = deriveBookingHistoricalBreakdown(row);
  assert.equal(computed.tourist_tax_amount,12);
  assert.equal(computed.provenance.tourist_tax_amount,'booking_explicit:tourist_tax');
  assert.equal(computed.accommodation_amount,188);
});
