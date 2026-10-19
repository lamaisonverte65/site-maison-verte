import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planSpecialStripeAccounting, syncAutoSpecialStripeAccounting } from '../netlify/functions/_lib/auto-special-stripe-accounting.js';
import { buildAccountingReconciliation } from '../netlify/functions/_lib/accounting-reconciliation.js';

const payment = { id:'p-special', booking_request_id:null, payment_type:'manual', manual_reason:'cleaning',
  status:'paid', amount:68.5, currency:'eur', stripe_payment_intent_id:'pi_clean', paid_at:'2026-08-16T08:00:00Z',
  stripe_checkout_session_id:'cs_clean', metadata:{booking_id:'b1', cleaning_issue_id:'clean1'} };
const tx = {id:'bt1',payment_id:'p-special',payment_intent_id:'pi_clean',type:'charge',amount:68.5,fee:1.25,net:67.25,currency:'eur'};
const cleaning = {id:'clean1', booking_request_id:'b1', payment_id:'p-special',amount_due:68.5,status:'paid'};
const categories = [
  {id:'catclean',code:'post_stay_cleaning',entry_kind:'income'},
  {id:'catbed',code:'additional_extra_bed',entry_kind:'income'},
  {id:'catother',code:'other_income',entry_kind:'income'},
  {id:'catfee',code:'payment_fees',entry_kind:'expense'} ];
