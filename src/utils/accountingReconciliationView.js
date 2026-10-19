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

// Read-only annual projection: never replace or repair values returned by the endpoint.
// Recompute eligible category subtotals only to detect disagreements with the server.
function expectedFiscalCategories(rows) {
  const sums = new Map();
  const groups = groupRows(rows);
  const add = (row) => sums.set(row.fiscalCategory, (sums.get(row.fiscalCategory) || 0) + row.fiscalGrossAmountCents);
  for (const row of rows) {
    if (row.fiscalAggregationKey || !rowReady(row)) continue;
    add(row);
  }
  for (const members of groups.values()) {
    const first = members[0];
    if (members.filter((row) => row.fiscalAnchor).length !== 1
      || !members.every((row) => rowReady(row) && row.fiscalCategory === first.fiscalCategory)) continue;
    for (const row of members) add(row);
  }
  return sums;
}

export function reviewAnnualDeclaration(reconciliation = {}, selectedYear) {
  const rows = Array.isArray(reconciliation?.rows) ? reconciliation.rows : [];
  const summary = reconciliation?.taxSummary;
  const year = Number(selectedYear);
  const categories = Array.isArray(summary?.categories) ? summary.categories : [];
  const expected = expectedFiscalCategories(rows);
  let integrityError = null;
  if (!summary || !Array.isArray(summary.categories) || summary.incomeYear !== year) {
    integrityError = 'Récapitulatif fiscal absent ou rattaché à un autre exercice.';
  } else if (summary.declarant !== 1 && summary.declarant !== 2) {
    integrityError = 'Déclarant fiscal inconnu.';
  } else if (!Number.isSafeInteger(summary.pendingRows) || summary.pendingRows < 0
    || !hasCents(summary.pendingKnownGrossAmountCents) || summary.pendingKnownGrossAmountCents < 0
    || !hasCents(summary.totalGrossAmountCents) || summary.totalGrossAmountCents < 0) {
    integrityError = 'Totaux ou nombre d’opérations en attente invalides.';
  } else if (categories.some((category) => !category
    || !hasCents(category.grossAmountCents) || category.grossAmountCents < 0
    || !Number.isSafeInteger(category.rowCount) || category.rowCount < 0
    || category.incomeYear !== year
    || !['tourist_furnished_unclassified', 'tourist_furnished_classified'].includes(category.category))) {
    integrityError = 'Catégorie fiscale ou montant annuel invalide.';
  } else {
    const categoriesSeen = new Set();
    let total = 0;
    for (const category of categories) {
      if (categoriesSeen.has(category.category)) {
        integrityError = 'Catégorie fiscale présente plusieurs fois.';
        break;
      }
      categoriesSeen.add(category.category);
      total += category.grossAmountCents;
      if (!Number.isSafeInteger(total) || expected.get(category.category) !== category.grossAmountCents) {
        integrityError = 'Le montant fiscal du serveur ne correspond pas aux opérations éligibles.';
        break;
      }
    }
    if (!integrityError && (categoriesSeen.size !== expected.size || total !== summary.totalGrossAmountCents)) {
      integrityError = 'Les totaux fiscaux annuels ne concordent pas avec les lignes.';
    }
  }

  const pendingRows = Number.isSafeInteger(summary?.pendingRows) && summary.pendingRows >= 0 ? summary.pendingRows : null;
  const pendingKnownGrossAmountCents = hasCents(summary?.pendingKnownGrossAmountCents)
    && summary.pendingKnownGrossAmountCents >= 0 ? summary.pendingKnownGrossAmountCents : null;
  const totalGrossAmountCents = hasCents(summary?.totalGrossAmountCents)
    && summary.totalGrossAmountCents >= 0 ? summary.totalGrossAmountCents : null;
  const completeForms = categories.every((item) => item.ruleStatus === 'confirmed' && Boolean(item.box) && Boolean(item.form));
  const status = integrityError ? 'inconsistent'
    : pendingRows > 0 ? 'pending'
      : categories.length === 0 ? 'empty'
        : !completeForms ? 'form_pending' : 'ready_for_review';
  return {
    incomeYear: year, declarationYear: year + 1, declarant: summary?.declarant ?? null,
    categories, totalGrossAmountCents, pendingRows, pendingKnownGrossAmountCents,
    integrityError, status, formReady: status === 'ready_for_review',
  };
}

