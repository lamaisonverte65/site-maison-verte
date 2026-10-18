import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {
  verifyDelayedRefundProof, reconcileDelayedStripeRefund, reconcilePendingStripeRefunds,
} from '../netlify/functions/_lib/reconcile-delayed-stripe-refund.js';
import {stripeRefundParisDate} from '../netlify/functions/_lib/auto-direct-stripe-refund-accounting.js';
import {buildAccountingReconciliation} from '../netlify/functions/_lib/accounting-reconciliation.js';

const a = {id:'a-1',operation_id:'op-1',booking_request_id:'b-1',payment_id:'p-1',
  amount:10,amount_cents:1000,currency:'eur',status:'pending',operation_status:'needs_reconciliation',
  stripe_refund_id:'re_1',stripe_payment_intent_id:'pi_1'};
const op = {id:'op-1',booking_request_id:'b-1',status:'needs_reconciliation',refunded_amount_cents:0,created_at:'2026-12-01'};
const pay = {id:'p-1',booking_request_id:'b-1',status:'paid',currency:'eur',stripe_payment_intent_id:'pi_1'};
const proof = {id:'re_1',status:'succeeded',created:1798761000,amount:1000,currency:'eur',payment_intent:'pi_1',
  metadata:{refund_allocation_id:'a-1',refund_operation_id:'op-1',payment_id:'p-1'}};

function fakeDb({allocation={...a},operation={...op},payment={...pay},stripeRefund=proof}={}) {
  const tables={refunds:[allocation],refund_operations:[operation],payments:[payment]};
  const calls=[];
  const db={from(table){
    let rows=[...(tables[table]||[])];
    const q={
      select(){return q;},
      eq(field,value){rows=rows.filter(item=>item[field]===value);return q;},
      neq(field,value){rows=rows.filter(item=>item[field]!==value);return q;},
      not(field,op,value){if(op==='is'&&value===null) rows=rows.filter(item=>item[field]!=null);return q;},
      in(field,values){rows=rows.filter(item=>values.includes(item[field]));return q;},
      gte(field,value){rows=rows.filter(item=>item[field]>=value);return q;},
      lt(field,value){rows=rows.filter(item=>item[field]<value);return q;},
      or(){return q;},
      order(field){rows.sort((x,y)=>String(x[field]).localeCompare(String(y[field])));return q;},
      gt(field,value){rows=rows.filter(item=>item[field]>value);return q;},
      limit(n){rows=rows.slice(0,n);return q;},
      range(start,end){rows=rows.slice(start,end+1);return q;},
      maybeSingle(){return Promise.resolve({data:rows[0]??null,error:null});},
      then(resolve,reject){return Promise.resolve({data:rows,error:null}).then(resolve,reject);},
    };
    return q;
  },async rpc(name,payload){
    calls.push({name,payload});
    if(name!=='record_stripe_refund_result') throw new Error('RPC métier interdite');
    if(payload.p_stripe_status !== 'succeeded') throw new Error('Preuve non confirmée');
    allocation.status='succeeded';allocation.operation_status='succeeded';
    operation.status='stripe_succeeded'; operation.refunded_amount_cents=allocation.amount_cents;
    allocation.metadata={...stripeRefund};
    return {data:{outcome:'stripe_succeeded'},error:null};
  }};
  const stripe={refunds:{retrieve:async(id)=>{assert.equal(id,allocation.stripe_refund_id);return stripeRefund;}}};
  return {db,tables,calls,stripe};
}

test('preuve Stripe validée avant la moindre mutation et aucun nouveau remboursement lancé',()=>{
  assert.equal(verifyDelayedRefundProof({allocation:a,operation:op,payment:pay,stripeRefund:proof}).outcome,'ready');
  for(const altered of [
    {stripeRefund:{...proof,amount:999}},
    {stripeRefund:{...proof,payment_intent:'pi_other'}},
    {stripeRefund:{...proof,metadata:{...proof.metadata,refund_allocation_id:'a-other'}}},
    {operation:{...op,booking_request_id:'b-other'}},
    {allocation:{...a,amount_cents:999}},
  ]) assert.equal(verifyDelayedRefundProof({allocation:a,operation:op,payment:pay,stripeRefund:proof,...altered}).outcome,'needs_review');
  assert.equal(verifyDelayedRefundProof({allocation:a,operation:op,payment:pay,stripeRefund:{...proof,status:'pending'}}).outcome,'not_confirmed');
  assert.equal(verifyDelayedRefundProof({allocation:{...a,status:'failed'},operation:op,payment:pay,stripeRefund:proof}).outcome,'needs_review');
});

test('Stripe succeeded tardif confirme localement UNIQUEMENT, sans finalisation ni email automatique',async()=>{
  const d=fakeDb();
  assert.deepEqual(await reconcileDelayedStripeRefund(d.db,d.stripe,{stripeRefundId:'re_1'}),{
    outcome:'recovered_requires_finalization',operationId:'op-1',allocationId:'a-1'});
  assert.equal(d.calls.length,1);
  assert.equal(d.calls[0].name,'record_stripe_refund_result');
  assert.equal(d.calls[0].payload.p_stripe_metadata.id,'re_1');
  assert.equal(d.tables.refunds[0].status,'succeeded');
  assert.equal(d.tables.refund_operations[0].status,'stripe_succeeded');
  assert.equal((await reconcileDelayedStripeRefund(d.db,d.stripe,{stripeRefundId:'re_1'})).outcome,'already_confirmed');
  assert.equal(d.calls.length,1,'pas de seconde RPC en replay');
});

