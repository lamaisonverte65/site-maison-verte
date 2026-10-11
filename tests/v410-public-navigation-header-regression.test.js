import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/pages/MaisonVerte.jsx', 'utf8');

test('home navigation stays transparent instead of restoring a full-width white band on scroll', () => {
  assert.match(source, /<PublicNavigation solid=\{false\} \/>/);
  assert.doesNotMatch(source, /solid=\{scrolled\}/);
  assert.doesNotMatch(source, /setScrolled\(window\.scrollY > 80\)/);
  assert.doesNotMatch(source, /const \[scrolled, setScrolled\]/);
});
