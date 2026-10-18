import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest as authorizeOwnerRequest, authorizationResponse } from "./_lib/admin-auth.js";
import { buildAccountingReconciliation } from "./_lib/accounting-reconciliation.js";
import { stripeRefundParisDate } from "./_lib/auto-direct-stripe-refund-accounting.js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PAID_PAYMENT_STATUSES = ["paid", "partially_refunded", "refunded"];

const PAYMENT_FIELDS = "id,booking_request_id,payment_type,manual_reason,amount,currency,status,stripe_checkout_session_id,stripe_payment_intent_id,paid_at,created_at";
const REFUND_FIELDS = "id,booking_request_id,status,refunded_amount_cents,created_at,updated_at,completed_at";
const ALLOCATION_FIELDS = "id,operation_id,booking_request_id,payment_id,amount,amount_cents,currency,status,operation_status,stripe_refund_id,stripe_payment_intent_id,metadata,created_at,updated_at";

// L'année d'une allocation est portée par la création Stripe conservée dans metadata,
// et non par la finalisation (potentiellement ultérieure) de refund_operations.
function allocationPage(supabase, start, pageSize) {
  return supabase.from('refunds').select(ALLOCATION_FIELDS)
    .eq('status', 'succeeded').not('operation_id', 'is', null)
    .order('id', {ascending: true}).range(start, start + pageSize - 1);
}
function refundOperationsByIds(supabase, ids) {
  return supabase.from('refund_operations').select(REFUND_FIELDS).in('id', ids);
}
async function readSucceededRefundAllocations(supabase) {
  const rows = [];
  const pageSize = 500;
  for (let start = 0; start < 20000; start += pageSize) {
    const response = await allocationPage(supabase, start, pageSize);
    const page = checked(response, 'Allocations de remboursements');
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error('Allocations Stripe trop nombreuses : extraction annuelle incomplète');
}
const EXTERNAL_FIELDS = "id,source,external_reference,booking_request_id,accommodation_amount,cleaning_fee,tourist_tax_amount,traveler_total,commission_amount,payment_fee_amount,net_payout,payment_date,provenance,raw_snapshot";
const ACCOUNTING_FIELDS = "id,entry_date,entry_kind,amount_ttc,source,source_record_key,external_reference,booking_request_id,metadata,category_id,accounting_categories(code,name,entry_kind)";
const BOOKING_FIELDS = "id,tourist_tax_amount,tourist_tax_snapshot";
const STRIPE_FIELDS = "id,booking_request_id,payment_id,payment_intent_id,type,amount,fee,net,created_at_stripe";
const INVOICE_FIELDS = "id,source,booking_request_id,external_reference,invoice_kind,status,total_amount,cleaning_issue_id,additional_charge_id";
const CREDIT_NOTE_FIELDS = "id,invoice_id,booking_request_id,refund_operation_id,status,total_amount";
const CLEANING_FIELDS = "id,booking_request_id,payment_id,invoice_id,confirmed_at,cancelled_at";
const ADDITIONAL_FIELDS = "id,booking_request_id,payment_id,invoice_id,status,amount,paid_at";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, max-age=0",
  },
  body: JSON.stringify(body),
});

function validYear(year) {
  return Number.isInteger(year) && year >= 2024 && year <= 2100;
}

function unique(values) {
  return [...new Set((values || []).filter((value) => value !== null && value !== undefined && value !== "").map(String))];
}

function mergeBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows.flat()) {
    if (!row) continue;
    const key = keyFn(row);
    if (key) map.set(key, row);
  }
  return [...map.values()];
}

function mergeById(...rows) {
  return mergeBy(rows, (row) => row.id == null ? null : String(row.id));
}

function emptyResult() {
  return Promise.resolve({ data: [], error: null });
}

function queryIf(values, build) {
  return values.length ? build() : emptyResult();
}

function checked(result, label) {
  if (result?.error) {
    const error = new Error(`${label}: ${result.error.message || "lecture impossible"}`);
    error.cause = result.error;
    throw error;
  }
  return result?.data || [];
}

function accountingKeysForMovements(payments, refunds, allocations = []) {
  const keys = [];
  const references = [];
  for (const payment of payments) {
    if (!payment?.id) continue;
    const id = String(payment.id);
    keys.push(id, `payment:${id}`, `direct:payment:${id}`);
    if (payment.stripe_payment_intent_id) references.push(String(payment.stripe_payment_intent_id));
    if (payment.stripe_checkout_session_id) references.push(String(payment.stripe_checkout_session_id));
  }
  for (const refund of refunds) {
    if (!refund?.id) continue;
    const id = String(refund.id);
    keys.push(id, `direct:refund:${id}`);
    references.push(id);
  }
  for (const allocation of allocations) {
    if (!allocation?.id) continue;
    keys.push(`direct:refund:${allocation.id}`);
    if (allocation.stripe_refund_id) references.push(String(allocation.stripe_refund_id));
  }
  return { keys: unique(keys), references: unique(references) };
}