test('Stripe pending et Stripe incohérent restent sans écriture métier',async()=>{
  for(const stripeRefund of [{...proof,status:'pending'}, {...proof,amount:999}, {...proof,metadata:{}}]) {
    const d=fakeDb({stripeRefund});
    const response=await reconcileDelayedStripeRefund(d.db,d.stripe,{stripeRefundId:'re_1'});
    assert.ok(['not_confirmed','needs_review'].includes(response.outcome));
    assert.equal(d.calls.length,0);
  }
  const d=fakeDb();
  assert.equal((await reconcileDelayedStripeRefund(d.db,d.stripe,{stripeRefundId:'re_external'})).outcome,'not_found');
  assert.equal(d.calls.length,0);
});

test('rattrapage keyset traite 2 allocations même si statut de la première change en cours de pagination',async()=>{
  const d=fakeDb();
  const next={...a,id:'a-2',operation_id:'op-2',payment_id:'p-2',stripe_refund_id:'re_2'};
  d.tables.refunds.push(next);
  d.tables.refund_operations.push({...op,id:'op-2'});
  d.tables.payments.push({...pay,id:'p-2'});
  const stripe={refunds:{retrieve:async id=>({...proof,id,metadata:{refund_allocation_id:id==='re_1'?'a-1':'a-2',refund_operation_id:id==='re_1'?'op-1':'op-2',payment_id:id==='re_1'?'p-1':'p-2'}})}};
  const result=await reconcilePendingStripeRefunds(d.db,stripe,{pageSize:1,maxRows:5});
  assert.equal(result.outcomes.recovered_requires_finalization,2);
  assert.equal(result.processed,2);
  assert.equal(result.truncated,false);
  assert.equal(d.calls.length,2);
});

test('allocation confirmée dont opération reste stripe_succeeded est visible À vérifier, sans perte du mouvement',()=>{
  const result=buildAccountingReconciliation({year:2027,bookings:[],payments:[],
    refundOperations:[{...op,status:'stripe_succeeded',refunded_amount_cents:1000,completed_at:null,updated_at:'2027-01-02'}],
    refundAllocations:[{...a,status:'succeeded',operation_status:'succeeded',metadata:proof}],
    accountingEntries:[], stripeBalanceTransactions:[], externalFinancials:[],invoices:[],creditNotes:[],cleaningIssues:[],additionalCharges:[]});
  const row=result.rows.find(item=>item.id==='direct-refund:a-1');
  assert.ok(row,'allocation absente du rapprochement');
  assert.equal(row.financialStatus,'a_verifier');
  assert.ok(row.reasons.includes('refund_operation_requires_business_finalization'));
});

test('endpoint annuel : exécution intégrale de la lecture Supabase avec allocations hors année de l’opération',async()=>{
  const source=readFileSync('netlify/functions/admin-accounting-reconciliation.js','utf8')
    .replace(/^import\s+[^\n]+\n/gm,'').replace(/^export\s+/gm,'');
  const capture=[];
  const sandbox={
    createClient:()=>null,process:{env:{}},console,Promise,JSON,Date,Number,Map,Set,String,Array,Error,Intl,
    stripeRefundParisDate,authorizationResponse:()=>({statusCode:401,body:'{}'}),
    authorizeOwnerRequest:async()=>({ok:true}),
    buildAccountingReconciliation:(input)=>{capture.push(input);return {rows:[],accountingSummary:{},taxSummary:{}};},
  };
  vm.runInNewContext(`${source}\nthis.runReconciliation = runAnnualReconciliation;`,sandbox);
  const first={...a,status:'succeeded',operation_status:'succeeded',metadata:{...proof,created:1798761000-3600}};
  const second={...a,id:'a-2',stripe_refund_id:'re_2',status:'succeeded',operation_status:'succeeded',metadata:{...proof,id:'re_2',created:1798761000}};
  const d=fakeDb({allocation:first,operation:{...op,status:'succeeded',refunded_amount_cents:2000}});
  d.tables.refunds.push(second);
  const reply=await sandbox.runReconciliation({httpMethod:'GET',queryStringParameters:{year:'2026'}},{client:d.db,authorize:async()=>({ok:true})});
  assert.equal(reply.statusCode,200,reply.body);
  assert.equal(capture.length,1);
  assert.equal(capture[0].refundAllocations.map(item=>item.id).join(','),'a-1,a-2');
  assert.ok(capture[0].refundOperations.some(item=>item.id==='op-1'));
  assert.equal(capture[0].year,2026);
});

test('aucun nouveau module de reprise ne déclenche Stripe, facture ou email',()=>{
  const helper=readFileSync('netlify/functions/_lib/reconcile-delayed-stripe-refund.js','utf8');
  assert.doesNotMatch(helper,/\.refunds\.create\s*\(/);
  assert.doesNotMatch(helper,/\.rpc\(['"]finalize_stripe_refund_operation['"]/);
});
