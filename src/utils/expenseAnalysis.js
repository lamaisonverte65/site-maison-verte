// V4.14 — Analyse du journal des charges existant, sans seconde comptabilité.
// Les remboursements (entry_kind=refund) et la taxe de séjour Aure Louron
// ne sont jamais assimilés à des charges d'exploitation.
const normalized = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const amountCents = (value) => Math.round(Number(value || 0) * 100);

export function filterExpenseEntries(entries, filters = {}) {
  const { year, month = "", categoryId = "", supplier = "", origin = "", search = "", startDate = "", endDate = "" } = filters;
  const needle = normalized(search);
  return (entries || []).filter((entry) => {
    if (entry.entry_kind !== "expense") return false;
    const date = String(entry.entry_date || "");
    if (year && !date.startsWith(`${year}-`)) return false;
    if (month && date.slice(5, 7) !== month) return false;
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    if (categoryId && String(entry.category_id || "") !== categoryId) return false;
    if (supplier && normalized(entry.counterparty) !== normalized(supplier)) return false;
    if (origin === "manual" && entry.source !== "manual") return false;
    if (origin === "automatic" && entry.source === "manual") return false;
    if (needle && ![entry.label, entry.counterparty, entry.accounting_categories?.name, entry.metadata?.receipt_reference]
      .some((field) => normalized(field).includes(needle))) return false;
    return true;
  });
}

export function summarizeExpenses(entries) {
  let totalCents = 0;
  let manualCents = 0;
  let automaticCents = 0;
  const byCategory = new Map();
  const byMonth = new Map();
  for (const entry of entries || []) {
    if (entry.entry_kind !== "expense") continue;
    const cents = amountCents(entry.amount_ttc);
    totalCents += cents;
    if (entry.source === "manual") manualCents += cents;
    else automaticCents += cents;
    const category = entry.accounting_categories?.name || "Sans domaine";
    byCategory.set(category, (byCategory.get(category) || 0) + cents);
    const month = String(entry.entry_date || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) byMonth.set(month, (byMonth.get(month) || 0) + cents);
  }
  const categoryTotals = [...byCategory].map(([label, cents]) => ({ label, cents })).sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label, "fr"));
  const monthTotals = [...byMonth].map(([month, cents]) => ({ month, cents })).sort((a, b) => a.month.localeCompare(b.month));
  return { totalCents, manualCents, automaticCents, count: (entries || []).filter((e) => e.entry_kind === "expense").length, categoryTotals, monthTotals };
}

// Avertissement souple : une même opération peut légitimement être répétée,
// la décision d'enregistrer malgré tout appartient à l'utilisateur.
export function findPotentialDuplicateExpense(entries, draft) {
  if (draft.entry_kind !== "expense") return null;
  const candidateAmount = amountCents(draft.amount_ttc);
  if (!draft.entry_date || !Number.isFinite(candidateAmount) || candidateAmount <= 0) return null;
  return (entries || []).find((entry) => {
    if (entry.entry_kind !== "expense" || entry.id === draft.id) return false;
    if (entry.entry_date !== draft.entry_date || amountCents(entry.amount_ttc) !== candidateAmount) return false;
    if (String(entry.category_id || "") !== String(draft.category_id || "")) return false;
    const supplier = normalized(draft.counterparty);
    if (supplier && normalized(entry.counterparty) === supplier) return true;
    return Boolean(normalized(draft.label)) && normalized(entry.label) === normalized(draft.label);
  }) || null;
}
