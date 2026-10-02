import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("B4.3.0 admin navigation exposes home tax and declarations", () => {
  const source = read("src/components/admin/AdminTopBar.jsx");
  assert.match(source, /key: "home", label: "Accueil"/);
  assert.match(source, /key: "tourist_tax", label: "Taxe de séjour"/);
  assert.match(source, /key: "declarations", label: "Déclarations"/);
  assert.match(source, /stickyAdminNav/);
});

test("B4.3.0 home is the default operational dashboard", () => {
  const source = read("src/pages/Admin.jsx");
  assert.match(source, /useState\("home"\)/);
  assert.match(source, /<AdminHomePanel/);
  assert.match(source, /activeTab === "home"/);
});

test("B4.3.0 tourist tax is separated from pricing", () => {
  const admin = read("src/pages/Admin.jsx");
  const pricing = read("src/components/PricingAdmin.jsx");
  assert.match(admin, /<PricingAdmin mode="pricing"/);
  assert.match(admin, /<PricingAdmin mode="tax"/);
  assert.match(pricing, /mode !== "pricing"/);
  assert.match(pricing, /mode !== "tax"/);
});

test("B4.3.0 reservations table is compact and scrollable", () => {
  const table = read("src/components/admin/reservations/ReservationsTable.jsx");
  const styles = read("src/components/admin/adminStyles.js");
  assert.match(table, /reservationTableCompact/);
  assert.match(styles, /reservationTableCompact:\{maxHeight:"340px",overflow:"auto"/);
});

test("B4.3.0 home contains the agreed operational sections without quick actions", () => {
  const source = read("src/components/admin/AdminHomePanel.jsx");
  assert.match(source, /Aujourd’hui/);
  assert.match(source, /À traiter/);
  assert.match(source, /Prochains séjours/);
  assert.match(source, /CA confirmé/);
  assert.doesNotMatch(source, /Actions rapides/);
});
