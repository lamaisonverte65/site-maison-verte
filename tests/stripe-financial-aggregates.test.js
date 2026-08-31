import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const paginationModule = await import("../netlify/functions/_lib/stripe-balance-transactions.js").catch(() => ({}));
const listAllBalanceTransactions = paginationModule.listAllBalanceTransactions;

const formatterModule = await import("../src/utils/adminFormatters.js");
const {
  getAmounts,
  getRealPaidAmount,
  getHistoricalGrossPaidAmount,
  getStripeBankExpectedNet,
} = formatterModule;

const migrationUrl = new URL(
  "../supabase/migrations/202608310000_booking_financial_aggregates.sql",
  import.meta.url,
);

async function migrationSql() {
  return readFile(migrationUrl, "utf8").catch(() => "");
}

test("the additive migration versions the production balance transaction schema without changing payment_id", async () => {
  const sql = await migrationSql();

  assert.match(sql, /create table if not exists public\.stripe_balance_transactions/i);
  assert.match(sql, /id text primary key/i);
  assert.match(sql, /booking_request_id uuid/i);
  assert.match(sql, /payment_id text/i);
  assert.doesNotMatch(sql, /foreign key\s*\(payment_id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /create index if not exists idx_stripe_balance_transactions_booking_request_id\s+[\s\S]*\(booking_request_id\)/i);
  assert.match(sql, /create index if not exists idx_stripe_balance_transactions_payment_intent_id\s+[\s\S]*\(payment_intent_id\)/i);
  assert.match(sql, /create index if not exists idx_stripe_balance_transactions_payout_id\s+[\s\S]*\(payout_id\)/i);
});

test("payment and refund aggregates use explicit money states and integer cents", async () => {
  const sql = await migrationSql();

  assert.match(sql, /status in \('paid', 'partially_refunded', 'refunded'\)/i);
  assert.match(sql, /sum\(round\(p\.amount \* 100\)::bigint\)/i);
  assert.match(sql, /coalesce\(r\.amount_cents, round\(r\.amount \* 100\)::bigint\)/i);
  assert.match(sql, /r\.status = 'succeeded'/i);
  assert.match(sql, /greatest\([\s\S]*gross_paid_cents[\s\S]*refunded_cents[\s\S]*0/i);
});

test("Stripe fee and net preserve signed ledger values for every attached transaction", async () => {
  const sql = await migrationSql();

  assert.match(sql, /sum\(bt\.fee\)/i);
  assert.match(sql, /sum\(bt\.net\)/i);
  assert.match(sql, /bt\.booking_request_id is not null/i);
  assert.doesNotMatch(sql, /where\s+bt\.type\s*=\s*'charge'[\s\S]*sum\(bt\.net\)/i);
});

test("refund completeness supports the historical refund id stored in charge_id", async () => {
  const sql = await migrationSql();

  assert.match(sql, /bt\.booking_request_id\s*=\s*r\.booking_request_id/i);
  assert.match(sql, /bt\.type\s*=\s*'refund'/i);
  assert.match(sql, /bt\.charge_id\s*=\s*r\.stripe_refund_id/i);
  assert.match(sql, /bt\.raw\s*->\s*'source'\s*->>\s*'id'\s*=\s*r\.stripe_refund_id/i);
});

test("completeness is derived and an unsafe historical backfill preserves cached values", async () => {
  const sql = await migrationSql();

  assert.match(sql, /stripe_financials_complete/i);
  assert.match(sql, /missing_charge_count/i);
  assert.match(sql, /missing_refund_count/i);
  assert.match(sql, /missing_transaction_value_count/i);
  assert.match(sql, /backfill_safe/i);
  assert.doesNotMatch(sql, /add column[^;]*(stripe_financials_complete|stripe_financials_missing_count)/i);
  assert.match(sql, /where[\s\S]*backfill_safe/i);
});

test("the recompute RPC is idempotent, service-role-only, and preserves incomplete Stripe caches", async () => {
  const sql = await migrationSql();

  assert.match(sql, /create or replace function public\.recompute_booking_financial_aggregates/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /amount_paid\s*=\s*v_aggregate\.amount_paid_cents\s*\/\s*100\.0/i);
  assert.match(sql, /refunded_amount\s*=\s*v_aggregate\.refunded_cents\s*\/\s*100\.0/i);
  assert.match(sql, /if v_aggregate\.stripe_financials_complete then/i);
  assert.match(sql, /stripe_fee_amount\s*=\s*v_aggregate\.stripe_fee_amount/i);
  assert.match(sql, /stripe_net_amount\s*=\s*v_aggregate\.stripe_net_amount/i);
  assert.match(sql, /revoke all on function public\.recompute_booking_financial_aggregates[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.recompute_booking_financial_aggregates[\s\S]*to service_role/i);
});

test("payout balance transactions are fetched exhaustively across more than 100 rows", async () => {
  assert.equal(typeof listAllBalanceTransactions, "function");
  const calls = [];
  const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: `txn_${index}` }));
  const stripe = {
    balanceTransactions: {
      async list(params) {
        calls.push(params);
        if (!params.starting_after) return { data: firstPage, has_more: true };
        return { data: [{ id: "txn_100" }], has_more: false };
      },
    },
  };

  const rows = await listAllBalanceTransactions(stripe, { payout: "po_test", expand: ["data.source"] });

  assert.equal(rows.length, 101);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].limit, 100);
  assert.equal(calls[1].starting_after, "txn_99");
});

