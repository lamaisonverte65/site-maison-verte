import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getAmounts } from "../src/utils/adminFormatters.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("V4.10 full payment does not expose the theoretical deposit as an active amount", () => {
  const amounts = getAmounts({
    contract_total: 238.28,
    deposit_amount: 69,
    payment_preference: "full",
    amount_paid: 0,
    status: "accepted",
  });

  assert.equal(amounts.total, 238.28);
  assert.equal(amounts.deposit, 0);
  assert.equal(amounts.balance, 238.28);
});

test("V4.10 deposit payment keeps the contractual deposit and balance split", () => {
  const amounts = getAmounts({
    contract_total: 238.28,
    deposit_amount: 69,
    payment_preference: "deposit",
    amount_paid: 0,
    status: "accepted",
  });

  assert.equal(amounts.deposit, 69);
  assert.equal(amounts.balance, 169.28);
});

test("reservation summary labels a full-payment booking without an active deposit", () => {
  const source = read("src/components/admin/reservation/ReservationSummaryBlock.jsx");
  assert.match(source, /payment_preference\s*===\s*["']full["']/);
  assert.match(source, /Acompte/);
  assert.match(source, /non applicable/);
  assert.match(source, /Paiement total/);
});


test("payment details hide the deposit section for a full-payment booking", () => {
  const source = read("src/components/admin/reservation/PaymentBlock.jsx");
  assert.match(source, /!fullPayment/);
  assert.match(source, /Paiement total/);
  assert.match(source, /Montant paiement total/);
  assert.doesNotMatch(source, /fullPayment \? "Montant à payer"/);
});
