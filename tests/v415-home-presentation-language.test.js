import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getHomeCopy } from "../src/components/home/homeTranslations.js";

const source = (filename) => readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");

test("R10.1 home texts are present in French, English and Spanish", () => {
  for (const language of ["fr", "en", "es"]) {
    const copy = getHomeCopy(language);
    assert.ok(copy.hero.subtitle1 && copy.hero.subtitle2 && copy.hero.description);
    assert.equal(copy.presentation.paragraphs.length, 4);
    assert.equal(copy.presentation.benefits.length, 11);
    assert.equal(copy.presentation.amenities.length, 20);
    assert.equal(copy.galleryCaptions.length, 16);
    assert.ok(copy.contact.title && copy.contact.whatsapp);
  }
  assert.equal(getHomeCopy("fr").hero.subtitle1, "Location de vacances dans les Hautes-Pyrénées");
});

test("R10.1 homepage and photos read locale-aware editorial copy", () => {
  for (const component of ["HomeHero", "HomePresentation", "HomeGallery", "HomeContact", "HomeWeather"]) {
    const jsx = source(`src/components/home/${component}.jsx`);
    assert.match(jsx, /getHomeCopy\(language\)/);
    assert.match(jsx, /languageForPublicPage/);
  }
});

test("R10.1 selector remains visible on top of hero photography", () => {
  const navigation = source("src/components/PublicNavigation.jsx");
  assert.match(navigation, /rgba\(255,255,255,0\.96\)/);
  assert.match(navigation, /public-navigation-language-label/);
  assert.match(navigation, /boxShadow: "0 3px 14px/);
});

test("R10.1 booklet has only the global language selector and keeps print", () => {
  const booklet = source("src/pages/LivretAccueil.jsx");
  assert.doesNotMatch(booklet, /id="livret-language"/);
  assert.doesNotMatch(booklet, /selectLanguage\(/);
  assert.match(booklet, /PublicNavigation/);
  assert.match(booklet, /window\.print\(\)/);
  assert.match(booklet, /normalizeBookletLanguage/);
});
