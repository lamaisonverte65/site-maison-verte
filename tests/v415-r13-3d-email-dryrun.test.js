import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeGuestLanguage, emailLanguageForAudience } from '../shared/guestLocale.js';
import { buildLocalizedGuestBookingReceipt } from '../netlify/functions/_lib/guest-booking-receipt.js';
import { buildLocalizedBookingDecision } from '../netlify/functions/_lib/guest-booking-decision.js';
import { buildLocalizedPaymentConfirmation } from '../netlify/functions/_lib/guest-payment-confirmation.js';
import { buildLocalizedRefundNotification } from '../netlify/functions/_lib/guest-refund-emails.js';
import {
  buildLocalizedBalanceEmail, buildLocalizedArrivalEmail, buildLocalizedReviewEmail,
} from '../netlify/functions/_lib/guest-scheduled-emails.js';
import {
  buildLocalizedAdditionalChargeEmail, buildLocalizedCleaningEmail,
  buildLocalizedArrivalRecoveryEmail, buildLocalizedExpiredEmail,
  buildLocalizedAdminBookingPaymentEmail, buildLocalizedManualPaymentEmail,
} from '../netlify/functions/_lib/guest-secondary-emails.js';

// Recette totalement hors-ligne : aucun import de client Stripe, Supabase ou Resend.
const booking = Object.freeze({
  id:'v415-test',guest_first_name:'Camille',guest_last_name:'Exemple',
  guest_email:'camille@example.invalid',start_date:'2026-12-20',end_date:'2026-12-25',
  nights:5,arrival_time:'17:30',contract_total:500,
});
const url = 'https://example.invalid/test?booking=v415-test&token=NONVALIDE';
const moneyPattern = /500[.,]00/;
const safe = (output) => {
  assert.equal(typeof output.subject,'string');
  assert.ok(output.subject.trim());
  assert.match(output.html, /La Maison Verte/);
  assert.doesNotMatch(output.html, /<script>|onerror=/i);
};

 test('R13.3d : retour FR des anciens dossiers et français maintenu pour le propriétaire', () => {
   assert.equal(normalizeGuestLanguage(null), 'fr');
   assert.equal(emailLanguageForAudience({}), 'fr');
   assert.equal(emailLanguageForAudience({communication_language:'en'}), 'en');
   assert.equal(emailLanguageForAudience({communication_language:'es'}), 'es');
   assert.equal(emailLanguageForAudience({communication_language:'es'}, 'owner'), 'fr');
   assert.equal(emailLanguageForAudience({communication_language:'unknown'}), 'fr');
 });

