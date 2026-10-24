import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.jsx");

test("R13.2 : accueil découplé du bundle initial pour les routes secondaires", () => {
  assert.match(app, /const MaisonVerte = lazy\(\(\) => import\("\.\/pages\/MaisonVerte"\)\)/);
  assert.doesNotMatch(app, /import MaisonVerte from/);
  assert.match(app, /if \(publicPage\?\.page === "home"\) \{\s*return withLazyAnalytics\(<>{previewMarker}<MaisonVerte \/><\/>\);/);
});

test("R13.2 : routes secondaires et administration conservent leur propre chargement", () => {
  for (const route of ["Admin", "GuideValleesAureLouron", "LivretAccueil", "SkiValleesAureLouron"]) {
    assert.match(app, new RegExp(`const ${route} = lazy\\(`));
  }
  assert.match(app, /if \(path === "\/admin"\)/);
  assert.match(app, /if \(path === "\/success"\)/);
  assert.match(app, /SiteAnalyticsTracker/);
  assert.match(app, /UntranslatedPublicPreview/);
  assert.match(app, /PublicNotFound/);
});

test("R13.2 : les 16 photos de la galerie sont différées sans sacrifier la visionneuse", () => {
  const gallery = read("src/components/home/HomeGallery.jsx");
  assert.match(gallery, /galleryPhotos\.map\(\(photo, index\) =>/);
  assert.match(gallery, /loading="lazy"/);
  assert.doesNotMatch(gallery, /loading=\{index === 0 \? "eager"/);
  assert.match(gallery, /decoding="async"/);
  assert.match(gallery, /setCurrentImageIndex\(index\)/);
  assert.match(gallery, /setLightboxOpen\(true\)/);
  assert.match(gallery, /alt=\{copy\.galleryCaptions\[index\] \|\| photo\.caption\}/);
});

test("R13.2 : images des quatre activités et de l'offre ski chargées à la demande", () => {
  const activities = read("src/components/home/HomeActivities.jsx");
  assert.equal((activities.match(/<img\b/g) || []).length, 2);
  assert.equal((activities.match(/loading="lazy"/g) || []).length, 2);
  assert.equal((activities.match(/decoding="async"/g) || []).length, 2);
  assert.match(activities, /src=\{activity\.image\}/);
  assert.match(activities, /src="\/activite-ski\.webp"/);
});

test("R13.2 : les intégrations externes ne chargent qu'à l'approche de la météo", () => {
  const weather = read("src/components/home/HomeWeather.jsx");
  assert.equal((weather.match(/<iframe\b/g) || []).length, 2);
  assert.equal((weather.match(/loading="lazy"/g) || []).length, 2);
  assert.match(weather, /meteoblue\.com/);
  assert.match(weather, /google\.com\/maps/);
  assert.match(weather, /minmax\(min\(100%, 320px\),1fr\)/);
});

test("R13.2 : éléments hors écran des rubriques contact et présentation différés", () => {
  const contact = read("src/components/home/HomeContact.jsx");
  const presentation = read("src/components/home/HomePresentation.jsx");
  assert.match(contact, /loading="lazy"\s+decoding="async"\s+src="\/banniere\.webp"/);
  assert.match(presentation, /loading="lazy"\s+decoding="async"\s+src="\/classement\/panonceau-meuble-tourisme-3-etoiles-2026\.webp"/);
  assert.match(contact, /href="tel:\+33695938315"/);
});
