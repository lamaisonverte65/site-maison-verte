import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLocalizedPaymentConfirmation } from '../netlify/functions/_lib/guest-payment-confirmation.js';

const booking = { id: 'booking-1', guest_first_name: 'Ana', guest_last_name: 'López',
  guest_email: 'ana@example.test', nights: 5, start_date: '2026-12-20', end_date: '2026-12-25' };
const base = { booking, total: 480, deposit: 144, balance: 336,
  manualAmount: 79.5, manualReason: 'complement',
  arrivalUrl: 'https://lamaisonverte65.fr/arrival?booking=booking-1&token=abc123' };

for (const lang of ['en', 'es']) {
  test(`R6 ${lang} : acompte sans informations prématurées`, () => {
    const out = buildLocalizedPaymentConfirmation({ ...base, language: lang, paymentType: 'deposit' });
    assert.match(out.subject, lang === 'en' ? /Deposit received/ : /Anticipo recibido/);
    assert.match(out.html, /144[,.]00/);
    assert.match(out.html, /336[,.]00/);
    assert.match(out.html, lang === 'en' ? /30 days before arrival/ : /30 días antes de su llegada/);
    assert.doesNotMatch(out.html, /procedure-boite-a-cles/);
    assert.doesNotMatch(out.html, /<a href="https:\/\/lamaisonverte65.fr\/arrival/);
  });
  test(`R6 ${lang} : paiement intégral avec livret et procédure de la bonne langue`, () => {
    const out = buildLocalizedPaymentConfirmation({ ...base, language: lang, paymentType: 'full' });
    assert.match(out.html, /480[,.]00/);
    assert.match(out.html, new RegExp(`procedure-boite-a-cles-${lang}\\.webp`));
    assert.match(out.html, new RegExp(`livret\\?lang=${lang}`));
    assert.match(out.html, /arrival\?booking=booking-1&amp;token=abc123/);
    assert.doesNotMatch(out.html, /Consulter le livret d.accueil|Bonjour|Acompte reçu/);
  });
  test(`R6 ${lang} : solde reçu garde les montants et les dates`, () => {
    const out = buildLocalizedPaymentConfirmation({ ...base, language: lang, paymentType: 'balance' });
    assert.match(out.html, /79[,.]50/);
    assert.match(out.html, /480[,.]00/);
    assert.match(out.html, /20/);
    assert.match(out.subject, lang === 'en' ? /Balance received/ : /Saldo recibido/);
  });
  test(`R6 ${lang} : paiement complémentaire sans instructions d'arrivée`, () => {
    const out = buildLocalizedPaymentConfirmation({ ...base, language: lang, paymentType: 'manual', manualReason: 'cleaning' });
    assert.match(out.html, /79[,.]50/);
    assert.match(out.html, lang === 'en' ? /Post-stay cleaning/ : /Limpieza posterior/);
    assert.doesNotMatch(out.html, /procedure-boite-a-cles/);
  });
}

test('R6 : textes client échappés et URL arrivée hostile exclue', () => {
  const out = buildLocalizedPaymentConfirmation({ ...base, language: 'en', paymentType: 'full',
    booking: { ...booking, guest_first_name: '<img src=x onerror=alert(1)>' },
    arrivalUrl: 'https://evil.example/arrival?booking=x' });
  assert.match(out.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(out.html, /<img src=x/);
  assert.doesNotMatch(out.html, /evil\.example/);
});
test('R6 : le modèle historique FR n’est jamais généré par le module EN/ES', () => {
  assert.throws(() => buildLocalizedPaymentConfirmation({ ...base, language: 'fr', paymentType: 'deposit' }));
  const source = readFileSync(new URL('../netlify/functions/stripe-webhook.js', import.meta.url), 'utf8');
  assert.match(source, /const frenchHtml = `/);
  assert.match(source, /localized\?\.html \?\? frenchHtml/);
  assert.match(source, /emailLanguageForAudience\(booking, "guest"\)/);
  assert.match(source, /const subject = localized\?\.subject/);
  assert.match(source, /sendOwnerPaymentStatusEmail/);
});
test('R6 : le webhook maintient sujet, HTML et retry identiques pour le journal', () => {
  const source = readFileSync(new URL('../netlify/functions/stripe-webhook.js', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('async function sendPaymentConfirmationEmail('), source.indexOf('async function sendOwnerPaymentStatusEmail('));
  assert.match(block, /const retryPayload = \{[\s\S]*?subject,[\s\S]*?html,/);
  assert.equal((block.match(/\n\s+subject,/g) || []).length, 3);
  assert.match(block, /logEmail\(/);
  assert.doesNotMatch(block, /stripe\.refunds\.create|stripe\.checkout\.sessions\.create|update\(\{/);
});