test("a repeated Stripe pagination cursor aborts before a third request", async () => {
  assert.equal(typeof listAllBalanceTransactions, "function");
  const calls = [];
  const stripe = {
    balanceTransactions: {
      async list(params) {
        calls.push(params);
        if (calls.length === 1) {
          return { data: [{ id: "txn_99" }], has_more: true };
        }
        if (calls.length > 2) throw new Error("Unexpected third Stripe request");
        return { data: [{ id: "txn_99" }], has_more: true };
      },
    },
  };

  await assert.rejects(
    listAllBalanceTransactions(stripe, { payout: "po_repeated_cursor" }),
    /pagination.*cursor/i,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].starting_after, "txn_99");
});

test("admin money helpers do not subtract refunds twice", () => {
  assert.equal(getRealPaidAmount({ status: "fully_paid", amount_paid: 250, refunded_amount: 70 }), 250);
  assert.equal(getRealPaidAmount({ status: "cancelled", amount_paid: 250, refunded_amount: 70 }), 0);
  assert.equal(typeof getHistoricalGrossPaidAmount, "function");
  assert.equal(getHistoricalGrossPaidAmount({ amount_paid: 250, refunded_amount: 70 }), 320);
  assert.equal(typeof getStripeBankExpectedNet, "function");
  assert.equal(getStripeBankExpectedNet(-1.72, 320), -1.72);
  assert.equal(getStripeBankExpectedNet(0, 320), 0);
  assert.equal(getAmounts({ status: "fully_paid", owner_price: 320, amount_paid: 0 }).paid, 0);
});

test("payment and refund mutation migrations delegate aggregate ownership to the central RPC", async () => {
  const checkoutSql = await readFile(
    new URL("../supabase/migrations/202608310001_secure_stripe_checkout_webhook.sql", import.meta.url),
    "utf8",
  );
  const refundSql = await readFile(
    new URL("../supabase/migrations/202608310002_secure_stripe_refunds.sql", import.meta.url),
    "utf8",
  );

  assert.match(checkoutSql, /recompute_booking_financial_aggregates/i);
  assert.doesNotMatch(checkoutSql, /stripe_fee_amount\s*=\s*coalesce\(p_stripe_fee_amount/i);
  assert.match(refundSql, /recompute_booking_financial_aggregates/i);
});

test("one, two, or three payments remain cumulative while refunds stay separate", () => {
  const aggregate = (payments, refunds) => {
    const accepted = new Set(["paid", "partially_refunded", "refunded"]);
    const grossPaidCents = payments
      .filter((payment) => accepted.has(payment.status))
      .reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0);
    const refundedCents = refunds
      .filter((refund) => refund.status === "succeeded")
      .reduce((sum, refund) => sum + (refund.amount_cents ?? Math.round(refund.amount * 100)), 0);
    return {
      grossPaidCents,
      refundedCents,
      amountPaidCents: Math.max(grossPaidCents - refundedCents, 0),
    };
  };

  assert.deepEqual(aggregate([{ amount: 96, status: "paid" }], []), {
    grossPaidCents: 9600, refundedCents: 0, amountPaidCents: 9600,
  });
  assert.deepEqual(aggregate([
    { amount: 96, status: "paid" },
    { amount: 224, status: "paid" },
  ], []), { grossPaidCents: 32000, refundedCents: 0, amountPaidCents: 32000 });
  assert.deepEqual(aggregate([
    { amount: 96, status: "paid" },
    { amount: 200, status: "partially_refunded" },
    { amount: 24, status: "refunded" },
    { amount: 999, status: "requires_review" },
  ], [
    { amount: 20, amount_cents: 2000, status: "succeeded" },
    { amount: 4, amount_cents: 400, status: "succeeded" },
    { amount: 99, amount_cents: 9900, status: "failed" },
  ]), { grossPaidCents: 32000, refundedCents: 2400, amountPaidCents: 29600 });
});

test("Stripe sync code paginates and never writes last-charge fee/net caches directly", async () => {
  const webhook = await readFile(new URL("../netlify/functions/stripe-webhook.js", import.meta.url), "utf8");
  const sync = await readFile(new URL("../netlify/functions/sync-stripe-finance.js", import.meta.url), "utf8");

  for (const source of [webhook, sync]) {
    assert.match(source, /listAllBalanceTransactions/i);
    assert.match(source, /recompute_booking_financial_aggregates/i);
    assert.doesNotMatch(source, /\n\s+stripe_fee_amount\s*:/i);
    assert.doesNotMatch(source, /\n\s+stripe_net_amount\s*:/i);
  }
});

test("admin reads derived completeness and labels cumulative net after refunds", async () => {
  const dataService = await readFile(new URL("../src/services/adminDataService.js", import.meta.url), "utf8");
  const paymentData = await readFile(new URL("../src/hooks/usePaymentData.js", import.meta.url), "utf8");
  const summary = await readFile(new URL("../src/components/admin/SummaryPanel.jsx", import.meta.url), "utf8");
  const paymentsPanel = await readFile(new URL("../src/components/admin/PaymentsPanel.jsx", import.meta.url), "utf8");

  assert.match(dataService, /booking_financial_ledger_aggregates/i);
  assert.match(paymentData, /stripe_financials_complete/i);
  assert.match(paymentData, /À rapprocher Stripe/i);
  assert.match(summary, /Net Stripe après remboursements/i);
  assert.match(paymentsPanel, /Net Stripe après remboursements/i);
  assert.doesNotMatch(summary, /Net Stripe avant remboursements/i);
});
