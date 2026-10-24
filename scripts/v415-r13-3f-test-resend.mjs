/**
 * La Maison Verte V4.15 — tests réels Resend SANS Supabase ni Stripe.
 * Sans argument : aperçu HTML uniquement. AUCUN envoi.
 * Envoi : --send-one --confirm=OUI-1-TEST, puis --send-remaining --confirm=OUI-8-TESTS, et LMV_R13_3F_TEST_ONLY=1.
 * Destination unique, fixée dans le code ; pas de modification des données.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildPublicBookingEmails } from '../netlify/functions/_lib/public-booking.js';
import { buildLocalizedBookingDecision } from '../netlify/functions/_lib/guest-booking-decision.js';
import { buildLocalizedPaymentConfirmation } from '../netlify/functions/_lib/guest-payment-confirmation.js';
import { buildLocalizedArrivalEmail } from '../netlify/functions/_lib/guest-scheduled-emails.js';
import { resendEmail } from '../netlify/functions/_lib/resend-email.js';
import { evaluateEmailDelivery } from '../netlify/functions/_lib/email-delivery-policy.js';

export const TEST_INBOX = 'lamaisonverte65@gmail.com';
const FROM = 'La Maison Verte <contact@lamaisonverte65.fr>';
const INVALID_URL = 'https://example.invalid/v415-recette-aucune-action';
const TEST_MARKER = 'TEST V4.15 — aucune réservation / aucun paiement';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const booking = Object.freeze({
  guest_first_name: 'Camille', guest_last_name: 'Exemple', guest_email: 'camille@example.invalid',
  start_date: '2026-12-20', end_date: '2026-12-25', nights: 5, arrival_time: '17:30',
  contract_total: 500,
});
const receiptModel = (language) => ({
  communication_language: language,
  firstName:'Camille',lastName:'Exemple', email:'camille@example.invalid',phone:'+33600000000',
  startDate:booking.start_date,endDate:booking.end_date,adults:2,children:0,childrenAges:'',
  nights:5,babyBedNeeded:false,accommodationTotal:450,accommodationGross:450,
  cleaningOption:true,cleaningFee:50,touristTaxAmount:0,total:500,paymentPreference:'deposit',
  depositRate:0.30,promotionCode:'',promotionDiscountAmount:0,additionalContacts:[],message:'',
});
const decisionModel = (language) => ({
  type:'accepted', language, firstName:'Camille',lastName:'Exemple',startDate:booking.start_date,
  endDate:booking.end_date,nights:5,adultsCount:2,childrenCount:0,
  accommodationNet:450,actualDiscount:0,cleaningApplied:50,touristTax:0,
  displayedPrice:500,amountToPay:150,paymentType:'deposit',daysBeforeArrival:45,
  paymentLink:INVALID_URL,contractUrl:'https://example.invalid/contrat-fictif',
  acceptanceExpiresAt:'2026-11-01T16:00:00Z',
});

export function buildTestMessages() {
  const messages = [];
  for (const lang of ['fr','en','es']) {
    const o = buildPublicBookingEmails(receiptModel(lang), {ownerEmail:TEST_INBOX}).guest;
    messages.push({name:`${lang.toUpperCase()} · Demande reçue`,lang,subject:o.subject,html:o.html});
  }
  for(const lang of ['en','es']) {
    const decision = buildLocalizedBookingDecision(decisionModel(lang));
    messages.push({name:`${lang.toUpperCase()} · Demande acceptée`,lang,subject:decision.subject,html:`<h2>${decision.title}</h2>${decision.content}`});
  }
  for(const lang of ['en','es']) {
    const o = buildLocalizedPaymentConfirmation({
      language:lang,booking,paymentType:'deposit',total:500,deposit:150,balance:350,
      manualReason:null,manualAmount:0,arrivalUrl:INVALID_URL,
    });
    messages.push({name:`${lang.toUpperCase()} · Acompte reçu`,lang,...o});
  }
  for(const lang of ['en','es']) {
    const o = buildLocalizedArrivalEmail({
      language:lang,booking,keyboxCode:'CODE-TEST-NON-VALABLE',
      arrivalUrl:INVALID_URL,siteUrl:'https://lamaisonverte65.fr',
    });
    messages.push({name:`${lang.toUpperCase()} · Avant arrivée`,lang,...o});
  }
  if(messages.length !== 9) throw new Error('Nombre inattendu de messages.');
  return messages.map((mail,index)=>({
    ...mail,
    subject:`[TEST V4.15 ${index+1}/9 ${mail.lang.toUpperCase()}] ${mail.subject}`,
    html:`<div style="padding:14px;background:#fff3cd;border:2px solid #b45309;font-family:Arial,sans-serif"><strong>${TEST_MARKER}</strong><br/>Destinataire d'essai unique : ${TEST_INBOX}<br/>Liens de paiement et d'arrivée fictifs ; ne pas cliquer.</div><hr/>${mail.html}`,
  }));
}

const escape = (s) => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export function makePreviewHtml(messages) {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recette emails V4.15 — aperçu</title>
<style>body{font:16px Arial,sans-serif;max-width:920px;margin:20px auto;padding:0 16px}article{border:1px solid #ddd;padding:20px;margin:24px 0;border-radius:8px}article>div{padding:12px;border-top:1px solid #ddd;margin-top:10px}h1{font-size:24px}h2{font-size:20px}</style><h1>Aperçu des 9 emails de test — La Maison Verte</h1><p>AUCUN EMAIL ENVOYÉ depuis cette page. Liens fictifs pour les actions.</p>
${messages.map(m=>`<article><h2>${escape(m.name)}</h2><p><strong>Objet :</strong> ${escape(m.subject)}</p><div>${m.html}</div></article>`).join('\n')}</html>`;
}

export function selectMessagesForSending(messages, mode) {
  if (messages.length !== 9) throw new Error('La recette attend neuf messages.');
  if (mode === 'one') return messages.slice(0, 1);
  if (mode === 'remaining') return messages.slice(1);
  throw new Error("Mode d’envoi invalide : aucun message transmis.");
}

export function testDeliveryEnv() {
  return Object.freeze({
    CONTEXT:'dev', URL:'http://localhost',
    LMV_EMAIL_DELIVERY_MODE:'allowlist',
    LMV_EMAIL_ALLOWED_RECIPIENTS:TEST_INBOX,
  });
}

export function approvedPayload(mail) {
  const payload = Object.freeze({
    from:FROM, to:[TEST_INBOX], reply_to:'contact@lamaisonverte65.fr',
    subject:mail.subject, html:mail.html,
  });
  if(!mail.subject.startsWith('[TEST V4.15 ') || !mail.html.includes(TEST_MARKER)) {
    throw new Error('Message dépourvu du marquage TEST.');
  }
  if (evaluateEmailDelivery(payload,testDeliveryEnv()).allowed !== true) {
    throw new Error('Le verrou de destination a refusé le message.');
  }
  return payload;
}

export async function main(args=process.argv.slice(2)) {
  const messages = buildTestMessages();
  if (args.length === 0 || (args.length === 1 && args[0] === '--preview')) {
    const out = resolve(root,'docs/MD/RECETTE_V415_R13_3F_APERCUS_REELS.html');
    mkdirSync(dirname(out),{recursive:true});
    writeFileSync(out,makePreviewHtml(messages),'utf8');
    console.log(`APERÇU SEUL — aucun email envoyé. ${messages.length} modèles prêts.`);
    for (const item of messages) console.log(` - ${item.name}: ${item.subject}`);
    console.log(`Ouvrir : ${out}`);
    return;
  }
  const one = args.length === 2 && args.includes('--send-one') && args.includes('--confirm=OUI-1-TEST');
  const remaining = args.length === 2 && args.includes('--send-remaining') && args.includes('--confirm=OUI-8-TESTS');
  if ((!one && !remaining) || process.env.LMV_R13_3F_TEST_ONLY !== '1') {
    throw new Error('Envoi refusé : mode et confirmation explicite requis via PowerShell R13.3f.');
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error('RESEND_API_KEY absente. Aucun email envoyé.');
  }
  if(process.env.RESEND_API_KEY.startsWith('re_dummy')) throw new Error('Clé API de démonstration refusée.');
  const env = testDeliveryEnv();
  const sendSet = selectMessagesForSending(messages, one ? 'one' : 'remaining');
  console.log(`Début de ${sendSet.length} envoi(s) vers la seule boîte autorisée : ${TEST_INBOX}`);
  for (const [i, mail] of sendSet.entries()) {
    const position = one ? 1 : i + 2;
    const result = await resendEmail(approvedPayload(mail), {apiKey:process.env.RESEND_API_KEY, env});
    if (!result.ok) {
      const detail = (await result.text()).slice(0, 700);
      // Aucune relance automatique : évite les doublons si le fournisseur a traité la requête.
      throw new Error(`Envoi ${position}/9 refusé (HTTP ${result.status}) : ${detail}`);
    }
    const response = await result.json().catch(() => ({}));
    console.log(`DEMANDE ACCEPTÉE ${position}/9 ${mail.name} — Resend id: ${String(response?.id || 'non fourni')}`);
    if (i < sendSet.length - 1) await new Promise(r => setTimeout(r, 1100));
  }
  console.log('Fin des demandes de test. Vérifier Delivered dans Resend : un ID ne prouve pas la livraison. Aucun accès Supabase ou Stripe.');
}

if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(err=>{console.error(`ARRÊT : ${err.message}`);process.exitCode=1;});
}
