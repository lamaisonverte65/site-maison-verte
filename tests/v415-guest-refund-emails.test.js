import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildRefundNotificationPayload} from '../netlify/functions/_lib/refund-notification-outbox.js';
import {buildLocalizedRefundNotification} from '../netlify/functions/_lib/guest-refund-emails.js';
const booking = {id:'b-5',guest_email:'ana@example.test',guest_first_name:'Ana',guest_last_name:'López',
  start_date:'2026-12-21',end_date:'2026-12-27',status:'cancelled',communication_language:'es'};
const make = (lang,action='refund_only',amount=23828,cancellation='client') => ({
 id:'op-5',booking_request_id:'b-5',status:'succeeded',action,cancellation_type:cancellation,
 message:'Message libre <script>alert(1)</script>',policy_label:'Règle française (J-30) & dépôt',
 refunded_amount_cents:amount,result:{booking:{...booking,communication_language:lang}}
});
for(const language of ['en','es']) {
 test(`R5 ${language}: remboursement avec montant, dates et texte original`,()=>{
  const out = buildRefundNotificationPayload(make(language));
  assert.equal(out.emailType,'refund_only');
  assert.match(out.payload.subject,/Refund|Reembolso/);
  assert.match(out.payload.html,/238[.,]28/);
  assert.match(out.payload.html,/Règle française \(J-30\) &amp; dépôt/);
  assert.match(out.payload.html,/Message libre &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(out.payload.html,/<script>/);
  assert.doesNotMatch(out.payload.html,/Bonjour|Remboursement effectué/);
 });
 for(const cancellationType of ['owner','client']) {
  test(`R5 ${language}: annulation ${cancellationType} avec remboursement`,()=>{
   const out = buildRefundNotificationPayload(make(language,'cancel_refund',1000,cancellationType));
   assert.equal(out.emailType,'booking_cancelled_refund');
   assert.match(out.payload.html,/10[.,]00/);
   assert.match(out.payload.subject,/Cancellation|cancellation|Cancelaci[oó]n|cancelaci[oó]n/);
   assert.equal(out.metadata.refundedAmount,10);
  });
 }
 test(`R5 ${language}: annulation sans remboursement`,()=>{
  const out=buildRefundNotificationPayload(make(language,'cancel_refund',0));
  assert.match(out.payload.html, /No Stripe refund|No se ha iniciado ning[uú]n reembolso/);
  assert.doesNotMatch(out.payload.html,/238[.,]28/);
 });
}
test('R5 français historique intact et repli FR si langue inconnue',()=>{
 const fr=buildRefundNotificationPayload(make('fr'));
 const missing=buildRefundNotificationPayload(make(undefined));
 assert.match(fr.payload.subject,/Remboursement effectué/);
 assert.equal(fr.payload.html,missing.payload.html);
 assert.match(fr.payload.html,/Bonjour/);
 assert.throws(()=>buildLocalizedRefundNotification({language:'fr',booking,refundOnly:true,cancellationType:'client',amountEur:5}));
});
test('R5 politique : montants négatifs / opération non finalisée sont refusés',()=>{
 assert.throws(()=>buildRefundNotificationPayload(make('es','refund_only',-1)));
 assert.throws(()=>buildRefundNotificationPayload({...make('en'),status:'pending'}));
 assert.throws(()=>buildRefundNotificationPayload({...make('es','cancel_refund'),result:{booking:{...booking,status:'accepted'}}}));
});
test('R5 intégration : seule notification outbox est modifiée ; aucune réémission métier',()=>{
 const text=readFileSync(new URL('../netlify/functions/_lib/refund-notification-outbox.js',import.meta.url),'utf8');
 assert.match(text,/emailLanguageForAudience\(booking\)/);
 assert.match(text,/localized\?\.subject \|\| subject/);
 assert.match(text,/claim_completed_refund_notification/);
 assert.match(text,/retry_payload:null/);
 assert.match(text,/expireBookingOpenCheckoutSessions/);
});
