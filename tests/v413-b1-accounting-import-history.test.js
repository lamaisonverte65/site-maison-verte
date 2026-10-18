import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAccountingImportHistory } from '../src/utils/accountingImportHistory.js';

const income = (id, year, source, ref, batchId = null) => ({id, entry_date: `${year}-05-02`, entry_kind: 'income', source, external_reference: ref, import_batch_id: batchId, amount_ttc: 200});
const expense = (id, year, source, ref, batchId = null) => ({ ...income(id, year, source, ref, batchId), entry_kind: 'expense', amount_ttc: 10});
const registry = (id, source, ref, paymentDate, startDate, extra = {}) => ({id, source, external_reference: ref, payment_date: paymentDate, start_date: startDate, traveler_total: null, tourist_tax_amount: null, ...extra});
const run = (year, entries, financialRows, batches = []) => buildAccountingImportHistory({year,entries,financialRows,batches});

test('financial-only Airbnb 2024 imports are visible without any 2024 journal entry', () => {
  const result = run(2024, [], [registry('a', 'airbnb', 'H2024', null, '2024-06-03')]);
  assert.equal(result.registryRows.length, 1);
  assert.equal(result.registryRows[0].yearBasis, 'stay_without_payment_date');
  assert.equal(result.summary.entries, 0);
  assert.equal(result.summary.withoutPaymentDate, 1);
  assert.equal(result.registryRows[0].journalLinks.length, 0);
});

test('a stay date never changes the cash exercise when payment date is known', () => {
  const rows = [registry('b', 'booking', 'B1', '2025-01-10', '2024-12-25')];
  assert.equal(run(2024, [], rows).registryRows.length, 0);
  assert.equal(run(2025, [], rows).registryRows[0].yearBasis, 'payment');
});

test('dated financial and journal records with the same source and reference link, without summing twice', () => {
  const entries = [income('i', 2025, 'airbnb', 'H100', 'batch'), expense('e', 2025, 'airbnb', 'H100', 'batch')];
  const result = run(2025, entries, [registry('r', 'airbnb', 'H100', '2025-05-03', '2025-05-01', {net_payout: 192.8})]);
  assert.equal(result.registryRows[0].journalLinks.length, 1);
  assert.equal(result.summary.registryRows, 1);
  assert.equal(result.summary.entries, 2);
  assert.equal(result.summary.unmatchedIncome, 0);
});

test('missing Booking registry is identified only by exact source and reference', () => {
  const entries = [income('b', 2025, 'booking', 'B100'), income('a', 2025, 'airbnb', 'B100'), expense('e', 2025, 'booking', 'B100')];
  const result = run(2025, entries, [registry('a', 'airbnb', 'B100', '2025-05-02', '2025-05-01')]);
  assert.deepEqual(result.unmatchedIncomeRows.map(x => x.external_reference), ['B100']);
  assert.equal(result.unmatchedIncomeRows[0].source, 'booking');
});

test('a registry without a payment or stay date is visible but never assigned to an accounting year', () => {
  const result = run(2024, [], [registry('x','booking','U1',null,null)]);
  assert.equal(result.undatedRegistryRows.length, 1);
  assert.equal(result.registryRows.length, 0);
  assert.equal(result.summary.withoutPaymentDate, 0);
});

test('replaced batch is retained in history but not called a live import', () => {
  const batches = [{id: 'old', source:'booking',exercise_year:2025,status:'replaced',original_filename:'old.csv', imported_rows:14}, {id:'current',source:'booking',exercise_year:2025,status:'validated',original_filename:'new.csv',imported_rows:15}];
  const result = run(2025, [income('i',2025,'booking','C1','current')],[],batches);
  assert.equal(result.batches.length,2);
  assert.equal(result.batches.find(x=>x.id==='old').activeEntries,0);
  assert.equal(result.batches.find(x=>x.id==='current').activeEntries,1);
});

test('source filtering applies without losing the annual unmatched state', () => {
  const entries=[income('b',2025,'booking','B1'),income('a',2025,'airbnb','A1')];
  const financialRows=[registry('a','airbnb','A1','2025-05-02','2025-05-01')];
  const result=buildAccountingImportHistory({year:2025,entries,financialRows,batches:[],source:'booking'});
  assert.equal(result.registryRows.length,0);
  assert.equal(result.unmatchedIncomeRows.length,1);
  assert.equal(result.unmatchedIncomeRows[0].external_reference,'B1');
});

test('unknown financial amounts are kept null, never auto-filled by accounting or zero', () => {
  const result=run(2025,[income('a',2025,'airbnb','A1')],[registry('r','airbnb','A1','2025-05-03','2025-05-01')]);
  assert.equal(result.registryRows[0].traveler_total,null);
  assert.equal(result.registryRows[0].tourist_tax_amount,null);
});

test('UI integrates import history in a read-only view and preserves legacy import actions',()=>{
  const panel=fs.readFileSync('src/components/admin/DeclarationsPanel.jsx','utf8');
  const component=fs.readFileSync('src/components/admin/AccountingImportHistory.jsx','utf8');
  assert.match(panel,/subtab === "imports"/);
  assert.match(panel,/AccountingImportHistory/);
  assert.match(panel,/fetchPlatformFinancialRegistry/);
  assert.match(panel,/saveAccountingImportSnapshot/);
  assert.match(panel,/saveExternalReservationFinancials/);
  assert.doesNotMatch(component,/\.insert\(|\.upsert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test('read-only registry loader paginates and propagates SQL errors instead of showing a misleading empty result', async () => {
  const {fetchPlatformFinancialRegistry} = await import('../src/services/accountingImportHistoryService.js');
  let calls = [];
  const server = {
    from: name => {
      assert.equal(name, 'external_reservation_financials');
      return {select: fields => {
        assert.match(fields, /payment_date/);
        return {order: (field, opts) => {
          assert.equal(field,'id');
          assert.equal(opts.ascending,true);
          return {range: async(start,end) => {calls.push([start,end]);return {data: start === 0 ? Array.from({length:500}, (_,i)=>({id:`r${i}`})) : [{id:'last'}],error:null};}};
        }};
      }};
    },
  };
  const result=await fetchPlatformFinancialRegistry(server);
  assert.equal(result.length,501);
  assert.deepEqual(calls,[[0,499],[500,999]]);
  const fail={from:()=>({select:()=>({order:()=>({range:async()=>({data:null,error:{message:'Permission refusée'}})})})})};
  await assert.rejects(fetchPlatformFinancialRegistry(fail),/Permission refusée/);
});

test('import panel distinguishes financial-only confirmation from journal entry creation',()=>{
  const panel=fs.readFileSync('src/components/admin/DeclarationsPanel.jsx','utf8');
  assert.match(panel,/Aucune écriture comptable n'a été créée/);
  assert.match(panel,/setFinancialRegistryVersion/);
  assert.match(panel,/onRefresh/);
});
