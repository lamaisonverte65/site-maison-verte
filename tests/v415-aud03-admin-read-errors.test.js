import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fetchAdminData } from "../src/services/adminDataService.js";
import { getAdminSourceLabel, getUnavailableAdminSources } from "../src/services/adminLoadState.js";

function mockSupabase(responses = {}) {
  const called = [];
  const from = (table) => {
    called.push(table);
    let headCount = false;
    let requestedCount = false;
    const query = {
      select: (_fields, options) => { headCount = options?.head === true; requestedCount = options?.count === "exact"; return query; },
      range: () => query,
      order: () => query,
      gte: () => query,
      then: (resolve, reject) => {
        const response = responses[table] ?? (headCount ? { count: 0, error: null } : { data: [], error: null });
        const value = typeof response === "function" ? response(called.filter((entry) => entry === table).length) : response;
        return Promise.resolve(value).then((result) => {
          if (requestedCount && result && result.count === undefined && Array.isArray(result.data)) {
            return resolve({ ...result, count: result.data.length });
          }
          return resolve(result);
        }, reject);
      },
    };
    return query;
  };
  return { from, called };
}

test("AUD-03 : une liste vide valide ne crée aucune erreur", async () => {
  const db = mockSupabase({ site_visits: (call) => call === 2 ? { count: 0, error: null } : { data: [], error: null } });
  const result = await fetchAdminData(db);
  assert.deepEqual(result.loadErrors, {});
  assert.deepEqual(result.payments, []);
  assert.deepEqual(result.customerInvoices, []);
  assert.equal(result.siteVisitsTotal, 0);
});

test("AUD-03 : échec paiements visible, factures et autres rubriques encore chargées", async () => {
  const db = mockSupabase({
    payments: { data: null, error: { message: "Accès refusé aux paiements" } },
    customer_invoices: { data: [{ id: "invoice-1" }], error: null },
    site_visits: (call) => call === 2 ? { count: 5, error: null } : { data: [{ id: "visit-1" }], error: null },
  });
  const result = await fetchAdminData(db);
  assert.match(result.loadErrors.payments, /Accès refusé/);
  assert.deepEqual(result.customerInvoices, [{ id: "invoice-1" }]);
  assert.equal(result.siteVisits.length, 1);
  assert.ok(db.called.includes("stripe_payouts"), "les autres lectures continuent");
  assert.deepEqual(getUnavailableAdminSources("payments", result.loadErrors), ["payments"]);
  assert.deepEqual(getUnavailableAdminSources("invoices", result.loadErrors), []);
  assert.deepEqual(getUnavailableAdminSources("calendar", result.loadErrors), []);
  assert.deepEqual(getUnavailableAdminSources("summary", result.loadErrors), ["payments"]);
});

test("AUD-03 : même sans erreur SQL, data=null n'est pas un tableau vide valide", async () => {
  const result = await fetchAdminData(mockSupabase({ email_logs: { data: null, error: null } }));
  assert.match(result.loadErrors.email_logs, /sans liste/);
  assert.deepEqual(getUnavailableAdminSources("communication", result.loadErrors), ["email_logs"]);
  assert.deepEqual(getUnavailableAdminSources("requests", result.loadErrors), []);
});

test("AUD-03 : rejet réseau capturé sans empêcher le chargement des autres tables", async () => {
  const result = await fetchAdminData(mockSupabase({ customer_credit_notes: () => Promise.reject(new Error("Connexion interrompue")) }));
  assert.match(result.loadErrors.customer_credit_notes, /Connexion interrompue/);
  assert.deepEqual(getUnavailableAdminSources("invoices", result.loadErrors), ["customer_credit_notes"]);
});

test("AUD-03 : erreur sur compteur visites n'invente pas de total", async () => {
  const result = await fetchAdminData(mockSupabase({ site_visits: (call) => call === 2
    ? { count: null, error: { message: "COUNT impossible" } }
    : { data: [], error: null },
  }));
  assert.equal(result.siteVisitsTotal, null);
  assert.match(result.loadErrors.site_visits_count, /COUNT impossible/);
  assert.deepEqual(getUnavailableAdminSources("visits", result.loadErrors), ["site_visits_count"]);
});

test("AUD-03 : les lectures obligatoires refusent toujours une erreur", async () => {
  await assert.rejects(fetchAdminData(mockSupabase({ booking_requests: { data: null, error: new Error("Réservations inaccessibles") } })), /Réservations inaccessibles/);
  await assert.rejects(fetchAdminData(mockSupabase({ booking_financial_ledger_aggregates: { data: null, error: new Error("Agrégats indisponibles") } })), /Agrégats indisponibles/);
});

test("AUD-03 : l'UI masque les seules rubriques dépendantes et propose de réactualiser", () => {
  const jsx = readFileSync(new URL("../src/pages/Admin.jsx", import.meta.url), "utf8");
  assert.match(jsx, /setDataLoadErrors\(adminData\.loadErrors \|\| \{\}\)/);
  assert.match(jsx, /role="alert"/);
  assert.match(jsx, /Chargement partiel/);
  assert.match(jsx, /!tabUnavailable\("payments"\)/);
  assert.match(jsx, /!tabUnavailable\("invoices"\)/);
  assert.match(jsx, /!tabUnavailable\("summary"\)/);
  assert.match(jsx, /!tabUnavailable\("reservation_details"\)/);
  assert.match(jsx, /shouldRenderAdminCalendar\(\{ activeTab, loading, error \}\)/);
});

test("AUD-03 : plusieurs échecs restent isolés et les tableaux fiables sont disponibles", async () => {
  const result = await fetchAdminData(mockSupabase({
    booking_cleaning_issues: { data: null, error: { message: "Ménage indisponible" } },
    booking_additional_charges: { data: null, error: { message: "Suppléments indisponibles" } },
    stripe_balance_transactions: { data: null, error: { message: "Stripe indisponible" } },
    customer_invoices: { data: [{ id: "f-1" }], error: null },
  }));
  assert.deepEqual(Object.keys(result.loadErrors).sort(), ["booking_additional_charges", "booking_cleaning_issues", "stripe_balance_transactions"]);
  assert.deepEqual(getUnavailableAdminSources("home", result.loadErrors), ["booking_cleaning_issues", "booking_additional_charges", "stripe_balance_transactions"]);
  assert.deepEqual(getUnavailableAdminSources("reservation_details", result.loadErrors), ["stripe_balance_transactions", "booking_cleaning_issues", "booking_additional_charges"]);
  assert.deepEqual(getUnavailableAdminSources("invoices", result.loadErrors), []);
  assert.deepEqual(result.customerInvoices, [{ id: "f-1" }]);
});

test("AUD-03 : les erreurs sont présentées avec un libellé en français", () => {
  assert.equal(getAdminSourceLabel("payments"), "Paiements");
  assert.equal(getAdminSourceLabel("stripe_balance_transactions"), "Transactions Stripe");
  assert.equal(getAdminSourceLabel("unknown"), "unknown");
});

test("AUD-03 : une récupération réussie efface les alertes au prochain chargement", async () => {
  const first = await fetchAdminData(mockSupabase({ payments: { data: null, error: { message: "Panne temporaire" } } }));
  assert.ok(first.loadErrors.payments);
  const second = await fetchAdminData(mockSupabase());
  assert.equal(Object.keys(second.loadErrors).length, 0);
  assert.deepEqual(getUnavailableAdminSources("payments", second.loadErrors), []);
});
