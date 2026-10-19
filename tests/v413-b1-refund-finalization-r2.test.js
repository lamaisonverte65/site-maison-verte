import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  verifyFinalizationSnapshot,finalizeDelayedStripeRefund,finalizePendingStripeRefundOperations,
} from '../netlify/functions/_lib/finalize-delayed-stripe-refund.js';
import {
  buildRefundNotificationPayload,dispatchRefundNotification,dispatchPendingRefundNotifications,
} from '../netlify/functions/_lib/refund-notification-outbox.js';

const booking={id:'b1',guest_email:'test@example.invalid',guest_first_name:'Test',guest_last_name:'Client',
  start_date:'2026-09-01',end_date:'2026-09-03',status:'accepted',stripe_checkout_session_id:null};
const operation={id:'op1',booking_request_id:'b1',status:'stripe_succeeded',action:'refund_only',
  is_refund_only:true,cancellation_type:'client',message:'Merci <script>danger</script>',policy_label:'Remboursement',
  refunded_amount_cents:1000,result:{}};
const allocation={id:'a1',operation_id:'op1',booking_request_id:'b1',
  status:'succeeded',operation_status:'succeeded',amount_cents:1000,stripe_refund_id:'re1'};
const stripe={checkout:{sessions:{retrieve:async()=>({status:'complete'}),expire:async()=>{}}},
  refunds:{create:async()=>{throw new Error('INTERDIT');}}};

function fakeDb({op={...operation},allocations=[{...allocation}],outboxStatus=null,logError=false,expireError=false}={}) {
  const state={op,allocations,outbox:outboxStatus ? {status:outboxStatus} : null,
    calls:[],logs:[],sendCount:0,finalizeCount:0,claimCount:0};
  const db={
    from(table){
      const candidates={refund_operations:[state.op],refund_notification_outbox:state.outbox ? [{refund_operation_id:state.op.id,...state.outbox}] : []};
      let rows=[...(candidates[table] || [])];
      const q={
        select(){return q;},eq(key,value){rows=rows.filter(x=>x[key]===value);return q;},
        gt(key,value){rows=rows.filter(x=>x[key]>value);return q;},
        order(key){rows.sort((a,b)=>String(a[key]).localeCompare(String(b[key])));return q;},
        limit(n){rows=rows.slice(0,n);return q;},
        maybeSingle:async()=>({data:rows[0]||null,error:null}),
        insert:async(values)=>{state.logs.push(...values);return logError ? {error:{message:'logging unavailable'}}:{error:null};},
        then(resolve,reject){return Promise.resolve({data:rows,error:null}).then(resolve,reject);},
      };
      if (table==='email_logs') return q;
      return q;
    },
    async rpc(name,args){
      state.calls.push(name);
      if(name==='refund_operation_snapshot') return {data:{operation:state.op,allocations:state.allocations},error:null};
      if(name==='finalize_stripe_refund_operation_with_notification') {
        if(state.op.status==='succeeded') return {data:{outcome:'already_succeeded'},error:null};
        state.finalizeCount++;
        state.op.status='succeeded'; state.op.result={booking:{...booking,status:state.op.action==='cancel_refund'?'cancelled':'accepted'}};
        state.outbox={status:'pending'};
        return {data:{outcome:'succeeded',should_notify:true},error:null};
      }
      if(name==='claim_completed_refund_notification') {
        state.claimCount++;
        if(state.outbox?.status!=='pending') return {data:{outcome:state.outbox?.status||'not_found'},error:null};
        state.outbox.status='sending';return {data:{outcome:'claimed'},error:null};
      }
      if(name==='complete_refund_notification') {
        assert.equal(state.outbox.status,'sending');state.outbox.status=args.p_status;
        return {data:{outcome:args.p_status},error:null};
      }
      throw new Error('Unexpected RPC '+name);
    },
  };
  return {db,state,send:async()=>{state.sendCount++;return {ok:true,json:async()=>({id:'resend1'})};}};
}

