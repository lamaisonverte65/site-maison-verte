import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  resolvePublicPage, publicUrlForLanguage, localizePublicHref, languageForPublicPage,
} from "../shared/publicSiteLocale.js";

// R9 ne modifie ni les routes admin/paiement ni les URL du livret déjà partagées.
test("R9: chaque page publique reconnue utilise le meme composant FR EN ES", () => {
  for (const [path,page] of [["/", "home"],["/guide-vallees-aure-louron", "guide"],["/livret", "booklet"],["/ski-vallees-aure-louron", "ski"]]) {
    assert.equal(resolvePublicPage(path)?.page, page);
    assert.equal(resolvePublicPage(`/en${path}`)?.page, page);
    assert.equal(resolvePublicPage(`/es${path}`)?.page, page);
    assert.equal(resolvePublicPage(`/en${path}`)?.language, "en");
  }
  assert.equal(resolvePublicPage("/livret-accueil")?.page, "booklet");
  assert.equal(resolvePublicPage("/en")?.page, "home");
  assert.equal(resolvePublicPage("/en/")?.page, "home");
});

test("R9: routes inconnues, admin et paiements jamais detournes", () => {
  for (const path of ["/admin","/en/admin","/success","/en/success","/arrival","/es/arrival","/not-found","/en/not-found", ""])
    assert.equal(resolvePublicPage(path), null, path);
});

test("R9: changement de langue sur l'accueil conserve la section et la recherche", () => {
  assert.equal(publicUrlForLanguage("https://lamaisonverte65.fr/#reservation", "en"), "/en/#reservation");
  assert.equal(publicUrlForLanguage("/es/?review=1#avis", "fr"), "/?review=1#avis");
  assert.equal(publicUrlForLanguage("/en/#presentation", "es"), "/es/#presentation");
  assert.equal(publicUrlForLanguage("/en", "en"), "/en/");
});

test("R9: guide et ski gardent des adresses stables pour chaque langue", () => {
  assert.equal(publicUrlForLanguage("/guide-vallees-aure-louron?lang=en", "es"), "/es/guide-vallees-aure-louron");
  assert.equal(publicUrlForLanguage("/es/ski-vallees-aure-louron", "fr"), "/ski-vallees-aure-louron");
  assert.equal(localizePublicHref("/#contact", "en"), "/en/#contact");
  assert.equal(localizePublicHref("/ski-vallees-aure-louron", "es"), "/es/ski-vallees-aure-louron");
});

test("R9: le livret garde ses URL partagees et ne lance pas une impression intempestive", () => {
  assert.equal(publicUrlForLanguage("/livret?lang=en&print=1", "es"), "/livret?lang=es");
  assert.equal(publicUrlForLanguage("/livret?lang=es", "fr"), "/livret");
  assert.equal(publicUrlForLanguage("/en/livret", "es"), "/livret?lang=es");
  assert.equal(localizePublicHref("/livret", "en"), "/livret?lang=en");
  assert.equal(languageForPublicPage("/livret?lang=es"), "es");
});

test("R9: ressources statiques et URL externes ne sont pas reecrites", () => {
  for (const href of ["https://www.example.org/", "/documents/contrat-location.pdf", "/appeler", "mailto:contact@lamaisonverte65.fr", "#faq"])
    assert.equal(localizePublicHref(href, "es"), href);
});

test("R9: le menu reste partage, le choix de langue accessible et l'ancien routage conserve", () => {
  const nav = fs.readFileSync("src/components/PublicNavigation.jsx", "utf8");
  const app = fs.readFileSync("src/App.jsx", "utf8");
  const livret = fs.readFileSync("src/pages/LivretAccueil.jsx", "utf8");
  assert.match(nav, /public-language-drawer/);
  assert.match(nav, /public-language-header/);
  assert.match(nav, /onChange=\{\(event\) => changeLanguage\(event.target.value\)\}/);
  assert.match(nav, /localizePublicHref/);
  assert.match(app, /path === "\/admin"/);
  assert.match(app, /path === "\/success"/);
  assert.match(app, /path === "\/cancel"/);
  assert.match(app, /path === "\/arrival"/);
  assert.match(app, /PublicNotFound/);
  assert.match(app, /noindex,follow/);
  assert.match(livret, /guestLanguageFromUrl/);
  assert.doesNotMatch(livret, /id="livret-language"/);
  assert.match(nav, /publicUrlForLanguage/);
});
