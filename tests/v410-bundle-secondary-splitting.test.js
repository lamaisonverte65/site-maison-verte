import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/App.jsx", "utf8");
const admin = fs.readFileSync("src/pages/Admin.jsx", "utf8");

test("V4.10 charge les pages publiques secondaires à la demande", () => {
  for (const page of ["GuideValleesAureLouron", "LivretAccueil", "MentionsLegales", "PolitiqueConfidentialite"]) {
    assert.match(app, new RegExp(`const ${page} = lazy\\(\\(\\) => import\\("\\.\\/pages\\/${page}"\\)\\)`));
    assert.doesNotMatch(app, new RegExp(`import ${page} from`));
  }
});

test("V4.10 isole les gros modules admin à la demande", () => {
  assert.match(admin, /const CalendarAdmin = lazy\(\(\) => import\("\.\.\/components\/CalendarAdmin"\)\)/);
  assert.match(admin, /const PricingAdmin = lazy\(\(\) => import\("\.\.\/components\/PricingAdmin"\)\)/);
  assert.match(admin, /const DeclarationsPanel = lazy\(\(\) => import\("\.\.\/components\/admin\/DeclarationsPanel"\)\)/);
  assert.doesNotMatch(admin, /import CalendarAdmin from/);
  assert.doesNotMatch(admin, /import PricingAdmin from/);
  assert.doesNotMatch(admin, /import DeclarationsPanel from/);
});
