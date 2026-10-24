import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validatePublicBookingPayload,
  canonicalizePhoneForBookingDeduplication,
  buildPublicBookingEmails,
} from '../netlify/functions/_lib/public-booking.js';

const validPayload = {
  guestFirstName: 'Alice', guestLastName: 'Martin', guestEmail: 'alice@example.test',
  guestPhone: '+33 6 12 34 56 78', guestAddress: '12 rue des Pyrénées', guestPostalCode: '65240',
  guestCity: 'Arreau', guestCountry: 'France', adultsCount: 2, childrenCount: 0, childrenAges: '',
  babyBedNeeded: false, marketingConsent: false, guestMessage: '', startDate: '2026-11-10',
  endDate: '2026-11-13', nights: 3, accommodationTotal: 420, contractAccepted: true,
  cleaningOption: true, website: '',
};

const validate = (payload) => validatePublicBookingPayload(payload, { cleaningFee: 50 });

test('public booking accepts and normalizes additional contacts separately from the booking fingerprint', () => {
  const additionalContacts = [{
    firstName: ' Bob ', lastName: ' Durand ', email: 'BOB@EXAMPLE.TEST',
    phone: '06 98 76 54 32', address: '4 rue Test', postalCode: '31000', city: 'Toulouse', country: 'France',
  }];
  const result = validate({ ...validPayload, additionalContacts });
  assert.equal(result.ok, true);
  assert.deepEqual(result.additionalContacts, [{
    firstName: 'Bob', lastName: 'Durand', email: 'bob@example.test', phone: '06 98 76 54 32',
    address: '4 rue Test', postalCode: '31000', city: 'Toulouse', country: 'France',
  }]);
  const baseline = validate(validPayload);
  assert.equal(result.booking.additional_contacts, undefined);
  assert.equal(result.booking.additionalContacts, undefined);
  assert.equal(
    canonicalizePhoneForBookingDeduplication(result.booking.guest_phone),
    canonicalizePhoneForBookingDeduplication(baseline.booking.guest_phone),
  );
});

test('additional contacts require identity, email and phone while postal fields remain optional', () => {
  const minimal = { firstName: 'Bob', lastName: 'Durand', email: 'bob@example.test', phone: '0698765432' };
  assert.equal(validate({ ...validPayload, additionalContacts: [minimal] }).ok, true);
  for (const missing of ['firstName', 'lastName', 'email', 'phone']) {
    const contact = { ...minimal, [missing]: '' };
    assert.equal(validate({ ...validPayload, additionalContacts: [contact] }).ok, false, missing);
  }
});

test('additional contacts reject duplicates of the main contact, duplicates between contacts and oversized arrays', () => {
  const bob = { firstName: 'Bob', lastName: 'Durand', email: 'bob@example.test', phone: '0698765432' };
  assert.equal(validate({ ...validPayload, additionalContacts: [{ ...bob, email: 'ALICE@EXAMPLE.TEST' }] }).ok, false);
  assert.equal(validate({ ...validPayload, additionalContacts: [bob, { ...bob, email: 'other@example.test' }] }).ok, false);
  assert.equal(validate({ ...validPayload, additionalContacts: Array.from({ length: 5 }, (_, index) => ({
    ...bob, email: `bob${index}@example.test`, phone: `060000000${index}`,
  })) }).ok, false);
});

