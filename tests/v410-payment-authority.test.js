import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  contractualDeposit,
  contractualTotal,
  hasV410FinancialSnapshot,
  recordedPaidAmount,
  remainingContractualDue,
} from "../netlify/functions/_lib/booking-financial-authority.js";

test("V4.10 contract_total and deposit_amount are authoritative over legacy totals", () => {
  const booking = {
    contract_total: 411.44,
    deposit_rate: 0.40,
    deposit_basis: 410,
    deposit_amount: 164,
    owner_price: 999,
    estimated_total: 888,
    balance_amount: 1,
    amount_paid: 0,
  };
  assert.equal(hasV410FinancialSnapshot(booking), true);
  assert.equal(contractualTotal(booking), 411.44);
  assert.equal(contractualDeposit(booking), 164);
  assert.equal(remainingContractualDue(booking), 411.44);
});

test("V4.10 remaining due follows the ledger amount_paid, not balance_amount", () => {
  const booking = {
    contract_total: 411.44,
    deposit_rate: 0.40,
    deposit_basis: 410,
    deposit_amount: 164,
    amount_paid: 164,
    balance_amount: 999,
  };
  assert.equal(recordedPaidAmount(booking), 164);
  assert.equal(remainingContractualDue(booking), 247.44);
});

test("legacy bookings retain owner_price and 30 percent fallback", () => {
  const booking = { owner_price: 320, estimated_total: 350, deposit_amount: null, amount_paid: 0 };
  assert.equal(hasV410FinancialSnapshot(booking), false);
  assert.equal(contractualTotal(booking), 320);
  assert.equal(contractualDeposit(booking), 96);
});

test("B2 SQL uses contract_total for V4.10 and never rewrites its contract on manual total", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202609280003_v410_stripe_payment_authority.sql", import.meta.url), "utf8");
  assert.match(sql, /when v_is_v410 then v_booking\.contract_total/i);
  assert.match(sql, /deposit_amount_mismatch/i);
  assert.match(sql, /manual_total_amount_mismatch/i);
  assert.match(sql, /if p_manual_reason = 'total' and v_is_v410 then[\s\S]*amount_paid = v_new_total_paid/i);
  const v410Block = sql.match(/if p_manual_reason = 'total' and v_is_v410 then([\s\S]*?)elsif p_manual_reason = 'total' then/i)?.[1] || "";
  assert.doesNotMatch(v410Block, /owner_price\s*=/i);
  assert.doesNotMatch(v410Block, /contract_total\s*=/i);
  assert.doesNotMatch(v410Block, /deposit_amount\s*=/i);
});
