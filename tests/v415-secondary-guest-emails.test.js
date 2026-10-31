import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildLocalizedAdditionalChargeEmail, buildLocalizedCleaningEmail,
  buildLocalizedArrivalRecoveryEmail, buildLocalizedExpiredEmail,
  buildLocalizedAdminBookingPaymentEmail, buildLocalizedManualPaymentEmail,
} from '../netlify/functions/_lib/guest-secondary-emails.js';
import { buildLocalizedBalanceEmail } from '../netlify/functions/_lib/guest-scheduled-emails.js';
const booking={id:'r8',guest_first_name:'Irene',guest_last_name:'García',guest_email:'irene@example.test',start_date:'2026-12-20',end_date:'2026-12-25',nights:5,contract_total:420,communication_language:'es'};
const paymentLink='https://checkout.stripe.com/c/pay?id=abc&src=r8';
const arrivalUrl='https://lamaisonverte65.fr/arrival?booking=r8&token=test&lang=es';
const read = (path) => readFileSync(new URL(`../netlify/functions/${path}`,import.meta.url),'utf8');
for (const language of ['en','es']) {
  test(`R8 ${language} additional charge keeps exact custom reason, amount and Stripe URL`,()=>{
    const out=buildLocalizedAdditionalChargeEmail({language,booking,charge:{reason_label:'Frais inventaire',amount:34.21,customer_message:'Merci de vérifier'},paymentLink});
    assert.ok(out.subject && out.html.includes('34') && out.html.includes('21'));
    assert.ok(out.html.includes('Frais inventaire') && out.html.includes('Merci de vérifier'));
    assert.ok(out.html.includes('checkout.stripe.com/c/pay?id=abc&amp;src=r8'));
    assert.doesNotMatch(out.html,/Demande de paiement complémentaire|Bonjour/);
  });
  test(`R8 ${language} post-stay cleaning keeps evidence and amount`,()=>{
    const out=buildLocalizedCleaningEmail({language,booking,issue:{amount_due:49,notes:'Vaisselle laissée'},paymentLink});
    assert.ok(out.html.includes('Vaisselle laissée') && out.html.includes('49'));
    assert.ok(out.html.includes('checkout.stripe.com'));
    assert.doesNotMatch(out.html,/Ménage après séjour|Bonjour/);
  });
  test(`R8 ${language} arrival recovery preserves token, no new public link`,()=>{
    const out=buildLocalizedArrivalRecoveryEmail({language,booking,url:arrivalUrl});
    assert.ok(out.html.includes('booking=r8&amp;token=test&amp;lang=es'));
    assert.ok(out.subject && !out.html.includes('Nouveau lien sécurisé'));
  });
  test(`R8 ${language} expiry preserves dates, no false payment statement`,()=>{
    const out=buildLocalizedExpiredEmail({language,booking});
    assert.ok(out.html.includes('2026') && out.html.includes('Irene'));
    assert.doesNotMatch(out.html,/Votre demande de réservation a expiré/);
  });
  test(`R8 ${language} admin-created deposit/full payments preserve amount, expiration and owner message`,()=>{
    for (const paymentType of ['full','deposit']) {
      const out=buildLocalizedAdminBookingPaymentEmail({language,booking,paymentLink,paymentType,paymentAmount:126,acceptanceExpiresAt:'2026-12-01T15:00:00Z',message:'Merci pour votre visite'});
      assert.ok(out.html.includes('126') && out.html.includes('420'));
      assert.ok(out.html.includes('Merci pour votre visite'));
      assert.ok(out.html.includes('checkout.stripe.com'));
      assert.match(out.html,/2026/);
    }
  });
  test(`R8 ${language} alternative manual payment endpoint labels financial types`,()=>{
    for (const reason of ['acompte','solde','total','complement']) {
      const out=buildLocalizedManualPaymentEmail({language,booking,amount:62.50,reason,message:'Message de l’hôte',paymentLink});
      assert.ok(out.html.includes('62') && out.html.includes('50') && out.html.includes('Message de l’hôte'));
      assert.ok(out.html.includes('checkout.stripe.com'));
      assert.doesNotMatch(out.html,/Bonjour|à régler/);
    }
  });
  test(`R8 ${language} legacy balance email reuses R4 four-step translations`,()=>{
    for (const step of ['request','reminder_1','reminder_2','urgent']) {
      const out=buildLocalizedBalanceEmail({language,booking,paymentLink,amount:100,step});
      assert.ok(out.html.includes('checkout.stripe.com'));
      assert.doesNotMatch(out.html,/Bonjour|Payer le solde/);
    }
  });
}
test('R8 French models always stay in existing sender functions',()=>{
  const fns=[buildLocalizedAdditionalChargeEmail,buildLocalizedCleaningEmail,buildLocalizedArrivalRecoveryEmail,buildLocalizedExpiredEmail,buildLocalizedAdminBookingPaymentEmail,buildLocalizedManualPaymentEmail];
  for (const fn of fns) assert.throws(()=>fn({language:'fr'}),/French|français/i);
  assert.match(read('_lib/additional-charge-email.js'),/Demande de paiement complémentaire/);
  assert.match(read('create-cleaning-payment-session.js'),/Ménage après séjour/);
  assert.match(read('check-expired-bookings.js'),/Votre demande de réservation a expiré/);
});
test('R8 new email texts escape guest fields, free text, URLs and original reasoning',()=>{
  const b={...booking,guest_first_name:'<script>alert(1)</script>'};
  const out=buildLocalizedAdditionalChargeEmail({language:'en',booking:b,charge:{reason_label:'<b>reason</b>',amount:3.50,customer_message:'<img src=x>'},paymentLink});
  assert.doesNotMatch(out.html,/<script>|<b>reason<\/b>|<img src=x>/);
  assert.ok(out.html.includes('&lt;script&gt;') && out.html.includes('&lt;b&gt;reason&lt;/b&gt;'));
});
test('R8 integrations use booking language; no changes to Stripe checkout, mail retry or owner emails',()=>{
  for (const fname of ['_lib/additional-charge-email.js','create-cleaning-payment-session.js','request-arrival-link.js','check-expired-bookings.js','create-personal-booking.js','create-manual-payment-session.js','create-balance-checkout-session.js']) {
    const s=read(fname);
    assert.match(s,/emailLanguageForAudience\(booking\)/,fname);
    assert.match(s,/language === "fr" \? null|language === "fr" \? \{ subject, html \}/,fname);
  }
  for (const fname of ['create-cleaning-payment-session.js','create-additional-charge-session.js','request-arrival-link.js']) assert.match(read(fname),/guest_email,communication_language|guest_last_name,communication_language/);
  const arrival=read('request-arrival-link.js');
  assert.match(arrival,/recoverArrivalLink\(input/);
  assert.match(arrival,/const opaqueKey/);
  assert.match(read('check-expired-bookings.js'),/sendOwner/);
  assert.match(read('create-manual-payment-session.js'),/openManualPaymentCheckout\(\{/);
  assert.match(read('_lib/manual-payment-checkout.js'),/stripe\.checkout\.sessions\.create/);
  assert.doesNotMatch(read('create-manual-payment-session.js'),/stripe\.checkout\.sessions\.create/);
  assert.match(read('create-cleaning-payment-session.js'),/openSpecialPaymentCheckout/);
  assert.match(read('_lib/special-payment-checkout.js'),/stripe\.checkout\.sessions\.create/);
  assert.match(read('_lib/additional-charge-email.js'),/retry_payload:/);
});
test('R8 Spanish and English localized subjects recorded with retry payloads',()=>{
  assert.match(read('_lib/additional-charge-email.js'),/subject,\s*status:/);
  assert.match(read('create-cleaning-payment-session.js'),/subject: emailSubject, status:/);
  assert.match(read('create-balance-checkout-session.js'),/subject: emailSubject/);
  assert.match(read('create-manual-payment-session.js'),/subject: emailSubject, status:/);
  assert.match(read('check-expired-bookings.js'),/subject: emailSubject/);
  assert.match(read('request-arrival-link.js'),/subject: value.subject \|\| localizedSubject/);
  assert.match(read('_lib/arrival-link-recovery.js'),/status: \"error\",[\s\S]*?booking,/);
  assert.match(read('check-expired-bookings.js'),/subject: emailSubject,\s*status: \"sent\"/);
});

test('R8 owner-only internal notes never enter an admin-created booking payment email',()=>{
 const src=read('create-personal-booking.js');
 assert.match(src,/internal_notes: internalNotes/);
 assert.match(src,/await sendAdminBookingPaymentEmail\(\{[\s\S]*?message: null,[\s\S]*?\}\);/);
 assert.doesNotMatch(src,/await sendAdminBookingPaymentEmail\(\{[\s\S]*?message: internalNotes,/);
});
