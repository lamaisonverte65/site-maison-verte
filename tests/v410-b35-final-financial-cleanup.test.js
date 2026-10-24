import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("B3.5 public payment explanation uses the authoritative deposit percentage", () => {
  const source = read("src/pages/MaisonVerte.jsx");
  const translations = read("src/components/home/bookingFormTranslations.js");

  // La phrase est traduite mais le pourcentage doit provenir du devis serveur.
  assert.match(source, /const depositPercent = Math\.round\(depositRate \* 100\)/);
  assert.match(source, /bookingText\(bookingCopy\.depositInfo,\s*\{\s*percent:\s*depositPercent,/);
  assert.match(translations, /depositInfo:\s*"Par défaut, un acompte de \{percent\} %/);
  assert.match(translations, /depositInfo:\s*"By default, a \{percent\}% deposit/);
  assert.match(translations, /depositInfo:\s*"Por defecto, se solicitará un anticipo del \{percent\}%/);
  assert.doesNotMatch(source, /acompte de 30 % sera demandé/);
});

test("B3.5 V4.10 admin balance is derived from contract snapshot, not legacy balance_amount", () => {
  const source = read("src/utils/adminFormatters.js");
  assert.match(source, /isV410 \? Math\.max\(total - deposit, 0\)/);
  assert.match(source, /request\?\.balance_amount/);
});
