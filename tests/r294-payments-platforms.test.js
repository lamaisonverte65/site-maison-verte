import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { paymentSource, platformPaymentRow, mergePlatformPaymentRows } from '../src/utils/paymentPlatformAdapter.js';

const src = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('R29.4 : source site / booking / airbnb distincte', () => {
  assert.equal(paymentSource('website'), 'site');
  assert.equal(paymentSource('direct'), 'site');
  assert.equal(paymentSource('admin_client'), 'site');
  assert.equal(paymentSource('booking'), 'booking');
  assert.equal(paymentSource('airbnb'), 'airbnb');
});

test('R29.4 : montant inconnu reste null, pas de faux paiement 0 euro', () => {
  const row = platformPaymentRow({ source: 'booking', external_reference: 'AB12', raw_snapshot: {} });
  assert.equal(row.confirmedAmount, null);
  assert.equal(row.platformNetAmount, null);
  assert.equal(row.paidClientAmount, null);
  assert.equal(row.paymentState, 'À rapprocher');
});

test('R29.4 : registre importé Booking affiche brut, frais, net et état prudent', () => {
  const row = platformPaymentRow({
    source: 'booking', external_reference: '123456', start_date: '2026-10-15', end_date: '2026-10-17',
    traveler_total: 260.80, commission_amount: 36.4, payment_fee_amount: 2.6,
    net_payout: 221.80, payment_date: '2026-10-21', raw_snapshot: { booking_statement: { guest_name: 'Client plateforme' } },
  });
  assert.equal(row.platformNetAmount, 221.8);
  assert.equal(row.confirmedAmount, 260.8);
  assert.equal(row.platformFeeAmount, 2.6);
  assert.equal(row.paymentState, 'Versement renseigné');
  assert.equal(row.name, 'Client plateforme');
  assert.equal(row.stripeNetAmount, null);
});

test('R29.4 : rapprochement explicite booking_request_id évite doublon', () => {
  const request = {id: 'req-1', source: 'booking', guest_first_name: 'Anne', guest_last_name: 'Test'};
  const base = [{ id: 'req-1', source: 'booking', name: 'Anne Test' }];
  const registry = [{ source: 'booking', external_reference: 'B17', booking_request_id: 'req-1', net_payout: 94 }];
  const result = mergePlatformPaymentRows(base, registry, [request]);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Anne Test');
  assert.equal(result[0].platformNetAmount, 94);
});

test('R29.4 : rapprochement sans preuve ne rapproche pas deux séjours par supposition', () => {
  const base = [{ id: 'req-1', source: 'booking', name: 'Anne Test' }];
  const registry = [{ source: 'booking', external_reference: 'B17', booking_request_id: null, net_payout: 94 }];
  const result = mergePlatformPaymentRows(base, registry, [{ id: 'req-1', source: 'booking' }]);
  assert.equal(result.length, 2);
});

test('R29.4 : table compacte une ligne et détails via Voir', async () => {
  const panel = await src('../src/components/admin/PaymentsPanel.jsx');
  assert.match(panel, /whiteSpace: "nowrap"/);
  assert.match(panel, /<PaymentDetails row=\{selectedPaymentRow\}/);
  assert.match(panel, /"Origine", "Séjour", "Brut"/);
  assert.match(panel, /Net Stripe après remboursements/);
  assert.doesNotMatch(panel, /<br\s*\/>/);
});

test('R29.4 : import plateforme optionnel non silencieux et jamais nécessaire pour la vue Site', async () => {
  const service = await src('../src/services/adminDataService.js');
  const admin = await src('../src/pages/Admin.jsx');
  assert.match(service, /external_reservation_financials/);
  assert.match(service, /readOptionalRows/);
  assert.match(admin, /platformReadError=\{dataLoadErrors\.external_reservation_financials\}/);
});

test('R29.4 : alertes consultables, filtres de source et aucun calcul Stripe pour plateformes', async () => {
  const alerts = await src('../src/components/admin/payments/PaymentAlerts.jsx');
  const filters = await src('../src/hooks/usePaymentFilters.js');
  assert.match(alerts, /onSelectAlert/);
  assert.match(alerts, /Plateforme à rapprocher/);
  assert.match(filters, /row\.source === "site"/);
  assert.match(filters, /sourceFilter/);
});