test('the public form sends multiple contacts and lets the user add or remove them', () => {
  const source = fs.readFileSync('src/pages/MaisonVerte.jsx', 'utf8');
  const translations = fs.readFileSync('src/components/home/bookingFormTranslations.js', 'utf8');

  assert.match(source, /additionalContacts\.map\(\(contact, index\)/);
  assert.match(source, /additionalContacts,/);
  assert.match(source, /onClick=\{addAdditionalContact\}/);
  assert.match(source, /onClick=\{\(\) => removeAdditionalContact\(index\)\}/);
  assert.match(source, /additionalContacts\.length < 4/);
  assert.match(source, /\{bookingCopy\.addContact\}/);
  assert.match(source, /\{bookingCopy\.removeContact\}/);

  // Les libellés restent fournis dans les trois langues, sans coder le français dans le JSX.
  assert.match(translations, /addContact:\s*"\+ Ajouter un contact"/);
  assert.match(translations, /removeContact:\s*"Supprimer ce contact"/);
  assert.match(translations, /addContact:\s*"\+ Add a contact"/);
  assert.match(translations, /removeContact:\s*"Remove this contact"/);
  assert.match(translations, /addContact:\s*"\+ Añadir un contacto"/);
  assert.match(translations, /removeContact:\s*"Eliminar este contacto"/);
});

test('booking contact migration and endpoint persist linked customer records after atomic booking creation', () => {
  const migration = fs.readFileSync('supabase/migrations/202610150001_v412_booking_contacts.sql', 'utf8');
  assert.match(migration, /create table(?: if not exists)? public\.booking_contacts/i);
  assert.match(migration, /booking_request_id uuid not null references public\.booking_requests\(id\)/i);
  assert.match(migration, /customer_id bigint references public\.customers\(id\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /is_v4_owner\(\)/i);
  assert.match(migration, /drop policy if exists booking_contacts_owner_only/i);

  const endpoint = fs.readFileSync('netlify/functions/send-booking-request.js', 'utf8');
  assert.match(endpoint, /persistAdditionalBookingContacts/);
  assert.match(endpoint, /validated\.additionalContacts/);
  assert.match(endpoint, /bookingId/);
});

test('owner booking email includes escaped additional-contact details for recovery and follow-up', () => {
  const model = {
    firstName: 'Alice', lastName: 'Martin', email: 'alice@example.test', phone: '0612345678',
    adults: 2, children: 0, childrenAges: '', babyBedNeeded: false, message: '',
    startDate: '2026-11-10', endDate: '2026-11-13', nights: 3, accommodationTotal: 420,
    accommodationGross: 420, promotionCode: null, promotionDiscountAmount: 0, touristTaxAmount: 0,
    cleaningOption: true, cleaningFee: 50, total: 470, paymentPreference: 'deposit', depositRate: 0.3,
    additionalContacts: [{ firstName: '<Bob>', lastName: 'Durand', email: 'bob@example.test', phone: '0698765432', address: '4 <rue>', postalCode: '31000', city: 'Toulouse', country: 'France' }],
  };
  const emails = buildPublicBookingEmails(model, { ownerEmail: 'owner@example.test' });
  assert.match(emails.owner.html, /Contacts supplémentaires/);
  assert.match(emails.owner.html, /&lt;Bob&gt;/);
  assert.match(emails.owner.html, /4 &lt;rue&gt;/);
  assert.doesNotMatch(emails.owner.html, /<Bob>/);
});

const contactModule = await import('../netlify/functions/_lib/public-booking-contacts.js').catch(() => ({}));

test('additional contact persistence creates a customer and links the booking snapshot', async () => {
  assert.equal(typeof contactModule.persistAdditionalBookingContacts, 'function');
  const calls = [];
  const repository = {
    async insertContactSnapshot(payload) { calls.push(['snapshot', payload]); return { id: 'link-1' }; },
    async findCustomerByEmail() { return null; },
    async findCustomerByPhones() { return null; },
    async createCustomer(payload) { calls.push(['create', payload]); return { id: 'customer-1', ...payload }; },
    async enrichCustomer() { throw new Error('must not enrich a newly created customer'); },
    async markLinked(linkId, customerId) { calls.push(['linked', linkId, customerId]); },
    async markConflict() { throw new Error('must not conflict'); },
  };
  const result = await contactModule.persistAdditionalBookingContacts(repository, {
    bookingId: 'booking-1', startDate: '2026-11-10', endDate: '2026-11-13',
    contacts: [{ firstName: 'Bob', lastName: 'Durand', email: 'bob@example.test', phone: '0698765432', address: '', postalCode: '', city: '', country: '' }],
    now: '2026-10-15T10:00:00.000Z',
  });
  assert.deepEqual(result, { linked: 1, conflicts: 0 });
  assert.equal(calls[0][0], 'snapshot');
  assert.equal(calls[1][0], 'create');
  assert.equal(calls[1][1].source, 'site_contact');
  assert.equal(calls[1][1].marketing_consent, false);
  assert.deepEqual(calls[2], ['linked', 'link-1', 'customer-1']);
});

test('additional contact persistence reuses one customer and flags conflicting email/phone identities', async () => {
  const reused = [];
  const repository = {
    async insertContactSnapshot(payload) { return { id: `link-${payload.position}` }; },
    async findCustomerByEmail(email) { return email === 'reuse@example.test' ? { id: 'customer-a', email } : { id: 'customer-email' }; },
    async findCustomerByPhones(_candidates, contact) { return contact.email === 'reuse@example.test' ? { id: 'customer-a' } : { id: 'customer-phone' }; },
    async createCustomer() { throw new Error('must not create'); },
    async enrichCustomer(id, payload) { reused.push([id, payload]); return { id }; },
    async markLinked(linkId, customerId) { reused.push(['linked', linkId, customerId]); },
    async markConflict(linkId) { reused.push(['conflict', linkId]); },
  };
  const result = await contactModule.persistAdditionalBookingContacts(repository, {
    bookingId: 'booking-1', startDate: '2026-11-10', endDate: '2026-11-13', now: '2026-10-15T10:00:00.000Z',
    contacts: [
      { firstName: 'Reuse', lastName: 'Client', email: 'reuse@example.test', phone: '0611223344', address: '', postalCode: '', city: '', country: '' },
      { firstName: 'Conflict', lastName: 'Client', email: 'conflict@example.test', phone: '0699887766', address: '', postalCode: '', city: '', country: '' },
    ],
  });
  assert.deepEqual(result, { linked: 1, conflicts: 1 });
  assert.ok(reused.some(([first]) => first === 'customer-a'));
  assert.ok(reused.some((entry) => entry[0] === 'conflict'));
});

const submissionModule = await import('../src/utils/publicBookingSubmission.js');

test('public submission preserves a non-fatal additional-contact persistence warning', async () => {
  const result = await submissionModule.submitPublicBooking({}, {
    fetchImpl: async () => ({
      ok: true,
      status: 202,
      async json() { return { success: true, bookingId: 'booking-1', additionalContactsPending: true }; },
    }),
  });
  assert.equal(result.success, true);
  assert.equal(result.bookingId, 'booking-1');
  assert.equal(result.additionalContactsPending, true);
  assert.equal(result.clearForm, true);
});
