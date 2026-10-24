import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLocalizedBalanceEmail, buildLocalizedArrivalEmail, buildLocalizedReviewEmail } from "../netlify/functions/_lib/guest-scheduled-emails.js";
import { emailLanguageForAudience } from "../shared/guestLocale.js";

const booking = {
  id: "book-5", guest_first_name: "Marta", guest_last_name: "López",
  start_date: "2026-12-20", end_date: "2026-12-24", guest_email: "marta@example.test",
  arrival_time: "17:30", communication_language: "es",
};
const paymentLink = "https://lamaisonverte65.fr/.netlify/functions/create-balance-checkout-session?bookingId=book-5";
for (const lang of ["en", "es"]) {
 test(`R4 ${lang} balance: four steps retain payment URL and total`, () => {
  const subjects = [];
  for (const step of ["request", "reminder_1", "reminder_2", "urgent"]) {
   const out = buildLocalizedBalanceEmail({language:lang,booking,paymentLink,amount:238.28,step});
   subjects.push(out.subject);
   assert.ok(out.html.includes(paymentLink));
   assert.match(out.html,/238[.,]28/);
   assert.match(out.html,/Marta Ló|Marta López/);
   assert.doesNotMatch(out.html, /Solde à payer|Payer le solde|Bonjour/);
  }
  assert.equal(new Set(subjects).size, 4);
 });
 test(`R4 ${lang} arrival: token, code and correct booklet language preserved`, () => {
  const arrivalUrl = "https://lamaisonverte65.fr/arrival?booking=book-5&token=test-token";
  const out = buildLocalizedArrivalEmail({language:lang,booking,keyboxCode:"1234",arrivalUrl,siteUrl:"https://lamaisonverte65.fr"});
  assert.ok(out.html.includes("1234"));
  assert.ok(out.html.includes(arrivalUrl.replace("&", "&amp;")));
  assert.ok(out.html.includes(`procedure-boite-a-cles-${lang}.webp`));
  assert.ok(out.html.includes(`/livret?lang=${lang}`));
  assert.match(out.html,/17:30/);
  assert.doesNotMatch(out.html, /Bonjour|Récupération des clés/);
 });
 test(`R4 ${lang} review: working links, 10% offer, both formats`, () => {
  const reviewUrl = "https://lamaisonverte65.fr/?review=1&booking=book-5#laisser-un-avis";
  const googleReviewUrl = "https://g.page/test/review";
  const out = buildLocalizedReviewEmail({language:lang,booking,reviewUrl,googleReviewUrl});
  assert.ok(out.html.includes(reviewUrl.replace("&", "&amp;")));
  assert.ok(out.html.includes(googleReviewUrl));
  assert.ok(out.text.includes(reviewUrl));
  assert.ok(out.text.includes(googleReviewUrl));
  assert.ok(out.html.includes("CLIENTFIDELE"));
  assert.match(out.html,/10\s*%/);
  assert.doesNotMatch(out.html,/Merci pour votre séjour|Laisser un avis/);
 });
}
test("R4 safe: fallback FR for existing bookings and owner emails", () => {
 assert.equal(emailLanguageForAudience({}),"fr");
 assert.equal(emailLanguageForAudience({communication_language:"es"},"owner"),"fr");
 assert.throws(()=>buildLocalizedBalanceEmail({language:"fr",booking,step:"request"}));
 assert.throws(()=>buildLocalizedBalanceEmail({language:"en",booking,step:"invalid"}));
});
test("R4 secure rendering: guest fields and URLs are escaped", () => {
 const out = buildLocalizedArrivalEmail({language:"en",booking:{...booking,guest_first_name:"<script>"},keyboxCode:"<123>",arrivalUrl:"https://example.test/?a=1&b=2",siteUrl:"https://lamaisonverte65.fr"});
 assert.doesNotMatch(out.html, /<script>|<123>/);
 assert.match(out.html,/&lt;script&gt;/);
 assert.match(out.html,/&lt;123&gt;/);
 assert.match(out.html,/a=1&amp;b=2/);
});
test("R4 integration: senders keep their schedules and FR templates", () => {
 const read=(file)=>readFileSync(new URL(`../netlify/functions/${file}`,import.meta.url),"utf8");
 const b=read("check-balance-payments.js");
 assert.match(b,/schedule\("0 8 \* \* \*"/);
 assert.match(b,/Paiement du solde/);
 assert.match(b,/sendOwnerJ17Alert/);
 assert.match(b,/emailLanguageForAudience\(booking\)/);
 assert.match(b,/retryPayload/);
 const a=read("send-arrival-reminder.js");
 assert.match(a,/schedule\("0 9 \* \* \*"/);
 assert.match(a,/createArrivalToken\(booking\)/);
 assert.match(a,/Préparez votre arrivée à La Maison Verte/);
 assert.match(a,/emailLanguageForAudience\(booking\)/);
 const r=read("send-stay-review-request.js");
 assert.match(r,/schedule\("0 10 \* \* \*"/);
 assert.match(r,/Merci pour votre séjour à La Maison Verte/);
 assert.match(r,/emailLanguageForAudience\(booking\)/);
});
test("R4 source unchanged for transactional side effects and retry content", () => {
 const b=readFileSync(new URL("../netlify/functions/check-balance-payments.js",import.meta.url),"utf8");
 assert.match(b,/const balance = Math.max\(total - totalPaid, 0\)/);
 assert.match(b,/balanceStepMarker\(step\)/);
 assert.match(b,/subject: emailSubject/);
 assert.match(b,/html: emailHtml/);
 const a=readFileSync(new URL("../netlify/functions/send-arrival-reminder.js",import.meta.url),"utf8");
 assert.match(a,/arrival_token_hash: capability.hash/);
 assert.match(a,/subject: emailSubject/);
 assert.match(a,/html: emailHtml/);
 const r=readFileSync(new URL("../netlify/functions/send-stay-review-request.js",import.meta.url),"utf8");
 assert.match(r,/subject: emailSubject/);
 assert.match(r,/html: emailHtml/);
 assert.match(r,/text: emailText/);
});
