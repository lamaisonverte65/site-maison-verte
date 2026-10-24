import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getBookingFormCopy, interpolateBookingCopy, localizeBookingFailure,
} from '../src/components/home/bookingFormTranslations.js';

const page = readFileSync(new URL('../src/pages/MaisonVerte.jsx', import.meta.url), 'utf8');
const submission = readFileSync(new URL('../src/utils/publicBookingSubmission.js', import.meta.url), 'utf8');
const langs = ['fr', 'en', 'es'];
const copy = Object.fromEntries(langs.map(language => [language, getBookingFormCopy(language)]));

const failureCases = {
  validation: 'errorValidation', date_conflict: 'errorDateConflict',
  duplicate: 'errorDuplicate', rate_limit: 'errorRateLimit',
  server_error: 'errorServer', timeout: 'errorTimeout', network_error: 'errorNetwork',
};

test('R11.2: les trois langues possèdent chaque message de validation et de confirmation', () => {
  const keys = Object.keys(copy.fr).sort();
  for (const lang of langs) {
    assert.deepEqual(Object.keys(copy[lang]).sort(), keys);
    for (const key of [
      'errorRequired', 'errorTooLong', 'errorEmailRequired', 'errorEmailInvalid',
      'errorPhoneRequired', 'errorPhoneInvalid', 'errorEmailDuplicate', 'errorPhoneDuplicate',
      'errorStayMinimum', 'errorChildrenAges', 'errorGuestCount', 'errorContract',
      'errorUnexpected', 'validationTitle', 'validationHelp', 'sendingNotice',
      'sendingButton', 'submitButton', 'confirmationTitle', 'confirmationPending',
      'confirmationEmail', 'confirmationSpamTitle', 'confirmationSpamHelp',
      'confirmationPayment', 'confirmationAdditionalContacts', 'confirmationClose',
    ]) assert.ok(copy[lang][key].trim(), `${lang}.${key}`);
  }
});

test('R11.2: les erreurs du backend sont localisées à partir du code stable', () => {
  for (const [kind, key] of Object.entries(failureCases)) {
    for (const lang of ['en','es']) {
      assert.equal(localizeBookingFailure(kind, lang, 'Échec serveur français'), copy[lang][key]);
      assert.doesNotMatch(localizeBookingFailure(kind, lang, 'Échec serveur français'), /Échec serveur français/);
    }
  }
});

test('R11.2: les messages français historiques du serveur sont conservés à l’identique', () => {
  const message = 'Certaines informations sont invalides. Vérifiez le formulaire puis réessayez.';
  assert.equal(localizeBookingFailure('validation', 'fr', message), message);
  assert.equal(localizeBookingFailure('validation', null, message), message);
  assert.equal(copy.fr.errorUnexpected, 'Une erreur inattendue est survenue. Vos informations sont conservées ; réessayez.');
  assert.equal(copy.fr.validationTitle, 'Votre demande ne peut pas encore être envoyée.');
  assert.equal(copy.fr.submitButton, 'Faire une demande de réservation');
});

test('R11.2: codes inconnus ne révèlent pas un texte serveur français sur les pages traduites', () => {
  for (const lang of ['en','es']) {
    assert.equal(localizeBookingFailure('unexpected_kind', lang, 'Erreur technique française'), copy[lang].errorServer);
  }
});

test('R11.2: les erreurs de champs restent paramétrées, sans altérer les limites de taille', () => {
  assert.equal(interpolateBookingCopy(copy.fr.errorRequired, {field:'Prénom'}), 'Prénom requis.');
  assert.equal(interpolateBookingCopy(copy.en.errorRequired, {field:copy.en.fieldFirstName}), 'First name is required.');
  assert.equal(interpolateBookingCopy(copy.es.errorRequired, {field:copy.es.fieldFirstName}), 'Nombre: campo obligatorio.');
  assert.equal(interpolateBookingCopy(copy.es.errorTooLong, {field:copy.es.fieldPostalCode,max:20}), 'Código postal: demasiados caracteres (máximo 20).');
  for (const limit of [80, 200, 20, 100, 254, 32]) assert.ok(page.includes(String(limit)));
  assert.match(page, /EMAIL_PATTERN\.test\(text\)/);
  assert.match(page, /PHONE_PATTERN\.test\(text\)/);
});

