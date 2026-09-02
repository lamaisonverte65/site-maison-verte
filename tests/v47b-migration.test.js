import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/202609010002_v47b_external_occupancy_conflicts.sql";
const migration = () => readFileSync(migrationPath, "utf8");

test("V4.7-B creates a dedicated minimal conflict registry", () => {
  assert.equal(existsSync(migrationPath), true);
  const sql = migration();
  assert.match(sql, /create table public\.external_occupancy_conflicts/i);
  assert.match(sql, /external_occupancy_id uuid not null/i);
  assert.match(sql, /local_kind text not null/i);
  assert.match(sql, /local_id uuid not null/i);
  assert.match(sql, /unique\s*\(external_occupancy_id, local_kind, local_id\)/i);
  assert.match(sql, /occurrence_count integer not null default 1/i);
  assert.match(sql, /alert_status text not null default 'pending'/i);
  assert.doesNotMatch(sql, /guest_(?:email|phone|name)|owner_price|estimated_total|message text/i);
  assert.doesNotMatch(sql, /external_calendar_actions/i);
});

test("reconciliation uses half-open local blockers and excludes both providers' one-night rows", () => {
  const sql = migration();
  assert.match(sql, /create or replace function public\.reconcile_external_occupancy_conflicts/i);
  assert.match(sql, /external\.source\s*=\s*p_source/i);
  assert.match(sql, /external\.source in \('booking', 'airbnb'\)/i);
  assert.match(sql, /external\.end_date\s*<>\s*external\.start_date\s*\+\s*1/i);
  assert.match(sql, /external\.start_date\s*<\s*booking\.end_date[\s\S]*external\.end_date\s*>\s*booking\.start_date/i);
  assert.match(sql, /external\.start_date\s*<\s*block\.end_date[\s\S]*external\.end_date\s*>\s*block\.start_date/i);
  assert.match(sql, /booking\.status in \('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed'\)/i);
  assert.match(sql, /booking\.source is null or booking\.source in \('website', 'direct', 'admin_client', 'admin_personal'\)/i);
  assert.match(sql, /(?:from|join) public\.calendar_blocks/i);
});

test("reconciliation preserves one row, resolves, and reopens with a new alert occurrence", () => {
  const sql = migration();
  assert.match(sql, /on conflict \(external_occupancy_id, local_kind, local_id\) do update/i);
  assert.match(sql, /when external_occupancy_conflicts\.status = 'resolved'[\s\S]*occurrence_count \+ 1/i);
  assert.match(sql, /alert_status = case[\s\S]*'pending'/i);
  assert.match(sql, /set status = 'resolved'[\s\S]*resolved_at = p_detected_at/i);
  assert.doesNotMatch(sql, /delete from public\.external_occupancy_conflicts/i);
});

test("per-source reconciliation rejects an older generation after a newer one", () => {
  const sql = migration();
  assert.match(sql, /create table public\.external_occupancy_conflict_runs/i);
  assert.match(sql, /source text primary key/i);
  assert.match(sql, /last_reconciled_at timestamptz not null/i);
  assert.match(sql, /on conflict \(source\) do update[\s\S]*last_reconciled_at < excluded\.last_reconciled_at/i);
  assert.match(sql, /if not coalesce\(v_source_claimed, false\)[\s\S]*return query select 0::bigint, 0::bigint/i);
  assert.match(sql, /alter table public\.external_occupancy_conflict_runs enable row level security/i);
  assert.match(sql, /revoke all on table public\.external_occupancy_conflict_runs from anon, authenticated/i);
  assert.match(sql, /grant select, insert, update on table public\.external_occupancy_conflict_runs to service_role/i);
});

test("alert claims are atomic, expirable, and service-role-only", () => {
  const sql = migration();
  assert.match(sql, /create or replace function public\.claim_external_occupancy_conflict_alerts/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /alert_claimed_at\s*<=\s*p_now\s*-\s*make_interval/i);
  assert.match(sql, /alter table public\.external_occupancy_conflicts enable row level security/i);
  assert.match(sql, /revoke all on table public\.external_occupancy_conflicts from anon, authenticated/i);
  assert.match(sql, /grant select, insert, update on table public\.external_occupancy_conflicts to service_role/i);
  assert.doesNotMatch(sql, /grant (?:delete|truncate)[^;]*service_role/i);
  assert.match(sql, /revoke all on function public\.reconcile_external_occupancy_conflicts[^;]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.claim_external_occupancy_conflict_alerts[^;]*to service_role/i);
});
