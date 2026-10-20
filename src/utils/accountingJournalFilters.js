// V4.14 — Filtrage local du journal existant : aucune écriture ni RPC.
// Le périmètre de l'onglet (recette, remboursement, frais manuel, immobilisation)
// est une contrainte indépendante des filtres saisis par l'utilisateur.
export const EMPTY_JOURNAL_FILTERS = Object.freeze({
  search: "", month: "", categoryId: "", counterparty: "", source: "",
  entryKind: "", treatment: "", startDate: "", endDate: "",
});

const normalized = (value) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export const JOURNAL_TAB_SCOPES = Object.freeze({
  summary: {},
  income: { kind: "income" },
  refund: { kind: "refund" },
  fees: { kind: "expense", manualOnly: true },
  assets: { kind: "expense", fixedAssetsOnly: true },
});

export function filterAccountingJournalEntries(entries, options = {}) {
  const {
    year, kind, manualOnly = false, fixedAssetsOnly = false,
    search = "", month = "", categoryId = "", counterparty = "", source = "",
    entryKind = "", treatment = "", startDate = "", endDate = "",
  } = options;
  const needle = normalized(search);
  return (entries || []).filter((entry) => {
    const date = String(entry.entry_date || "");
    if (year && !date.startsWith(`${year}-`)) return false;
    if (kind && entry.entry_kind !== kind) return false;
    if (manualOnly && entry.source !== "manual") return false;
    if (fixedAssetsOnly && (entry.entry_kind !== "expense" || entry.treatment !== "fixed_asset")) return false;
    if (entryKind && entry.entry_kind !== entryKind) return false;
    if (month && date.slice(5, 7) !== month) return false;
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    if (categoryId && String(entry.category_id || "") !== String(categoryId)) return false;
    if (counterparty && normalized(entry.counterparty) !== normalized(counterparty)) return false;
    if (source === "automatic" && entry.source === "manual") return false;
    if (source && source !== "automatic" && entry.source !== source) return false;
    if (treatment && entry.treatment !== treatment) return false;
    if (needle && ![
      entry.label, entry.counterparty, entry.accounting_categories?.name,
      entry.metadata?.receipt_reference, entry.metadata?.receipt_origin,
      entry.payment_method, entry.notes, entry.source_record_key,
    ].some((value) => normalized(value).includes(needle))) return false;
    return true;
  });
}

export function journalFilterOptions(entries, { year, ...scope } = {}) {
  const scopeEntries = filterAccountingJournalEntries(entries, { year, ...scope });
  const categories = new Map();
  const counterparties = new Set();
  const sources = new Set();
  for (const entry of scopeEntries) {
    if (entry.category_id) categories.set(String(entry.category_id), entry.accounting_categories?.name || "Sans domaine");
    if (String(entry.counterparty || "").trim()) counterparties.add(String(entry.counterparty).trim());
    if (entry.source) sources.add(String(entry.source));
  }
  return {
    categories: [...categories].sort((a, b) => a[1].localeCompare(b[1], "fr")),
    counterparties: [...counterparties].sort((a, b) => a.localeCompare(b, "fr")),
    sources: [...sources].sort((a, b) => a.localeCompare(b, "fr")),
  };
}
