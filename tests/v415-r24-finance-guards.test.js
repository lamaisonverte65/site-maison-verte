import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { formatDate, formatMoney } from "../src/utils/adminFormatters.js";

// Execute le VRAI handler dans un environnement isole : aucune connexion
// Supabase/Stripe/Resend n'est effectuee pendant les tests.
const endpointSource = fs.readFileSync("netlify/functions/create-balance-checkout-session.js", "utf8");
function loadBalanceHandler(dependencies) {
  const runnable = endpointSource
    .replace(/^import .*;\r?\n/gm, "")
    .replace(/const supabase = createClient\([^\n]+\);/, "const supabase = dependencies.supabase;")
    .replace("export async function handler", "async function handler");
  assert.doesNotMatch(runnable, /^import /m, "Tout import doit etre simule.");
  assert.match(runnable, /const supabase = dependencies\.supabase;/);
  const header = `const { escapeHtml, ADMIN_PERMISSIONS, authorizationResponse, authorizeAdminRequest,
    createBalancePaymentUrl, remainingContractualDue, resendEmail,
    emailLanguageForAudience, buildLocalizedBalanceEmail } = dependencies;`;
  // Les fonctions Stripe, authentification et email sont toutes substituees.
  return new Function("dependencies", `${header}\n${runnable}\nreturn handler;`)(dependencies);
}

function booking(overrides = {}) {
  return {
    id: "booking-test", status: "deposit_paid", balance_status: "en attente",
    updated_at: "2026-10-29T08:00:00.000Z", start_date: "2027-03-12",
    end_date: "2027-03-17", guest_first_name: "Test", guest_last_name: "Client",
    guest_email: "nobody@example.invalid", contract_total: 100, amount_paid: 30,
    ...overrides,
  };
}

function fixture(input = booking(), mutateBeforeWrite = null) {
  const state = { current: { ...input }, reads: 0, writes: 0, emails: [], logs: [] };
  const db = {
    from(table) {
      if (table === "email_logs") return {
        async insert(rows) { state.logs.push(...rows); return { error: null }; },
      };
      assert.equal(table, "booking_requests");
      return {
        select(columns) {
          assert.equal(columns, "*");
          return {
            eq(key, value) {
              assert.equal(key, "id"); assert.equal(value, state.current.id);
              return this;
            },
            async single() { state.reads++; return { data: { ...state.current }, error: null }; },
          };
        },
        update(values) {
          const filters = [];
          const query = {
            eq(key, value) { filters.push({ key, value }); return query; },
            is(key, value) { assert.equal(value, null); filters.push({ key, value }); return query; },
            select(fields) { assert.equal(fields, "id"); return query; },
            async maybeSingle() {
              if (mutateBeforeWrite) mutateBeforeWrite(state);
              const allowed = filters.every(({key, value}) => state.current[key] === value || (value == null && state.current[key] == null));
              if (!allowed) return { data: null, error: null };
              state.writes++;
              state.current = { ...state.current, ...values };
              return { data: { id: state.current.id }, error: null };
            },
          };
          return query;
        },
      };
    },
  };
  const dependencies = {
    supabase: db,
    escapeHtml: (value) => String(value),
    ADMIN_PERMISSIONS: { managePayments: "managePayments" },
    authorizeAdminRequest: async () => ({ok: true}),
    authorizationResponse: () => ({statusCode: 403}),
    createBalancePaymentUrl: () => "https://example.invalid/solde",
    remainingContractualDue: (b) => Math.max(b.contract_total - b.amount_paid, 0),
    resendEmail: async (payload) => {
      state.emails.push(payload);
      return { ok: true, json: async () => ({id: "email-test"}) };
    },
    emailLanguageForAudience: () => "fr",
    buildLocalizedBalanceEmail: () => { throw new Error("Ne doit pas etre appele en FR"); },
  };
  const handler = loadBalanceHandler(dependencies);
  return {
    state,
    send: (step = "request") => handler({
      httpMethod: "POST", body: JSON.stringify({bookingId: state.current.id, step}),
    }),
  };
}

