import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bookletText, inventoryText } from "../src/booklet/bookletTranslations.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bookletFolder = path.join(root, "src", "components", "booklet");

const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const normalize = (value) => value.replace(/&#x27;/gi, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

test("V4.15 livret : aucun bloc du texte français oublié dans les traductions", () => {
  for (const file of fs.readdirSync(bookletFolder).filter((name) => name.endsWith(".jsx"))) {
    if (file === "BookletInventory.jsx") continue;
    const source = read("src", "components", "booklet", file);
    const pattern = /<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/g;
    const items = [...source.matchAll(pattern)].map((hit) => normalize(hit[2].replace(/<[^>]*>/g, " "))).filter(Boolean);
    for (const label of items) {
      assert.ok(bookletText.en[label] || label === "&", `EN : ${file} / ${label}`);
      assert.ok(bookletText.es[label] || label === "&", `ES : ${file} / ${label}`);
    }
  }
});

test("V4.15 livret : 149 articles d'inventaire, quantités inchangées", () => {
  const source = read("src", "components", "booklet", "BookletInventory.jsx");
  const lines = [...source.matchAll(/<li>\s*<span>(\d+)<\/span>([\s\S]*?)<\/li>/g)];
  assert.equal(lines.length, 149);
  for (const [, quantity, french] of lines) {
    assert.ok(Number(quantity) > 0);
    const label = normalize(french.replace(/<[^>]*>/g, " "));
    for (const lang of ["en", "es"]) {
      assert.ok(inventoryText[lang][label], `${lang} : ${label}`);
    }
  }
});

test("V4.15 livret : assets d'accès, boîte à clés, QR, bannière", () => {
  for (const lang of ["fr", "en", "es"]) {
    assert.ok(fs.existsSync(path.join(root, "public", "livret", `banniere-contacts-${lang}.webp`)));
    if (lang === "fr") continue; // FR conserve ses plans et sa procédure de référence.
    assert.ok(fs.existsSync(path.join(root, "public", "livret", `procedure-boite-a-cles-${lang}.webp`)));
    assert.ok(fs.existsSync(path.join(root, "public", "livret", `qr-guide-${lang}.svg`)));
  }
});


test("V4.15 finition : les plans FR sont communs aux trois langues et restent cliquables", () => {
  const source = read("src", "booklet", "localizeBooklet.jsx");
  const localizable = source.match(/const sourceImages = new Set\(\[([\s\S]*?)\]\);/);
  const zoomable = source.match(/const clickImages = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(localizable && zoomable, "Registres des assets du livret introuvables");
  for (const name of ["plan-parking-4.webp", "plan-parking-3.webp"]) {
    assert.ok(fs.existsSync(path.join(root, "public", "livret", name)), name);
    assert.ok(!localizable[1].includes(name), `Le plan ${name} ne doit pas être localisé`);
    assert.ok(zoomable[1].includes(name), `Le plan ${name} doit rester cliquable`);
  }
  assert.ok(localizable[1].includes("procedure-boite-a-cles.webp"));
  assert.ok(localizable[1].includes("banniere-contacts.webp"));
});

test("V4.15 finition : CSS espagnol limité au sommaire et au fonctionnement du logement", () => {
  const css = read("src", "styles", "livret.css");
  const start = css.lastIndexOf("/* =========================================================");
  assert.ok(start > 0, "Ajustements ciblés ES absents");
  const rules = css.slice(start).replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const selectors = [...rules.matchAll(/(^|\})\s*([^{}]+)\{/g)].map((match) => match[2].trim()).filter(Boolean);
  assert.equal(selectors.length, 11);
  assert.match(rules, /grid-template-columns:\s*96px\s+minmax\(0, 1fr\)\s*!important/);
  assert.match(rules, /livret-summary-list a span\s*\{\s*white-space:\s*nowrap/);
  for (const selector of selectors) {
    assert.ok(selector.startsWith('.livret[data-livret-lang="es"] '), `Sélecteur non limité à ES : ${selector}`);
    assert.ok(selector.includes(".livret-welcome .livret-summary") || selector.includes("#fonctionnement-logement"), selector);
    assert.ok(!selector.includes("#depart") && !selector.includes("inventory"), selector);
  }
});


test("V4.15 finition boîte à clés : avertissement EN/ES intégré, image FR inchangée", () => {
  for (const lang of ["en", "es"]) {
    const data = fs.readFileSync(path.join(root, "public", "livret", `procedure-boite-a-cles-${lang}.webp`));
    assert.ok(data.length > 100000, `Image ${lang} incomplet`);
  }
  assert.ok(fs.existsSync(path.join(root, "public", "livret", "procedure-boite-a-cles.webp")));
});
