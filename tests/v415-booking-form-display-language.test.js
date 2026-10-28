import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getBookingFormCopy, interpolateBookingCopy, formatBookingMoney, formatBookingCalendarMoney } from '../src/components/home/bookingFormTranslations.js';

const page = readFileSync(new URL('../src/pages/MaisonVerte.jsx', import.meta.url), 'utf8');
const messages = ['fr', 'en', 'es'].map(lang => [lang, getBookingFormCopy(lang)]);

test('R11.1: FR par défaut et affichage historique conservé', () => {
  assert.equal(getBookingFormCopy('fr').title, 'Réserver votre séjour');
  assert.equal(getBookingFormCopy('de').title, 'Réserver votre séjour');
  assert.equal(getBookingFormCopy().title, 'Réserver votre séjour');
  assert.equal(formatBookingMoney(75, 'fr'), '75€');
  assert.equal(getBookingFormCopy('fr').weekdays.join(','), 'Lun,Mar,Mer,Jeu,Ven,Sam,Dim');
});

test('R11.1: tous les textes possèdent leurs versions FR/EN/ES', () => {
  const reference = Object.keys(messages[0][1]).sort();
  for (const [lang, copy] of messages) {
    assert.deepEqual(Object.keys(copy).sort(), reference, `${lang}: clés manquantes`);
    for (const [key, value] of Object.entries(copy)) {
      if (key === 'contractFrenchNotice' && lang === 'fr') continue;
      assert.ok(Array.isArray(value) ? value.length === 7 : String(value).trim(), `${lang}.${key}`);
    }
  }
});

test('R11.1: calendrier et placeholders des contacts localisés', () => {
  assert.deepEqual(getBookingFormCopy('en').weekdays, ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
  assert.deepEqual(getBookingFormCopy('es').weekdays, ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']);
  for (const [, copy] of messages) {
    for (const key of ['arrival','departure','firstName','lastName','email','phone','address','postalCode','city','country','additional','removeContact']) assert.ok(copy[key]);
  }
  assert.match(page, /currentMonth\.toLocaleDateString\(siteLanguage === "es"/);
  assert.match(page, /bookingDisplayDate\(selectedDates\[0\]\)/);
  assert.match(page, /bookingCopy\.weekdays\.map/);
});

test('R11.1: informations de paiement et nettoyage complètes en EN/ES', () => {
  for (const lang of ['en','es']) {
    const c = getBookingFormCopy(lang);
    for (const key of ['paymentTitle','depositInfo','fullPaymentChoice','fullPaymentRequired','cleaningWarning','cleaningDuties','cleaningInspection','cleaningConsent','totalToPay','balance','tax']) assert.ok(c[key]);
    assert.match(c.depositInfo, /\{percent\}/);
    assert.match(c.cleaningConsent, /\{fee\}/);
    assert.ok(c.contractFrenchNotice.length > 20);
  }
});

test('R11.1: variables interpolées uniquement dans le texte', () => {
  assert.equal(interpolateBookingCopy('A {nights} / {fee}', {nights: 3, fee: '15 €'}),'A 3 / 15 €');
  assert.equal(interpolateBookingCopy(getBookingFormCopy('es').minimumStay, {nights: 5}), 'Estancia mínima: 5 noches para estas fechas.');
  assert.equal(interpolateBookingCopy(getBookingFormCopy('en').depositToPay, {percent: 30}), 'Deposit due (30%)');
});

test('R11.1: montants affichés selon la langue sans recalcul de prix', () => {
  assert.equal(formatBookingMoney(1000.5,'en'),new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(1000.5));
  assert.equal(formatBookingMoney(1000.5,'es'),new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(1000.5));
  assert.match(page, /bookingMoney\(displayedAccommodationTotal\)/);
  assert.match(page, /bookingMoney\(touristTaxAmount\)/);
  assert.match(page, /bookingMoney\(total\)/);
  assert.match(page, /bookingMoney\(depositAmount\)/);
  assert.match(page, /bookingMoney\(balanceAmount\)/);
  assert.equal(formatBookingCalendarMoney(95, 'en'), '€95');
  assert.equal(formatBookingCalendarMoney(95, 'es').replace(/\u00a0/g, ' '), '95 €'.replace(/\u00a0/g, ' '));
  assert.equal(formatBookingCalendarMoney(95.5, 'fr'), '95.5€');
});

test('R11.1: règles de prix, taxe, sélection et requête serveur non modifiées', () => {
  for (const required of [
    'selectionContainsUnavailableNight(',
    'setSelectedDates([realStart, end])',
    '"/.netlify/functions/booking-quote"',
    'setBookingQuote(await response.json())',
    'bookingQuote?.total ??',
    'bookingQuote?.touristTax ??',
    'bookingQuote?.depositRate ??',
    'submitPublicBooking({',
    'communicationLanguage: guestLanguageFromUrl(window.location.href)',
  ]) assert.ok(page.includes(required), `invariant absent: ${required}`);
});

test('R11.1/R4: endpoints et référence contractuelle conservés, PDF public selon la langue', () => {
  assert.match(page, /href=\{contractPdfHref\}/);
  assert.match(page, /\/documents\/contrat-location-en\.pdf/);
  assert.match(page, /\/documents\/contrat-location-es\.pdf/);
  assert.match(page, /\/documents\/contrat-location\.pdf/);
  assert.match(page, /localizePublicHref\("\/livret", siteLanguage\)/);
  assert.match(page, /bookingCopy\.contractFrenchNotice/);
  assert.match(page, /const canSubmitRequest =/);
  assert.match(page, /const \[bookingQuoteLoading/);
});
