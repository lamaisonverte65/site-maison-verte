import test from "node:test";
import assert from "node:assert/strict";
import {
  GUEST_LANGUAGES, normalizeGuestLanguage, guestLanguageFromUrl,
  emailLanguageForAudience, formatGuestDate, formatGuestMoney,
} from "../shared/guestLocale.js";

test("V4.15: seules FR EN ES sont admises", () => {
  assert.deepEqual([...GUEST_LANGUAGES], ["fr", "en", "es"]);
  for (const [input, result] of [["fr", "fr"], ["FR-fr", "fr"], ["EN_gb", "en"], ["es-ES", "es"], ["de", "fr"], ["french", "fr"], ["", "fr"], [null, "fr"], [{}, "fr"]]) {
    assert.equal(normalizeGuestLanguage(input), result);
  }
  assert.equal(normalizeGuestLanguage("??", "en"), "en");
});

test("V4.15: URL existantes et futures reconnues sans redirection", () => {
  assert.equal(guestLanguageFromUrl("/livret?lang=es"), "es");
  assert.equal(guestLanguageFromUrl("/livret?lang=en"), "en");
  assert.equal(guestLanguageFromUrl("/livret"), "fr");
  assert.equal(guestLanguageFromUrl("/en/guide-vallees-aure-louron"), "en");
  assert.equal(guestLanguageFromUrl("/es/"), "es");
  assert.equal(guestLanguageFromUrl("/en?lang=es"), "en");
  assert.equal(guestLanguageFromUrl("/admin"), "fr");
  assert.equal(guestLanguageFromUrl("/livret?lang=invalid", "es"), "es");
});

test("V4.15: emails internes toujours en français, invités selon réservation", () => {
  assert.equal(emailLanguageForAudience({ communication_language: "es" }), "es");
  assert.equal(emailLanguageForAudience({ communicationLanguage: "en" }), "en");
  assert.equal(emailLanguageForAudience({ communication_language: "de" }), "fr");
  assert.equal(emailLanguageForAudience(null), "fr");
  assert.equal(emailLanguageForAudience({ communication_language: "es" }, "owner"), "fr");
});

test("V4.15: les dates ISO sont localisées sans décalage de jour", () => {
  assert.match(formatGuestDate("2026-12-25", "fr"), /25.*décembre.*2026/);
  assert.match(formatGuestDate("2026-12-25", "en"), /25.*December.*2026/);
  assert.match(formatGuestDate("2026-12-25", "es"), /25.*diciembre.*2026/);
  assert.equal(formatGuestDate("2026-02-30", "es"), "2026-02-30");
  assert.equal(formatGuestDate("", "fr"), "");
});

test("V4.15: le montant reste identique dans les trois langues", () => {
  for (const locale of GUEST_LANGUAGES) {
    const euro = formatGuestMoney(480.25, locale);
    assert.match(euro, /€/);
    assert.match(euro, /480|480,|480\./);
  }
  assert.equal(formatGuestMoney("not-a-number", "en"), "–");
});
