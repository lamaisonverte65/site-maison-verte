import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/202610090002_v410_guest_reviews_publication_policy.sql";

test("published guest reviews are publicly readable without consent_to_publish", () => {
  assert.ok(fs.existsSync(migrationPath));
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.match(sql, /DROP POLICY IF EXISTS "Allow public read published guest reviews"/);
  assert.match(sql, /CREATE POLICY "Allow public read published guest reviews"[\s\S]*FOR SELECT[\s\S]*TO anon[\s\S]*USING \(status = 'published'\)/);
  assert.doesNotMatch(sql, /USING \([\s\S]*consent_to_publish\s*=\s*true[\s\S]*\)/);
});

test("public review insertion no longer requires the legacy consent flag", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.match(sql, /DROP POLICY IF EXISTS "Allow public insert guest reviews"/);
  assert.match(sql, /CREATE POLICY "Allow public insert guest reviews"[\s\S]*FOR INSERT[\s\S]*TO anon/);
  const insertPolicy = sql.match(/CREATE POLICY "Allow public insert guest reviews"[\s\S]*?;\s*\n/)?.[0] || "";
  assert.ok(insertPolicy);
  assert.doesNotMatch(insertPolicy, /consent_to_publish/);
  assert.match(insertPolicy, /status = 'pending'/);
});
