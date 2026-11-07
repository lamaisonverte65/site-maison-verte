import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("R29 navigation exposes home, declarations and backups without a tax tab", () => {
  const source = read("src/components/admin/AdminTopBar.jsx");
  assert.match(source, /key: "home", label: "Accueil"/);
  assert.doesNotMatch(source, /key: "tourist_tax"/);
  assert.doesNotMatch(source, /key: "crm"/);
  assert.match(source, /key: "backups", label: "Sauvegardes"/);
  assert.match(source, /key: "declarations", label: "Déclarations"/);
  assert.match(source, /stickyAdminNav/);
});

test("B4.3.0 home is the default operational dashboard", () => {
  const source = read("src/pages/Admin.jsx");
  assert.match(source, /useState\("home"\)/);
  assert.match(source, /<AdminHomePanel/);
  assert.match(source, /activeTab === "home"/);
});

test("R29 tourist tax is accessible inside pricing, without its own tab", () => {
  const admin = read("src/pages/Admin.jsx");
  const pricing = read("src/components/PricingAdmin.jsx");
  assert.match(admin, /<PricingAdmin mode="all"/);
  assert.match(pricing, /<details className="pricing-tax-details"/);
  assert.match(pricing, /<summary style=/);
  assert.doesNotMatch(admin, /activeTab === "tourist_tax"/);
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
