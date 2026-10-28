import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getHomeCopy } from "../src/components/home/homeTranslations.js";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("Wifi 7 doit être annoncé dans les trois langues sans contradiction", () => {
  for (const lang of ["fr", "en", "es"]) {
    assert.ok(getHomeCopy(lang).presentation.benefits.some(v => /Wi-Fi 7/.test(v)), lang);
    assert.ok(!getHomeCopy(lang).presentation.benefits.some(v => /Sans Wi-Fi|No Wi-Fi|Sin Wi-Fi/.test(v)), lang);
  }
  assert.match(read("src/components/booklet/BookletHouseRules.jsx"), /Wi-Fi 7/);
  assert.match(read("src/pages/MaisonVerte.jsx"), /name: "Wi-Fi 7"/);
});
test("Le courriel français retrouve le Wi-Fi et conserve les codes d'accès et les horaires", () => {
  const html = read("netlify/functions/send-arrival-reminder.js");
  assert.match(html, /<h3>Wi-Fi 7<\/h3>/);
  assert.match(html, /<strong>Réseau :<\/strong> Freebox-38AFFB/);
  assert.doesNotMatch(html, /<strong>Réseau :<\/strong> La Maison Verte/);
  assert.match(html, /<strong>Mot de passe :<\/strong> lamaisonverte65/);
  assert.match(html, /keyboxCode/);
  assert.match(html, /arrivalUrl/);
});
