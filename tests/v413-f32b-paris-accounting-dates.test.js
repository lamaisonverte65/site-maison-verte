import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planDirectStripeAccounting } from '../netlify/functions/_lib/direct-stripe-accounting-import.js';
import { applyAutoDirectStripeAccounting } from '../netlify/functions/_lib/auto-direct-stripe-accounting.js';
import { planSpecialStripeAccounting } from '../netlify/functions/_lib/auto-special-stripe-accounting.js';
import { buildAccountingReconciliation } from '../netlify/functions/_lib/accounting-reconciliation.js';

const cat = [{id:'rental', code:'rental_direct',entry_kind:'income'},{id:'fee',code:'payment_fees',entry_kind:'expense'}];
const payment = (id, paid_at) => ({id, booking_request_id:'b-f32b', payment_type:'full',amount:100,status:'paid',currency:'eur',stripe_payment_intent_id:`pi_${id}`,paid_at});
const tx = (id) => ({id:`bt_${id}`,payment_id:id,payment_intent_id:`pi_${id}`,type:'charge',amount:100,fee:2,net:98,currency:'eur'});

function plan(p, year, entries = []) {
  return planDirectStripeAccounting({year,payments:[p],transactions:[tx(p.id)],entries,categories:cat});
}
function reconcile(p, year, entries=[]) {
  return buildAccountingReconciliation({year,payments:[p],bookings:[{id:p.booking_request_id}],stripeBalanceTransactions:[tx(p.id)],accountingEntries:entries});
}

test('direct Stripe: 31 decembre 23:30 UTC appartient au 1er janvier francais', () => {
  const p = payment('new-year','2025-12-31T23:30:00Z');
  const res = plan(p, 2026);
  assert.equal(res.readyCount,1);
  assert.deepEqual(res.inserts.map(e=>e.entry_date), ['2026-01-01','2026-01-01']);
  assert.equal(plan(p,2025).readyCount,0);
  assert.equal(reconcile(p,2026).rows[0].date,'2026-01-01');
  assert.equal(reconcile(p,2025).rows.length,0);
});

test('direct Stripe: 31 decembre 22:59 UTC appartient encore a decembre en France',()=>{
  const p=payment('old-year','2025-12-31T22:59:59Z');
  assert.equal(plan(p,2025).readyCount,1);
  assert.equal(plan(p,2025).inserts[0].entry_date,'2025-12-31');
  assert.equal(plan(p,2026).readyCount,0);
});

test('ete Europe/Paris: passage de jour a 22 h UTC',()=>{
  const before=payment('summer1','2026-06-30T21:59:59Z');
  const after=payment('summer2','2026-06-30T22:00:00Z');
  assert.equal(plan(before,2026).inserts[0].entry_date,'2026-06-30');
  assert.equal(plan(after,2026).inserts[0].entry_date,'2026-07-01');
});

test('historique: ecriture Stripe datee 2025 ne devient pas idempotente en 2026 et reste a verifier',()=>{
  const p=payment('historical','2025-12-31T23:30:00Z');
  const oldEntries=plan({...p,paid_at:'2025-12-31T12:00:00Z'},2025).inserts.map((entry, i)=>({...entry,entry_date:'2025-12-31',id:`e-old-${i}`}));
  const future=plan(p,2026,oldEntries);
  assert.equal(future.blockedCount,1);
  assert.equal(future.inserts.length,0);
  const row=reconcile(p,2026,oldEntries).rows.find(x=>x.id==='direct-payment:historical');
  assert.equal(row.accountingStatus,'a_verifier');
  assert.ok(row.reasons.includes('accounting_entry_year_mismatch'));
});

test('webhook automatique direct utilise exercice francais, sans double ecriture',async()=>{
  const p=payment('auto','2025-12-31T23:30:00Z');
  let rows=[];
  const params={payment:p,transactions:[tx(p.id)],entries:[],categories:cat,insertEntries:async inserts=>{rows=inserts}};
  assert.equal((await applyAutoDirectStripeAccounting(params)).outcome,'created');
  assert.deepEqual(rows.map(e=>e.entry_date),['2026-01-01','2026-01-01']);
});

test('paiement special menage utilise la date France (meme apres changement exercice)',()=>{
  const p={...payment('special','2025-12-31T23:30:00Z'),booking_request_id:null,payment_type:'manual',manual_reason:'post_stay_cleaning',
    amount:68.5,stripe_payment_intent_id:'pi_special',metadata:{booking_id:'b-f32b',cleaning_issue_id:'clean-f32b'}};
  const item={id:'clean-f32b',booking_request_id:'b-f32b',payment_id:'special',status:'paid',amount_due:68.5};
  const result=planSpecialStripeAccounting({payment:p,context:{type:'post_stay_cleaning',id:item.id,bookingRequestId:'b-f32b',item},
    transactions:[{id:'bt_special',payment_id:'special',payment_intent_id:'pi_special',type:'charge',amount:68.5,fee:1.25,net:67.25,currency:'eur'}],
    entries:[],categories:[{id:'clean',code:'post_stay_cleaning',entry_kind:'income'},cat[1]]});
  assert.equal(result.outcome,'ready');
  assert.deepEqual(result.inserts.map(e=>e.entry_date),['2026-01-01','2026-01-01']);
});

test('reconciliation: date operation de remboursement historique en heure France',()=>{
  const result=buildAccountingReconciliation({year:2026,refundOperations:[{id:'refund-f32b',booking_request_id:'b-f32b',status:'succeeded',refunded_amount_cents:1000,completed_at:'2025-12-31T23:30:00Z'}],bookings:[{id:'b-f32b'}]});
  assert.equal(result.rows.find(x=>x.id==='direct-refund:refund-f32b')?.date,'2026-01-01');
});

test('requêtes annuelles couvrent les frontières de 1er janvier en heure de France',()=>{
  const annual=readFileSync(new URL('../netlify/functions/admin-accounting-reconciliation.js',import.meta.url),'utf8');
  const manual=readFileSync(new URL('../netlify/functions/admin-direct-stripe-accounting.js',import.meta.url),'utf8');
  assert.match(annual,/12-31T23:00:00Z/);
  assert.match(manual,/12-31T23:00:00Z/);
});
