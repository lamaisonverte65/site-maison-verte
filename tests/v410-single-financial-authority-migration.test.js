import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const path = new URL("../supabase/migrations/202610020002_v410_contract_total_single_authority.sql", import.meta.url);

test("V4.10 migration makes estimated_total legacy-only and removes it from public booking insert", () => {
  const sql = fs.readFileSync(path, "utf8");
  assert.match(sql, /alter\s+column\s+estimated_total\s+drop\s+not\s+null/i);
  const insert = sql.match(/insert into public\.booking_requests\s*\(([\s\S]*?)\)\s*values\s*\(([\s\S]*?)\)/i);
  assert.ok(insert, "public booking INSERT must remain explicit");
  assert.doesNotMatch(insert[1], /\bestimated_total\b/i);
});
