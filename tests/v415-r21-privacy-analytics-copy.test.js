import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEGAL_COPY } from "../src/pages/legalTranslations.js";

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("R21 : confidentialité FR conforme à la collecte actuelle et transparente sur l'historique", () => {
  const source = read("src/pages/PolitiqueConfidentialite.jsx");
  const currentText = source.split("<h2 style={h2Style}>Cookies et statistiques</h2>")[1]
    ?.split("<h2 style={h2Style}>Services externes</h2>")[0];
  assert.ok(currentText, "Section confidentialité FR introuvable");
  for (const expected of [
    "pages vues", "session de navigation", "type d’appareil", "langue indiquée par le",
    "domaine du site référent", "utm_source", "formulaires", "n’enregistre plus",
    "Les événements collectés avant cette simplification",
  ]) {
    assert.ok(currentText.includes(expected), `Mention FR absente : ${expected}`);
  }
  assert.doesNotMatch(currentText, /Les statistiques comprennent le type d’appareil, le navigateur, le système/);
});

test("R21 : informations équivalentes dans les politiques EN et ES", () => {
  const scenarios = [
    { language: "en", heading: "Cookies and statistics", expects: ["page views", "browser", "utm_source", "no longer records", "technical history"] },
    { language: "es", heading: "Cookies y estadísticas", expects: ["páginas vistas", "navegador", "utm_source", "ya no registra", "historial técnico"] },
  ];
  for (const { language, heading, expects } of scenarios) {
    const section = LEGAL_COPY[language].privacy.sections.find((entry) => entry.heading === heading);
    assert.ok(section, `${language} : rubrique statistiques absente`);
    assert.equal(section.paragraphs.length, 1);
    for (const expected of expects) {
      assert.ok(section.paragraphs[0].includes(expected), `${language} : mention absente ${expected}`);
    }
  }
});

test("R21 : le tableau indique la langue du navigateur, pas celle de la page", () => {
  const ui = read("src/components/admin/VisitsPanel.jsx");
  assert.match(ui, /<SummaryList title="Langues des navigateurs" rows=\{languageStats\}/);
  assert.doesNotMatch(ui, /<SummaryList title="Langues" rows=\{languageStats\}/);
});
