import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("src/components/home/homeResponsive.css");
const home = read("src/pages/MaisonVerte.jsx");

test("R13.2b : CSS responsive chargé uniquement avec l'accueil", () => {
  assert.match(home, /import "\.\.\/components\/home\/homeResponsive\.css"/);
  assert.match(css, /@media \(max-width: 850px\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
});

test("R13.2b : galerie : quatre colonnes desktop, deux en petit écran", () => {
  const gallery = read("src/components/home/HomeGallery.jsx");
  assert.match(gallery, /className="home-gallery-grid"/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(gallery, /galleryPhotos\.map\(\(photo, index\) =>/);
  assert.match(gallery, /loading="lazy"/);
  assert.match(gallery, /decoding="async"/);
});

test("R13.2b : chaque miniature reste cliquable et devient accessible au clavier", () => {
  const gallery = read("src/components/home/HomeGallery.jsx");
  assert.match(gallery, /<button\s+key=\{photo\.src\}\s+type="button"/);
  assert.match(gallery, /className="gallery-item home-gallery-thumb"/);
  assert.match(gallery, /aria-label=\{copy\.galleryCaptions\[index\] \|\| photo\.caption\}/);
  assert.match(gallery, /setCurrentImageIndex\(index\)/);
  assert.match(gallery, /setLightboxOpen\(true\)/);
  assert.match(css, /\.home-gallery-thumb:focus-visible/);
});

test("R13.2b : présentation et offre ski basculent en une colonne sans distinction d'orientation", () => {
  const presentation = read("src/components/home/HomePresentation.jsx");
  const activities = read("src/components/home/HomeActivities.jsx");
  assert.match(presentation, /className="home-presentation-grid"/);
  assert.match(activities, /className="home-ski-offer"/);
  assert.match(css, /\.home-presentation-grid,\s*\.home-ski-offer\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(activities, /minmax\(min\(100%,260px\),1fr\)/);
  assert.match(presentation, /minmax\(min\(100%,190px\),1fr\)/);
});

test("R13.2b : météo bornée horizontalement et iframes toujours différées", () => {
  const weather = read("src/components/home/HomeWeather.jsx");
  assert.match(weather, /className="home-weather-embed"/);
  assert.match(weather, /height: "496px", overflow: "hidden"/);
  assert.match(weather, /width: "125%"/);
  assert.match(weather, /transform: "scale\(0\.8\)"/);
  assert.equal((weather.match(/loading="lazy"/g) || []).length, 2);
  assert.match(weather, /google\.com\/maps/);
  assert.match(weather, /meteoblue\.com/);
});