test('R11.2: contrôle des contacts et doublons traduit et non désactivé', () => {
  assert.match(page, /emailDuplicate = Boolean\(email\)/);
  assert.match(page, /phoneDuplicate = Boolean\(phone\)/);
  assert.match(page, /bookingCopy\.errorEmailDuplicate/);
  assert.match(page, /bookingCopy\.errorPhoneDuplicate/);
  assert.match(page, /bookingCopy\.errorTooLong/);
  assert.match(page, /bookingText\(bookingCopy\.contactNumber, \{ number: index \+ 2 \}\)/);
});

test('R11.2: durée minimum, enfants et consentement restent bloquants', () => {
  assert.match(page, /numberOfNights < minimumNights/);
  assert.match(page, /bookingText\(bookingCopy\.errorStayMinimum, \{ nights: minimumNights \}\)/);
  assert.match(page, /bookingCopy\.errorChildrenAges/);
  assert.match(page, /bookingCopy\.errorGuestCount/);
  assert.match(page, /bookingCopy\.errorContract/);
  assert.match(page, /!contractAccepted/);
  assert.match(page, /cleaningOption \|\| cleaningObligationsAccepted/);
});

test('R11.2: titres, états et bouton de validation utilisent la langue choisie', () => {
  for (const key of ['validationTitle','validationHelp','sendingNotice','sendingButton','submitButton']) {
    assert.ok(page.includes(`bookingCopy.${key}`), key);
  }
  assert.match(page, /setBookingValidationErrors\(\[localizeBookingFailure\(outcome\.kind, siteLanguage, outcome\.message\)\]\)/);
  assert.match(page, /setBookingValidationErrors\(\[bookingCopy\.errorUnexpected\]\)/);
});

test('R11.2: confirmation normale, email en attente et contacts à vérifier restent distincts', () => {
  assert.match(page, /bookingConfirmation\.confirmationPending \?/);
  assert.match(page, /bookingConfirmation\.additionalContactsPending &&/);
  for (const key of ['confirmationTitle','confirmationPending','confirmationEmail','confirmationSpamTitle',
    'confirmationSpamHelp','confirmationPayment','confirmationAdditionalContacts','confirmationClose']) {
    assert.ok(page.includes(`bookingCopy.${key}`), key);
  }
  assert.match(page, /setBookingConfirmation\(null\)/);
});

test('R11.2: un échec ne vide pas le formulaire; double clic et reset au succès préservés', () => {
  assert.match(page, /if \(bookingSubmitLockRef\.current \|\| bookingSubmitting\)/);
  assert.match(page, /bookingSubmitLockRef\.current = true;/);
  assert.match(page, /if \(!outcome\.success\)/);
  assert.match(page, /setBookingConfirmation\(\{/);
  assert.match(page, /setGuestFirstName\(""\)/);
  assert.match(page, /bookingSubmitLockRef\.current = false;/);
  assert.match(submission, /const PUBLIC_BOOKING_TIMEOUT_MS = 15_000/);
  assert.match(submission, /kind: confirmationPending \? "recorded_confirmation_pending" : "success"/);
});

test('R11.2: le paiement et la transmission de langue au serveur ne sont pas modifiés', () => {
  for (const fragment of [
    'submitPublicBooking({',
    'communicationLanguage: guestLanguageFromUrl(window.location.href)',
    'paymentPreference: canChooseFullPayment && payFullNow ? "full" : "deposit"',
    '"/.netlify/functions/booking-quote"',
    'bookingQuote.depositAmount',
    'bookingQuote?.total ??',
    'setBookingQuote(await response.json())',
  ]) assert.ok(page.includes(fragment), fragment);
});
