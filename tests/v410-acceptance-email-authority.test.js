import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("decision email browser contract sends only booking id type and owner message", () => {
  const source = read("src/services/bookingActionsService.js");
  const fn = source.match(/export async function sendDecisionEmail[\s\S]*?\n}/)?.[0] || "";
  assert.match(fn, /bookingId:\s*request\.id/);
  assert.match(fn, /type,/);
  assert.match(fn, /ownerMessage/);
  assert.doesNotMatch(fn, /guestEmail|startDate|paymentLink|paymentAmount|daysBeforeArrival/);
});

test("decision email builds accepted stay and payment data from stored booking", () => {
  const source = read("netlify/functions/send-booking-decision.js");
  assert.match(source, /storedBooking\.guest_first_name/);
  assert.match(source, /storedBooking\.start_date/);
  assert.match(source, /storedBooking\.payment_link/);
  assert.match(source, /storedBooking\.acceptance_expires_at/);
  assert.match(source, /storedBooking\.accommodation_net/);
  assert.match(source, /storedBooking\.tourist_tax_amount/);
});


test("contract URL helper accepts the current PDF and historical immutable LMV URLs", async () => {
  const { CURRENT_CONTRACT_VERSION, CURRENT_CONTRACT_URL, resolveBookingContractUrl } = await import("../netlify/functions/_lib/contract-version.js");

  assert.equal(CURRENT_CONTRACT_VERSION, "v1.5");
  assert.equal(CURRENT_CONTRACT_URL, "https://lamaisonverte65.fr/documents/contrat-location.pdf");
  assert.equal(
    resolveBookingContractUrl("https://lamaisonverte65.fr/documents/contrat-location-V1.2.pdf"),
    "https://lamaisonverte65.fr/documents/contrat-location-V1.2.pdf",
  );
  assert.equal(resolveBookingContractUrl("https://lamaisonverte65.fr/documents/contrat-location.pdf"), CURRENT_CONTRACT_URL);
  assert.equal(resolveBookingContractUrl("https://lamaisonverte65.fr/documents/contrat-location-V1.5.pdf"), "https://lamaisonverte65.fr/documents/contrat-location-V1.5.pdf");
  assert.equal(resolveBookingContractUrl("https://evil.example/contrat-location-V1.5.pdf"), CURRENT_CONTRACT_URL);
  assert.equal(resolveBookingContractUrl("http://lamaisonverte65.fr/documents/contrat-location-V1.4.pdf"), CURRENT_CONTRACT_URL);
  assert.equal(resolveBookingContractUrl("https://lamaisonverte65.fr/documents/contrat-location-V1.4.pdf?download=1"), CURRENT_CONTRACT_URL);
});

test("decision email resolves the stored current or historical contract URL instead of hard-coding a link", () => {
  const source = read("netlify/functions/send-booking-decision.js");
  assert.match(source, /resolveBookingContractUrl/);
  assert.match(source, /storedBooking\.contract_url/);
  assert.match(source, /href="\$\{contractUrl\}"/);
  assert.doesNotMatch(source, /href="https:\/\/lamaisonverte65\.fr\/documents\/contrat-location\.pdf"/);
});
