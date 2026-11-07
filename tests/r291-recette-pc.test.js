import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTouristTaxDeclarationRows, summarizeTouristTaxDeclaration } from '../netlify/functions/_lib/tourist-tax-declaration.js';
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
test('R29.1 : sauvegarde client sans updated_at absent de customers', () => {
  const admin = read('src/pages/Admin.jsx');
  assert.match(admin, /const payload = \{ \.\.\.updates \};/);
  assert.doesNotMatch(admin.slice(admin.indexOf('async function updateCustomer'), admin.indexOf('async function addCustomer')), /updated_at: new Date/);
});
test('R29.1 : changement de token ne déclenche pas le rechargement admin', () => {
  const admin = read('src/pages/Admin.jsx');
  const users = read('src/hooks/useAdminUsers.js');
  assert.match(admin, /\[session\?\.user\?\.id, adminUsersData\.currentAdminUser\?\.id, adminUsersData\.currentAdminUser\?\.role\]/);
  assert.match(users, /\}, \[sessionUserId\]\)/);
});
test('R29.1 : logout icon right inline with accessible label', () => {
  const bar = read('src/components/admin/AdminTopBar.jsx');
  const style = read('src/components/admin/adminStyles.js');
  assert.match(bar, /aria-label="Déconnexion"/);
  assert.match(bar, /<svg aria-hidden="true"/);
  assert.match(style, /navLogoutButton/);
});
test('R29.1 : calendar toolbar and legend below calendar', () => {
  const calendar = read('src/components/CalendarAdmin.jsx');
  assert.ok(calendar.indexOf('      <div className="calendar-admin-layout"') < calendar.indexOf('        <CalendarToolbar', calendar.indexOf('      <div className="calendar-admin-layout"')));
  assert.ok(calendar.indexOf('      <CalendarLegend items={legendItems} />') > calendar.indexOf('      <div className="calendar-admin-layout"'));
  assert.doesNotMatch(read('src/components/calendar/CalendarToolbar.jsx'), /Disponibilités, blocages|Actualiser|Sélectionne une période/);
  assert.doesNotMatch(read('src/components/admin/ReservationsPanel.jsx'), /Tri, filtres, sélection et export/);
});
test('R29.1 : une ancienne réservation du site sans snapshot reste visible à vérifier', () => {
  const bookings=[{id:'don',source:'website',status:'confirmed',start_date:'2026-10-18',end_date:'2026-10-24',guest_first_name:'Don-Linda',guest_last_name:'Lunjevich',adults_count:2,children_count:1,tourist_tax_collector:'la_maison_verte',tourist_tax_snapshot:null}];
  const rows=buildTouristTaxDeclarationRows({bookings,classificationHistory:[],rules:[],todayDate:'2026-11-01'});
  const total=summarizeTouristTaxDeclaration(rows,{year:2026,month:10});
  assert.equal(total.totals.nights,6);
  assert.equal(total.totals.needsReviewNights,6);
  assert.equal(total.totals.dueTaxCents,0);
  assert.equal(rows[0].guestName,'Don-Linda Lunjevich');
  assert.equal(rows[0].taxablePeople,null);
});
test('R29.1 : les montants documentés restent inchangés sur snapshot complet',()=>{
 const booking={ id:'direct',status:'confirmed',start_date:'2026-10-15',end_date:'2026-10-17',tourist_tax_collector:'la_maison_verte',tourist_tax_snapshot:{occupants:2,taxablePeople:2,nights:[{date:'2026-10-15',accommodationCents:7500,totalTaxCents:200},{date:'2026-10-16',accommodationCents:7500,totalTaxCents:200}]}};
 const rows=buildTouristTaxDeclarationRows({bookings:[booking]});
 assert.equal(rows.length,2);assert.equal(rows[0].snapshotTaxCents,200);assert.equal(rows[1].snapshotTaxCents,200);
});
