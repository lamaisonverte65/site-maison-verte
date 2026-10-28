import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePublicBookingPayload } from "../netlify/functions/_lib/public-booking.js";
import { CURRENT_CONTRACT_URL, CURRENT_CONTRACT_VERSION, resolveBookingContractUrl } from "../netlify/functions/_lib/contract-version.js";
import { publicShellTranslations } from "../src/pages/guestFlowTranslations.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("R7: nouvelle reservation ne reference jamais le PDF archive V1.5", () => {
  assert.equal(CURRENT_CONTRACT_VERSION, "v1.5");
  assert.equal(CURRENT_CONTRACT_URL, "https://lamaisonverte65.fr/documents/contrat-location.pdf");
  const source = read("netlify/functions/_lib/public-booking.js");
  assert.match(source, /contract_url: CURRENT_CONTRACT_URL/);
  assert.doesNotMatch(source, /contrat-location-V1\.5\.pdf/);
  assert.equal(resolveBookingContractUrl(CURRENT_CONTRACT_URL), CURRENT_CONTRACT_URL);
});

test("R7: les nouvelles reservations FR/EN/ES enregistrent le contrat courant", () => {
  const payload = {
    guestFirstName: "Alice", guestLastName: "Martin", guestEmail: "alice@example.test", guestPhone: "+33 6 12 34 56 78",
    guestAddress: "12 rue des Pyrénées", guestPostalCode: "65240", guestCity: "Arreau", guestCountry: "France",
    adultsCount: 2, childrenCount: 1, childrenAges: "7 ans", babyBedNeeded: false, marketingConsent: true,
    guestMessage: "Séjour en famille", startDate: "2026-11-10", endDate: "2026-11-13", nights: 3,
    accommodationTotal: 420, contractAccepted: true, cleaningOption: true, website: "",
  };
  for (const communicationLanguage of ["fr", "en", "es"]) {
    const result = validatePublicBookingPayload({ ...payload, communicationLanguage }, { cleaningFee: 50 });
    assert.equal(result.ok, true, communicationLanguage);
    assert.equal(result.booking.contract_url, CURRENT_CONTRACT_URL);
    assert.equal(result.booking.contract_version, CURRENT_CONTRACT_VERSION);
  }
});

test("R7: les liens historiques LMV restent accessibles, les autres URLs sont refusees", () => {
  for (const version of ["V1.1", "V1.4", "V1.5"]) {
    const old = `https://lamaisonverte65.fr/documents/contrat-location-${version}.pdf`;
    assert.equal(resolveBookingContractUrl(old), old);
  }
  for (const invalid of [
    "https://evil.example/documents/contrat-location.pdf",
    "http://lamaisonverte65.fr/documents/contrat-location.pdf",
    "https://lamaisonverte65.fr/documents/contrat-location.pdf?override=1",
    "https://lamaisonverte65.fr/documents/../admin",
  ]) assert.equal(resolveBookingContractUrl(invalid), CURRENT_CONTRACT_URL);
});

test("R7: navigation publique FR/EN/ES affiche chargement et erreur traduits", () => {
  for (const language of ["fr", "en", "es"]) {
    const keys = Object.keys(publicShellTranslations.fr);
    assert.deepEqual(Object.keys(publicShellTranslations[language]), keys);
    for (const key of keys) assert.ok(publicShellTranslations[language][key].trim());
  }
  assert.equal(publicShellTranslations.en.notFoundTitle, "Page not found");
  assert.equal(publicShellTranslations.es.loading, "Cargando…");
  const app = read("src/App.jsx");
  assert.match(app, /<PublicNotFound language=\{publicLanguage\}/);
  assert.match(app, /publicShellTranslations\[normalizeGuestLanguage\(publicLanguage\)\]\.loading/);
  assert.match(app, /<a href=\{homeHref\}>\{t\.home\}<\/a>/);
});
