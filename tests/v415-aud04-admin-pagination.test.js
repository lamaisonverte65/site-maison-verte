import test from "node:test";
import assert from "node:assert/strict";
import { readAllAdminRows, ADMIN_PAGE_SIZE } from "../src/services/adminPaginatedRead.js";
import { fetchAdminData } from "../src/services/adminDataService.js";

function fixtureRows(number, prefix = "row") {
  return Array.from({ length: number }, (_, i) => ({
    id: `${prefix}-${String(i + 1).padStart(5, "0")}`,
    created_at: "2026-10-28T12:00:00Z", // Tous ex aequo : le tri secondaire est obligatoire.
    booking_request_id: `${prefix}-${String(i + 1).padStart(5, "0")}`,
  }));
}

function fakeSupabase(tables = {}, override = () => null) {
  const calls = [];
  return {
    calls,
    rpc: (name, params) => {
      calls.push({ table: `rpc:${name}`, params });
      return Promise.resolve({ data: {
    period_days: 30, today: 1, last7: 7, last30: 20,
    daily: Array.from({ length: 30 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, pages: i === 0 ? 20 : 0 })),
    sources: [{ label: "direct", count: 20 }],
    pages: [{ label: "/", count: 20 }],
    languages: [], devices: [],
  }, error: null });
    },
    from: (table) => {
      let countRequested = false;
      let head = false;
      let since;
      const sorting = [];
      const query = {
        select: (_columns, options) => {
          countRequested = options?.count === "exact";
          head = options?.head === true;
          return query;
        },
        gte: (_field, value) => { since = value; return query; },
        order: (field, options) => { sorting.push({ field, ascending: options?.ascending !== false }); return query; },
        range: (from, to) => {
          const call = { table, from, to, sorting: [...sorting], since, head: false };
          calls.push(call);
          const forced = override(call);
          if (forced) return Promise.resolve(forced);
          let rows = tables[table] || [];
          if (since) rows = rows.filter((r) => r.created_at >= since);
          rows = [...rows].sort((a, b) => {
            for (const { field, ascending } of sorting) {
              const cmp = String(a[field] ?? "").localeCompare(String(b[field] ?? ""));
              if (cmp) return ascending ? cmp : -cmp;
            }
            return 0;
          });
          return Promise.resolve({ data: rows.slice(from, to + 1), count: countRequested ? rows.length : null, error: null });
        },
        then: (resolve, reject) => {
          const call = { table, head: true, since };
          calls.push(call);
          const forced = override(call);
          if (forced) return Promise.resolve(forced).then(resolve, reject);
          const count = (tables[table] || []).length;
          return Promise.resolve(head && countRequested ? { count, error: null } : { data: [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test("AUD-04 : pagination intégrale au-delà de 1000 lignes, tri secondaire stable", async () => {
  const payments = fixtureRows(1205);
  const client = fakeSupabase({ payments });
  const result = await readAllAdminRows(client, { table: "payments", orderBy: "created_at" });
  assert.equal(result.length, 1205);
  assert.equal(new Set(result.map((r) => r.id)).size, 1205);
  assert.equal(client.calls.length, 3);
  assert.deepEqual(client.calls.map((c) => [c.from, c.to]), [[0, 499], [500, 999], [1000, 1499]]);
  assert.deepEqual(client.calls[0].sorting.map((s) => s.field), ["created_at", "id"]);
  assert.equal(result[0].id, "row-01205");
});

test("AUD-04 : zéro ligne correspond bien à une liste vide", async () => {
  const result = await readAllAdminRows(fakeSupabase(), { table: "payments", orderBy: "created_at" });
  assert.deepEqual(result, []);
});

test("AUD-04 : une limite serveur inférieure à la taille de page est une erreur", async () => {
  const db = fakeSupabase({ payments: fixtureRows(650) }, (call) => call.table === "payments" && call.from === 0
    ? { data: fixtureRows(100), count: 650, error: null } : null);
  await assert.rejects(readAllAdminRows(db, { table: "payments", orderBy: "created_at" }), /100 lignes reçues sur 500 attendues/);
});

test("AUD-04 : aucune pagination silencieuse lorsque COUNT est indisponible", async () => {
  const db = fakeSupabase({}, (call) => call.table === "payments" ? { data: [], count: null, error: null } : null);
  await assert.rejects(readAllAdminRows(db, { table: "payments", orderBy: "created_at" }), /total exact indisponible/);
});

test("AUD-04 : une mutation du nombre de lignes entre deux pages rend les résultats non fiables", async () => {
  const db = fakeSupabase({ payments: fixtureRows(650) }, (call) => call.table === "payments" && call.from === ADMIN_PAGE_SIZE
    ? { data: fixtureRows(149), count: 649, error: null } : null);
  await assert.rejects(readAllAdminRows(db, { table: "payments", orderBy: "created_at" }), /total modifié pendant/);
});

test("AUD-04 : les doublons entre pages ne sont jamais comptés deux fois", async () => {
  const rows = fixtureRows(501);
  const db = fakeSupabase({ payments: rows }, (call) => call.table === "payments" && call.from === 500
    ? { data: [rows[499]], count: 501, error: null } : null);
  await assert.rejects(readAllAdminRows(db, { table: "payments", orderBy: "created_at" }), /identifiant manquant ou doublon/);
});

test("AUD-04 : un échec à la deuxième page invalide la rubrique concernée, les autres restent visibles", async () => {
  const db = fakeSupabase({ payments: fixtureRows(1100), customer_invoices: fixtureRows(3) }, (call) => call.table === "payments" && call.from === 500
    ? { data: null, count: null, error: { message: "Erreur page 2" } } : null);
  const result = await fetchAdminData(db);
  assert.match(result.loadErrors.payments, /Erreur page 2/);
  assert.deepEqual(result.payments, []);
  assert.equal(result.customerInvoices.length, 3);
});

test("AUD-04 : les agrégats financiers et les paiements sont tous chargés sans tronquage", async () => {
  const db = fakeSupabase({
    booking_financial_ledger_aggregates: fixtureRows(1050, "booking"),
    payments: fixtureRows(1080, "payment"),
  });
  const result = await fetchAdminData(db);
  assert.equal(result.bookingFinancialAggregates.length, 1050);
  assert.equal(result.payments.length, 1080);
  assert.deepEqual(result.loadErrors, {});
  assert.deepEqual(db.calls.filter((c) => c.table === "booking_financial_ledger_aggregates")[0].sorting.map((s) => s.field), ["booking_request_id"]);
});

test("AUD-04/R18 : les visites utilisent un agrégat SQL et aucune pagination brute", async () => {
  const db = fakeSupabase({
    site_visits: fixtureRows(100001, "event"),
  });
  const result = await fetchAdminData(db);
  assert.equal(result.siteVisitSummary.last30, 20);
  assert.equal(db.calls.filter((c) => c.table === "site_visits").length, 0);
  assert.equal(db.calls.filter((c) => c.table === "rpc:get_admin_visit_summary").length, 1);
  assert.deepEqual(db.calls.find((c) => c.table === "rpc:get_admin_visit_summary").params, { p_days: 30 });
});

test("AUD-04 : les lectures obligatoires s'arrêtent sur un COUNT incohérent", async () => {
  const db = fakeSupabase({}, (call) => call.table === "booking_requests"
    ? { data: [], count: 12, error: null } : null);
  await assert.rejects(fetchAdminData(db), /Lecture incomplète de booking_requests/);
});

test("AUD-04 : les identifiants manquants sont refusés", async () => {
  const db = fakeSupabase({}, (call) => call.table === "payments" ? { data: [{ created_at: "2026-10-28" }], count: 1, error: null } : null);
  await assert.rejects(readAllAdminRows(db, { table: "payments", orderBy: "created_at" }), /identifiant manquant/);
});

test("AUD-04 : une source surdimensionnée ne provoque pas 200 requêtes supplémentaires", async () => {
  const db = fakeSupabase({}, (call) => call.table === "payments" ? { data: [], count: 100001, error: null } : null);
  await assert.rejects(readAllAdminRows(db, { table: "payments", orderBy: "created_at" }), /trop volumineuse/);
  assert.equal(db.calls.length, 1);
});
