import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLocalizedBookingDecision } from '../netlify/functions/_lib/guest-booking-decision.js';
import { buildStoredManualPaymentEmail } from '../netlify/functions/_lib/admin-email.js';

const base = {
  type: 'accepted', language: 'en', firstName: 'Alex', lastName: 'Müller',
  startDate: '2026-12-18', endDate: '2026-12-22', nights: 4,
  adultsCount: 2, childrenCount: 1, childrenAges: '11', babyBedNeeded: false,
  accommodationNet: 300, actualDiscount: 20, actualDiscountRate: '6,25',
  cleaningApplied: 40, touristTax: 7.5, displayedPrice: 347.5, amountToPay: 104.25,
  paymentType: 'deposit', daysBeforeArrival: 56,
  paymentLink: 'https://checkout.stripe.com/c/pay/cs_test_123',
  contractUrl: 'https://lamaisonverte65.fr/contract',
  acceptanceExpiresAt: '2026-10-23T11:00:00.000Z',
  ownerMessage: '', arrivalTime: null,
};

test('R3 EN acceptance keeps Stripe, financial inputs and rental contract', () => {
  const email = buildLocalizedBookingDecision(base);
  assert.match(email.subject, /accepted/);
  assert.match(email.content, /Pay the deposit/);
  assert.match(email.content, /checkout\.stripe\.com\/c\/pay\/cs_test_123/);
  assert.match(email.content, /rental agreement/);
  assert.match(email.content, /104\.25/);
  assert.match(email.content, /347\.50/);
  assert.match(email.content, /30 days before arrival/);
  assert.match(email.content, /24 hours/);
  assert.doesNotMatch(email.content, /Payer l.acompte|Taxe de séjour/);
});

test('R3 ES full payment near arrival includes rental cancellation terms', () => {
  const email = buildLocalizedBookingDecision({ ...base, language: 'es', paymentType: 'full', daysBeforeArrival: 10, amountToPay: 347.5 });
  assert.match(email.subject, /aceptada/);
  assert.match(email.content, /Pagar la estancia/);
  assert.match(email.content, /30 días anteriores/);
  assert.match(email.content, /tasa turística se reembolsa/);
  assert.match(email.content, /347,50/);
  assert.doesNotMatch(email.content, /saldo pendiente se solicitará/);
});

test('R3 confirmed in EN retains arrival-time choice and contract total', () => {
  const message = buildLocalizedBookingDecision({ ...base, type: 'confirmed', arrivalTime: '16:00' });
  assert.match(message.subject, /confirmed/);
  assert.match(message.content, /Expected arrival time/);
  assert.match(message.content, /16:00/);
  assert.match(message.content, /347\.50/);
  assert.doesNotMatch(message.content, /checkout.stripe/);
});

test('R3 confirmed in ES requests arrival time when unknown', () => {
  const message = buildLocalizedBookingDecision({ ...base, type: 'confirmed', language: 'es', arrivalTime: '' });
  assert.match(message.content, /hora aproximada de llegada/);
  assert.match(message.subject, /confirmada/);
});

test('R3 refused in ES does not offer payment and escapes owner free text', () => {
  const message = buildLocalizedBookingDecision({ ...base, type: 'refused', language: 'es', ownerMessage: 'Hola <script>alert(1)</script>' });
  assert.match(message.content, /no podemos aceptar/i);
  assert.match(message.content, /&lt;script&gt;/);
  assert.doesNotMatch(message.content, /<script>|checkout.stripe/);
});

test('R3 unknown and French decisions rejected by EN/ES helper', () => {
  assert.throws(() => buildLocalizedBookingDecision({ ...base, language: 'fr' }));
  assert.throws(() => buildLocalizedBookingDecision({ ...base, type: 'invalid' }));
});

const stored = {
  guest_email: 'guest@example.test', guest_first_name: 'Alice', guest_last_name: 'Martin',
  start_date: '2026-12-18', end_date: '2026-12-22', manual_payment_amount: 120,
  manual_payment_reason: 'Frais ménage', manual_payment_message: 'Merci <script>test</script>',
  manual_payment_link: 'https://checkout.stripe.com/c/pay/cs_test_456',
  housekeeping_notes: 'PRIVATE HOUSEKEEPING', owner_message: 'PRIVATE OWNER',
};

test('R3 EN manual payment translates UI without modifying owner free text', () => {
  const email = buildStoredManualPaymentEmail({ ...stored, communication_language: 'en' });
  assert.equal(email.ok, true);
  assert.match(email.subject, /Payment requested/);
  assert.match(email.html, /Proceed to payment/);
  assert.match(email.html, /€120\.00/);
  assert.match(email.html, /Frais ménage/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>|PRIVATE HOUSEKEEPING|PRIVATE OWNER/);
});

test('R3 ES manual payment uses saved amount and trusted Stripe link', () => {
  const email = buildStoredManualPaymentEmail({ ...stored, communication_language: 'es' });
  assert.equal(email.ok, true);
  assert.match(email.subject, /Solicitud de pago/);
  assert.match(email.html, /Realizar el pago/);
  assert.match(email.html, /120,00/);
  assert.match(email.html, /checkout.stripe.com\/c\/pay\/cs_test_456/);
});

test('R3 French manual payment remains the historical model', () => {
  const email = buildStoredManualPaymentEmail({ ...stored, communication_language: 'fr' });
  assert.equal(email.subject, 'Paiement demandé - La Maison Verte');
  assert.match(email.html, /Procéder au paiement/);
  assert.match(email.html, /120\.00 €/);
});

test('R3 rejects forged payment links before localization', () => {
  const email = buildStoredManualPaymentEmail({ ...stored, communication_language: 'es', manual_payment_link: 'https://bad.example/pay' });
  assert.equal(email.ok, false);
});

test('R3 decision uses persisted guest language and retains stored retry payload', () => {
  const source = readFileSync(new URL('../netlify/functions/send-booking-decision.js', import.meta.url), 'utf8');
  assert.match(source, /emailLanguageForAudience\(storedBooking\)/);
  assert.match(source, /const displayedPrice = contractualTotal\(storedBooking\)/);
  assert.match(source, /const authoritativePaymentAmount = paymentType === "full"/);
  assert.match(source, /const retryPayload = \{/);
  assert.match(source, /await logEmail\(\{ bookingId, emailType:/);
});
