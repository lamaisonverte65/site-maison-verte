import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HOME_SEO, HOME_ALTERNATES, getHomeSeo } from "../src/components/home/homeSeo.js";
import { resolvePublicPage } from "../shared/publicSiteLocale.js";

const read = (path) => readFileSync(path, "utf8");
const home = read("src/pages/MaisonVerte.jsx");
const app = read("src/App.jsx");
const guide = read("src/pages/GuideValleesAureLouron.jsx");
const booklet = read("src/pages/LivretAccueil.jsx");
const netlify = read("netlify.toml");
const sitemap = read("public/sitemap.xml");

const ROOT = "https://lamaisonverte65.fr";

test("R13.1 : SEO accueil localise et URL canonique propre pour chaque langue", () => {
  for (const language of ["fr", "en", "es"]) {
    const seo = getHomeSeo(language);
    assert.equal(seo, HOME_SEO[language]);
    assert.equal(seo.canonical, language === "fr" ? `${ROOT}/` : `${ROOT}/${language}/`);
    assert.equal(resolvePublicPage(new URL(seo.canonical).pathname)?.language, language);
    for (const field of ["title", "description", "ogTitle", "ogDescription", "twitterDescription", "ogLocale"]) {
      assert.ok(seo[field] && typeof seo[field] === "string", `${language}: ${field}`);
    }
  }
  assert.notEqual(HOME_SEO.fr.title, HOME_SEO.en.title);
  assert.notEqual(HOME_SEO.fr.description, HOME_SEO.es.description);
  assert.equal(getHomeSeo("??"), HOME_SEO.fr);
});

test("R13.1 : hreflang reciproques accueil fr/en/es et x-default", () => {
  for (const language of ["fr", "en", "es"]) {
    assert.equal(HOME_ALTERNATES[language], HOME_SEO[language].canonical);
    assert.match(home, new RegExp(`hrefLang="${language}"`));
  }
  assert.equal(HOME_ALTERNATES["x-default"], HOME_SEO.fr.canonical);
  assert.match(home, /hrefLang="x-default"/);
  assert.match(home, /<Helmet htmlAttributes=\{\{ lang: siteLanguage \}\}>/);
  assert.match(home, /rel="canonical" href=\{homeSeo.canonical\}/);
  assert.match(home, /property="og:url" content=\{homeSeo.canonical\}/);
});

test("R13.1 : conservation du noindex temporaire FR/EN/ES selectionne sans indexation precoce", () => {
  assert.match(app, /function UntranslatedPublicPreview/);
  assert.match(app, /if \(language === "fr"\) return null/);
  assert.match(app, /<meta name="robots" content="noindex,follow"/);
  assert.match(netlify, /for = "\/en\/\*"[\s\S]*?X-Robots-Tag = "noindex, follow"/);
  assert.match(netlify, /for = "\/es\/\*"[\s\S]*?X-Robots-Tag = "noindex, follow"/);
  for (const bare of ["en", "es"]) {
    assert.ok(netlify.includes(`for = "/${bare}"\n  [headers.values]\n    X-Robots-Tag = "noindex, follow"`));
  }
  assert.doesNotMatch(read("public/robots.txt"), /Disallow:\s*\/(?:en|es)/);
});

test("R13.1 : sitemap ne reference que les pages effectivement indexables avant publication", () => {
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  for (const pathname of ["/", "/guide-vallees-aure-louron", "/ski-vallees-aure-louron"]) {
    assert.ok(sitemap.includes(`<loc>${ROOT}${pathname}</loc>`), pathname);
  }
  assert.equal((sitemap.match(/<loc>/g) || []).length, 3);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/lamaisonverte65\.fr\/(?:en|es)\//);
  assert.doesNotMatch(sitemap, /\/livret/);
});

test("R13.1 : guide garde ses canoniques et alternate deja corrects", () => {
  assert.match(guide, /href=\{canonicalUrl\}/);
  assert.match(guide, /hrefLang="fr"/);
  assert.match(guide, /hrefLang="en"/);
  assert.match(guide, /hrefLang="es"/);
  assert.match(guide, /hrefLang="x-default"/);
});

test("R13.1 : livret et page introuvable exclus des moteurs", () => {
  assert.match(booklet, /<meta name="robots" content="noindex,follow"/);
  const notFound = app.split(/function PublicNotFound\s*\([^)]*\)\s*\{/)[1]?.split("export default function App()")[0];
  assert.ok(notFound, "Composant PublicNotFound introuvable");
  assert.match(notFound, /<meta name="robots" content="noindex,follow"/);
  for (const pathname of ["/livret", "/livret-accueil", "/admin", "/arrival", "/success", "/cancel", "/avis-validation"]) {
    assert.ok(netlify.includes(`for = "${pathname}"\n  [headers.values]\n    X-Robots-Tag = "noindex, follow"`), pathname);
  }
});

test("R13.1 : donnees structurees reprennent le Wi-Fi reel sans inventer de notation", () => {
  assert.match(home, /"@type": "VacationRental"/);
  assert.match(home, /name: "Wi-Fi 7"/);
  assert.doesNotMatch(home, /aggregateRating:\s*\{/);
  assert.match(home, /name: "Balcon sud-ouest"/);
});

test("R19 : calendrier iCal et automatisations preserves malgre la correction des 404", () => {
  const redirects = read("public/_redirects");
  assert.match(redirects, /^\/calendar\.ics\s+\/\.netlify\/functions\/export-ical\s+200\s*$/m);
  assert.doesNotMatch(netlify, /\[\[redirects\]\]/);
  assert.doesNotMatch(redirects, /^\/\*\s+\/index\.html\s+200\b/m);
  assert.match(netlify, /schedule = "0 8 \* \* \*"/);
  assert.match(home, /submitPublicBooking/);
  assert.match(home, /booking-quote/);
});
