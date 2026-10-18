// Read-only projections. Monetary values remain exact integer cents.
export const DEFAULT_RECONCILIATION_FILTERS = Object.freeze({
  scope: 'all', source: 'all', type: 'all', status: 'all', fiscalCategory: 'all', query: '',
});
const STATUS_RANK = { a_verifier: 0, manquant: 1, coherent: 2, non_applicable: 3 };
const hasCents = (value) => Number.isSafeInteger(value);
const isFiscalCandidate = (row) => row?.fiscalRelevant !== false && row?.type !== 'expense';
const rowReady = (row) => isFiscalCandidate(row) && row.status === 'coherent'
  && row.fiscalStatus === 'coherent' && Boolean(row.fiscalCategory)
  && hasCents(row.fiscalGrossAmountCents) && row.fiscalGrossAmountCents >= 0;

export function filterReconciliationRows(rows = [], filters = {}) {
  const f = { ...DEFAULT_RECONCILIATION_FILTERS, ...filters };
  const query = String(f.query || '').trim().toLocaleLowerCase('fr-FR');
  const fullFiscalGroups = groupRows(rows);
  return rows.filter((row) => {
    if (f.source !== 'all' && row.source !== f.source) return false;
    if (f.type !== 'all' && row.type !== f.type) return false;
    if (f.status !== 'all' && row.status !== f.status) return false;
    if (f.fiscalCategory !== 'all'
      && (f.fiscalCategory === 'unknown' ? Boolean(row.fiscalCategory) : row.fiscalCategory !== f.fiscalCategory)) return false;
    if (f.scope === 'coherent' && row.status !== 'coherent') return false;
    if (f.scope === 'anomalies' && row.status !== 'a_verifier' && row.status !== 'manquant') return false;
    if (f.scope === 'ready') {
      if (!rowReady(row)) return false;
      if (row.fiscalAggregationKey) {
        const group = fullFiscalGroups.get(row.fiscalAggregationKey) || [];
        if (group.filter((member) => member.fiscalAnchor).length !== 1 || !group.every(rowReady)) return false;
      }
    }
    if (query) {
      const searchable = [row.id, row.source, row.type, row.bookingRequestId,
        row.externalReference, row.accountingCategory, row.fiscalCategory,
        ...(Array.isArray(row.reasons) ? row.reasons : [])].filter(Boolean).join(' ').toLocaleLowerCase('fr-FR');
      if (!searchable.includes(query)) return false;
    }
    return true;
  });
}

function compareNullableDates(a, b, descending = false) {
  if (!a) return b ? 1 : 0;
  if (!b) return -1;
  return descending ? String(b).localeCompare(String(a)) : String(a).localeCompare(String(b));
}
function compareNullableCents(a, b, descending = false) {
  const knownA = hasCents(a), knownB = hasCents(b);
  if (!knownA || !knownB) return knownA === knownB ? 0 : knownA ? -1 : 1;
  return descending ? b - a : a - b;
}
export function sortReconciliationRows(rows = [], sort = 'priority_date') {
  return [...rows].sort((a, b) => {
    let comparison = 0;
    switch (sort) {
      case 'date_desc': comparison = compareNullableDates(a.date, b.date, true); break;
      case 'date_asc': comparison = compareNullableDates(a.date, b.date); break;
      case 'amount_desc': comparison = compareNullableCents(a.grossKnownCents, b.grossKnownCents, true); break;
      case 'amount_asc': comparison = compareNullableCents(a.grossKnownCents, b.grossKnownCents); break;
      case 'source': comparison = String(a.source || '').localeCompare(String(b.source || ''), 'fr'); break;
      case 'fiscal_desc': comparison = compareNullableCents(a.fiscalGrossAmountCents, b.fiscalGrossAmountCents, true); break;
      case 'priority_date':
      default:
        comparison = (STATUS_RANK[a.status] ?? 4) - (STATUS_RANK[b.status] ?? 4);
        if (!comparison) comparison = compareNullableDates(a.date, b.date, true);
        break;
    }
    return comparison || String(a.id || '').localeCompare(String(b.id || ''), 'fr');
  });
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.fiscalAggregationKey) continue;
    if (!groups.has(row.fiscalAggregationKey)) groups.set(row.fiscalAggregationKey, []);
    groups.get(row.fiscalAggregationKey).push(row);
  }
  return groups;
}

// Visible fiscal amount is a conservative indicator, NOT the annual taxSummary.
// A partly visible / inconsistent direct booking fiscal group is never certified.
export function summarizeVisibleReconciliationRows(visibleRows = [], allRows = visibleRows) {
  const total = {
    rowCount: visibleRows.length, receiptsCents: 0, refundsCents: 0, expensesCents: 0,
    commissionsCents: 0, paymentFeesCents: 0, touristTaxCents: 0, economicNetCents: 0,
    unknownGrossCount: 0, unknownNetCount: 0, unknownTouristTaxCount: 0,
    fiscalValidatedCents: 0, fiscalPendingKnownReceiptsCents: 0, fiscalPendingKnownRefundsCents: 0,
    fiscalUnknownCount: 0, fiscalIncompleteGroupCount: 0,
    statuses: { coherent: 0, manquant: 0, a_verifier: 0 },
  };
  const fullGroups = groupRows(allRows), visibleGroups = groupRows(visibleRows);
  const invalid = new Set();
  for (const [key, members] of visibleGroups) {
    const whole = fullGroups.get(key) || [];
    const complete = members.length === whole.length
      && whole.every((item) => members.some((member) => member.id === item.id));
    if (!complete || whole.some((item) => !rowReady(item))) invalid.add(key);
    if (!complete) total.fiscalIncompleteGroupCount++;
  }
  for (const row of visibleRows) {
    if (Object.hasOwn(total.statuses, row.status)) total.statuses[row.status]++;
    if (hasCents(row.grossKnownCents)) {
      if (row.type === 'expense') total.expensesCents += row.grossKnownCents;
      else if (row.type === 'refund') total.refundsCents += row.grossKnownCents;
      else total.receiptsCents += row.grossKnownCents;
    } else total.unknownGrossCount++;
    if (hasCents(row.netCents)) total.economicNetCents += row.netCents;
    else total.unknownNetCount++;
    if (hasCents(row.touristTaxCents)) total.touristTaxCents += row.touristTaxCents;
    else if (row.type !== 'expense') total.unknownTouristTaxCount++;
    if (hasCents(row.commissionCents)) total.commissionsCents += row.commissionCents;
    if (hasCents(row.paymentFeeCents)) total.paymentFeesCents += row.paymentFeeCents;
    if (!isFiscalCandidate(row)) continue;
    if (rowReady(row) && (!row.fiscalAggregationKey || !invalid.has(row.fiscalAggregationKey))) {
      total.fiscalValidatedCents += row.fiscalGrossAmountCents;
    } else if (hasCents(row.grossKnownCents)) {
      if (row.type === 'refund') total.fiscalPendingKnownRefundsCents += row.grossKnownCents;
      else total.fiscalPendingKnownReceiptsCents += row.grossKnownCents;
    } else total.fiscalUnknownCount++;
  }
  return total;
}