function sample(overrides={}) {
  return {payment,context:{type:'post_stay_cleaning',id:'clean1',bookingRequestId:'b1',item:cleaning},
    transactions:[tx],entries:[],categories,...overrides};
}
function plan(o={}) {return planSpecialStripeAccounting(sample(o));}
test('ménage après séjour : recette et frais distincts, sans paiement dans contrat',()=>{
  const result=plan();
  assert.equal(result.outcome,'ready');
  assert.deepEqual(result.inserts.map(e=>[e.entry_kind,e.category_id,e.amount_ttc]),[['income','catclean',68.5],['expense','catfee',1.25]]);
  assert.ok(result.inserts.every(e=>e.booking_request_id==='b1'));
  assert.ok(result.inserts.every(e=>e.metadata.cleaning_issue_id==='clean1'));
  assert.deepEqual(result.inserts.map(e=>e.source_record_key),['direct:payment:p-special','direct:fee:p-special']);
  assert.equal(payment.booking_request_id,null);
});
test('replay sans doublon et rattrapage frais uniquement',()=>{
  const first=plan();
  assert.equal(plan({entries:first.inserts}).outcome,'already_recorded');
  const second=plan({entries:[first.inserts[0]]});
  assert.deepEqual(second.inserts.map(e=>e.entry_kind),['expense']);
});
test('supplément lit : catégorie et liaison propres',()=>{
  const p={...payment,manual_reason:'additional_charge',metadata:{booking_id:'b1',additional_charge_id:'extra1'}};
  const result=plan({payment:p,context:{type:'additional_charge',id:'extra1',bookingRequestId:'b1',
    item:{id:'extra1',payment_id:'p-special',booking_request_id:'b1',status:'paid',amount:68.5,category:'extra_bed'}}});
  assert.equal(result.outcome,'ready');
  assert.equal(result.inserts[0].category_id,'catbed');
});
for (const category of ['damage','other']) {
  test(`${category} : saisie financière possible mais traitement fiscal à vérifier`,()=>{
    const p={...payment,manual_reason:'additional_charge',metadata:{booking_id:'b1',additional_charge_id:'extra1'}};
    const result=plan({payment:p,context:{type:'additional_charge',id:'extra1',bookingRequestId:'b1',
      item:{id:'extra1',payment_id:'p-special',booking_request_id:'b1',status:'paid',amount:68.5,category}}});
    assert.equal(result.outcome,'ready');
    assert.equal(result.inserts[0].category_id,'catother');
    assert.equal(result.inserts[0].treatment,'to_review');
    assert.equal(result.inserts[0].metadata.fiscal_review_required,true);
  });
}
const broken=[
 ['pi mismatch',{transactions:[{...tx,payment_intent_id:'pi_other'}]}],
 ['payment mismatch',{transactions:[{...tx,payment_id:'other'}]}],
 ['missing fee',{transactions:[{...tx,fee:null}]}],
 ['one cent mismatch',{transactions:[{...tx,net:67.26}]}],
 ['missing tx',{transactions:[]}],
 ['double tx',{transactions:[tx,{...tx,id:'bt2'}]}],
 ['missing category',{categories:categories.filter(c=>c.code!=='post_stay_cleaning')}],
 ['wrong metadata booking',{payment:{...payment,metadata:{...payment.metadata,booking_id:'other'}}}],
 ['wrong metadata issue',{payment:{...payment,metadata:{...payment.metadata,cleaning_issue_id:'other'}}}],
 ['wrong item payment',{context:{type:'post_stay_cleaning',id:'clean1',bookingRequestId:'b1',item:{...cleaning,payment_id:'other'}}}],
 ['pending item',{context:{type:'post_stay_cleaning',id:'clean1',bookingRequestId:'b1',item:{...cleaning,status:'payment_requested'}}}],
 ['wrong amount',{payment:{...payment,amount:99}}],
 ['wrong currency',{payment:{...payment,currency:'usd'}}],
 ['booking in payment',{payment:{...payment,booking_request_id:'b1'}}],
 ['missing date',{payment:{...payment,paid_at:null}}],
 ['manual collision',{entries:[{id:'old',entry_kind:'income',source:'manual',booking_request_id:'b1',entry_date:'2026-08-16',amount_ttc:68.5}]}],
];
for (const [name,change] of broken) test(`${name} bloque la création`,()=>{
  assert.equal(plan(change).outcome,'needs_review',name);
});
test('clé identique incohérente ne peut pas être écrasée',()=>{
  const existing={...plan().inserts[0],amount_ttc:69};
  assert.equal(plan({entries:[existing]}).outcome,'needs_review');
});
test("paiement non confirmé ne crée pas d'écriture",()=>{
  assert.equal(plan({payment:{...payment,status:'pending'}}).outcome,'not_eligible');
});
test('reconciliation : ménage paid, booking_request_id nul, rattachement par dossier',()=>{
  const imported=plan().inserts.map((entry,i)=>({...entry,id:'e'+i}));
  const result=buildAccountingReconciliation({year:2026,bookings:[{id:'b1',tourist_tax_snapshot:{classification:'unclassified'}}],
    payments:[payment],stripeBalanceTransactions:[tx],cleaningIssues:[cleaning],additionalCharges:[],
    accountingEntries:imported,invoices:[]});
  const row=result.rows.find(r=>r.id==='direct-payment:p-special');
  assert.equal(row.type,'post_stay_cleaning');
  assert.equal(row.bookingRequestId,'b1');
  assert.equal(row.accountingStatus,'coherent');
  assert.equal(row.fiscalGrossAmountCents,6850);
  assert.equal(row.paymentFeeCents,125);
  assert.deepEqual(row.accountingEntryIds.sort(),['e0','e1']);
});
test('reconciliation : dommages et autre ne deviennent jamais fiscalement certains',()=>{
  for(const category of ['damage','other']) {
    const p={...payment,manual_reason:'additional_charge',metadata:{booking_id:'b1',additional_charge_id:'extra1'}};
    const issue={id:'extra1',booking_request_id:'b1',payment_id:p.id,status:'paid',category,amount:68.5};
    const result=buildAccountingReconciliation({year:2026,bookings:[{id:'b1',tourist_tax_snapshot:{classification:'unclassified'}}],
      payments:[p],stripeBalanceTransactions:[tx],cleaningIssues:[],additionalCharges:[issue],
      accountingEntries:[],invoices:[]});
    const row=result.rows.find(r=>r.id==='direct-payment:p-special');
    assert.equal(row.bookingRequestId,'b1');
    assert.equal(row.fiscalStatus,'a_verifier');
    assert.equal(row.fiscalGrossAmountCents,null);
    assert.ok(row.reasons.includes('special_payment_fiscal_nature_requires_review'));
  }
});
test('reconciliation : dossier absent ne produit pas de recette fiscale certaine',()=>{
  const result=buildAccountingReconciliation({year:2026,bookings:[],payments:[payment],stripeBalanceTransactions:[tx],
    cleaningIssues:[],additionalCharges:[],accountingEntries:[],invoices:[]});
  const row=result.rows.find(r=>r.id==='direct-payment:p-special');
  assert.equal(row.fiscalGrossAmountCents,null);
  assert.equal(row.fiscalStatus,'a_verifier');
});
test('code source : dispatcher après webhook, pas de mutation du contrat, et payout rattrapage',()=>{
  const webhook=fs.readFileSync(new URL('../netlify/functions/stripe-webhook.js',import.meta.url),'utf8');
  const sync=fs.readFileSync(new URL('../netlify/functions/sync-stripe-finance.js',import.meta.url),'utf8');
  const server=fs.readFileSync(new URL('../netlify/functions/_lib/sync-stripe-payment-accounting.js',import.meta.url),'utf8');
  assert.match(webhook,/syncStripePaymentAccounting/);
  assert.match(sync,/syncStripePaymentAccounting/);
  assert.match(sync,/return \{ booking: null, payment \}/);
  assert.match(server,/syncAutoSpecialStripeAccounting/);
});

