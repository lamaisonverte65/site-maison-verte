import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const endpointPath = 'netlify/functions/admin-accounting-reconciliation.js';
const source = fs.existsSync(endpointPath) ? fs.readFileSync(endpointPath, 'utf8') : '';

test('annual reconciliation endpoint exists', () => {
  assert.ok(fs.existsSync(endpointPath));
});

test('annual reconciliation endpoint is GET-only, owner-only, and validates one income year', () => {
  assert.match(source, /event\.httpMethod !== ["']GET["']/);
  assert.match(source, /authorizeAdminRequest\(event,\s*supabase,\s*\{\s*ownerOnly:\s*true\s*\}\)/);
  assert.match(source, /validYear\(year\)/);
  assert.match(source, /yearStart/);
  assert.match(source, /nextYearStart/);
});

test('endpoint delegates calculation to the pure reconciliation engine', () => {
  assert.match(source, /buildAccountingReconciliation/);
  assert.match(source, /buildAccountingReconciliation\(\{[\s\S]*year,[\s\S]*bookings,[\s\S]*payments,[\s\S]*refundOperations,[\s\S]*stripeBalanceTransactions,[\s\S]*externalFinancials,[\s\S]*accountingEntries:\s*accountingContext,[\s\S]*invoices,[\s\S]*creditNotes,[\s\S]*cleaningIssues,[\s\S]*additionalCharges/);
});

test('year-bearing source queries are bounded to the requested exercise', () => {
  assert.match(source, /from\(["']payments["']\)[\s\S]*paid_at[\s\S]*created_at/);
  assert.match(source, /from\(["']refund_operations["']\)[\s\S]*completed_at[\s\S]*updated_at[\s\S]*created_at/);
  assert.match(source, /from\(["']external_reservation_financials["']\)[\s\S]*\.gte\(["']payment_date["'],\s*yearStart\)[\s\S]*\.lt\(["']payment_date["'],\s*nextYearStart\)/);
  assert.match(source, /from\(["']accounting_entries["']\)[\s\S]*\.gte\(["']entry_date["'],\s*yearStart\)[\s\S]*\.lt\(["']entry_date["'],\s*nextYearStart\)/);
});

test('linked cross-year movements are loaded only for bookings anchored in the requested year', () => {
  assert.match(source, /const bookingIds = unique/);
  assert.match(source, /from\(["']payments["']\)[\s\S]*\.in\(["']booking_request_id["'],\s*bookingIds\)/);
  assert.match(source, /from\(["']refund_operations["']\)[\s\S]*\.in\(["']booking_request_id["'],\s*bookingIds\)/);
});

test('endpoint loads linked documents and Stripe/accounting context without N+1 loops', () => {
  assert.match(source, /Promise\.all\(/);
  assert.match(source, /from\(["']stripe_balance_transactions["']\)/);
  assert.match(source, /from\(["']customer_invoices["']\)/);
  assert.match(source, /from\(["']customer_credit_notes["']\)/);
  assert.match(source, /from\(["']booking_cleaning_issues["']\)/);
  assert.match(source, /from\(["']booking_additional_charges["']\)/);
  assert.doesNotMatch(source, /for\s*\([^)]*\)\s*\{[\s\S]{0,500}?supabase\.from/);
});

test('endpoint is read-only and does not invoke write RPCs', () => {
  assert.doesNotMatch(source, /\.insert\s*\(/);
  assert.doesNotMatch(source, /\.update\s*\(/);
  assert.doesNotMatch(source, /\.upsert\s*\(/);
  assert.doesNotMatch(source, /\.delete\s*\(/);
  assert.doesNotMatch(source, /\.rpc\s*\(/);
});

test('response exposes one generated annual snapshot with no-store caching', () => {
  assert.match(source, /Cache-Control/);
  assert.match(source, /no-store/);
  assert.match(source, /generatedAt/);
  assert.match(source, /rows/);
  assert.match(source, /accountingSummary/);
  assert.match(source, /taxSummary/);
});
