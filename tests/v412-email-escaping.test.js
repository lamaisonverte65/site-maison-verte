import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { escapeHtml } from "../netlify/functions/_lib/html.js";

for (const file of ["check-balance-payments", "check-expired-bookings", "create-personal-booking", "create-balance-checkout-session", "refund-booking-payment", "send-stay-review-request"]) {
  test(`${file}: rendered email escapes client data and free text`, () => {
    const source=fs.readFileSync(new URL(`../netlify/functions/${file}.js`,import.meta.url),"utf8");
    const attack='<img src=x onerror="alert(1)">';
    const booking={guest_first_name:attack,guest_last_name:attack,guest_phone:attack,guest_email:attack,start_date:'2027-01-01',end_date:'2027-01-04',nights:3};
    const scope={escapeHtml,booking,name:attack,message:attack,policyLabel:attack,clientEmailStatus:attack,
      labels:{request:'Paiement'},intro:{request:'Paiement'},step:'request',label:'Paiement',subject:'Paiement',
      amount:50,balance:50,paymentAmount:50,isFull:false,refundedAmount:50,refundParagraph:'<p>Remboursement</p>',
      acceptanceExpiresAt:'2027-01-01',paymentLink:'https://example.test/pay',adminUrl:'https://example.test/admin',
      reviewUrl:'https://example.test/review',GOOGLE_REVIEW_URL:'https://example.test/review',
      formatDate:()=> '01/01/2027',formatMoney:()=> '50 €',formatCurrency:()=> '50 €',getTotalDue:()=>50};
    const templates=[...source.matchAll(/const html = (`[\s\S]*?`);/g)];
    assert.ok(templates.length>0);
    for (const [,template] of templates) {
      const html=vm.runInNewContext(template,scope);
      assert.ok(!html.includes(attack), 'unescaped HTML input in rendered email');
      assert.ok(html.includes('&lt;img'), 'name must remain visible as text');
    }
  });
}