const csvSource = fs.readFileSync("src/components/admin/payments/PaymentActions.jsx", "utf8");
function loadRealCsvBuilder() {
  const start = csvSource.indexOf("function csvEscape(");
  const end = csvSource.indexOf("export default function PaymentActions(");
  assert.ok(start >= 0 && end > start, "Retrouver le constructeur CSV reel du composant.");
  return new Function("formatDate", "formatMoney", `${csvSource.slice(start, end)}\nreturn buildCsv;`)(formatDate, formatMoney);
}
function csvNetCell(row) {
  const buildCsv = loadRealCsvBuilder();
  const csv = buildCsv([{ name: "Client test", startDate: "2026-10-10", endDate: "2026-10-15",
    status: "fully_paid", confirmedAmount: 100, paidClientAmount: 100, stripeFeeAmount: 0,
    payoutIds: [], ...row }]);
  return csv.split("\n")[1].split(";")[7];
}

test("R24 : aucun email ni mise a jour pour demandes et reservations terminees", async () => {
  for (const status of ["pending", "accepted", "cancelled", "refused", "expired", "fully_paid", "confirmed"]) {
    const fx = fixture(booking({status}));
    const result = await fx.send();
    assert.equal(result.statusCode, 409, `Statut ${status}`);
    assert.equal(fx.state.writes, 0, status);
    assert.equal(fx.state.emails.length, 0, status);
    assert.equal(fx.state.logs.length, 0, status);
  }
});

test("R24 : aucun email pour solde paye, annule ou rembourse", async () => {
  for (const balance_status of ["paid", "remboursé", "rembourse", "annulé", "annule", "cancelled"]) {
    const fx = fixture(booking({balance_status}));
    const result = await fx.send();
    assert.equal(result.statusCode, 409, `Solde : ${balance_status}`);
    assert.equal(fx.state.writes, 0);
    assert.equal(fx.state.emails.length, 0);
  }
});

test("R24 : relance d'un vrai solde restant autorisee pour deposit_paid et paid", async () => {
  for (const status of ["deposit_paid", "paid"]) {
    const fx = fixture(booking({status}));
    const result = await fx.send("request");
    assert.equal(result.statusCode, 200, status);
    assert.equal(JSON.parse(result.body).amount, 70);
    assert.equal(fx.state.writes, 1);
    assert.equal(fx.state.emails.length, 1);
    assert.equal(fx.state.logs.length, 1);
    assert.equal(fx.state.current.balance_status, "à payer");
  }
});

test("R24 : annulation concurrente interdit d'envoyer l'email", async () => {
  const fx = fixture(booking(), (state) => { state.current.status = "cancelled"; });
  const result = await fx.send();
  assert.equal(result.statusCode, 409);
  assert.equal(fx.state.writes, 0);
  assert.equal(fx.state.emails.length, 0);
});

test("R24 : paiement concurrent du solde interdit d'envoyer l'email", async () => {
  const fx = fixture(booking(), (state) => { state.current.balance_status = "paid"; });
  const result = await fx.send();
  assert.equal(result.statusCode, 409);
  assert.equal(fx.state.writes, 0);
  assert.equal(fx.state.emails.length, 0);
});

test("R24 : aucune relance si aucun solde, meme en reservation active", async () => {
  const fx = fixture(booking({contract_total: 100, amount_paid: 100}));
  const result = await fx.send();
  assert.equal(result.statusCode, 400);
  assert.equal(fx.state.writes, 0);
  assert.equal(fx.state.emails.length, 0);
});

test("R24 : etape de relance inconnue refusee sans lecture de reservation", async () => {
  const fx = fixture();
  const result = await fx.send("incorrect");
  assert.equal(result.statusCode, 400);
  assert.equal(fx.state.reads, 0);
  assert.equal(fx.state.emails.length, 0);
});

test("R24 : export CSV affiche exactement un net Stripe connu de zero euro", () => {
  assert.match(csvNetCell({stripeFinancialsComplete:true, stripeNetAmount:0}), /^"0,00\s*€"$/u);
});

test("R24 : export CSV conserve les autres valeurs positives et negatives", () => {
  assert.match(csvNetCell({stripeFinancialsComplete:true, stripeNetAmount:12.34}), /^"12,34\s*€"$/u);
  assert.match(csvNetCell({stripeFinancialsComplete:true, stripeNetAmount:-2}), /^"-2,00\s*€"$/u);
});

test("R24 : export CSV laisse vide un net Stripe indisponible ou incomplet", () => {
  for (const value of [null, undefined, "", "non disponible", NaN]) {
    assert.equal(csvNetCell({stripeFinancialsComplete:true, stripeNetAmount:value}), '""');
  }
  assert.equal(csvNetCell({stripeFinancialsComplete:false, stripeNetAmount:0}), '""');
  assert.equal(csvNetCell({stripeFinancialsComplete:false, stripeNetAmount:12.34}), '""');
});
