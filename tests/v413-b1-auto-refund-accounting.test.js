import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  planDirectRefundAccounting, stripeRefundParisDate, syncConfirmedRefundAccounting,
} from '../netlify/functions/_lib/auto-direct-stripe-refund-accounting.js';
import {buildAccountingReconciliation} from '../netlify/functions/_lib/accounting-reconciliation.js';

const operation = {id:'op-1',booking_request_id:'b-1',status:'succeeded',refunded_amount_cents:2000,completed_at:'2027-01-02T09:00:00Z'};
const payment = {id:'p-1',booking_request_id:'b-1',status:'partially_refunded',currency:'eur',stripe_payment_intent_id:'pi_1'};
const allocation = {id:'a-1',operation_id:'op-1',booking_request_id:'b-1',payment_id:'p-1',
  amount:10,amount_cents:1000,currency:'eur',status:'succeeded',operation_status:'succeeded',
  stripe_refund_id:'re_1',stripe_payment_intent_id:'pi_1'};
const stripeRefund = {id:'re_1',status:'succeeded',created:1798761000,amount:1000,currency:'eur',
  payment_intent:'pi_1',metadata:{refund_operation_id:'op-1',refund_allocation_id:'a-1',payment_id:'p-1'}};
const category = {id:'cat_refund',code:'direct_stripe_refund',entry_kind:'refund'};
const values = (change={}) => ({allocation,operation,payment,stripeRefund,entries:[],category,...change});
const plan = (change={}) => planDirectRefundAccounting(values(change));
const reconciliationInput = (extra={}) => ({year:2027, bookings:[],payments:[],refundOperations:[operation],refundAllocations:[],
  stripeBalanceTransactions:[],externalFinancials:[],accountingEntries:[],invoices:[],creditNotes:[], cleaningIssues:[],additionalCharges:[], ...extra});

