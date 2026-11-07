import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function keysInBlock(text, block, until) {
  const start = text.indexOf(`const ${block} = [`);
  assert.ok(start >= 0, `Bloc ${block} absent`);
  const end = text.indexOf(until, start);
  assert.ok(end > start, `Fin ${block} absente`);
  return [...text.slice(start, end).matchAll(/key: "([^"]+)", label: "([^"]+)"/g)].map((match) => match[2]);
}

test('R29.3 : navigation visible, ordre exact demandé, aucun onglet superflu', () => {
  const top = read('src/components/admin/AdminTopBar.jsx');
  assert.deepEqual(keysInBlock(top, 'DIRECT_TABS', 'const MORE_TABS'), [
    'Demandes', 'Calendrier', 'Réservations', 'Clients', 'Communication',
    'Paiements', 'Factures', 'Déclarations',
  ]);
  assert.deepEqual(keysInBlock(top, 'MORE_TABS', 'export default'), [
    'Virements Stripe', 'Synthèse', 'Tarifs', 'Utilisateurs',
    'Sauvegardes', 'Avis', 'Visites',
  ]);
  assert.match(top, /const HOME_TAB = \{ key: "home", label: "Accueil" \}/);
  assert.match(top, /aria-label=\{HOME_TAB\.label\}/);
  assert.match(top, /aria-label="Déconnexion"/);
});

test('R29.3 : bouton Plus conditionné aux droits, accessible et replié par défaut', () => {
  const top = read('src/components/admin/AdminTopBar.jsx');
  assert.match(top, /useState\(false\)/);
  assert.match(top, /MORE_TABS\.filter\(\(tab\) => canSeeTab\(tab\.key\)\)/);
  assert.match(top, /\{visibleMoreTabs\.length > 0 && \(/);
  assert.match(top, /aria-expanded=\{moreOpen\}/);
  assert.match(top, /role="menu"/);
  assert.match(top, /setMoreOpen\(false\)/);
  assert.match(top, /document\.addEventListener\("keydown", closeOnEscape\)/);
  assert.match(top, /onClick=\{\(\) => navigate\(tab\.key\)\}/);
});

test('R29.3 : pas de filtres globaux en double sur Réservations ni de filtre caché', () => {
  const top = read('src/components/admin/AdminTopBar.jsx');
  const admin = read('src/pages/Admin.jsx');
  const filters = read('src/components/admin/reservations/ReservationsFilters.jsx');
  assert.match(top, /const showGlobalFilters = \["requests", "customers"\]\.includes\(activeTab\)/);
  assert.match(admin, /search: activeTab === "reservations" \? "" : search/);
  assert.match(admin, /statusFilter: activeTab === "reservations" \? "all" : statusFilter/);
  assert.match(filters, /Exporter la liste filtrée/);
  assert.match(filters, /type="search"/);
  assert.match(filters, /onFilterChange\("dateFrom"/);
  assert.match(filters, /onFilterChange\("dateTo"/);
});

test('R29.3 : un seul module Tarifs avec taxe dans le cadre juste sous Accueil voyageurs, fermé par défaut', () => {
  const admin = read('src/pages/Admin.jsx');
  const price = read('src/components/PricingAdmin.jsx');
  assert.match(admin, /<PricingAdmin mode="all"/);
  assert.doesNotMatch(admin, /<PricingAdmin mode="tax"|taxConfigExpanded/);
  const keybox = price.indexOf('>Boîte à clés</h3>');
  const tax = price.indexOf('<details className="pricing-tax-details"');
  const editor = price.indexOf('<section style={styles.editorCard}>');
  assert.ok(keybox >= 0 && keybox < tax && tax < editor);
  assert.match(price, /<details className="pricing-tax-details" style=\{styles\.cardPremium\}>/);
  assert.doesNotMatch(price.slice(tax, price.indexOf('>', tax) + 1), /\bopen\b/);
  assert.match(price, /Changer le classement/);
  assert.match(price, /Nouvelle règle/);
});