test('snapshot complet uniquement, aucune finalisation anticipée ou double allocation',()=>{
  assert.equal(verifyFinalizationSnapshot({operation,allocations:[allocation]}).outcome,'ready');
  for (const variant of [
    {operation:{...operation,status:'needs_reconciliation'},allocations:[allocation]},
    {operation,allocations:[{...allocation,operation_status:'pending'}]},
    {operation,allocations:[{...allocation,amount_cents:900}]},
    {operation,allocations:[]},
    {operation,allocations:[allocation,{...allocation,id:'a2',amount_cents:900}]},
  ]) assert.equal(verifyFinalizationSnapshot(variant).outcome,'needs_review');
});

test('la finalisation tardive met à jour métier une fois et expédie une notification une fois',async()=>{
  const {db,state,send}=fakeDb();
  const first=await finalizeDelayedStripeRefund(db,stripe,'op1',{send});
  assert.equal(first.outcome,'finalized');assert.equal(first.notification,'sent');
  assert.equal(state.finalizeCount,1);assert.equal(state.sendCount,1);
  assert.equal(state.outbox.status,'sent');assert.equal(state.logs.length,1);
  const replay=await finalizeDelayedStripeRefund(db,stripe,'op1',{send});
  assert.equal(replay.outcome,'already_finalized');
  assert.equal(state.sendCount,1);
});

test('même deux appels de notification simultanés ne produisent qu’un email',async()=>{
  const {db,state,send}=fakeDb({op:{...operation,status:'succeeded',result:{booking}},outboxStatus:'pending'});
  const answers=await Promise.all([
    dispatchRefundNotification(db,'op1',{send,stripe}),dispatchRefundNotification(db,'op1',{send,stripe}),
  ]);
  assert.equal(state.sendCount,1);assert.ok(answers.some(v=>v.outcome==='sent'));
  assert.ok(answers.some(v=>v.outcome==='sending'||v.outcome==='sent'));
});

test('un échec réseau incertain n’est pas renvoyé lors du replay',async()=>{
  const {db,state}=fakeDb({op:{...operation,status:'succeeded',result:{booking}},outboxStatus:'pending'});
  const send=async()=>{state.sendCount++;throw new Error('connexion coupée après soumission');};
  assert.equal((await dispatchRefundNotification(db,'op1',{send,stripe})).outcome,'needs_review');
  assert.equal((await dispatchRefundNotification(db,'op1',{send,stripe})).outcome,'needs_review');
  assert.equal(state.sendCount,1);
  assert.equal(state.outbox.status,'needs_review');
});

test('réponse provider non OK : pas de retry automatique',async()=>{
  const {db,state}=fakeDb({op:{...operation,status:'succeeded',result:{booking}},outboxStatus:'pending'});
  const send=async()=>{state.sendCount++;return {ok:false,text:async()=>('429 rate limited')};};
  await dispatchRefundNotification(db,'op1',{send,stripe});
  await dispatchRefundNotification(db,'op1',{send,stripe});
  assert.equal(state.sendCount,1);assert.equal(state.outbox.status,'needs_review');
  assert.equal(state.logs[0].retry_payload,null);
});

test('absence email : statut not_applicable sans appel provider',async()=>{
  const {db,state,send}=fakeDb({op:{...operation,status:'succeeded',result:{booking:{...booking,guest_email:null}}},outboxStatus:'pending'});
  const r=await dispatchRefundNotification(db,'op1',{send,stripe});
  assert.equal(r.outcome,'not_applicable');assert.equal(state.outbox.status,'not_applicable');assert.equal(state.sendCount,0);
});

test('template préserve motif et échappe le message',()=>{
  const n=buildRefundNotificationPayload({...operation,status:'succeeded',result:{booking}});
  assert.match(n.payload.html,/Merci &lt;script&gt;danger&lt;\/script&gt;/);
  assert.match(n.payload.subject,/Remboursement/);
  assert.equal(n.metadata.refundOperationId,'op1');
});

test('annulation : bloque envoi si les sessions Checkout ne peuvent être expirées',async()=>{
  const {db,state,send}=fakeDb({op:{...operation,action:'cancel_refund',status:'succeeded',result:{booking:{...booking,status:'cancelled',stripe_checkout_session_id:'cs_open'}}},outboxStatus:'pending'});
  const brokenStripe={checkout:{sessions:{retrieve:async()=>{throw Error('stripe inaccessible');}}}};
  const r=await dispatchRefundNotification(db,'op1',{send,stripe:brokenStripe});
  assert.equal(r.outcome,'needs_review');assert.equal(state.outbox.status,'pending');assert.equal(state.sendCount,0);
  assert.equal(state.claimCount,0);
});

