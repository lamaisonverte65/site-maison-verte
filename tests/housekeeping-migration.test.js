import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("housekeeping migration is additive, target-constrained, and append-only", () => {
  const sql = readFileSync("supabase/migrations/202608280003_housekeeping_notes.sql", "utf8");
  assert.match(sql, /create table if not exists public\.external_occupancies/i);
  assert.match(sql, /unique \(source, external_uid\)/i);
  assert.match(sql, /is_current\s+boolean\s+not null\s+default true/i);
  assert.match(sql, /references public\.booking_requests\(id\)/i);
  assert.match(sql, /external_occupation_id\s+uuid/i);
  assert.match(sql, /foreign key \(external_occupation_id\)[\s\S]*references public\.external_occupancies\(id\)/i);
  assert.doesNotMatch(sql, /references public\.external_occupancies\(source, external_uid\)/i);
  assert.match(sql, /housekeeping_notes_exactly_one_target/i);
  assert.match(sql, /revoke update, delete, truncate on table public\.housekeeping_notes from service_role/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.external_occupancies/i);
  assert.doesNotMatch(sql, /^\s*(?:drop|truncate|delete\s+from|update\s+public\.|alter\s+table[^;]+drop)\b/im);
});
