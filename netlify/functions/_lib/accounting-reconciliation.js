import { buildFiscalSummary, classifyFiscalOperation } from './accounting-fiscal-rules.js';

const OK = 'coherent';
const MISSING = 'manquant';
const REVIEW = 'a_verifier';
const NA = 'non_applicable';
const ACCOUNTING_TOLERANCE_CENTS = 0;
const PAID_PAYMENT_STATUSES = new Set(['paid', 'partially_refunded', 'refunded']);

function eurosToCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

function nonnegativeCents(value) {
  const cents = eurosToCents(value);
  return cents !== null && cents >= 0 ? cents : null;
}

function isoDate(value) {
  if (!value) return null;
  const text = String(value);
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function yearOf(value) {
  const date = isoDate(value);
  return date ? Number(date.slice(0, 4)) : null;
}

function statusFromDimensions(...statuses) {
  const active = statuses.filter((value) => value && value !== NA);
  // Une pièce réellement manquante doit rester prioritaire sur une incertitude
  // fiscale : sinon les encaissements Direct non comptabilisés sont masqués.
  if (active.includes(MISSING)) return MISSING;
  if (active.includes(REVIEW)) return REVIEW;
  return OK;
}

function accountingCategory(entry) {
  return entry?.accounting_categories?.code || entry?.category?.code || entry?.category_code || null;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function bookingClassification(booking) {
  return booking?.tourist_tax_snapshot?.classification || null;
}

// La finalisation d'une annulation sans paiement produit une refund_operation
// 'succeeded' à 0 centime : elle ne constitue PAS un mouvement de trésorerie.
// Les remboursements positifs et les montants inconnus restent contrôlables.
function financialRefundOperation(refund) {
  if (refund?.status !== 'succeeded') return false;
  const cents = Number.isInteger(refund.refunded_amount_cents)
    ? refund.refunded_amount_cents
    : nonnegativeCents(refund.refunded_amount);
  return cents !== 0;
}

function addReason(reasons, reason) {
  if (reason && !reasons.includes(reason)) reasons.push(reason);
}

function explicitDirectAccountingMatches(payment, entries) {
  const paymentId = String(payment.id || '');
  const keys = new Set([
    paymentId,
    `payment:${paymentId}`,
    `direct:payment:${paymentId}`,
    payment.stripe_payment_intent_id,
    payment.stripe_checkout_session_id,
  ].filter(Boolean).map(String));

  return entries.filter((entry) => {
    if (entry.entry_kind !== 'income') return false;
    const entryKey = entry.source_record_key == null ? null : String(entry.source_record_key);
    const external = entry.external_reference == null ? null : String(entry.external_reference);
    const metadataPaymentId = entry.metadata?.payment_id == null ? null : String(entry.metadata.payment_id);
    return (entryKey && keys.has(entryKey)) || (external && keys.has(external)) || (metadataPaymentId && metadataPaymentId === paymentId);
  });
}

function fallbackDirectAccountingMatches(payment, entries) {
  const amountCents = nonnegativeCents(payment.amount);
  const paidDate = isoDate(payment.paid_at || payment.created_at);
  return entries.filter((entry) => {
    if (entry.entry_kind !== 'income') return false;
    if (!payment.booking_request_id || entry.booking_request_id !== payment.booking_request_id) return false;
    if (isoDate(entry.entry_date) !== paidDate) return false;
    const entryCents = nonnegativeCents(entry.amount_ttc);
    return amountCents !== null && entryCents !== null && Math.abs(entryCents - amountCents) <= ACCOUNTING_TOLERANCE_CENTS;
  });
}

function reconcileDirectAccounting(payment, entries, reasons) {
  const explicit = explicitDirectAccountingMatches(payment, entries);
  if (explicit.length > 1) {
    addReason(reasons, 'accounting_match_ambiguous');
    return { status: REVIEW, entries: explicit };
  }
  if (explicit.length === 1) {
    const expected = nonnegativeCents(payment.amount);
    const actual = nonnegativeCents(explicit[0].amount_ttc);
    if (yearOf(explicit[0].entry_date) !== yearOf(payment.paid_at || payment.created_at)) {
      addReason(reasons, 'accounting_entry_year_mismatch');
      return { status: REVIEW, entries: explicit };
    }
    if (expected === null || actual === null || Math.abs(expected - actual) > ACCOUNTING_TOLERANCE_CENTS) {
      addReason(reasons, 'accounting_amount_mismatch');
      return { status: REVIEW, entries: explicit };
    }
    return { status: OK, entries: explicit };
  }

  const fallback = fallbackDirectAccountingMatches(payment, entries);
  if (fallback.length) {
    addReason(reasons, fallback.length > 1 ? 'accounting_match_ambiguous' : 'accounting_match_amount_date_booking_only');
    return { status: REVIEW, entries: fallback };
  }

  addReason(reasons, 'accounting_entry_missing');
  return { status: MISSING, entries: [] };
}

function stripeForPayment(payment, balanceTransactions, reasons) {
  const matches = balanceTransactions.filter((item) => {
    if (item.type && item.type !== 'charge') return false;
    if (item.payment_id && String(item.payment_id) === String(payment.id)) return true;
    if (payment.stripe_payment_intent_id && item.payment_intent_id === payment.stripe_payment_intent_id) return true;
    return false;
  });
  if (matches.length > 1) {
    addReason(reasons, 'stripe_balance_transaction_ambiguous');
    return { status: REVIEW, match: null };
  }
  if (matches.length === 0) {
    if (payment.stripe_payment_intent_id || payment.stripe_checkout_session_id) {
      addReason(reasons, 'stripe_balance_transaction_missing');
      return { status: MISSING, match: null };
    }
    return { status: OK, match: null };
  }
  const match = matches[0];
  const expected = nonnegativeCents(payment.amount);
  const actual = nonnegativeCents(match.amount);
  if (expected !== null && actual !== null && Math.abs(expected - actual) > ACCOUNTING_TOLERANCE_CENTS) {
    addReason(reasons, 'stripe_amount_mismatch');
    return { status: REVIEW, match };
  }
  return { status: OK, match };
}

function findPostStayContext(payment, cleaningIssues, additionalCharges) {
  const additional = additionalCharges.find((item) => String(item.payment_id || '') === String(payment.id || '')) || null;
  if (additional || payment.manual_reason === 'additional_charge') return { type: 'additional_charge', item: additional };
  const cleaning = cleaningIssues.find((item) => String(item.payment_id || '') === String(payment.id || '')) || null;
  if (cleaning || payment.manual_reason === 'post_stay_cleaning' || payment.manual_reason === 'cleaning') return { type: 'post_stay_cleaning', item: cleaning };
  return { type: 'receipt', item: null };
}

function fiscalContextFromClassification(classification) {
  return classifyFiscalOperation({}, { classification });
}

function directMovementYears(bookingId, payments, refundOperations, cleaningIssues = [], additionalCharges = []) {
  const years = [];
  for (const payment of payments) {
    if (payment.booking_request_id !== bookingId || !PAID_PAYMENT_STATUSES.has(String(payment.status || ''))) continue;
    if (findPostStayContext(payment, cleaningIssues, additionalCharges).type !== 'receipt') continue;
    const year = yearOf(payment.paid_at || payment.created_at);
    if (year) years.push(year);
  }
  for (const refund of refundOperations) {
    if (refund.booking_request_id === bookingId && financialRefundOperation(refund)) {
      const year = yearOf(refund.completed_at || refund.updated_at || refund.created_at);
      if (year) years.push(year);
    }
  }
  return unique(years);
}

function directSameYearFiscalGroups({ year, bookingsById, payments, refundOperations, cleaningIssues, additionalCharges }) {
  const byPaymentId = new Map();
  const grouped = new Map();
  for (const payment of payments) {
    if (!PAID_PAYMENT_STATUSES.has(String(payment.status || ''))) continue;
    if (!payment.booking_request_id) continue;
    if (findPostStayContext(payment, cleaningIssues, additionalCharges).type !== 'receipt') continue;
    const list = grouped.get(payment.booking_request_id) || [];
    list.push(payment);
    grouped.set(payment.booking_request_id, list);
  }

  for (const [bookingId, allPayments] of grouped.entries()) {
    const booking = bookingsById.get(bookingId);
    if (!booking) continue;
    const years = directMovementYears(bookingId, payments, refundOperations, cleaningIssues, additionalCharges);
    const hasRefund = refundOperations.some((refund) => refund.booking_request_id === bookingId && financialRefundOperation(refund));
    const inYear = allPayments.filter((payment) => yearOf(payment.paid_at || payment.created_at) === year);
    if (years.length !== 1 || years[0] !== year || hasRefund || inYear.length === 0) continue;

    const anchor = [...inYear]
      .sort((a, b) => String(a.paid_at || a.created_at || '').localeCompare(String(b.paid_at || b.created_at || '')))
      .at(-1);
    const totalPaidCents = inYear.reduce((sum, payment) => sum + (nonnegativeCents(payment.amount) || 0), 0);
    const taxCents = Number.isInteger(booking?.tourist_tax_snapshot?.totalTaxCents)
      ? booking.tourist_tax_snapshot.totalTaxCents
      : nonnegativeCents(booking?.tourist_tax_amount);
    const groupKey = `direct-booking:${bookingId}:${year}`;

    for (const payment of inYear) {
      byPaymentId.set(String(payment.id), {
        groupKey,
        anchorId: String(anchor.id),
        isAnchor: String(payment.id) === String(anchor.id),
        totalPaidCents,
        taxCents,
      });
    }
  }
  return byPaymentId;
}

function platformComponentEntries(entries, source, reference) {
  return entries.filter((entry) => entry.source === source && String(entry.external_reference || '') === String(reference || ''));
}

function suffixMatch(entry, suffixes) {
  const key = String(entry.source_record_key || '');
  const category = accountingCategory(entry);
  return suffixes.some((suffix) => key.endsWith(suffix))
    || (suffixes.includes(':commission') && category === 'platform_fees')
    || (suffixes.includes(':payment_fee') && category === 'payment_fees');
}

// Airbnb distingue le revenu brut des taxes collectées séparément pour son compte.
// L'export Transactions fournit le brut explicite dans son instantané ;
// traveler_total peut donc rester NULL sans empêcher le rapprochement comptable.
function airbnbStatementGrossCents(external) {
  if (external.source !== 'airbnb') return null;
  const snapshot = external.raw_snapshot?.airbnb_statement;
  if (!snapshot || snapshot.confirmation_code !== external.external_reference) return null;
  return nonnegativeCents(snapshot.gross);
}

function platformAccountingGrossCents(external) {
  return airbnbStatementGrossCents(external) ?? nonnegativeCents(external.traveler_total);
}

function expectedPlatformAccounting(external, entries, reasons) {
  const allRelated = platformComponentEntries(entries, external.source, external.external_reference);
  const paymentYear = yearOf(external.payment_date);
  const related = allRelated.filter(entry => paymentYear !== null && yearOf(entry.entry_date) === paymentYear);
  const checks = [];

  const incomeExpected = platformAccountingGrossCents(external);
  if (incomeExpected !== null) {
    const income = related.filter((entry) => entry.entry_kind === 'income');
    checks.push({ kind: 'income', expected: incomeExpected, candidates: income });
  }

  const commissionExpected = nonnegativeCents(external.commission_amount);
  if (commissionExpected !== null && commissionExpected > 0) {
    checks.push({ kind: 'commission', expected: commissionExpected, candidates: related.filter((entry) => entry.entry_kind === 'expense' && suffixMatch(entry, [':commission', ':service_fee'])) });
  }

  const feeExpected = nonnegativeCents(external.payment_fee_amount);
  if (feeExpected !== null && feeExpected > 0) {
    checks.push({ kind: 'payment_fee', expected: feeExpected, candidates: related.filter((entry) => entry.entry_kind === 'expense' && suffixMatch(entry, [':payment_fee'])) });
  }

  let status = OK;
  const matched = [];
  for (const check of checks) {
    if (check.candidates.length === 0) {
      status = status === REVIEW ? REVIEW : MISSING;
      addReason(reasons, `accounting_${check.kind}_missing`);
      continue;
    }
    if (check.candidates.length > 1) {
      status = REVIEW;
      addReason(reasons, `accounting_${check.kind}_ambiguous`);
      matched.push(...check.candidates);
      continue;
    }
    matched.push(check.candidates[0]);
    const actual = nonnegativeCents(check.candidates[0].amount_ttc);
    if (actual === null || Math.abs(actual - check.expected) > ACCOUNTING_TOLERANCE_CENTS) {
      status = REVIEW;
      addReason(reasons, `accounting_${check.kind}_amount_mismatch`);
    }
  }
  if (allRelated.length > related.length) {
    status = REVIEW;
    addReason(reasons, 'accounting_entry_year_mismatch');
  }
  if (checks.length === 0) {
    status = related.length ? REVIEW : MISSING;
    addReason(reasons, related.length ? 'accounting_platform_components_not_demonstrated' : 'accounting_entry_missing');
  }
  // Expenses alone cannot prove that a platform income agrees with the source gross.
  if (incomeExpected === null) {
    status = REVIEW;
    addReason(reasons, 'accounting_income_amount_not_demonstrated');
  }
  return { status, entries: unique(matched.map((entry) => entry.id)).map((id) => matched.find((entry) => entry.id === id)) };
}

function platformFiscal(external, booking, reasons) {
  // L'intitulé Airbnb « taxes reversées » inclut potentiellement plusieurs taxes
  // (TVA/TPS et taxe de séjour) : il ne justifie pas seul une taxe de séjour.
  if (external.source === 'airbnb'
    && String(external.provenance?.tourist_tax_amount || '').startsWith('airbnb_statement:taxes_reversees_par_airbnb')) {
    addReason(reasons, 'platform_airbnb_tax_type_not_demonstrated');
    return { fiscalStatus: REVIEW, fiscalCategory: null, fiscalGrossAmountCents: null, touristTaxCents: null };
  }
  const traveler = nonnegativeCents(external.traveler_total);
  const accommodation = nonnegativeCents(external.accommodation_amount);
  const cleaning = nonnegativeCents(external.cleaning_fee);
  const tax = nonnegativeCents(external.tourist_tax_amount);
  if ([traveler, accommodation, cleaning, tax].some((value) => value === null)) {
    addReason(reasons, 'platform_fiscal_breakdown_incomplete');
    return { fiscalStatus: REVIEW, fiscalCategory: null, fiscalGrossAmountCents: null, touristTaxCents: tax };
  }
  if (Math.abs((accommodation + cleaning + tax) - traveler) > ACCOUNTING_TOLERANCE_CENTS) {
    addReason(reasons, 'platform_fiscal_breakdown_mismatch');
    return { fiscalStatus: REVIEW, fiscalCategory: null, fiscalGrossAmountCents: null, touristTaxCents: tax };
  }
  // A subtraction remainder is not an independently justified tourist tax amount.
  if (String(external.provenance?.tourist_tax_amount || '').startsWith('derived:')) {
    addReason(reasons, 'platform_tourist_tax_derived_not_demonstrated');
    return { fiscalStatus: REVIEW, fiscalCategory: null, fiscalGrossAmountCents: null, touristTaxCents: null };
  }
  const classification = external.fiscal_classification || external.provenance?.fiscal_classification || bookingClassification(booking);
  const classified = fiscalContextFromClassification(classification);
  if (classified.fiscalStatus !== OK) {
    addReason(reasons, classified.reason);
    return { ...classified, fiscalGrossAmountCents: null, touristTaxCents: tax };
  }
  return { ...classified, fiscalGrossAmountCents: accommodation + cleaning, touristTaxCents: tax };
}

function documentForPlatform(external, invoices, reasons) {
  const found = invoices.filter((invoice) => invoice.source === external.source && String(invoice.external_reference || '') === String(external.external_reference || '') && invoice.status === 'issued');
  if (found.length > 1) {
    addReason(reasons, 'issued_invoice_ambiguous');
    return { status: REVIEW, ids: found.map((invoice) => invoice.id) };
  }
  if (found.length === 1 && external.traveler_total != null) {
    const expected = nonnegativeCents(external.traveler_total);
    const actual = nonnegativeCents(found[0].total_amount);
    if (expected !== null && actual !== null && Math.abs(expected - actual) > ACCOUNTING_TOLERANCE_CENTS) {
      addReason(reasons, 'issued_invoice_amount_mismatch');
      return { status: REVIEW, ids: [found[0].id] };
    }
  }
  return { status: OK, ids: found.map((invoice) => invoice.id) };
}

function buildDirectPaymentRow(context, payment, fiscalGroup) {
  const { bookingsById, accountingEntries, stripeBalanceTransactions, invoices, cleaningIssues, additionalCharges, movementYears } = context;
  const reasons = [];
  const booking = bookingsById.get(payment.booking_request_id) || null;
  const accounting = reconcileDirectAccounting(payment, accountingEntries, reasons);
  const stripe = stripeForPayment(payment, stripeBalanceTransactions, reasons);
  const financialStatus = statusFromDimensions(OK, stripe.status);
  const postStay = findPostStayContext(payment, cleaningIssues, additionalCharges);
  const grossKnownCents = nonnegativeCents(payment.amount);
  const feeCents = stripe.match ? nonnegativeCents(stripe.match.fee) : null;
  const netCents = stripe.match && nonnegativeCents(stripe.match.net) !== null
    ? nonnegativeCents(stripe.match.net)
    : (grossKnownCents !== null && feeCents !== null ? grossKnownCents - feeCents : grossKnownCents);

  // Les frais Stripe sont des écritures comptables distinctes, mais leur valeur
  // est DÉJÀ déduite du net économique de ce paiement. On doit donc les absorber
  // dans sa ligne de rapprochement, sinon ils sont comptés une deuxième fois.
  const feeEntries = accountingEntries.filter((entry) => entry.entry_kind === 'expense'
    && entry.source === 'stripe' && entry.source_record_key === `direct:fee:${payment.id}`);
  const importedReceipt = accounting.entries.some((entry) => entry.source === 'stripe'
    && entry.source_record_key === `direct:payment:${payment.id}`);
  let feeAccountingStatus = OK;
  if (feeEntries.length > 1) {
    feeAccountingStatus = REVIEW;
    addReason(reasons, 'direct_stripe_fee_entries_ambiguous');
  } else if (feeEntries.length === 1) {
    const entry = feeEntries[0];
    if (feeCents === null || nonnegativeCents(entry.amount_ttc) !== feeCents
      || isoDate(entry.entry_date) !== isoDate(payment.paid_at || payment.created_at)
      || entry.booking_request_id !== payment.booking_request_id) {
      feeAccountingStatus = REVIEW;
      addReason(reasons, 'direct_stripe_fee_mismatch');
    }
  } else if (importedReceipt && feeCents !== null && feeCents > 0) {
    feeAccountingStatus = MISSING;
    addReason(reasons, 'direct_stripe_fee_entry_missing');
  }
  const accountingStatus = statusFromDimensions(accounting.status, feeAccountingStatus);
  const accountingEntryIds = unique([...accounting.entries.map((entry) => entry.id), ...feeEntries.map((entry) => entry.id)]);
  let fiscalStatus = REVIEW;
  let fiscalCategory = null;
  let fiscalGrossAmountCents = null;
  let touristTaxCents = null;

  const fiscalClassification = fiscalContextFromClassification(bookingClassification(booking));
  if (postStay.type !== 'receipt') {
    if (fiscalClassification.fiscalStatus === OK && grossKnownCents !== null) {
      fiscalStatus = OK;
      fiscalCategory = fiscalClassification.fiscalCategory;
      fiscalGrossAmountCents = grossKnownCents;
      touristTaxCents = 0;
    } else {
      addReason(reasons, fiscalClassification.reason || 'fiscal_classification_missing');
    }
  } else if (movementYears.length > 1) {
    addReason(reasons, 'tourist_tax_cross_year_allocation_unknown');
  } else if (context.bookingRefundIds.has(payment.booking_request_id)) {
    addReason(reasons, 'refund_fiscal_effect_requires_versioned_rule');
  } else if (fiscalClassification.fiscalStatus !== OK) {
    addReason(reasons, fiscalClassification.reason);
  } else if (!fiscalGroup || fiscalGroup.taxCents === null) {
    addReason(reasons, 'tourist_tax_snapshot_missing');
  } else {
    fiscalStatus = OK;
    fiscalCategory = fiscalClassification.fiscalCategory;
    fiscalGrossAmountCents = fiscalGroup.isAnchor ? fiscalGroup.totalPaidCents - fiscalGroup.taxCents : 0;
    touristTaxCents = fiscalGroup.isAnchor ? fiscalGroup.taxCents : 0;
  }

  const postStayItem = postStay.item;
  const documentIds = [];
  let documentStatus = OK;
  if (postStayItem?.invoice_id) {
    const invoice = invoices.find((item) => String(item.id) === String(postStayItem.invoice_id));
    if (!invoice) {
      documentStatus = MISSING;
      addReason(reasons, 'referenced_invoice_missing');
    } else {
      documentIds.push(invoice.id);
      const expected = grossKnownCents;
      const actual = nonnegativeCents(invoice.total_amount);
      if (expected !== null && actual !== null && Math.abs(expected - actual) > ACCOUNTING_TOLERANCE_CENTS) {
        documentStatus = REVIEW;
        addReason(reasons, 'invoice_amount_mismatch');
      }
    }
  }

  return {
    id: `direct-payment:${payment.id}`,
    date: isoDate(payment.paid_at || payment.created_at),
    source: 'direct',
    type: postStay.type,
    bookingRequestId: payment.booking_request_id || null,
    externalReference: payment.stripe_payment_intent_id || payment.stripe_checkout_session_id || null,
    grossKnownCents,
    signedAmountCents: grossKnownCents,
    touristTaxCents,
    commissionCents: 0,
    paymentFeeCents: feeCents,
    netCents,
    accountingEntryIds,
    invoiceIds: documentIds,
    creditNoteIds: [],
    accountingCategory: null,
    financialStatus,
    accountingStatus,
    documentStatus,
    fiscalStatus,
    fiscalCategory,
    fiscalGrossAmountCents,
    fiscalRelevant: true,
    fiscalAggregationKey: fiscalGroup?.groupKey || null,
    fiscalAnchor: fiscalGroup?.isAnchor === true,
    reasons,
    status: statusFromDimensions(financialStatus, accountingStatus, documentStatus, fiscalStatus),
  };
}

function buildRefundRow(context, refund) {
  const reasons = [];
  const amountCents = Number.isInteger(refund.refunded_amount_cents) ? refund.refunded_amount_cents : nonnegativeCents(refund.refunded_amount);
  const issuedStayInvoices = context.invoices.filter((invoice) => invoice.booking_request_id === refund.booking_request_id && invoice.status === 'issued' && (invoice.invoice_kind || 'stay') === 'stay');
  const notes = context.creditNotes.filter((note) => note.refund_operation_id === refund.id);
  let documentStatus = OK;
  if (issuedStayInvoices.length === 1 && notes.length === 0) {
    documentStatus = MISSING;
    addReason(reasons, 'credit_note_missing_for_issued_stay_invoice');
  } else if (notes.length > 1 || issuedStayInvoices.length > 1) {
    documentStatus = REVIEW;
    addReason(reasons, 'refund_document_link_ambiguous');
  } else if (notes.length === 1 && amountCents !== null) {
    const noteTotal = nonnegativeCents(notes[0].total_amount);
    if (noteTotal !== null && Math.abs(noteTotal - amountCents) > ACCOUNTING_TOLERANCE_CENTS) {
      documentStatus = REVIEW;
      addReason(reasons, 'credit_note_amount_mismatch');
    }
  }

  const explicitAccounting = context.accountingEntries.filter((entry) => {
    const key = String(entry.source_record_key || '');
    const external = String(entry.external_reference || '');
    return key === `direct:refund:${refund.id}` || key === String(refund.id) || external === String(refund.id);
  });
  let accountingStatus = OK;
  if (explicitAccounting.length === 0) {
    accountingStatus = MISSING;
    addReason(reasons, 'accounting_entry_missing');
  } else if (explicitAccounting.length > 1) {
    accountingStatus = REVIEW;
    addReason(reasons, 'accounting_match_ambiguous');
  } else {
    const entry = explicitAccounting[0];
    if (entry.entry_kind !== 'refund') {
      accountingStatus = REVIEW;
      addReason(reasons, 'refund_accounting_kind_invalid');
    }
    if (entry.source !== 'stripe') {
      accountingStatus = REVIEW;
      addReason(reasons, 'refund_accounting_source_invalid');
    }
    if (yearOf(entry.entry_date) !== yearOf(refund.completed_at || refund.updated_at || refund.created_at)) {
      accountingStatus = REVIEW;
      addReason(reasons, 'accounting_entry_year_mismatch');
    }
    const actual = nonnegativeCents(entry.amount_ttc);
    if (amountCents === null || actual === null || Math.abs(actual - amountCents) > ACCOUNTING_TOLERANCE_CENTS) {
      accountingStatus = REVIEW;
      addReason(reasons, 'accounting_amount_mismatch');
    }
  }

  addReason(reasons, 'refund_fiscal_effect_requires_versioned_rule');
  return {
    id: `direct-refund:${refund.id}`,
    date: isoDate(refund.completed_at || refund.updated_at || refund.created_at),
    source: 'direct',
    type: 'refund',
    bookingRequestId: refund.booking_request_id || null,
    externalReference: refund.id || null,
    grossKnownCents: amountCents,
    signedAmountCents: amountCents === null ? null : -amountCents,
    touristTaxCents: null,
    commissionCents: 0,
    paymentFeeCents: null,
    netCents: amountCents === null ? null : -amountCents,
    accountingEntryIds: explicitAccounting.map((entry) => entry.id),
    invoiceIds: issuedStayInvoices.map((invoice) => invoice.id),
    creditNoteIds: notes.map((note) => note.id),
    accountingCategory: null,
    financialStatus: amountCents === null ? REVIEW : OK,
    accountingStatus,
    documentStatus,
    fiscalStatus: REVIEW,
    fiscalCategory: null,
    fiscalGrossAmountCents: null,
    fiscalRelevant: true,
    reasons,
    status: statusFromDimensions(amountCents === null ? REVIEW : OK, accountingStatus, documentStatus, REVIEW),
  };
}

function buildPlatformRow(context, external) {
  const reasons = [];
  const booking = external.booking_request_id ? context.bookingsById.get(external.booking_request_id) : null;
  const grossKnownCents = platformAccountingGrossCents(external);
  const accounting = expectedPlatformAccounting(external, context.accountingEntries, reasons);
  const fiscal = platformFiscal(external, booking, reasons);
  const document = documentForPlatform(external, context.invoices, reasons);
  const financialStatus = external.payment_date && external.external_reference ? OK : REVIEW;
  if (financialStatus === REVIEW) addReason(reasons, 'platform_financial_identity_incomplete');
  return {
    id: `platform:${external.source}:${external.external_reference}`,
    date: isoDate(external.payment_date),
    source: external.source,
    type: 'receipt',
    bookingRequestId: external.booking_request_id || null,
    externalReference: external.external_reference || null,
    grossKnownCents,
    signedAmountCents: grossKnownCents,
    touristTaxCents: fiscal.touristTaxCents,
    commissionCents: nonnegativeCents(external.commission_amount),
    paymentFeeCents: nonnegativeCents(external.payment_fee_amount),
    netCents: nonnegativeCents(external.net_payout),
    accountingEntryIds: accounting.entries.map((entry) => entry.id),
    invoiceIds: document.ids,
    creditNoteIds: [],
    accountingCategory: null,
    financialStatus,
    accountingStatus: accounting.status,
    documentStatus: document.status,
    fiscalStatus: fiscal.fiscalStatus,
    fiscalCategory: fiscal.fiscalCategory,
    fiscalGrossAmountCents: fiscal.fiscalGrossAmountCents,
    fiscalRelevant: true,
    reasons,
    status: statusFromDimensions(financialStatus, accounting.status, document.status, fiscal.fiscalStatus),
  };
}

function buildAccountingOnlyRow(entry) {
  const amountCents = nonnegativeCents(entry.amount_ttc);
  const isExpense = entry.entry_kind === 'expense';
  const isRefund = entry.entry_kind === 'refund';
  const reasons = [];
  if (amountCents === null) addReason(reasons, 'accounting_amount_invalid');
  // Une écriture refund orpheline ne devient JAMAIS une recette ni une charge.
  if (isRefund) {
    addReason(reasons, 'refund_origin_unlinked');
    if (amountCents === 0) addReason(reasons, 'refund_zero_amount');
  } else if (!isExpense) {
    addReason(reasons, 'accounting_income_unlinked');
  }
  return {
    id: `accounting-entry:${entry.id}`,
    date: isoDate(entry.entry_date),
    source: entry.source || 'manual',
    type: isRefund ? 'refund' : isExpense ? 'expense' : 'income',
    bookingRequestId: entry.booking_request_id || null,
    externalReference: entry.external_reference || null,
    grossKnownCents: amountCents,
    signedAmountCents: isRefund && amountCents !== null ? -amountCents : amountCents,
    touristTaxCents: null,
    commissionCents: accountingCategory(entry) === 'platform_fees' ? amountCents : 0,
    paymentFeeCents: accountingCategory(entry) === 'payment_fees' ? amountCents : 0,
    netCents: (isExpense || isRefund) && amountCents !== null ? -amountCents : amountCents,
    accountingEntryIds: [entry.id],
    invoiceIds: [],
    creditNoteIds: [],
    accountingCategory: accountingCategory(entry),
    financialStatus: amountCents === null ? REVIEW : OK,
    accountingStatus: amountCents === null ? REVIEW : OK,
    documentStatus: OK,
    fiscalStatus: isExpense ? NA : REVIEW,
    fiscalCategory: null,
    fiscalGrossAmountCents: null,
    fiscalRelevant: !isExpense,
    reasons,
    status: amountCents === null || !isExpense ? REVIEW : OK,
  };
}

function summarizeAccounting(rows) {
  let receiptsCents = 0;
  let refundsCents = 0;
  let expensesCents = 0;
  let commissionsCents = 0;
  let paymentFeesCents = 0;
  let touristTaxCents = 0;
  let economicNetCents = 0;
  const statuses = { coherent: 0, manquant: 0, a_verifier: 0 };

  for (const row of rows) {
    if (row.status && Object.hasOwn(statuses, row.status)) statuses[row.status] += 1;
    if (row.type === 'expense') expensesCents += row.grossKnownCents || 0;
    else if (row.type === 'refund') refundsCents += row.grossKnownCents || 0;
    else receiptsCents += row.grossKnownCents || 0;
    commissionsCents += row.commissionCents || 0;
    paymentFeesCents += row.paymentFeeCents || 0;
    touristTaxCents += row.touristTaxCents || 0;
    if (row.netCents !== null && row.netCents !== undefined) economicNetCents += Number(row.netCents) || 0;
  }

  return {
    rowCount: rows.length,
    receiptsCents,
    refundsCents,
    expensesCents,
    commissionsCents,
    paymentFeesCents,
    touristTaxCents,
    economicNetCents,
    statuses,
  };
}

function buildTaxProjectionRows(rows) {
  const projected = [];
  const groups = new Map();

  for (const row of rows) {
    if (!row.fiscalAggregationKey) {
      if (row.fiscalRelevant !== false) projected.push(row);
      continue;
    }
    const list = groups.get(row.fiscalAggregationKey) || [];
    list.push(row);
    groups.set(row.fiscalAggregationKey, list);
  }

  for (const list of groups.values()) {
    const anchor = list.find((row) => row.fiscalAnchor) || list.at(-1);
    const groupStatus = statusFromDimensions(...list.map((row) => row.status));
    const groupFiscalStatus = statusFromDimensions(...list.map((row) => row.fiscalStatus));
    projected.push({
      ...anchor,
      status: groupStatus,
      fiscalStatus: groupFiscalStatus,
      grossKnownCents: list.reduce((sum, row) => sum + (row.grossKnownCents || 0), 0),
    });
  }

  return projected;
}

export function buildAccountingReconciliation(input = {}) {
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new Error('Année de rapprochement invalide.');

  const bookings = input.bookings || [];
  const payments = input.payments || [];
  const refundOperations = input.refundOperations || [];
  const stripeBalanceTransactions = input.stripeBalanceTransactions || [];
  const externalFinancials = input.externalFinancials || [];
  const accountingEntries = input.accountingEntries || [];
  const invoices = input.invoices || [];
  const creditNotes = input.creditNotes || [];
  const cleaningIssues = input.cleaningIssues || [];
  const additionalCharges = input.additionalCharges || [];

  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
  const bookingRefundIds = new Set(refundOperations.filter(financialRefundOperation).map((refund) => refund.booking_request_id));
  const directFiscalGroups = directSameYearFiscalGroups({ year, bookingsById, payments, refundOperations, cleaningIssues, additionalCharges });
  const rows = [];
  const consumedAccounting = new Set();

  for (const payment of payments) {
    if (!PAID_PAYMENT_STATUSES.has(String(payment.status || ''))) continue;
    if (yearOf(payment.paid_at || payment.created_at) !== year) continue;
    const movementYears = directMovementYears(payment.booking_request_id, payments, refundOperations, cleaningIssues, additionalCharges);
    const row = buildDirectPaymentRow({
      year, bookingsById, accountingEntries, stripeBalanceTransactions, invoices, creditNotes,
      cleaningIssues, additionalCharges, refundOperations, bookingRefundIds, movementYears,
    }, payment, directFiscalGroups.get(String(payment.id)) || null);
    rows.push(row);
    row.accountingEntryIds.forEach((id) => consumedAccounting.add(id));
  }

  for (const refund of refundOperations) {
    if (!financialRefundOperation(refund)) continue;
    if (yearOf(refund.completed_at || refund.updated_at || refund.created_at) !== year) continue;
    const row = buildRefundRow({ bookingsById, accountingEntries, invoices, creditNotes }, refund);
    rows.push(row);
    row.accountingEntryIds.forEach((id) => consumedAccounting.add(id));
  }

  for (const external of externalFinancials) {
    if (!['booking', 'airbnb'].includes(external.source)) continue;
    if (yearOf(external.payment_date) !== year) continue;
    const row = buildPlatformRow({ bookingsById, accountingEntries, invoices }, external);
    rows.push(row);
    row.accountingEntryIds.forEach((id) => consumedAccounting.add(id));
  }

  for (const entry of accountingEntries) {
    if (yearOf(entry.entry_date) !== year || consumedAccounting.has(entry.id)) continue;
    rows.push(buildAccountingOnlyRow(entry));
  }

  rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id)));
  const accountingSummary = summarizeAccounting(rows);
  const taxSummary = buildFiscalSummary(buildTaxProjectionRows(rows), year, Number(input.declarant || 2));
  return { rows, accountingSummary, taxSummary };
}

export const ACCOUNTING_RECONCILIATION_STATUS = Object.freeze({ OK, MISSING, REVIEW, NA });
