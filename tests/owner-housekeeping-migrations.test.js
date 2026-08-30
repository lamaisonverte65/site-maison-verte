import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const phaseA = readFileSync("supabase/migrations/202608280001_owner_housekeeping_phase_a.sql", "utf8");
const phaseB = readFileSync("supabase/migrations/202608280002_owner_housekeeping_phase_b.sql", "utf8");
const exportIcal = readFileSync("netlify/functions/export-ical.js", "utf8");

test("phase A keeps the audited business schema minimal", () => {
  assert.doesNotMatch(phaseA, /add column if not exists\s+(?:departure_time|practical_information|adults_count|children_count|children_ages|baby_bed_needed|arrival_time|housekeeping_notes)\b/i);
  assert.doesNotMatch(phaseA, /alter column permissions set default/i);
});

test("phase A owner invariants reject null or incoherent role flags", () => {
  assert.match(
    phaseA,
    /check\s*\(\s*\(role\s*=\s*'owner'\)\s+is\s+not\s+distinct\s+from\s+\(is_owner\s+is\s+true\)\s*\)/i,
  );
  assert.match(phaseA, /check\s*\(\s*role\s+is\s+distinct\s+from\s+'owner'\s+or\s+is_active\s+is\s+true\s*\)/i);
});

test("phase A closes authenticated gaps without breaking the legacy anonymous calendar export", () => {
  assert.match(phaseA, /'external_calendar_actions'/i);
  assert.match(phaseA, /'refunds'/i);
  assert.match(phaseA, /create policy v4_internal_role_boundary[\s\S]*as restrictive[\s\S]*to authenticated/i);
  assert.doesNotMatch(phaseA, /revoke select on table public\.booking_requests from anon/i);
  assert.doesNotMatch(phaseA, /revoke insert on table public\.booking_requests from anon/i);
  assert.doesNotMatch(phaseA, /drop policy[\s\S]*(?:guest_reviews|site_visits|booking_requests)/i);
});

test("phase A leaves the final active-role constraint to the post-deployment phase", () => {
  assert.doesNotMatch(phaseA, /add constraint admin_users_active_role_allowed/i);
  assert.match(phaseB, /add constraint admin_users_active_role_allowed/i);
  assert.match(phaseB, /validate constraint admin_users_active_role_allowed/i);
});

test("the new calendar export uses service role before phase B removes anonymous booking reads", () => {
  assert.match(exportIcal, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(exportIcal, /process\.env\.VITE_SUPABASE_ANON_KEY/);
  assert.match(phaseB, /revoke select on table public\.booking_requests from anon/i);
});

test("the public calendar export does not return private guest fields through service role", () => {
  assert.match(exportIcal, /\.from\("calendar_blocks"\)[\s\S]*?\.select\("id,start_date,end_date"\)/i);
  assert.match(exportIcal, /\.from\("booking_requests"\)[\s\S]*?\.select\("id,start_date,end_date,status"\)/i);
  assert.doesNotMatch(exportIcal, /block\.title/i);
  assert.doesNotMatch(exportIcal, /block\.notes/i);
  assert.doesNotMatch(exportIcal, /request\.guest_(?:first_name|last_name|email|phone)/i);
});

test("housekeeping cannot inherit a legacy authenticated policy during phase A", () => {
  assert.match(
    phaseA,
    /create policy v4_internal_role_boundary[\s\S]*as restrictive[\s\S]*for all to authenticated[\s\S]*using \(public\.is_v4_owner\(\)\)[\s\S]*with check \(public\.is_v4_owner\(\)\)/i,
  );
});

test("phase B aborts until the strict owner is linked and every read-only legacy profile is inactive", () => {
  assert.match(
    phaseB,
    /where role = 'owner'[\s\S]*is_owner is true[\s\S]*is_active is true[\s\S]*auth_user_id is not null[\s\S]*strict_owner_count <> 1/i,
  );
  assert.match(
    phaseB,
    /where\s+is_active\s+is\s+true\s+and\s*\(\s*role\s+is\s+null\s+or\s+role\s+not\s+in\s*\(\s*'owner'\s*,\s*'housekeeping'\s*\)\s*\)/i,
  );
  assert.match(phaseB, /where is_active is true[\s\S]*auth_user_id is null/i);
});

test("phase B leaves no anonymous full-row access to booking requests", () => {
  assert.match(phaseB, /revoke select on table public\.booking_requests from anon/i);
});

test("owner migrations never rewrite or delete historical profiles", () => {
  for (const sql of [phaseA, phaseB]) {
    assert.doesNotMatch(sql, /^\s*(?:drop|truncate|delete\s+from|update\s+public\.admin_users|alter\s+table[^;]+drop)\b/im);
  }
});
