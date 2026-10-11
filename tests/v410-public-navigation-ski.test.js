import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("public navigation is shared and exposes all public destinations", () => {
  const source = read("src/components/PublicNavigation.jsx");
  assert.match(source, /aria-label="Ouvrir le menu"/);
  assert.match(source, /left: 0/);
  assert.match(source, /La Maison Verte/);
  assert.match(source, /\["Présentation", "\/#presentation"\]/);
  assert.match(source, /\["Guide des vallées", "\/guide-vallees-aure-louron"\]/);
  assert.match(source, /\["Livret d'accueil", "\/livret"\]/);
  assert.match(source, /\["Ski – Moniteur", "\/ski-vallees-aure-louron"\]/);
  assert.match(source, /\["Appeler", "\/appeler"\]/);
  assert.match(source, /WhatsApp/);
  assert.match(source, /https:\/\/wa\.me\/33695938315\?text=/);
  assert.match(source, /\["Réservation", "\/#reservation"\]/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /document\.body\.style\.overflow = "hidden"/);
});

test("main guide booklet and ski pages use the shared public navigation", () => {
  for (const path of [
    "src/pages/MaisonVerte.jsx",
    "src/pages/GuideValleesAureLouron.jsx",
    "src/pages/LivretAccueil.jsx",
    "src/pages/SkiValleesAureLouron.jsx",
  ]) {
    const source = read(path);
    assert.match(source, /PublicNavigation/);
  }
});

test("ski showcase has its route existing content and conversion links", () => {
  const app = read("src/App.jsx");
  const ski = read("src/pages/SkiValleesAureLouron.jsx");
  assert.match(app, /SkiValleesAureLouron/);
  assert.match(app, /path === "\/ski-vallees-aure-louron"/);
  assert.match(ski, /activite-ski\.webp/);
  assert.match(ski, /Peyragudes/);
  assert.match(ski, /moniteur de ski diplômé/i);
  assert.match(ski, /jusqu’à 15% de réduction/);
  assert.match(ski, /href="\/#reservation"/);
  assert.match(ski, /href="\/#contact"/);
});

test("3-star plaque is in presentation without adding a gallery image", () => {
  const home = read("src/pages/MaisonVerte.jsx");
  assert.match(home, /\/classement\/panonceau-meuble-tourisme-3-etoiles-2026\.png/);
  assert.match(home, /Panonceau officiel du classement Meublé de tourisme 3 étoiles/);
  const galleryBlock = home.match(/const galleryPhotos = \[[\s\S]*?\n  \];/)?.[0] || "";
  assert.ok(galleryBlock);
  assert.doesNotMatch(galleryBlock, /panonceau-meuble-tourisme/);
  assert.ok(fs.existsSync("public/classement/panonceau-meuble-tourisme-3-etoiles-2026.png"));
});


test("navigation header places logo before a prominent green hamburger", () => {
  const source = read("src/components/PublicNavigation.jsx");
  const logoIndex = source.indexOf('aria-label="La Maison Verte - accueil"');
  const hamburgerIndex = source.indexOf('aria-label="Ouvrir le menu"');
  assert.ok(logoIndex >= 0 && hamburgerIndex > logoIndex);
  assert.match(source, /background: "#1f6f3d"/);
  assert.match(source, /background: "white"/);
});

test("presentation anchor reserves header space and plaque is integrated in En bref", () => {
  const home = read("src/pages/MaisonVerte.jsx");
  assert.match(home, /id="presentation"[\s\S]*scrollMarginTop: "86px"/);
  const enBrefIndex = home.indexOf("En bref");
  const plaqueIndex = home.indexOf("panonceau-meuble-tourisme-3-etoiles-2026.png");
  const introIndex = home.indexOf("Un petit cocon niché");
  assert.ok(enBrefIndex >= 0 && plaqueIndex > enBrefIndex);
  assert.ok(introIndex >= 0 && plaqueIndex > enBrefIndex);
});

test("published site reviews no longer depend on consent_to_publish", () => {
  const home = read("src/pages/MaisonVerte.jsx");
  assert.match(home, /\.eq\("status", "published"\)/);
  assert.doesNotMatch(home, /\.eq\("consent_to_publish", true\)/);
  assert.doesNotMatch(home, /if \(!reviewConsent\)/);
  assert.match(home, /\.netlify\/functions\/submit-guest-review/);
  const submitFn = read("netlify/functions/submit-guest-review.js");
  const helper = read("netlify/functions/_lib/guest-review-validation.js");
  assert.match(helper, /consent_to_publish: true/);
  assert.match(submitFn, /status/);
  assert.match(home, /En envoyant cet avis, vous acceptez sa publication/);
});

test("Google review card displays the current two five-star reviews", () => {
  const home = read("src/pages/MaisonVerte.jsx");
  assert.match(home, /5,0\/5/);
  assert.match(home, /2 avis Google/);
  assert.doesNotMatch(home, /Les premiers avis Google apparaîtront prochainement/);
});


test("public contact section exposes WhatsApp Business alongside phone", () => {
  const home = read("src/pages/MaisonVerte.jsx");
  assert.match(home, /href="https:\/\/wa\.me\/33695938315\?text=/);
  assert.match(home, /Écrire sur WhatsApp/);
  assert.match(home, /target="_blank"/);
  assert.match(home, /rel="noopener noreferrer"/);
});
