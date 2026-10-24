import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getGuideCopy, localizeGuideRecords, localizeGuideLinks } from "../src/pages/guideTranslations.js";
import { languageForPublicPage, localizePublicHref } from "../shared/publicSiteLocale.js";

const guide = fs.readFileSync("src/pages/GuideValleesAureLouron.jsx", "utf8");
const translations = fs.readFileSync("src/pages/guideTranslations.js", "utf8");

const sourceBlock = (start, end) => guide.split(start)[1]?.split(end)[0] ?? "";
const sourceSectionCount = (sourceBlock("const guideSections = [", "const majorEvents = [").match(/\bkicker:/g) || []).length;
const sourceEventCount = (sourceBlock("const majorEvents = [", "const usefulLinks = [").match(/\btext:/g) || []).length;
const sourceParagraphCounts = Array.from(
  sourceBlock("const guideSections = [", "const majorEvents = [").matchAll(/paragraphs:\s*\[([\s\S]*?)\n    \],/g),
  (match) => (match[1].match(/^\s*"/gm) || []).length,
);


const sourceLinks = [
  ["https://www.mairie-arreau.fr/", "https://www.pyrenees2vallees.com/"],
  ["https://www.patoutrailsaintlary.com/", "https://www.peche65.fr/"],
];

test("R12: la version française conserve ses données et n'utilise pas de traduction forcée", () => {
  assert.equal(getGuideCopy("fr"), null);
  assert.equal(getGuideCopy("zz"), null);
  assert.equal(sourceSectionCount, 13);
  assert.equal(sourceEventCount, 5);
  assert.match(guide, /const guideSections = \[/);
  assert.match(guide, /const usefulLinks = \[/);
});

test("R12: 13 rubriques traduites intégralement en anglais et espagnol", () => {
  for (const lang of ["en", "es"]) {
    const sections = getGuideCopy(lang).sections;
    assert.equal(sections.length, sourceSectionCount);
    for (const [index, item] of sections.entries()) {
      for (const field of ["kicker", "title", "alt", "caption"]) {
        assert.equal(typeof item[field], "string", `${lang} ${index} ${field}`);
        assert.ok(item[field].trim(), `${lang} ${index} ${field}`);
      }
      assert.equal(item.paragraphs.length, sourceParagraphCounts[index], `${lang} ${index} paragraphs`);
      assert.ok(item.paragraphs.every((p) => typeof p === "string" && p.length > 40), `${lang} ${index} paragraphs`);
    }
  }
});

test("R12: 3 idées de séjour, 9 trajets, 5 événements dans les deux langues", () => {
  for (const lang of ["en", "es"]) {
    const copy = getGuideCopy(lang);
    assert.equal(copy.stayIdeas.length, 3);
    assert.ok(copy.stayIdeas.every((x) => x.title.length && x.items.length === 4));
    assert.equal(copy.places.length, 9);
    assert.equal(copy.events.length, sourceEventCount);
    assert.ok(copy.events.every((text) => text.length > 40));
  }
});

test("R12: tous les groupes et intitulés de liens ont des traductions", () => {
  for (const lang of ["en", "es"]) {
    const groups = getGuideCopy(lang).linkGroups;
    assert.deepEqual(groups.map((g) => g.labels.length), [7,8,5,5,6]);
    assert.ok(groups.every((g) => g.category.trim() && g.labels.every((l) => l.trim())));
  }
});

test("R12: images et URL inchangées par les traducteurs", () => {
  const sourceSections = [{title:"FR", image:"/guide/example.webp",alt:"FR", paragraphs:["FR"]}];
  const translation = [{title:"EN", alt:"Translated", paragraphs:["Translated"]}];
  assert.deepEqual(localizeGuideRecords(sourceSections, translation, ["title","alt","paragraphs"]), [{title:"EN",image:"/guide/example.webp",alt:"Translated",paragraphs:["Translated"]}]);
  const input = [{category:"FR",links:[["Nom","https://example.com/page"]]}];
  assert.deepEqual(localizeGuideLinks(input,[{category:"EN",labels:["Name"]}]),[{category:"EN",links:[["Name","https://example.com/page"]]}]);
  assert.deepEqual(sourceSections,[{title:"FR",image:"/guide/example.webp",alt:"FR",paragraphs:["FR"]}]);
  assert.match(guide, /image: "\/guide\/arreau-panorama\.webp"/);
  assert.ok(sourceLinks.every((group) => group.every((url) => guide.includes(url))));
});

test("R12: refuse une traduction incomplète au lieu d'afficher le mauvais contenu", () => {
  assert.throws(() => localizeGuideRecords([{},{}],[{}],["title"]), /do not match/);
  assert.throws(() => localizeGuideLinks([{category:"FR",links:[["Name","https://example.com"]]}],[{category:"EN",labels:[]}]),/count mismatch/);
});

test("R12: les QR existants ouvrent le guide traduit via lang=en/es", () => {
  assert.equal(languageForPublicPage("https://lamaisonverte65.fr/guide-vallees-aure-louron?lang=en"), "en");
  assert.equal(languageForPublicPage("https://lamaisonverte65.fr/guide-vallees-aure-louron?lang=es"), "es");
  assert.equal(languageForPublicPage("https://lamaisonverte65.fr/en/guide-vallees-aure-louron"), "en");
  assert.equal(languageForPublicPage("https://lamaisonverte65.fr/es/guide-vallees-aure-louron"), "es");
});

test("R12: le bouton réservation et le retour accueil préservent la langue", () => {
  for (const lang of ["en","es"]) {
    assert.equal(localizePublicHref("/#reservation", lang), `/${lang}/#reservation`);
    assert.equal(localizePublicHref("/", lang), `/${lang}/`);
  }
  assert.match(guide, /href=\{localizePublicHref\("\/#reservation", language\)\}/);
  assert.match(guide, /href=\{localizePublicHref\("\/", language\)\}/);
});

test("R12: traduction des titres, SEO et textes visibles sans changer les métadonnées images", () => {
  for (const lang of ["en","es"]) {
    const c = getGuideCopy(lang);
    for (const field of ["seoTitle","seoDescription","seoOgTitle","seoOgDescription","introTitle","intro","locationTitle","locationText","eventsTitle","eventsIntro","linksTitle","linksIntro","accommodationTitle","accommodationText","availabilityButton","homeButton"]) {
      assert.ok(c[field]?.length > 5, `${lang} ${field}`);
    }
    assert.equal(c.hero.length, 3);
  }
  assert.match(guide, /<Helmet htmlAttributes=\{\{ lang: language \}\}>/);
  assert.match(guide, /href=\{canonicalUrl\}/);
  assert.match(guide, /hrefLang="en"/);
  assert.match(guide, /hrefLang="es"/);
  assert.match(guide, /og:image/);
  assert.doesNotMatch(translations, /https?:\/\/[^\s]+\.(?:jpg|webp|png)/i);
});

test("R12: la grille du guide reste adaptable aux smartphones étroits", () => {
  assert.match(guide, /minmax\(min\(100%, 280px\), 1fr\)/);
  assert.match(guide, /minmax\(min\(100%, 240px\), 1fr\)/);
  assert.match(guide, /minmax\(min\(100%, 210px\), 1fr\)/);
});
