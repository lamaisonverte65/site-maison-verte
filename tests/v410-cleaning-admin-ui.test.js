import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const housekeepingView = fs.readFileSync('src/components/admin/reservation/HousekeepingReservationView.jsx', 'utf8');
const calendar = fs.readFileSync('src/components/CalendarAdmin.jsx', 'utf8');
const admin = fs.readFileSync('src/pages/Admin.jsx', 'utf8');
const reservationPanel = fs.readFileSync('src/components/admin/ReservationPanel.jsx', 'utf8');
const block = fs.readFileSync('src/components/admin/reservation/PostStayCleaningBlock.jsx', 'utf8');
const adminData = fs.readFileSync('src/services/adminDataService.js', 'utf8');

test('housekeeping can report cleaning issue with mandatory note and no financial actions', () => {
  assert.match(housekeepingView, /Signaler le ménage/);
  assert.match(housekeepingView, /cleaningIssueNote/);
  assert.match(housekeepingView, /onReportCleaningIssue/);
  assert.doesNotMatch(housekeepingView, /Envoyer le lien de paiement|Confirmer la facturation|Créer la facture/);
  assert.match(calendar, /onHousekeepingCleaningIssueReport/);
  assert.match(admin, /reportCleaningIssue/);
});

test('owner reservation block exposes state-specific post stay cleaning actions', () => {
  assert.match(reservationPanel, /PostStayCleaningBlock/);
  assert.match(block, /Confirmer la facturation/);
  assert.match(block, /Envoyer le lien de paiement/);
  assert.match(block, /Renvoyer le lien/);
  assert.match(block, /Annuler/);
  assert.match(block, /Créer la facture ménage/);
  assert.match(block, /amount_due/);
});

test('owner admin loads cleaning issues and keeps stay invoice separate from cleaning invoice', () => {
  assert.match(adminData, /booking_cleaning_issues/);
  assert.match(admin, /cleaningIssues/);
  assert.match(admin, /invoice_kind !== "post_stay_cleaning"/);
  assert.match(admin, /invoice_kind === "post_stay_cleaning"/);
});