test('scanner par opération finalise les recovered et non les allocations déjà succeeded',async()=>{
  const {db,state,send}=fakeDb();
  const result=await finalizePendingStripeRefundOperations(db,stripe,{send,pageSize:1,maxRows:5});
  assert.equal(result.processed,1);assert.equal(result.outcomes.finalized,1);
  assert.equal(state.sendCount,1);
  const second=await finalizePendingStripeRefundOperations(db,stripe,{send,pageSize:1,maxRows:5});
  assert.equal(second.processed,0);
});

test('outbox : les notifications déjà réservées ne sont jamais rejouées',async()=>{
  const {db,state,send}=fakeDb({op:{...operation,status:'succeeded',result:{booking}},outboxStatus:'sending'});
  const r=await dispatchPendingRefundNotifications(db,{send,stripe});
  assert.equal(r.processed,0);assert.equal(state.sendCount,0);
});

test('migration : trigger atomique, clés uniques, droits service-role, aucun backfill ni paiement Stripe créé',()=>{
  const sql=readFileSync('supabase/migrations/202610190001_v413_b1_refund_notification_outbox.sql','utf8');
  assert.match(sql,/refund_operation_id uuid primary key/);
  assert.match(sql,/after update of status on public\.refund_operations/i);
  assert.match(sql,/old\.status is distinct from 'succeeded'/);
  assert.match(sql,/status = 'pending'/);
  assert.match(sql,/grant execute on function public\.claim_completed_refund_notification\(uuid\) to service_role/);
  assert.match(sql,/grant execute on function public\.complete_refund_notification\(uuid,text,text,text\) to service_role/);
  assert.match(sql,/grant execute on function public\.refund_operation_snapshot\(uuid\) to service_role/);
  assert.match(sql,/current_setting\('lmv\.refund_notification_outbox', true\) = 'enabled'/);
  assert.match(sql,/create function public\.finalize_stripe_refund_operation_with_notification/);
  assert.match(readFileSync('netlify/functions/refund-booking-payment.js','utf8'),/rpc\(\"finalize_stripe_refund_operation_with_notification\"/);
  assert.match(readFileSync('netlify/functions/_lib/finalize-delayed-stripe-refund.js','utf8'),/finalize_stripe_refund_operation_with_notification/);
  assert.doesNotMatch(sql,/insert into public\.refunds\b/i);
  const js=readFileSync('netlify/functions/_lib/finalize-delayed-stripe-refund.js','utf8');
  assert.doesNotMatch(js,/\.refunds\.create\s*\(/);
  assert.doesNotMatch(js,/\.from\(['"]customer_credit_notes['"]\)\.insert/);
});


test('montant nul en remboursement simple : aucune notification fallacieuse',async()=>{
  const {db,state,send}=fakeDb({op:{...operation,status:'succeeded',refunded_amount_cents:0,result:{booking}},outboxStatus:'pending'});
  assert.equal((await dispatchRefundNotification(db,'op1',{send,stripe})).outcome,'not_applicable');
  assert.equal(state.sendCount,0);
});

test('une annulation non confirmée en base ne peut déclencher son email',async()=>{
  const {db,state,send}=fakeDb({op:{...operation,status:'succeeded',action:'cancel_refund',result:{booking}},outboxStatus:'pending'});
  const result=await dispatchRefundNotification(db,'op1',{send,stripe});
  assert.equal(result.outcome,'needs_review');assert.equal(state.sendCount,0);
  assert.equal(state.outbox.status,'pending');
});

test('deux allocations confirmées sont finalisées en une seule opération',async()=>{
  const two=[{...allocation,amount_cents:400},{...allocation,id:'a2',stripe_refund_id:'re2',amount_cents:600}];
  const {db,state,send}=fakeDb({allocations:two});
  const r=await finalizeDelayedStripeRefund(db,stripe,'op1',{send});
  assert.equal(r.outcome,'finalized');
  assert.equal(state.finalizeCount,1);assert.equal(state.sendCount,1);
});

test('log email indisponible après réponse OK : outbox envoyé et aucun deuxième envoi',async()=>{
  const {db,state,send}=fakeDb({op:{...operation,status:'succeeded',result:{booking}},outboxStatus:'pending',logError:true});
  const oldLog=console.error;
  console.error=()=>{};
  try {
    assert.equal((await dispatchRefundNotification(db,'op1',{send,stripe})).outcome,'sent');
    assert.equal((await dispatchRefundNotification(db,'op1',{send,stripe})).outcome,'sent');
  } finally {console.error=oldLog;}
  assert.equal(state.sendCount,1);assert.equal(state.outbox.status,'sent');
});

test('annulation : expire la session Checkout avant la réservation de l’email',async()=>{
  let expirations=0;
  const {db,state,send}=fakeDb({op:{...operation,action:'cancel_refund',status:'succeeded',result:{booking:{...booking,status:'cancelled',stripe_checkout_session_id:'cs_open'}}},outboxStatus:'pending'});
  const activeStripe={checkout:{sessions:{retrieve:async()=>({status:'open'}),expire:async()=>{expirations++;}}}};
  const r=await dispatchRefundNotification(db,'op1',{send,stripe:activeStripe});
  assert.equal(r.outcome,'sent');assert.equal(expirations,1);assert.equal(state.sendCount,1);
});

test('refus SQL de finalisation : pas d’email, aucun Stripe create',async()=>{
  const {db,state,send}=fakeDb();
  const rpc=db.rpc;
  db.rpc=async(name,args)=>name==='finalize_stripe_refund_operation_with_notification'
    ? {data:null,error:{message:'transaction annulée'}}:rpc(name,args);
  await assert.rejects(finalizeDelayedStripeRefund(db,stripe,'op1',{send}),/transaction annulée/);
  assert.equal(state.sendCount,0);assert.equal(state.op.status,'stripe_succeeded');
});

test('webhook, rattrapage et endpoint admin appellent la reprise sans Stripe refunds.create',()=>{
  const webhook=readFileSync('netlify/functions/stripe-webhook.js','utf8');
  const sync=readFileSync('netlify/functions/sync-stripe-refund-accounting.js','utf8');
  assert.match(webhook,/finalizeDelayedStripeRefund\(supabase, stripe, recovered\.operationId\)/);
  assert.match(sync,/finalizePendingStripeRefundOperations\(supabase, stripe\)/);
  assert.match(sync,/dispatchPendingRefundNotifications\(supabase, \{stripe\}\)/);
  assert.match(sync,/notificationReviewCount/);
  for(const file of ['netlify/functions/_lib/refund-notification-outbox.js',
    'netlify/functions/_lib/finalize-delayed-stripe-refund.js']) {
    assert.doesNotMatch(readFileSync(file,'utf8'),/\.refunds\.create\(/);
  }
});

// R2-R1 : le client Supabase réel retourne des builders thenable différés.
// Simuler ce comportement pour empêcher un faux succès quand une RPC n'est pas awaitée.
function deferCompletionRpc(db) {
  const realRpc = db.rpc.bind(db);
  let executions = 0;
  db.rpc = (name, args) => name !== 'complete_refund_notification'
    ? realRpc(name, args)
    : {
      then(onFulfilled, onRejected) {
        return Promise.resolve().then(() => {
          executions++;
          return realRpc(name, args);
        }).then(onFulfilled, onRejected);
      },
    };
  return () => executions;
}

test('R2-R1 : la clôture email attend réellement la RPC thenable avant de confirmer sent', async () => {
  const {db, state, send} = fakeDb({
    op:{...operation,status:'succeeded',result:{booking}},outboxStatus:'pending',
  });
  const executions = deferCompletionRpc(db);
  const result = await dispatchRefundNotification(db,'op1',{send,stripe});
  assert.equal(result.outcome, 'sent');
  assert.equal(executions(), 1, 'la RPC différée doit réellement être exécutée');
  assert.equal(state.outbox.status, 'sent');
  assert.equal(state.sendCount, 1);
  assert.equal(state.logs[0].provider_id, 'resend1');
});

test('R2-R1 : toutes les clôtures sont attendues, y compris needs_review et not_applicable', async () => {
  for (const variant of [
    {status:'needs_review', email:booking.guest_email, response:{ok:false,text:async()=>('429')}},
    {status:'not_applicable', email:null},
  ]) {
    const {db, state, send} = fakeDb({
      op:{...operation,status:'succeeded',result:{booking:{...booking,guest_email:variant.email}}},
      outboxStatus:'pending',
    });
    const executions = deferCompletionRpc(db);
    const sender = variant.response ? async()=>{state.sendCount++;return variant.response;} : send;
    const result = await dispatchRefundNotification(db,'op1',{send:sender,stripe});
    assert.equal(result.outcome,variant.status);
    assert.equal(executions(),1);
    assert.equal(state.outbox.status,variant.status);
  }
});

test('R2-R1 : Resend HTTP 2xx sans identifiant ne peut pas être déclaré envoyé', async () => {
  const {db, state} = fakeDb({
    op:{...operation,status:'succeeded',result:{booking}},outboxStatus:'pending',
  });
  const executions = deferCompletionRpc(db);
  let calls = 0;
  const send = async()=>{calls++;return {ok:true,json:async()=>({})};};
  const first = await dispatchRefundNotification(db,'op1',{send,stripe});
  assert.equal(first.outcome,'needs_review');
  assert.equal(state.outbox.status,'needs_review');
  assert.equal(executions(),1);
  assert.match(first.reason,/identifiant fournisseur/i);
  assert.equal(state.logs[0].status,'error');
  assert.equal(state.logs[0].retry_payload,null);
  await dispatchRefundNotification(db,'op1',{send,stripe});
  assert.equal(calls,1,'pas de deuxième envoi sans preuve de non livraison');
});

test('R2-R1 : réponse Resend non décodable reste needs_review', async () => {
  const {db, state} = fakeDb({
    op:{...operation,status:'succeeded',result:{booking}},outboxStatus:'pending',
  });
  const send=async()=>({ok:true,json:async()=>{throw new Error('payload illisible');}});
  const answer=await dispatchRefundNotification(db,'op1',{send,stripe});
  assert.equal(answer.outcome,'needs_review');
  assert.equal(state.outbox.status,'needs_review');
});

test('R2-R1 : absence de confirmation SQL après envoi bloque la déclaration sent', async () => {
  const {db,state,send}=fakeDb({
    op:{...operation,status:'succeeded',result:{booking}},outboxStatus:'pending',
  });
  const real=db.rpc.bind(db);
  db.rpc=(name,args)=>name==='complete_refund_notification'
    ? Promise.resolve({data:{outcome:'sending'},error:null}) : real(name,args);
  await assert.rejects(dispatchRefundNotification(db,'op1',{send,stripe}),/non confirmée en base/);
  assert.equal(state.sendCount,1);
  assert.equal(state.outbox.status,'sending');
  assert.equal(state.logs.length,0);
  // Aucun second email possible : sending est une revendication irréversible.
  assert.equal((await dispatchRefundNotification(db,'op1',{send,stripe})).outcome,'sending');
  assert.equal(state.sendCount,1);
});

test('R2-R1 : une erreur de notification après COMMIT ne masque pas le remboursement finalisé', async () => {
  const {db,state,send}=fakeDb();
  const real=db.rpc.bind(db);
  db.rpc=(name,args)=>name==='claim_completed_refund_notification'
    ? Promise.resolve({data:null,error:{message:'réseau indisponible'}}) : real(name,args);
  const oldError=console.error;
  console.error=()=>{};
  try {
    const result=await finalizeDelayedStripeRefund(db,stripe,'op1',{send});
    assert.equal(result.outcome,'finalized');
    assert.equal(result.notification,'needs_review');
  } finally { console.error=oldError; }
  assert.equal(state.op.status,'succeeded');
  assert.equal(state.finalizeCount,1);
  assert.equal(state.sendCount,0);
});

test('R2-R1 : une panne Checkout après finalisation n’est pas confondue avec un échec de remboursement', () => {
  const source = readFileSync('netlify/functions/refund-booking-payment.js','utf8');
  assert.match(source,/finalize_stripe_refund_operation_with_notification/);
  assert.match(source,/try\s*\{\s*await expireBookingOpenCheckoutSessions\(stripe, result\.booking\)/);
  assert.match(source,/catch\s*\(error\)\s*\{\s*console\.error\("Expiration Checkout après finalisation/);
});
