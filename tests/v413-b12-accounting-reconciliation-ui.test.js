import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const servicePath = "src/services/accountingReconciliationService.js";
const panelPath = "src/components/admin/DeclarationsPanel.jsx";
const service = fs.existsSync(servicePath) ? fs.readFileSync(servicePath, "utf8") : "";
const panel = fs.readFileSync(panelPath, "utf8");

test("V4.13 reconciliation service calls the owner-only annual endpoint with bearer token and no cache", () => {
  assert.ok(service, "accountingReconciliationService.js must exist");
  assert.match(service, /supabase\.auth\.getSession\(\)/);
  assert.match(service, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.match(service, /admin-accounting-reconciliation\?\$\{params\}/);
  assert.match(service, /new URLSearchParams\(\{ year: String\(year\) \}\)/);
  assert.match(service, /cache:\s*"no-store"/);
});

test("V4.13 accounting UI exposes the Rapprochement subtab", () => {
  assert.match(panel, /\["reconciliation",\s*"Rapprochement"\]/);
  assert.match(panel, /subtab === "reconciliation"/);
});

test("V4.13 reconciliation state is independent and reloads when the selected exercise changes", () => {
  assert.match(panel, /fetchAccountingReconciliation/);
  assert.match(panel, /useEffect\(\(\) => \{[\s\S]*fetchAccountingReconciliation\(Number\(year\)\)[\s\S]*\}, \[year, subtab\]\)/);
  assert.match(panel, /reconciliationLoading/);
  assert.match(panel, /reconciliationError/);
  assert.match(panel, /setReconciliation/);
});

test("V4.13 reconciliation view exposes explicit loading, error, and empty states", () => {
  assert.match(panel, /Chargement du rapprochement/);
  assert.match(panel, /reconciliationError/);
  assert.match(panel, /Aucune opération à rapprocher pour cet exercice/);
});

test("V4.13 reconciliation view remains read-only and does not reuse manual accounting mutation handlers", () => {
  const start = panel.indexOf("function AccountingReconciliationPanel");
  const end = panel.indexOf("export default function DeclarationsPanel", start);
  assert.ok(start >= 0 && end > start, "AccountingReconciliationPanel must exist");
  const block = panel.slice(start, end);
  assert.doesNotMatch(block, /createManualAccountingEntry|updateManualAccountingEntry|deleteManualAccountingEntry|saveAccountingImportSnapshot/);
});

test("V4.13 reconciliation requests are lazy and independent from the accounting loader", () => {
  assert.match(panel, /if \(subtab !== "reconciliation"\) return;/);
  assert.doesNotMatch(panel, /!loading && !error && subtab === "reconciliation"/);
  assert.match(panel, /subtab !== "reconciliation" && loading/);
  assert.match(panel, /subtab !== "reconciliation" && error/);
});

test("V4.13 reconciliation does not display stale results from a different fiscal year", () => {
  assert.match(panel, /reconciliationRequestYear !== Number\(year\)/);
  assert.match(panel, /setReconciliation\(null\)/);
});

test("V4.13 service rejects an incomplete or wrong-year reconciliation response", () => {
  assert.match(service, /Number\(payload\?\.year\) !== Number\(year\)/);
  assert.match(service, /!Array\.isArray\(payload\?\.rows\)/);
  assert.match(service, /Réponse du rapprochement comptable incohérente/);
});

function isolatedReconciliationService(supabaseMock, fetchMock) {
  const js = service
    .replace(/^import \{ supabase \} from "\.\.\/supabaseClient";\s*/, "")
    .replace("export async function fetchAccountingReconciliation", "async function fetchAccountingReconciliation");
  return new Function("supabase", "fetch", `${js}\nreturn fetchAccountingReconciliation;`)(supabaseMock, fetchMock);
}

test("V4.13 service requests only the selected year with an authenticated GET", async () => {
  let called = null;
  const getSession = async () => ({ data: { session: { access_token: "example-token" } }, error: null });
  const request = isolatedReconciliationService({ auth: { getSession } }, async (url, options) => {
    called = { url, options };
    return { ok: true, json: async () => ({ year: 2026, rows: [], accountingSummary: {}, taxSummary: {} }) };
  });
  const result = await request(2026);
  assert.equal(result.year, 2026);
  assert.equal(called.url, "/.netlify/functions/admin-accounting-reconciliation?year=2026");
  assert.equal(called.options.headers.Authorization, "Bearer example-token");
  assert.equal(called.options.cache, "no-store");
  assert.equal(called.options.method, undefined, "fetch defaults to GET");
});

test("V4.13 service refuses missing admin token before any network request", async () => {
  let requests = 0;
  const request = isolatedReconciliationService(
    { auth: { getSession: async () => ({ data: { session: null }, error: null }) } },
    async () => { requests++; throw new Error("must not run"); },
  );
  await assert.rejects(request(2026), /Session admin manquante/);
  assert.equal(requests, 0);
});

test("V4.13 service reports owner-only authorization failures", async () => {
  const request = isolatedReconciliationService(
    { auth: { getSession: async () => ({ data: { session: { access_token: "token" } }, error: null }) } },
    async () => ({ ok: false, json: async () => ({ error: "Droit propriétaire requis." }) }),
  );
  await assert.rejects(request(2026), /Droit propriétaire requis/);
});

test("V4.13 service rejects wrong-year and malformed successful server payloads", async () => {
  const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: "token" } }, error: null }) } };
  for (const payload of [
    { year: 2025, rows: [], accountingSummary: {}, taxSummary: {} },
    { year: 2026, rows: null, accountingSummary: {}, taxSummary: {} },
    { year: 2026, rows: [], accountingSummary: {}, taxSummary: null },
  ]) {
    const request = isolatedReconciliationService(supabase, async () => ({ ok: true, json: async () => payload }));
    await assert.rejects(request(2026), /Réponse du rapprochement comptable incohérente/);
  }
});
