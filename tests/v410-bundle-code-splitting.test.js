import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/App.jsx", "utf8");

test("V4.10 charge l'administration à la demande", () => {
  assert.match(source, /const Admin = lazy\(\(\) => import\("\.\/pages\/Admin"\)\)/);
  assert.doesNotMatch(source, /import Admin from "\.\/pages\/Admin"/);
  assert.match(source, /<Suspense[\s\S]*?<Admin \/>[\s\S]*?<\/Suspense>/);
});
