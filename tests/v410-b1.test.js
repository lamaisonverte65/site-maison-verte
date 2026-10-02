import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/202609280002_v410_public_booking_snapshots.sql";

test("V4.10 B1 RPC persists contract and deposit snapshots atomically", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  for (const field of ["deposit_rate", "deposit_basis", "deposit_amount", "contract_total", "tourist_tax_snapshot"]) {
    assert.match(sql, new RegExp(`\\b${field}\\b`, "i"), `${field} must be persisted`);
  }
  assert.match(sql, /Incomplete V4\.10 public booking financial snapshot/i);
  assert.match(sql, /revoke all on function public\.create_public_booking_request_atomic[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.create_public_booking_request_atomic[\s\S]*to service_role/i);
});
