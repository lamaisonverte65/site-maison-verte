import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createManualAccountingEntry, updateManualAccountingEntry, deleteManualAccountingEntry } from '../src/services/accountingService.js';

const migration = fs.readFileSync('supabase/migrations/202610280001_v415_aud12_manual_accounting_atomic.sql', 'utf8');
const source = fs.readFileSync('src/services/accountingService.js', 'utf8');
const base = { entry_kind: 'expense', entry_date: '2026-10-28', label: 'Travaux', amount_ttc: '300', treatment: 'fixed_asset' };

function rpcMock(response = { data: { id: 'entry-1', source: 'manual' }, error: null }) {
  const calls = [];
  return { calls, db: { async rpc(name, args) { calls.push({ name, args }); return response; }, from() { throw new Error('Ecriture multi-requetes interdite'); } } };
}

test('AUD-12 création immobilisation : une seule RPC, sans entrée préalable', async () => {
  const { db, calls } = rpcMock();
  const result = await createManualAccountingEntry(db, { ...base, asset_category: 'Agencements', acquisition_value: '300', depreciation_duration_months: '60' });
  assert.equal(result.id, 'entry-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'save_manual_accounting_entry_atomic');
  assert.equal(calls[0].args.p_id, null);
  assert.equal(calls[0].args.p_entry.source, 'manual');
  assert.equal(calls[0].args.p_entry.treatment, 'fixed_asset');
  assert.equal(calls[0].args.p_asset.asset_category, 'Agencements');
  assert.equal(calls[0].args.p_asset.acquisition_value, 300);
  assert.equal(calls[0].args.p_asset.depreciation_duration_months, 60);
  assert.equal('accounting_entry_id' in calls[0].args.p_asset, false);
});

test('AUD-12 modification immobilisation : une seule RPC', async () => {
  const { db, calls } = rpcMock();
  await updateManualAccountingEntry(db, 'entry-1', { ...base, notes: 'Facture' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.p_id, 'entry-1');
  assert.equal(calls[0].args.p_entry.notes, 'Facture');
  assert.ok(calls[0].args.p_asset);
});

test('AUD-12 passage immobilisation vers charge courante : suppression liée dans la même RPC', async () => {
  const { db, calls } = rpcMock();
  await updateManualAccountingEntry(db, 'entry-1', { ...base, treatment: 'current' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.p_asset, null);
});

test('AUD-12 saisie manuelle ordinaire : une seule RPC sans immobilisation', async () => {
  const { db, calls } = rpcMock();
  await createManualAccountingEntry(db, { ...base, treatment: 'current' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.p_asset, null);
});

test('AUD-12 la validation locale bloque les écritures invalides avant toute RPC', async () => {
  const { db, calls } = rpcMock();
  for (const row of [ { ...base, label: '' }, { ...base, amount_ttc: -1 }, { ...base, amount_ttc: NaN }, { ...base, entry_date: null } ]) {
    await assert.rejects(createManualAccountingEntry(db, row), /obligatoires/);
  }
  assert.equal(calls.length, 0);
});

test('AUD-12 mise à jour sans identifiant refusée', async () => {
  const { db, calls } = rpcMock();
  await assert.rejects(updateManualAccountingEntry(db, null, base), /Identifiant/);
  assert.equal(calls.length, 0);
});

test('AUD-12 une erreur de seconde étape est remontée et aucune compensation JS n’est tentée', async () => {
  const { db, calls } = rpcMock({ data: null, error: { message: 'invalid_fixed_asset' } });
  await assert.rejects(createManualAccountingEntry(db, base), /invalid_fixed_asset/);
  assert.equal(calls.length, 1);
});

test('AUD-12 RPC absente : échec visible, aucun repli dangereux sur deux requêtes', async () => {
  const { db, calls } = rpcMock({ data: null, error: { message: 'Could not find function public.save_manual_accounting_entry_atomic' } });
  await assert.rejects(createManualAccountingEntry(db, base), /Could not find function/);
  assert.equal(calls.length, 1);
});

test('AUD-12 aucun changement dans la suppression existante', () => {
  assert.match(deleteManualAccountingEntry.toString(), /accounting_entries/);
  assert.match(source, /deleteManualAccountingEntry\(supabase, id\)/);
  assert.match(source, /\.eq\("id", id\)\.eq\("source", "manual"\)/);
});

test('AUD-12 fonction SQL unique, droits propriétaire et invoker RLS', () => {
  assert.match(migration, /create function public\.save_manual_accounting_entry_atomic\(/i);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /set search_path\s*=\s*''/i);
  assert.match(migration, /if not coalesce\(public\.is_v4_owner\(\), false\)/i);
  assert.match(migration, /revoke all on function public\.save_manual_accounting_entry_atomic\(uuid, jsonb, jsonb\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.save_manual_accounting_entry_atomic\(uuid, jsonb, jsonb\) to authenticated/i);
  assert.doesNotMatch(migration, /service_role|grant\s+execute\s+to\s+anon/i);
});

test('AUD-12 transaction SQL : ligne + immobilisation, y compris correction et retrait', () => {
  assert.match(migration, /begin;[\s\S]*commit;/i);
  assert.match(migration, /insert into public\.accounting_entries/i);
  assert.match(migration, /update public\.accounting_entries[\s\S]*where id = p_id and source = 'manual'/i);
  assert.match(migration, /insert into public\.accounting_fixed_assets/i);
  assert.match(migration, /on conflict \(accounting_entry_id\) do update/i);
  assert.match(migration, /delete from public\.accounting_fixed_assets/i);
  assert.match(migration, /raise exception 'manual_accounting_entry_not_found'/);
  assert.doesNotMatch(source.slice(source.indexOf('async function saveManualAccountingEntryAtomic'), source.indexOf('export async function deleteManualAccountingEntry')), /\.from\(/);
});

test('AUD-12 les données clients et mouvements automatiques ne sont pas impliqués dans la migration', () => {
  assert.doesNotMatch(migration, /\b(insert into|update|delete from)\s+public\.(booking_requests|payments|stripe_balance_transactions|accounting_import_batches|customers)\b/i);
  assert.match(migration, /where id = p_id and source = 'manual'/);
  assert.match(migration, /'manual'/);
});