// 2026-12-31 23:30 UTC est le 1er janvier 2027 à Paris.
test('date Stripe correspond à Europe/Paris, même au changement d’exercice',()=>{
  assert.equal(stripeRefundParisDate(1798761000),'2027-01-01');
  assert.equal(stripeRefundParisDate(1798761000 - 3600),'2026-12-31');
  assert.equal(stripeRefundParisDate(null),null);
});
test('allocation réellement confirmée -> écriture refund unique avec date financière et clé propre',()=>{
  const result=plan();
  assert.equal(result.outcome,'ready');
  assert.equal(result.entry.entry_kind,'refund');
  assert.equal(result.entry.amount_ttc,10);
  assert.equal(result.entry.entry_date,'2027-01-01');
  assert.equal(result.entry.source_record_key,'direct:refund:a-1');
  assert.equal(result.entry.external_reference,'re_1');
  assert.equal(result.entry.treatment,'to_review');
  assert.equal(result.entry.metadata.payment_id,'p-1');
});
test('aucun enregistrement d’un remboursement partiel encore pending ou Stripe non succeeded',()=>{
  assert.equal(plan({allocation:{...allocation,status:'pending'}}).outcome,'not_confirmed');
  assert.equal(plan({stripeRefund:{...stripeRefund,status:'pending'}}).outcome,'needs_review');
});
test('l’annulation à zéro ne génère pas d’écriture',()=>{
  assert.equal(plan({allocation:{...allocation,amount:0,amount_cents:0},stripeRefund:{...stripeRefund,amount:0}}).outcome,'needs_review');
});
test('bloque montant, devise, lien réservation, paiement intent, identifiant refund et métadonnées incohérents',()=>{
  const variants=[
    {allocation:{...allocation,amount:10,amount_cents:1001}},
    {allocation:{...allocation,currency:'usd'}},
    {payment:{...payment,booking_request_id:'b-else'}},
    {stripeRefund:{...stripeRefund,id:'re_2'}},
    {stripeRefund:{...stripeRefund,payment_intent:'pi_other'}},
    {stripeRefund:{...stripeRefund,metadata:{...stripeRefund.metadata,refund_allocation_id:'a-other'}}},
    {stripeRefund:{...stripeRefund,amount:999}},
    {category:{...category,entry_kind:'expense'}},
    {category:{...category,is_active:false}},
  ];
  for(const variant of variants) assert.equal(plan(variant).outcome,'needs_review',JSON.stringify(variant));
});
test('récupération idempotente : écriture correcte -> déjà enregistré, discordance -> bloqué',()=>{
  const entry = {...plan().entry,id:'e-1'};
  assert.equal(plan({entries:[entry]}).outcome,'already_recorded');
  assert.equal(plan({entries:[{...entry,entry_date:'2026-12-31'}]}).outcome,'needs_review');
  assert.equal(plan({entries:[{...entry,entry_kind:'income'}]}).outcome,'needs_review');
  assert.equal(plan({entries:[{...entry,amount_ttc:10.01}]}).outcome,'needs_review');
});
test('ancienne écriture par opération ou écriture non liée bloque le doublon',()=>{
  const manual={id:'old',booking_request_id:'b-1',entry_date:'2027-01-01',entry_kind:'refund',source:'stripe',
    source_record_key:'direct:refund:op-1',amount_ttc:20};
  assert.equal(plan({entries:[manual]}).outcome,'needs_review');
  assert.equal(plan({entries:[{...manual,source_record_key:null,amount_ttc:10}]}).outcome,'needs_review');
});
test('deux remboursements de même montant le même jour restent indépendants',()=>{
  const prior={...plan().entry,id:'e-1'};
  const secondAllocation={...allocation,id:'a-2',stripe_refund_id:'re_2'};
  const secondRefund={...stripeRefund,id:'re_2',metadata:{...stripeRefund.metadata,refund_allocation_id:'a-2'}};
  assert.equal(plan({allocation:secondAllocation,stripeRefund:secondRefund,entries:[prior]}).outcome,'ready');
});
test('Stripe externe sans allocation locale -> aucun ajout',async()=>{
  const fake = {from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})};
  assert.deepEqual(await syncConfirmedRefundAccounting(fake,{refunds:{retrieve:async()=>{throw new Error('appel interdit');}}},{stripeRefundId:'re_external'}),{outcome:'not_found'});
});
test('l’opération multi-allocations de deux exercices génère une ligne par année, jamais 2 fois le total',()=>{
  const first={...allocation, metadata:{...stripeRefund,created:1798761000-3600}};
  const second={...allocation,id:'a-2',stripe_refund_id:'re_2',metadata:{...stripeRefund,id:'re_2',created:1798761000}};
  const entry1={...plan({stripeRefund:{...stripeRefund,created:1798761000-3600}}).entry,id:'e1',entry_date:'2026-12-31'};
  const entry2={...plan({allocation:{...allocation,id:'a-2',stripe_refund_id:'re_2'},stripeRefund:{...stripeRefund,id:'re_2',metadata:{...stripeRefund.metadata,refund_allocation_id:'a-2'}}}).entry,id:'e2'};
  const data={refundAllocations:[first,second],accountingEntries:[entry1,entry2]};
  const in2027=buildAccountingReconciliation(reconciliationInput({...data,year:2027}));
  const in2026=buildAccountingReconciliation(reconciliationInput({...data,year:2026}));
  assert.deepEqual(in2027.rows.filter(r=>r.type==='refund').map(r=>r.id),['direct-refund:a-2']);
  assert.deepEqual(in2026.rows.filter(r=>r.type==='refund').map(r=>r.id),['direct-refund:a-1']);
  assert.equal(in2027.accountingSummary.refundsCents,1000);
  assert.equal(in2026.accountingSummary.refundsCents,1000);
  assert.equal(in2027.accountingSummary.receiptsCents,0);
});
test('un remboursement Stripe sans horodatage validé reste À vérifier et sans date comptable inventée',()=>{
  const item={...allocation,metadata:{...stripeRefund,created:null}};
  const result=buildAccountingReconciliation(reconciliationInput({refundAllocations:[item]}));
  assert.equal(result.rows[0].financialStatus,'a_verifier');
  assert.ok(result.rows[0].reasons.includes('refund_stripe_evidence_unverified'));
});
test('le site, le webhook et le rattrapage ne déclenchent jamais un nouveau refund Stripe',()=>{
  const paths=['netlify/functions/stripe-webhook.js',
    'netlify/functions/sync-stripe-refund-accounting.js','netlify/functions/_lib/auto-direct-stripe-refund-accounting.js'];
  const text=paths.map(p=>readFileSync(p,'utf8')).join('\n');
  assert.doesNotMatch(text,/stripe\.refunds\.create\(/);
  assert.match(text,/syncRefundOperationAccounting/);
  assert.match(text,/syncConfirmedRefundAccounting/);
  assert.match(text,/schedule\('37 4 \* \* \*'/);
});

function fakeDatabase({existingEntries = [], conflict = false} = {}) {
  const tables = {
    refunds: [allocation], refund_operations: [operation], payments: [payment],
    accounting_categories: [{...category, is_active:true}], accounting_entries: [...existingEntries],
  };
  let inserts = 0;
  const supabase = {from(table) {
    let rows = tables[table] || [];
    return {
      select() {return this;},
      eq(field,value) {rows=rows.filter(x=>x[field]===value);return this;},
      in(field,values) {rows=rows.filter(x=>values.includes(x[field]));return this;},
      maybeSingle() {return Promise.resolve({data:rows[0]||null,error:null});},
      then(resolve,reject) {return Promise.resolve({data:rows,error:null}).then(resolve,reject);},
      insert(items) {
        inserts++;
        if(conflict) return Promise.resolve({data:null,error:{code:'23505',message:'duplicate'}});
        tables[table].push(...items.map((item)=>({...item,id:`entry-${inserts}`})));
        return Promise.resolve({data:items,error:null});
      },
    };
  }};
  return {supabase, tables, get inserts() {return inserts;}};
}

test('synchronisation Supabase crée une écriture, puis webhook rejoué reste idempotent',async()=>{
  const db=fakeDatabase();
  const stripe={refunds:{retrieve:async(id)=>{assert.equal(id,'re_1');return stripeRefund;}}};
  assert.deepEqual(await syncConfirmedRefundAccounting(db.supabase,stripe,{allocationId:'a-1'}),{outcome:'created',created:1});
  assert.deepEqual(await syncConfirmedRefundAccounting(db.supabase,stripe,{stripeRefundId:'re_1'}),{outcome:'already_recorded',created:0});
  assert.equal(db.inserts,1);
});
test('contrainte unique protège la concurrence sans seconde insertion réussie',async()=>{
  const db=fakeDatabase({conflict:true});
  const stripe={refunds:{retrieve:async()=>stripeRefund}};
  assert.deepEqual(await syncConfirmedRefundAccounting(db.supabase,stripe,{allocationId:'a-1'}),{outcome:'concurrent_write',created:0});
  assert.equal(db.tables.accounting_entries.length,0);
});
test('allocation locale non confirmée ne sollicite jamais Stripe',async()=>{
  const db=fakeDatabase();db.tables.refunds[0]={...allocation,status:'pending'};
  const stripe={refunds:{retrieve:async()=>{throw new Error('Appel interdit')}}};
  assert.equal((await syncConfirmedRefundAccounting(db.supabase,stripe,{allocationId:'a-1'})).outcome,'not_confirmed');
  assert.equal(db.inserts,0);
});
