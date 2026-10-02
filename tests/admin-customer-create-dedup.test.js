import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const projectRoot = process.cwd();
const admin = fs.readFileSync(path.join(projectRoot, "src", "pages", "Admin.jsx"), "utf8");
const panel = fs.readFileSync(path.join(projectRoot, "src", "components", "admin", "CustomersPanel.jsx"), "utf8");
const modal = fs.readFileSync(path.join(projectRoot, "src", "components", "admin", "CustomerCreateModal.jsx"), "utf8");

test("Ajouter client n'insère plus une fiche Nouveau client vide", () => {
  assert.doesNotMatch(admin, /last_name:\s*["']Nouveau client["']/);
  assert.match(panel, /setShowCreateCustomer\(true\)/);
  assert.match(panel, /<CustomerCreateModal/);
});

test("la création exige prénom et nom et enregistre les coordonnées saisies", () => {
  assert.match(admin, /if \(!firstName \|\| !lastName\) throw new Error/);
  assert.match(admin, /first_name: firstName/);
  assert.match(admin, /last_name: lastName/);
  assert.match(admin, /email: email \|\| null/);
  assert.match(admin, /phone: phone \|\| null/);
  assert.match(admin, /address: address \|\| null/);
  assert.match(admin, /postal_code: postalCode \|\| null/);
  assert.match(admin, /city: city \|\| null/);
  assert.match(admin, /country: country \|\| null/);
  assert.match(modal, /update\("address"/);
  assert.match(modal, /update\("postalCode"/);
  assert.match(modal, /update\("city"/);
  assert.match(modal, /update\("country"/);
});

test("le formulaire réutilise la recherche CRM et bloque une correspondance exacte", () => {
  assert.match(modal, /useCustomerSearch/);
  assert.match(modal, /const exactDuplicate = useMemo/);
  assert.match(modal, /Ouvrir ce client/);
  assert.match(modal, /disabled=\{saving \|\| Boolean\(exactDuplicate\)\}/);
});
