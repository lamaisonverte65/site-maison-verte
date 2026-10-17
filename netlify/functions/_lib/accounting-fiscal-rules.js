const CATEGORIES = Object.freeze({
  UNCLASSIFIED: "tourist_furnished_unclassified",
  CLASSIFIED: "tourist_furnished_classified",
});

const CLASSIFIED_VALUES = new Set(["1_star", "2_star", "3_star", "4_star", "5_star"]);

// Official French income-tax mappings for LMNP micro-BIC tourist furnished rentals.
// 2025 income / 2026 declaration: impots.gouv.fr 2042-C-PRO and official guidance.
// 2026 income: tax regime is known, but 2027 declaration box numbers are not yet published.
const FISCAL_RULES = Object.freeze({
  2025: Object.freeze({
    [CATEGORIES.UNCLASSIFIED]: Object.freeze({
      incomeYear: 2025,
      declarationYear: 2026,
      form: "2042-C-PRO",
      boxes: Object.freeze({ 1: "5NH", 2: "5OH" }),
      abatementRate: 0.30,
      microThresholdCents: 1_500_000,
      ruleStatus: "confirmed",
    }),
    [CATEGORIES.CLASSIFIED]: Object.freeze({
      incomeYear: 2025,
      declarationYear: 2026,
      form: "2042-C-PRO",
      boxes: Object.freeze({ 1: "5NG", 2: "5OG" }),
      abatementRate: 0.50,
      microThresholdCents: 7_770_000,
      ruleStatus: "confirmed",
    }),
  }),
  2026: Object.freeze({
    [CATEGORIES.UNCLASSIFIED]: Object.freeze({
      incomeYear: 2026,
      declarationYear: 2027,
      form: "2042-C-PRO",
      boxes: Object.freeze({ 1: null, 2: null }),
      abatementRate: 0.30,
      microThresholdCents: 1_500_000,
      ruleStatus: "form_pending",
    }),
    [CATEGORIES.CLASSIFIED]: Object.freeze({
      incomeYear: 2026,
      declarationYear: 2027,
      form: "2042-C-PRO",
      boxes: Object.freeze({ 1: null, 2: null }),
      abatementRate: 0.50,
      microThresholdCents: 8_360_000,
      ruleStatus: "form_pending",
    }),
  }),
});

function normalizeDeclarant(value) {
  const declarant = Number(value);
  if (declarant !== 1 && declarant !== 2) throw new Error("Déclarant fiscal invalide.");
  return declarant;
}

function integerCents(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function getFiscalRule(incomeYear, category, declarant = 2) {
  const year = Number(incomeYear);
  const person = normalizeDeclarant(declarant);
  const rule = FISCAL_RULES[year]?.[category];
  if (!rule) return null;
  return {
    incomeYear: rule.incomeYear,
    declarationYear: rule.declarationYear,
    form: rule.form,
    box: rule.boxes[person] ?? null,
    abatementRate: rule.abatementRate,
    microThresholdCents: rule.microThresholdCents,
    ruleStatus: rule.ruleStatus,
    category,
  };
}

export function classifyFiscalOperation(operation = {}, context = {}) {
  if (context.classificationStatus === "ambiguous" || context.classificationTransition === true) {
    return {
      fiscalCategory: null,
      fiscalStatus: "a_verifier",
      reason: "classification_transition",
    };
  }

  const explicitCategory = context.fiscalCategory || operation.fiscalCategory || null;
  if (explicitCategory === CATEGORIES.UNCLASSIFIED || explicitCategory === CATEGORIES.CLASSIFIED) {
    return { fiscalCategory: explicitCategory, fiscalStatus: "coherent", reason: null };
  }

  const classification = String(context.classification || "").trim();
  if (classification === "unclassified") {
    return { fiscalCategory: CATEGORIES.UNCLASSIFIED, fiscalStatus: "coherent", reason: null };
  }
  if (CLASSIFIED_VALUES.has(classification)) {
    return { fiscalCategory: CATEGORIES.CLASSIFIED, fiscalStatus: "coherent", reason: null };
  }

  return {
    fiscalCategory: null,
    fiscalStatus: "a_verifier",
    reason: "fiscal_classification_missing",
  };
}

export function buildFiscalSummary(rows = [], incomeYear, declarant = 2) {
  const year = Number(incomeYear);
  const grouped = new Map();
  let pendingKnownGrossAmountCents = 0;
  let pendingRows = 0;

  for (const row of rows || []) {
    const fiscalGross = integerCents(row?.fiscalGrossAmountCents);
    const eligible = row?.status === "coherent"
      && row?.fiscalStatus === "coherent"
      && fiscalGross !== null
      && Boolean(row?.fiscalCategory);
    const rule = eligible ? getFiscalRule(year, row.fiscalCategory, declarant) : null;

    if (!eligible || !rule) {
      pendingRows += 1;
      pendingKnownGrossAmountCents += integerCents(row?.grossKnownCents) ?? 0;
      continue;
    }

    const current = grouped.get(row.fiscalCategory) || {
      ...rule,
      grossAmountCents: 0,
      rowCount: 0,
    };
    current.grossAmountCents += fiscalGross;
    current.rowCount += 1;
    grouped.set(row.fiscalCategory, current);
  }

  const categories = [...grouped.values()].sort((a, b) => a.category.localeCompare(b.category));
  return {
    incomeYear: year,
    declarant: normalizeDeclarant(declarant),
    categories,
    totalGrossAmountCents: categories.reduce((sum, item) => sum + item.grossAmountCents, 0),
    pendingKnownGrossAmountCents,
    pendingRows,
  };
}

export { CATEGORIES as FISCAL_CATEGORIES };
