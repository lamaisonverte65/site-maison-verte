import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const block = fs.readFileSync('src/components/admin/reservation/AdditionalChargeBlock.jsx','utf8');
const reservation = fs.readFileSync('src/components/admin/ReservationPanel.jsx','utf8');
const cleaning = fs.readFileSync('src/components/admin/reservation/PostStayCleaningBlock.jsx','utf8');

test('owner reservation exposes collapsed generic additional charge form', () => {
  assert.match(reservation, /AdditionalChargeBlock/);
  assert.match(block, /Créer une demande de paiement complémentaire/);
  assert.match(block, /Motif/);
  assert.match(block, /Montant/);
  assert.match(block, /Message client/);
  assert.match(block, /Envoyer le lien de paiement/);
});

test('cleaning signal can open the same generic payment form prefilled for cleaning', () => {
  assert.match(cleaning, /Créer une demande de paiement/);
  assert.match(cleaning, /onCreateAdditionalCharge/);
  assert.match(cleaning, /Ménage après séjour/);
  assert.match(reservation, /setAdditionalChargePreset/);
});

test('cleaning preset scrolls to the generic form and focuses the reason field', () => {
  assert.match(block, /useRef/);
  assert.match(block, /scrollIntoView/);
  assert.match(block, /\.focus\(\)/);
  assert.match(block, /ref=\{reasonInputRef\}/);
});

test('owner UI blocks sending an additional charge when client email is missing', () => {
  assert.match(block, /Aucune adresse email client n.est renseignée|aucune adresse email client n.est renseignée/i);
  assert.match(block, /guest_email/);
  assert.match(block, /hasClientEmail/);
  assert.match(block, /disabled=\{[^}]*!hasClientEmail/);
});