for (const lang of ['en','es']) {
 test(`R13.3d ${lang} : demande reçue avec montants et destinataire fictif`, () => {
  const o = buildLocalizedGuestBookingReceipt({communication_language:lang,
    firstName:'Camille',email:booking.guest_email,startDate:booking.start_date,endDate:booking.end_date,
    adults:2,children:0,nights:5,accommodationTotal:450,accommodationGross:450,
    cleaningOption:true,cleaningFee:50,touristTaxAmount:0,total:500,paymentPreference:'deposit',depositRate:0.30,
  });
  safe(o);assert.equal(o.to,'camille@example.invalid');assert.match(o.html,moneyPattern);
 });
 test(`R13.3d ${lang} : décisions accepté/refusé/confirmé et lien factice`, () => {
  const fields={type:'accepted',language:lang,firstName:'Camille',lastName:'Exemple',startDate:booking.start_date,
   endDate:booking.end_date,nights:5,adultsCount:2,childrenCount:0,accommodationNet:450,
   actualDiscount:0,cleaningApplied:50,touristTax:0,displayedPrice:500,amountToPay:150,paymentType:'deposit',
   daysBeforeArrival:45,paymentLink:url,contractUrl:'https://example.invalid/contrat',acceptanceExpiresAt:'2026-11-01T16:00:00Z'};
  const accepted=buildLocalizedBookingDecision(fields);
  assert.match(accepted.content,/example\.invalid\/test/);
  for (const type of ['refused','confirmed']) {
    const o=buildLocalizedBookingDecision({...fields,type});
    assert.ok(o.subject);assert.match(o.content,/Camille/);
    assert.doesNotMatch(o.content,/example\.invalid\/test/);
  }
 });
 test(`R13.3d ${lang} : relances de solde, quatre étapes, URL et montant stables`, () => {
  for(const step of ['request','reminder_1','reminder_2','urgent']) {
   const o=buildLocalizedBalanceEmail({language:lang,booking,paymentLink:url,amount:350,step});
   safe(o);assert.match(o.html,/350[,.]00/);assert.match(o.html,/example\.invalid\/test/);
  }
 });
 test(`R13.3d ${lang} : arrivée Wi-Fi 7, code et livret localisés`, () => {
  const o=buildLocalizedArrivalEmail({language:lang,booking,keyboxCode:'TEST-000',arrivalUrl:url,siteUrl:'https://example.invalid'});
  safe(o);assert.match(o.html,/TEST-000/);assert.match(o.html,new RegExp(`livret\\?lang=${lang}`));
  assert.match(o.html,/example\.invalid\/test/);
 });
 test(`R13.3d ${lang} : demande d'avis, fidélité et deux liens`, () => {
  const o=buildLocalizedReviewEmail({language:lang,booking,reviewUrl:url,googleReviewUrl:'https://example.invalid/google'});
  safe(o);assert.match(o.html,/CLIENTFIDELE/);assert.match(o.text,/example\.invalid\/google/);
 });
 test(`R13.3d ${lang} : confirmation de paiement, aucune donnée d'arrivée après acompte`, () => {
  for(const paymentType of ['deposit','full','balance','manual']) {
   const o=buildLocalizedPaymentConfirmation({language:lang,booking,paymentType,total:500,deposit:150,balance:350,manualAmount:50,manualReason:'cleaning',arrivalUrl:url});
   safe(o);assert.match(o.html,moneyPattern);
   if(paymentType==='deposit') assert.doesNotMatch(o.html,/procedure-boite-a-cles/);
  }
 });
 test(`R13.3d ${lang} : remboursement seul et annulation`, () => {
  for(const refundOnly of [true,false]) {
   const o=buildLocalizedRefundNotification({language:lang,booking,refundOnly,cancellationType:'client',amountEur:75,message:'Message test',policyLabel:'Conditions test'});
   safe(o);assert.match(o.html,/75[,.]00/);
  }
 });
 test(`R13.3d ${lang} : paiements complémentaires, ménage et relance manuelle`, () => {
  const emails=[
   buildLocalizedAdditionalChargeEmail({language:lang,booking,charge:{reason_label:'Test',amount:27,customer_message:'Message test'},paymentLink:url}),
   buildLocalizedCleaningEmail({language:lang,booking,issue:{amount_due:50,notes:'Test'},paymentLink:url}),
   buildLocalizedArrivalRecoveryEmail({language:lang,booking,url}),
   buildLocalizedExpiredEmail({language:lang,booking}),
   buildLocalizedAdminBookingPaymentEmail({language:lang,booking,paymentLink:url,paymentType:'deposit',paymentAmount:150,acceptanceExpiresAt:'2026-11-01T16:00:00Z',message:'Test'}),
   buildLocalizedManualPaymentEmail({language:lang,booking,amount:50,reason:'complement',message:'Test',paymentLink:url}),
  ];
  for(const o of emails) safe(o);
 });
}

test('R13.3d : l’envoi réel reste interdit pour cette recette hors-ligne', () => {
 const file=(name)=>readFileSync(new URL(`../netlify/functions/${name}`,import.meta.url),'utf8');
 for(const name of ['check-balance-payments.js','send-arrival-reminder.js','send-stay-review-request.js']) {
  const src=file(name);
  assert.match(src,/schedule\(/);
  assert.match(src,/resendEmail\(retryPayload\)/);
  assert.match(src,/\.from\("booking_requests"\)/);
 }
});
