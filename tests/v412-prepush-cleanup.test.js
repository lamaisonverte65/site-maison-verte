import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('favicon manifest and canonical icon use the deployed paths', () => {
  const manifest = JSON.parse(read('public/favicon/manifest.json'));
  assert.equal(manifest.short_name, 'La Maison Verte');
  assert.deepEqual(manifest.icons.map((icon) => icon.src), [
    '/favicon/android-chrome-192x192.png',
    '/favicon/android-chrome-512x512.png',
  ]);
  const ico = fs.readFileSync('public/favicon.ico');
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
  assert.equal(fs.existsSync('public/favicon/favicon.ico'), false);
  assert.match(read('src/pages/MaisonVerte.jsx'), /href="\/favicon\.ico"/);
});

test('the booklet keeps one WhatsApp QR and exposes it on page 2', () => {
  assert.equal(fs.existsSync('public/livret/qr-whatsapp.png'), true);
  assert.equal(fs.existsSync('public/livret/shared-qr-code.png'), false);
  assert.equal(fs.existsSync('public/shared-qr-code.png'), false);
  const welcome = read('src/components/booklet/BookletWelcome.jsx');
  assert.match(welcome, /href="https:\/\/wa\.me\/message\/EKRAB2I476GVP1\?src=qr"/);
  assert.match(welcome, /src="\/livret\/qr-whatsapp\.png"/);
  assert.match(welcome, />WhatsApp</);
  const qr = fs.readFileSync('public/livret/qr-whatsapp.png');
  assert.equal(qr.toString('ascii', 1, 4), 'PNG');
  assert.equal(qr.readUInt32BE(16), qr.readUInt32BE(20), 'WhatsApp QR must remain square');
});

test('livret, guide and ski use overlay navigation without the white bar', () => {
  for (const file of [
    'src/pages/LivretAccueil.jsx',
    'src/pages/GuideValleesAureLouron.jsx',
    'src/pages/SkiValleesAureLouron.jsx',
  ]) {
    assert.match(read(file), /<PublicNavigation solid=\{false\} \/>/, file);
    assert.doesNotMatch(read(file), /<PublicNavigation solid \/>/, file);
  }
});

test('confirmed orphaned source files are removed', () => {
  for (const file of [
    'src/components/admin/reservation/ContractBlock.jsx',
    'src/components/calendar/CalendarFilters.jsx',
    'src/components/calendar/ReservationPreview.jsx',
    'src/hooks/useCalendarConflicts.js',
    'src/hooks/useCalendarFilters.js',
    'netlify/functions/_lib/customer-credit-note.js',
    'tests/v410-customer-credit-note-model.test.js',
  ]) {
    assert.equal(fs.existsSync(file), false, file);
  }
});
