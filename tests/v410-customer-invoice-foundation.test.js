import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/202610010003_v410_customer_invoice_foundation.sql', 'utf8');

test('B1 crée une infrastructure facture autonome de la comptabilité', () => {
  assert.match(migration, /create table public\.customer_invoices/i);
  assert.match(migration, /create table public\.customer_invoice_counters/i);
  assert.doesNotMatch(migration, /accounting_entry_id/i);
  assert.match(migration, /booking_request_id uuid references public\.booking_requests\(id\).*on delete set null/is);
});

test('B1 accepte direct et plateformes sans imposer booking_request aux plateformes', () => {
  assert.match(migration, /source in \('direct', 'booking', 'airbnb'\)/i);
  assert.match(migration, /source = 'direct' and booking_request_id is not null/i);
  assert.match(migration, /source in \('booking', 'airbnb'\).*external_reference/is);
});

test('B1 sépare brouillon et facture émise avec snapshots', () => {
  for (const field of ['seller_snapshot','customer_snapshot','stay_snapshot','financial_snapshot','payment_snapshot']) {
    assert.match(migration, new RegExp(field + ' jsonb', 'i'));
  }
  assert.match(migration, /status = 'draft'.*invoice_number is null.*issued_at is null/is);
  assert.match(migration, /status = 'issued'.*invoice_number is not null.*issued_at is not null/is);
});

test('B1 attribue le numéro atomiquement et sans MAX plus un', () => {
  assert.match(migration, /admin_issue_customer_invoice/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /on conflict \(invoice_year\) do update/i);
  assert.match(migration, /LMV-%s-%s/i);
  assert.doesNotMatch(migration, /max\s*\(/i);
});

test('B1 protège une facture émise contre modification et suppression', () => {
  assert.match(migration, /protect_issued_customer_invoice/i);
  assert.match(migration, /issued_invoice_immutable/i);
  assert.match(migration, /before update on public\.customer_invoices/i);
  assert.match(migration, /before delete on public\.customer_invoices/i);
});

test('B1 garde les factures owner-only et émission owner-only', () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /customer_invoices_owner_only/i);
  assert.match(migration, /public\.is_v4_owner\(\)/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /revoke all on function public\.admin_issue_customer_invoice\(uuid\) from public, anon/i);
});
