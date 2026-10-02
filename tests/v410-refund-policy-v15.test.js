import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sqlUrl = new URL("../supabase/migrations/202609290001_v410_refund_policy_v15.sql", import.meta.url);
const sql = await readFile(sqlUrl, "utf8").catch(() => "");

test("B3.1 migration exists and is transactional", () => {
  assert.notEqual(sql, "");
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
});

test("V4.10 refund authority consumes contract and deposit snapshots", () => {
  assert.match(sql, /v_is_v410 := v_booking\.contract_total is not null[\s\S]*v_booking\.deposit_amount is not null[\s\S]*v_booking\.deposit_basis is not null[\s\S]*v_booking\.deposit_rate is not null/i);
  assert.match(sql, /if v_is_v410 then[\s\S]*v_contract_total_cents := round\(v_booking\.contract_total \* 100\)[\s\S]*v_contract_deposit_cents := round\(v_booking\.deposit_amount \* 100\)/i);
});

test("30 percent exists only inside the explicit legacy fallback", () => {
  const v410Start = sql.indexOf("if v_is_v410 then");
  const legacyStart = sql.indexOf("else\n    -- Compatibilité legacy uniquement", v410Start);
  const legacyEnd = sql.indexOf("end if;", legacyStart);
  assert.ok(v410Start >= 0 && legacyStart > v410Start && legacyEnd > legacyStart);
  assert.doesNotMatch(sql.slice(v410Start, legacyStart), /0\.30/);
  assert.match(sql.slice(legacyStart, legacyEnd), /v_booking\.deposit_amount is not null[\s\S]*v_contract_total_cents \* 0\.30/i);
});

test("policy has only the validated owner, client > J-30 and client <= J-30 branches", () => {
  const policyStart = sql.indexOf("if p_refund_mode = 'policy' then");
  const manualStart = sql.indexOf("else\n    v_effective_mode := p_refund_mode", policyStart);
  const policy = sql.slice(policyStart, manualStart);
  assert.match(policy, /p_cancellation_type = 'owner'[\s\S]*v_effective_mode := 'total'/i);
  assert.match(policy, /v_days > 30[\s\S]*v_effective_mode := 'total'/i);
  assert.match(policy, /else[\s\S]*v_effective_mode := 'balance'/i);
  assert.doesNotMatch(policy, /v_days\s*>=?\s*7|v_days\s*<\s*7|J-7|moins de 7/i);
});

test("client <= J-30 preserves the contractual deposit for a single full payment", () => {
  assert.match(sql, /v_effective_mode = 'balance'[\s\S]*v_payment\.payment_type = 'full'[\s\S]*v_payment_cents\s*-\s*v_contract_deposit_cents\s*-\s*v_succeeded_cents\s*-\s*v_reserved_cents/i);
});

test("deposit-only payment is not eligible when policy preserves the deposit", () => {
  const firstAllocation = sql.indexOf("if v_effective_mode in ('total', 'custom') then");
  const requested = sql.indexOf("v_requested_cents := case", firstAllocation);
  const block = sql.slice(firstAllocation, requested);
  assert.match(block, /v_effective_mode = 'deposit'[\s\S]*payment_type = 'deposit'/i);
  assert.match(block, /v_effective_mode = 'balance'[\s\S]*payment_type = 'balance'/i);
  assert.doesNotMatch(block.match(/elsif v_effective_mode = 'balance'[\s\S]*?end if;/i)?.[0] || "", /payment_type = 'deposit'/i);
});

test("manual refund modes remain distinct from cancellation policy", () => {
  assert.match(sql, /else\s+v_effective_mode := p_refund_mode;/i);
  for (const mode of ["none", "total", "custom", "deposit", "balance"]) {
    assert.match(sql, new RegExp(`when '${mode}'`, "i"));
  }
});

test("B3.1 does not mutate V4.10 contract snapshots", () => {
  assert.doesNotMatch(sql, /update\s+public\.booking_requests[\s\S]{0,500}\b(contract_total|deposit_amount|deposit_basis|deposit_rate)\s*=/i);
});