const RECONCILIATION_REASONS = Object.freeze({
  accounting_amount_invalid: ['Montant comptable invalide', 'Le montant de l’écriture ne peut pas être utilisé tel quel.'],
  accounting_amount_mismatch: ['Écart de montant comptable', 'Comparer le montant exact en centimes avec celui de l’encaissement.'],
  accounting_entry_missing: ['Écriture comptable manquante', 'Aucune écriture correspondante n’a été trouvée avec une preuve de liaison suffisante.'],
  accounting_income_unlinked: ['Recette comptable sans lien démontré', 'Cette écriture isolée doit être rapprochée d’un encaissement justifié avant d’être déclarée cohérente.'],
  accounting_income_amount_not_demonstrated: ['Brut plateforme non comparable', 'Les commissions et frais ne démontrent pas le brut voyageur : contrôler une pièce source comparable à la recette comptable.'],
  platform_tourist_tax_derived_not_demonstrated: ['Taxe de séjour non justifiée séparément', 'Le montant résulte d’une différence arithmétique : contrôler la taxe sur une pièce source avant toute exclusion fiscale.'],
  accounting_entry_year_mismatch: ['Exercice comptable différent', 'L’écriture est datée dans un autre exercice que l’encaissement.'],
  accounting_match_ambiguous: ['Plusieurs écritures candidates', 'Vérifier la référence source avant de retenir une correspondance.'],
  accounting_match_amount_date_booking_only: ['Correspondance non démontrée', 'Date, montant et réservation concordent, mais aucun lien explicite ne prouve l’écriture.'],
  stripe_amount_mismatch: ['Écart de montant Stripe', 'Le montant Stripe et celui du paiement ne concordent pas au centime.'],
  stripe_balance_transaction_ambiguous: ['Plusieurs opérations Stripe candidates', 'Vérifier les identifiants de paiement et les mouvements Stripe.'],
  stripe_balance_transaction_missing: ['Opération Stripe manquante', 'Le justificatif de transaction Stripe n’a pas été rapproché.'],
  direct_cancelled_booking_fiscal_qualification_required: ['Réservation annulée : traitement fiscal à vérifier', 'Le statut annulé ne démontre pas la réalisation du séjour : la taxe de séjour initialement prévue ne peut pas être déduite automatiquement. Vérifier la nature des sommes conservées et les justificatifs.'],
  tourist_tax_cross_year_allocation_unknown: ['Taxe de séjour à ventiler entre exercices', 'Plusieurs années d’encaissement sont concernées : ne pas répartir la taxe sans justificatif.'],
  tourist_tax_snapshot_missing: ['Snapshot de taxe de séjour absent', 'La taxe historique enregistrée avec la réservation doit être contrôlée.'],
  refund_fiscal_effect_requires_versioned_rule: ['Traitement fiscal du remboursement à vérifier', 'Le remboursement ne doit pas être déduit automatiquement des recettes déclarables.'],
  credit_note_missing_for_issued_stay_invoice: ['Avoir manquant', 'Une facture de séjour émise existe, mais aucun avoir correspondant au remboursement n’est lié.'],
  credit_note_amount_mismatch: ['Écart de montant de l’avoir', 'Le montant de l’avoir et celui du remboursement ne concordent pas.'],
  refund_document_link_ambiguous: ['Justificatifs de remboursement ambigus', 'Plusieurs factures ou avoirs pourraient correspondre au remboursement.'],
  invoice_amount_mismatch: ['Écart avec la facture', 'Le montant de la facture ne concorde pas avec celui de l’opération.'],
  issued_invoice_amount_mismatch: ['Écart avec la facture émise', 'Comparer le montant émis à la source financière plateforme.'],
  issued_invoice_ambiguous: ['Plusieurs factures émises', 'Contrôler l’association de la réservation à ses factures.'],
  special_payment_business_link_unverified: ['Lien du paiement complémentaire non confirmé', 'Contrôler que le paiement est bien lié au bon dossier ménage ou supplément et à la réservation correspondante.'],
  special_payment_fiscal_nature_requires_review: ['Nature fiscale du supplément à vérifier', 'Dommages ou autre prestation : le montant est encaissé mais son traitement fiscal n’est pas établi.'],
  special_payment_accounting_link_mismatch: ['Écriture complémentaire mal rattachée', 'La référence métier de l’écriture ne correspond pas au dossier payé.'],
  special_payment_invoice_link_mismatch: ['Facture complémentaire mal rattachée', 'Vérifier la réservation, le type de facture et le dossier ménage ou supplément.'],
  referenced_invoice_missing: ['Facture référencée introuvable', 'Une pièce est indiquée mais ne figure pas parmi les justificatifs chargés.'],
  platform_financial_identity_incomplete: ['Identité financière plateforme incomplète', 'Référence de réservation ou date d’encaissement non démontrée.'],
  platform_fiscal_breakdown_incomplete: ['Ventilation fiscale plateforme incomplète', 'Hébergement, ménage, taxe et total voyageur ne sont pas tous connus.'],
  platform_fiscal_breakdown_mismatch: ['Ventilation plateforme incohérente', 'La somme des postes ne correspond pas exactement au total du voyageur.'],
  fiscal_classification_missing: ['Classement fiscal non établi', 'Le classement applicable à la date du séjour doit être démontré.'],
  classification_transition: ['Changement de classement à contrôler', 'Vérifier la date d’effet du classement, sans appliquer rétroactivement le nouveau régime.'],
  accounting_platform_components_not_demonstrated: ['Postes comptables non démontrés', 'Les éléments de l’import ne permettent pas de confirmer les montants correspondants.'],
});

export function explainReconciliationReasons(reasons = []) {
  return (Array.isArray(reasons) ? reasons : []).map((code) => {
    let pair = RECONCILIATION_REASONS[code];
    if (!pair) {
      const kind = /^accounting_(income|commission|payment_fee)_(missing|ambiguous|amount_mismatch)$/.exec(String(code));
      if (kind) {
        const source = { income: 'recette', commission: 'commission', payment_fee: 'frais de paiement' }[kind[1]];
        pair = kind[2] === 'missing'
          ? [`Écriture de ${source} manquante`, 'Aucune écriture liée ne permet de confirmer ce poste.']
          : kind[2] === 'ambiguous'
            ? [`Écritures de ${source} ambiguës`, 'Plusieurs écritures peuvent correspondre à ce poste.']
            : [`Écart de montant (${source})`, 'Le montant ne concorde pas exactement au centime.'];
      }
    }
    return { code: String(code), label: pair?.[0] || `Motif non traduit : ${code}`,
      description: pair?.[1] || 'Code transmis par le moteur : vérification manuelle nécessaire.' };
  });
}
