import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/202609010001_v47a_atomic_direct_bookings.sql";
const precheckPath = "docs/operations/v47a-direct-booking-overlap-precheck.sql";

test("V4.7-A migration and read-only precheck are present", () => {
  assert.equal(existsSync(migrationPath), true);
  assert.equal(existsSync(precheckPath), true);
});

test("migration enforces half-open local blocking periods without btree_gist", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /exclude\s+using\s+gist\s*\(\s*daterange\s*\(\s*start_date\s*,\s*end_date\s*,\s*'\[\)'\s*\)\s+with\s+&&\s*\)/i);
  assert.match(sql, /status\s+in\s*\(\s*'pending'\s*,\s*'accepted'\s*,\s*'deposit_paid'\s*,\s*'paid'\s*,\s*'fully_paid'\s*,\s*'confirmed'\s*\)/i);
  assert.match(sql, /source\s+is\s+null[\s\S]*source\s+in\s*\(\s*'website'\s*,\s*'direct'\s*,\s*'admin_client'\s*,\s*'admin_personal'\s*\)/i);
  assert.doesNotMatch(sql, /create\s+extension[\s\S]*btree_gist/i);
});

test("migration aborts on unclassified sources and historical local overlaps without rewriting bookings", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /unclassified[^']*source|source[^']*non class/i);
  assert.match(sql, /where\s+source\s+is\s+not\s+null\s+and\s+source::text\s+not\s+in/i);
  assert.match(sql, /historical[^']*overlap|chevauchement[^']*historique/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.booking_requests/i);
  assert.doesNotMatch(sql, /update\s+public\.booking_requests\s+set/i);
});

test("website is classified and included in every local source predicate without allowing unknown sources", () => {
  for (const path of [migrationPath, precheckPath]) {
    const sql = readFileSync(path, "utf8");
    const localLists = [...sql.matchAll(/source\s+in\s*\(([^)]*'admin_personal'[^)]*)\)/gi)];
    assert.ok(localLists.length > 0);
    for (const [, list] of localLists) {
      assert.deepEqual([...list.matchAll(/'([^']+)'/g)].map((match) => match[1]),
        ["website", "direct", "admin_client", "admin_personal"]);
    }
  }
  const sql = readFileSync(migrationPath, "utf8");
  const classified = sql.match(/source::text\s+not\s+in\s*\(([^)]+)\)/i)[1];
  assert.deepEqual([...classified.matchAll(/'([^']+)'/g)].map((match) => match[1]),
    ["website", "direct", "admin_client", "admin_personal", "booking", "airbnb", "booking_import", "airbnb_import"]);
});

test("atomic RPC checks known blockers before claiming and inserting", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const rpcSql = sql.slice(sql.search(/create\s+or\s+replace\s+function\s+public\.create_public_booking_request_atomic/i));
  const duplicateProbe = rpcSql.search(/from\s+public\.public_rate_limits/i);
  const checkBooking = rpcSql.search(/from\s+public\.booking_requests/i);
  const checkBlocks = rpcSql.search(/from\s+public\.calendar_blocks/i);
  const checkExternal = rpcSql.search(/from\s+public\.external_occupancies/i);
  const claim = rpcSql.search(/claim_public_rate_limit/i);
  const insert = rpcSql.search(/insert\s+into\s+public\.booking_requests/i);

  assert.ok(duplicateProbe >= 0);
  assert.ok(checkBooking > duplicateProbe && checkBlocks > duplicateProbe && checkExternal > duplicateProbe);
  assert.ok(claim > checkBooking && claim > checkBlocks && claim > checkExternal);
  assert.ok(insert > claim);
  assert.match(sql, /'created'/i);
  assert.match(sql, /'duplicate'/i);
  assert.match(sql, /'date_conflict'/i);
});

test("atomic RPC ignores one-night technical blocks from both Booking and Airbnb", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(
    sql,
    /not\s*\(\s*source\s+in\s*\(\s*'booking'\s*,\s*'airbnb'\s*\)\s+and\s+end_date\s*=\s*start_date\s*\+\s*1\s*\)/i,
  );
});

test("atomic RPC keeps multi-night Booking and Airbnb occupancies as date conflicts", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const rpcSql = sql.slice(sql.search(/create\s+or\s+replace\s+function\s+public\.create_public_booking_request_atomic/i));

  assert.match(rpcSql, /from\s+public\.external_occupancies[\s\S]*is_current\s+is\s+true/i);
  assert.match(rpcSql, /daterange\s*\(\s*start_date\s*,\s*end_date\s*,\s*'\[\)'\s*\)\s*&&\s*v_period/i);
  assert.match(rpcSql, /return\s+query\s+select\s+'date_conflict'/i);
});

test("atomic RPC is service-role only", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.create_public_booking_request_atomic[\s\S]*from\s+public\s*,\s*anon\s*,\s*authenticated/i);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.create_public_booking_request_atomic[\s\S]*to\s+service_role/i);
});

test("read-only precheck reports sources, invalid periods, overlaps, blocks and known external occupancies", () => {
  const sql = readFileSync(precheckPath, "utf8");
  assert.match(sql, /group\s+by\s+source/i);
  assert.match(sql, /end_date\s*<=\s*start_date/i);
  assert.match(sql, /daterange\s*\([^)]*'\[\)'\s*\)\s*&&/i);
  assert.match(sql, /calendar_blocks/i);
  assert.match(sql, /external_occupancies/i);
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|truncate|alter|drop)\b/i);
});