function fakeSupabase() {
  const state = {
    payments:[{...payment}], booking_cleaning_issues:[{...cleaning}],booking_additional_charges:[],
    stripe_balance_transactions:[{...tx}], accounting_categories:categories.map(e=>({...e})), accounting_entries:[],
  };
  const database={from(name){
    if (!(name in state)) throw new Error('Unexpected query '+name);
    const filters=[];
    const q={
      select(){return this;},
      eq(key,value){filters.push([key,value]);return this;},
      in(key,value){filters.push([key,value]);return this;},
      maybeSingle(){return Promise.resolve({data:read()[0]||null,error:null});},
      then(resolve,reject){return Promise.resolve({data:read(),error:null}).then(resolve,reject);},
      insert(rows){
        if(name!=='accounting_entries') throw new Error('Unexpected mutation: '+name);
        state.accounting_entries.push(...rows.map((e,i)=>({...e,id:`new${i}`})));
        return Promise.resolve({data:null,error:null});
      },
    };
    function read(){return state[name].filter(row=>filters.every(([k,v])=>Array.isArray(v)?v.includes(row[k]):String(row[k])===String(v)));}
    return q;
  }};
  return {database,state};
}

test('service complet depuis paiement confirmé : écritures idempotentes et lecture seule sur les dossiers',async()=>{
  const {database,state}=fakeSupabase();
  assert.deepEqual(await syncAutoSpecialStripeAccounting(database,{checkoutSessionId:'cs_clean'}),{outcome:'created',created:2});
  assert.equal(state.accounting_entries.length,2);
  assert.deepEqual(await syncAutoSpecialStripeAccounting(database,{paymentId:'p-special'}),{outcome:'already_recorded',created:0});
  assert.equal(state.booking_cleaning_issues[0].status,'paid');
  assert.equal(state.payments[0].booking_request_id,null);
});

test('service réel simulé : métadonnées erronées refusées, sans écriture',async()=>{
  const {database,state}=fakeSupabase();
  state.payments[0].metadata.booking_id='autre';
  const result=await syncAutoSpecialStripeAccounting(database,{paymentId:'p-special'});
  assert.equal(result.outcome,'needs_review');
  assert.equal(state.accounting_entries.length,0);
});