export async function runAnnualReconciliation(event, { client = supabase, authorize = authorizeOwnerRequest } = {}) {
  const supabase = client;
  const authorizeAdminRequest = authorize;
  if (event.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });

  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);

  const year = Number(event.queryStringParameters?.year);
  if (!validYear(year)) return json(400, { error: "Année invalide." });

  const yearStart = `${year}-01-01`;
  const nextYearStart = `${year + 1}-01-01`;
  const yearStartIso = `${yearStart}T00:00:00Z`;
  const nextYearStartIso = `${nextYearStart}T00:00:00Z`;

  try {
    // La date comptable d'une allocation est celle de Stripe, pas celle de
    // la finalisation de l'opération. Extraction paginée, sans résultat tronqué.
    const allocationsAll = await readSucceededRefundAllocations(supabase);
    const allocationsYear = allocationsAll.filter(row =>
      stripeRefundParisDate(Number(row.metadata?.created))?.slice(0, 4) === String(year));

    // Phase 1 — opérations qui appartiennent réellement à l'exercice demandé.
    const [paymentsYearResult, refundsYearResult, externalYearResult, accountingYearResult] = await Promise.all([
      supabase
        .from("payments")
        .select(PAYMENT_FIELDS)
        .in("status", PAID_PAYMENT_STATUSES)
        .or(`and(paid_at.gte.${yearStartIso},paid_at.lt.${nextYearStartIso}),and(paid_at.is.null,created_at.gte.${yearStartIso},created_at.lt.${nextYearStartIso})`),
      supabase
        .from("refund_operations")
        .select(REFUND_FIELDS)
        .eq("status", "succeeded")
        .or(`and(completed_at.gte.${yearStartIso},completed_at.lt.${nextYearStartIso}),and(completed_at.is.null,updated_at.gte.${yearStartIso},updated_at.lt.${nextYearStartIso}),and(completed_at.is.null,updated_at.is.null,created_at.gte.${yearStartIso},created_at.lt.${nextYearStartIso})`),
      supabase
        .from("external_reservation_financials")
        .select(EXTERNAL_FIELDS)
        .in("source", ["booking", "airbnb"])
        .gte("payment_date", yearStart)
        .lt("payment_date", nextYearStart),
      supabase
        .from("accounting_entries")
        .select(ACCOUNTING_FIELDS)
        .gte("entry_date", yearStart)
        .lt("entry_date", nextYearStart),
    ]);

    const paymentsYear = checked(paymentsYearResult, "Paiements de l'exercice");
    const refundsYear = checked(refundsYearResult, "Remboursements de l'exercice");
    const externalFinancials = checked(externalYearResult, "Plateformes de l'exercice");
    const accountingYear = checked(accountingYearResult, "Journal de l'exercice");

    const bookingIds = unique([
      ...paymentsYear.map((row) => row.booking_request_id),
      ...refundsYear.map((row) => row.booking_request_id),
      ...allocationsYear.map((row) => row.booking_request_id),
      ...externalFinancials.map((row) => row.booking_request_id),
      ...accountingYear.map((row) => row.booking_request_id),
    ]);
    const platformReferences = unique(externalFinancials.map((row) => row.external_reference));

    // Phase 2 — contexte relié uniquement aux opérations de l'exercice.
    // Les mouvements Direct des autres années sont nécessaires pour savoir si une réservation
    // traverse plusieurs exercices ; ils ne deviennent pas pour autant des lignes de l'année demandée.
    const [
      bookingsResult,
      linkedPaymentsResult,
      linkedRefundsResult,
      accountingByBookingResult,
      accountingByPlatformResult,
      invoicesByBookingResult,
      invoicesByPlatformResult,
      cleaningIssuesResult,
      additionalChargesResult,
    ] = await Promise.all([
      queryIf(bookingIds, () => supabase.from("booking_requests").select(BOOKING_FIELDS).in("id", bookingIds)),
      queryIf(bookingIds, () => supabase.from("payments").select(PAYMENT_FIELDS).in("booking_request_id", bookingIds).in("status", PAID_PAYMENT_STATUSES)),
      queryIf(bookingIds, () => supabase.from("refund_operations").select(REFUND_FIELDS).in("booking_request_id", bookingIds).eq("status", "succeeded")),
      queryIf(bookingIds, () => supabase.from("accounting_entries").select(ACCOUNTING_FIELDS).in("booking_request_id", bookingIds)),
      queryIf(platformReferences, () => supabase.from("accounting_entries").select(ACCOUNTING_FIELDS).in("source", ["booking", "airbnb"]).in("external_reference", platformReferences)),
      queryIf(bookingIds, () => supabase.from("customer_invoices").select(INVOICE_FIELDS).in("booking_request_id", bookingIds)),
      queryIf(platformReferences, () => supabase.from("customer_invoices").select(INVOICE_FIELDS).in("source", ["booking", "airbnb"]).in("external_reference", platformReferences)),
      queryIf(bookingIds, () => supabase.from("booking_cleaning_issues").select(CLEANING_FIELDS).in("booking_request_id", bookingIds)),
      queryIf(bookingIds, () => supabase.from("booking_additional_charges").select(ADDITIONAL_FIELDS).in("booking_request_id", bookingIds)),
    ]);

    const bookings = checked(bookingsResult, "Réservations liées");
    const payments = mergeById(paymentsYear, checked(linkedPaymentsResult, "Paiements liés"));
    const refundOperations = mergeById(refundsYear, checked(linkedRefundsResult, "Remboursements liés"));
    const refundAllocations = allocationsAll.filter(row => bookingIds.includes(String(row.booking_request_id)));
    // Les allocations dans l'exercice mais rattachées à une opération d'une autre année
    // doivent aussi retrouver leur opération (pour vérifier la pièce et éviter le double compte).
    const missingOperationIds = unique(refundAllocations.map(row => row.operation_id))
      .filter(id => !refundOperations.some(op => String(op.id) === id));
    for (let i = 0; i < missingOperationIds.length; i += 100) {
      const response = await refundOperationsByIds(supabase, missingOperationIds.slice(i, i + 100));
      refundOperations.push(...checked(response, 'Opérations des allocations'));
    }
    const accountingEntries = mergeById(
      accountingYear,
      checked(accountingByBookingResult, "Journal lié aux réservations"),
      checked(accountingByPlatformResult, "Journal lié aux plateformes"),
    );
    const invoices = mergeById(
      checked(invoicesByBookingResult, "Factures liées aux réservations"),
      checked(invoicesByPlatformResult, "Factures liées aux plateformes"),
    );
    const cleaningIssues = checked(cleaningIssuesResult, "Dossiers ménage liés");
    const additionalCharges = checked(additionalChargesResult, "Charges complémentaires liées");

    const paymentIds = unique(payments.map((row) => row.id));
    const paymentIntentIds = unique(payments.map((row) => row.stripe_payment_intent_id));
    const refundIds = unique(refundOperations.map((row) => row.id));
    const accountingMovementKeys = accountingKeysForMovements(paymentsYear, refundsYear, refundAllocations);

    // Phase 3 — liens techniques qui ne portent pas eux-mêmes l'exercice fiscal.
    const [
      stripeByBookingResult,
      stripeByPaymentResult,
      stripeByIntentResult,
      creditNotesResult,
      accountingByMovementKeyResult,
      accountingByMovementReferenceResult,
    ] = await Promise.all([
      queryIf(bookingIds, () => supabase.from("stripe_balance_transactions").select(STRIPE_FIELDS).in("booking_request_id", bookingIds)),
      queryIf(paymentIds, () => supabase.from("stripe_balance_transactions").select(STRIPE_FIELDS).in("payment_id", paymentIds)),
      queryIf(paymentIntentIds, () => supabase.from("stripe_balance_transactions").select(STRIPE_FIELDS).in("payment_intent_id", paymentIntentIds)),
      queryIf(refundIds, () => supabase.from("customer_credit_notes").select(CREDIT_NOTE_FIELDS).in("refund_operation_id", refundIds)),
      queryIf(accountingMovementKeys.keys, () => supabase.from("accounting_entries").select(ACCOUNTING_FIELDS).in("source_record_key", accountingMovementKeys.keys)),
      queryIf(accountingMovementKeys.references, () => supabase.from("accounting_entries").select(ACCOUNTING_FIELDS).in("external_reference", accountingMovementKeys.references)),
    ]);

    const stripeBalanceTransactions = mergeById(
      checked(stripeByBookingResult, "Mouvements Stripe liés aux réservations"),
      checked(stripeByPaymentResult, "Mouvements Stripe liés aux paiements"),
      checked(stripeByIntentResult, "Mouvements Stripe liés aux PaymentIntents"),
    );
    const creditNotes = checked(creditNotesResult, "Avoirs liés");
    const accountingContext = mergeById(
      accountingEntries,
      checked(accountingByMovementKeyResult, "Journal lié aux identifiants de mouvements"),
      checked(accountingByMovementReferenceResult, "Journal lié aux références de mouvements"),
    );

    const { rows, accountingSummary, taxSummary } = buildAccountingReconciliation({
      year,
      bookings,
      payments,
      refundOperations,
      refundAllocations,
      stripeBalanceTransactions,
      externalFinancials,
      accountingEntries: accountingContext,
      invoices,
      creditNotes,
      cleaningIssues,
      additionalCharges,
    });

    return json(200, {
      year,
      rows,
      accountingSummary,
      taxSummary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erreur rapprochement comptable annuel :", error);
    return json(500, { error: "Impossible de calculer le rapprochement comptable annuel." });
  }
}

export async function handler(event) {
  return runAnnualReconciliation(event);
}
