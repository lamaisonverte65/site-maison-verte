import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const foundation = readFileSync(new URL('../supabase/migrations/202609290003_v410_accounting_foundation.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/202610180001_v413_b1_refund_accounting_kind.sql', import.meta.url), 'utf8');

const code = migration.replace(/--[^\n]*/g, '').trim();

for (const [table, original] of [
  ['accounting_entries', 'accounting_entries_entry_kind_check'],
  ['accounting_categories', 'accounting_categories_entry_kind_check'],
]) {
  test(`foundation constrains ${table} to income/expense before phase 2A`, () => {
    assert.match(foundation, new RegExp(`create table public\\.${table}\\s*\\([\\s\\S]*?entry_kind text not null check \\(entry_kind in \\('income', 'expense'\\)\\)`, 'i'));
  });

  test(`${table}: extended check is validated before dropping historical check`, () => {
    const added = code.indexOf(`add constraint ${table}_entry_kind_v413_check`);
    const validated = code.indexOf(`validate constraint ${table}_entry_kind_v413_check`);
    const dropped = code.indexOf(`drop constraint ${original}`);
    assert.ok(added >= 0 && added < validated && validated < dropped);
    assert.match(code.slice(added, validated), /check\s*\(entry_kind in\s*\('income', 'expense', 'refund'\)\)\s*not valid/i);
  });
}

test('migration is transactional and does not rewrite any existing business rows', () => {
  assert.match(code, /^begin\s*;/i);
  assert.match(code, /commit\s*;$/i);
  assert.doesNotMatch(code, /\bupdate\s+|\bdelete\s+from\s+|\btruncate\s+|\bdrop\s+table\s+|\bcreate\s+or\s+replace\s+function\b/i);
  assert.doesNotMatch(code, /\b(public\.)?(payments|refunds|refund_operations|booking_requests|customer_invoices|customer_credit_notes)\b/i);
  assert.match(code, /insert into public\.accounting_categories/i);
});

test('refund category is distinct from income/expense and is seeded idempotently', () => {
  assert.match(code, /values\s*\('refund',\s*'direct_stripe_refund',/i);
  assert.match(code, /on conflict\s*\(entry_kind,\s*code\)\s*do nothing/i);
  assert.match(foundation, /constraint accounting_categories_code_key unique \(entry_kind, code\)/);
});

test('source-record idempotency index, RLS and account permissions remain untouched', () => {
  assert.match(foundation, /create unique index accounting_entries_source_record_unique_idx\s+on public\.accounting_entries\s*\(source, source_record_key\)/i);
  assert.match(foundation, /alter table public\.accounting_entries enable row level security/i);
  assert.doesNotMatch(code, /\b(grant|revoke|create policy|drop policy|alter policy|drop index|create index)\b/i);
  assert.doesNotMatch(code, /\b(source_record_key|source|amount_ttc|entry_date)\b/i);
});
