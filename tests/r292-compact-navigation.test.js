import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('R29.2: les filtres de réservations sont répartis sur deux rangées', () => {
  const toolbar = read('src/components/admin/reservations/ReservationsToolbar.jsx');
  const filters = read('src/components/admin/reservations/ReservationsFilters.jsx');
  assert.doesNotMatch(toolbar, /Pilotage des réservations|affichée.*sur/);
  assert.match(toolbar, /<ReservationsFilters/);
  assert.match(filters, /display: "grid", gap: "7px"/);
  assert.match(filters, /Exporter la liste filtrée/);
  assert.match(filters, /marginLeft: "auto"/);
  assert.ok(filters.indexOf('Tous les statuts') < filters.indexOf('Exporter la liste filtrée'));
  assert.ok(filters.indexOf('Exporter la liste filtrée') < filters.indexOf('type="search"'));
  assert.ok(filters.indexOf('type="search"') < filters.indexOf('type="date"'));
  assert.match(filters, /width: "139px"/);
  assert.match(filters, /onFilterChange\("dateFrom"/);
  assert.match(filters, /onFilterChange\("dateTo"/);
  assert.match(filters, /onClick=\{onReset\}/);
});

test('R29.2: aucune bannière de sélection lorsque sélection vide', () => {
  const bulk = read('src/components/admin/reservations/ReservationsBulkActions.jsx');
  assert.doesNotMatch(bulk, /Aucune réservation sélectionnée/);
  assert.match(bulk, /if \(selectedCount === 0\) \{\s*return null;/);
  assert.match(bulk, /Exporter la sélection/);
  assert.match(bulk, /Vider la sélection/);
});

test('R29.2: retire la liste sous le calendrier mais garde les blocages et leur suppression par clic', () => {
  const cal = read('src/components/CalendarAdmin.jsx');
  const panel = read('src/components/admin/calendar/EventPanel.jsx');
  assert.doesNotMatch(cal, /<h3>Blocages admin<\/h3>/);
  assert.doesNotMatch(cal, /blocks\.map\(\(block\) => \(/);
  assert.match(cal, /extendedProps: \{ type: "admin_block", block \}/);
  assert.match(cal, /onDeleteBlock=\{deleteBlock\}/);
  assert.match(panel, /onDeleteBlock\(block\.id\)/);
  assert.match(cal, /const adminBlocks = events\.filter/);
});

test('R29.2: la typographie compacte ne s’applique qu’aux Tarifs', () => {
  const pricing = read('src/components/PricingAdmin.jsx');
  const css = read('src/styles/adminPricingCompact.css');
  assert.match(pricing, /import "\.\.\/styles\/adminPricingCompact\.css"/);
  assert.match(pricing, /className="pricing-admin-compact"/);
  assert.match(css, /\.pricing-admin-compact h3 \{[^}]*font-size: 15px;/s);
  assert.match(css, /\.pricing-admin-compact button,/);
  assert.doesNotMatch(css, /(^|\n)h3\s*\{/);
});
