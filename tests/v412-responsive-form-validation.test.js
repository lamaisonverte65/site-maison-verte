import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('src/index.css', 'utf8');
const home = fs.readFileSync('src/pages/MaisonVerte.jsx', 'utf8');

test('portrait drawer navigation stays vertical without changing landscape drawer behavior', () => {
  assert.match(css, /@media\s*\(max-width:\s*768px\)\s*and\s*\(orientation:\s*portrait\)[\s\S]*?\.public-navigation-drawer\s+nav\s*\{[\s\S]*?display:\s*block\s*!important;/);
  assert.match(css, /\.public-navigation-drawer\s+nav\s+a\s*\{[\s\S]*?display:\s*block\s*!important;/);
});

test('mobile landscape hero uses normal document flow so title and CTAs cannot overlap', () => {
  assert.match(css, /@media\s*\(max-width:\s*950px\)\s*and\s*\(orientation:\s*landscape\)[\s\S]*?\.hero\s+\.overlay\s*\{[\s\S]*?position:\s*relative\s*!important;/);
  assert.match(css, /@media\s*\(max-width:\s*950px\)\s*and\s*\(orientation:\s*landscape\)[\s\S]*?\.hero-actions\s*\{[\s\S]*?gap:/);
});

test('booking form exposes generic inline invalid-field feedback for required contact fields', () => {
  assert.match(home, /bookingValidationAttempted/);
  assert.match(home, /booking-field-error/);
  assert.match(home, /getRequiredTextError\(guestFirstName, "Prénom", 80\)/);
  assert.match(home, /getRequiredTextError\(guestLastName, "Nom", 80\)/);
  assert.match(home, /Adresse email invalide\./);
  assert.match(home, /Numéro de téléphone invalide\./);
  assert.match(home, /getRequiredTextError\(guestAddress, "Adresse", 200\)/);
  assert.match(home, /getRequiredTextError\(guestPostalCode, "Code postal", 20\)/);
  assert.match(home, /getRequiredTextError\(guestCity, "Ville", 100\)/);
  assert.match(home, /getRequiredTextError\(guestCountry, "Pays", 100\)/);
  assert.match(home, /const PHONE_PATTERN = \/\^\[\+\\d\]\[\\d\\s\(\)\.\-\]\{5,31\}\$\//);
  assert.match(home, /getPhoneError\(guestPhone, true\)/);
  assert.match(home, /Contact \$\{index \+ 2\}/);
  const patternLiteral = home.match(/const PHONE_PATTERN = (\/\^[^;]+\/);/)?.[1];
  assert.ok(patternLiteral, 'PHONE_PATTERN must remain explicit in MaisonVerte.jsx');
  const phonePattern = Function(`return ${patternLiteral}`)();
  assert.equal(phonePattern.test('0663076314'), true);
  assert.equal(phonePattern.test('+33 6 63 07 63 14'), true);
  assert.equal(phonePattern.test('0645454654+65'), false);
});
