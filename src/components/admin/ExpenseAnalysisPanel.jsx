import { useMemo, useState } from "react";
import { styles } from "./adminStyles";
import { filterExpenseEntries, summarizeExpenses } from "../../utils/expenseAnalysis.js";

const currency = (cents) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export default function ExpenseAnalysisPanel({ entries, categories, year, renderTable, onAddCategory, onNewExpense }) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({ month: "", categoryId: "", supplier: "", origin: "", search: "", startDate: "", endDate: "" });
  const setFilter = (key, value) => setFilters((previous) => ({ ...previous, [key]: value }));
  const expenses = useMemo(() => filterExpenseEntries(entries, { ...filters, year }), [entries, filters, year]);
  const totals = useMemo(() => summarizeExpenses(expenses), [expenses]);
  const yearExpenses = useMemo(() => filterExpenseEntries(entries, { year }), [entries, year]);
  const suppliers = useMemo(() => [...new Set(yearExpenses.map((entry) => String(entry.counterparty || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [yearExpenses]);
  const activeFilters = Object.values(filters).some(Boolean);
  const expenseCategories = categories.filter((c) => c.entry_kind === "expense");
  const fieldStyle = { ...styles.input, width: "100%", minWidth: 0 };
  return <section style={{ display: "grid", gap: 18, minWidth: 0 }}>
    <div className="lmv-expenses-header" style={styles.panelHeader}>
      <div><h3 style={{ margin: 0 }}>Dépenses {year}</h3><p style={styles.muted}>Journal unique : frais manuels et frais automatiques Booking, Airbnb et Stripe.</p></div>
      <div className="lmv-expenses-actions" style={styles.contactButtons}>
        <button type="button" style={styles.smallButton} onClick={onAddCategory}>+ Ajouter un domaine</button>
        <button type="button" style={styles.addButton} onClick={onNewExpense}>+ Ajouter une dépense</button>
      </div>
    </div>
    <div className="lmv-expenses-filters" style={{ ...styles.accountingAssetBox, marginTop: 0 }}>
      <div className="lmv-expense-filters-title"><h4 style={{ margin: 0 }}>Filtres du journal</h4>{activeFilters && <button type="button" style={styles.smallButton} onClick={() => setFilters({ month: "", categoryId: "", supplier: "", origin: "", search: "", startDate: "", endDate: "" })}>Effacer les filtres</button>}</div>
      <label className="lmv-expense-search" style={styles.label}>Rechercher<input type="search" style={fieldStyle} placeholder="Libellé, fournisseur, justificatif…" value={filters.search} onChange={(event) => setFilter("search", event.target.value)} /></label>
      <button type="button" className="lmv-expense-filters-toggle" aria-controls="lmv-expense-advanced-filters" aria-expanded={showAdvancedFilters} onClick={() => setShowAdvancedFilters((current) => !current)}>{showAdvancedFilters ? "Masquer les filtres" : "Afficher les filtres"}{activeFilters && !showAdvancedFilters ? " · filtres actifs" : ""}</button>
      <div id="lmv-expense-advanced-filters" className={`lmv-expense-filter-fields${showAdvancedFilters ? " is-expanded" : ""}`}>

        <label style={styles.label}>Mois<select style={fieldStyle} value={filters.month} onChange={(event) => setFilter("month", event.target.value)}><option value="">Toute l'année</option>{Array.from({ length: 12 }, (_, i) => { const month = String(i + 1).padStart(2, "0"); return <option key={month} value={month}>{new Date(2020, i, 1).toLocaleDateString("fr-FR", { month: "long" })}</option>; })}</select></label>
        <label style={styles.label}>Catégorie<select style={fieldStyle} value={filters.categoryId} onChange={(event) => setFilter("categoryId", event.target.value)}><option value="">Toutes les catégories</option>{expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label style={styles.label}>Fournisseur<select style={fieldStyle} value={filters.supplier} onChange={(event) => setFilter("supplier", event.target.value)}><option value="">Tous les fournisseurs</option>{suppliers.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label style={styles.label}>Origine<select style={fieldStyle} value={filters.origin} onChange={(event) => setFilter("origin", event.target.value)}><option value="">Toutes les origines</option><option value="manual">Saisies manuelles</option><option value="automatic">Écritures automatiques</option></select></label>
        <label style={styles.label}>Date de début<input type="date" style={fieldStyle} value={filters.startDate} onChange={(event) => setFilter("startDate", event.target.value)} /></label>
        <label style={styles.label}>Date de fin<input type="date" style={fieldStyle} min={filters.startDate || undefined} value={filters.endDate} onChange={(event) => setFilter("endDate", event.target.value)} /></label>
      </div>
    </div>
    <div className="lmv-expense-summary" style={styles.homeFinanceGrid}>
      <div style={styles.accountingStat}><span>Dépenses affichées</span><strong>{currency(totals.totalCents)}</strong><small>{totals.count} écriture{totals.count > 1 ? "s" : ""}</small></div>
      <div style={styles.accountingStat}><span>Frais manuels</span><strong>{currency(totals.manualCents)}</strong></div>
      <div style={styles.accountingStat}><span>Frais automatiques</span><strong>{currency(totals.automaticCents)}</strong></div>
    </div>
    <p style={{ ...styles.muted, margin: 0 }}>Les totaux reflètent les filtres sélectionnés, immobilisations comprises. Ils ne représentent pas des charges fiscalement déductibles. Les remboursements clients et reversements de taxe de séjour ne sont pas inclus.</p>
    <div className="lmv-expense-breakdowns">
      <div className="lmv-expense-breakdown"><h4>Répartition par catégorie</h4><div className="lmv-expense-breakdown-list">
        {totals.categoryTotals.map(({ label, cents }) => <div className="lmv-expense-breakdown-row" key={label}><span>{label}</span><strong>{currency(cents)}</strong></div>)}
        {!totals.categoryTotals.length && <p className="lmv-expense-breakdown-empty">Aucune dépense.</p>}
      </div></div>
      <div className="lmv-expense-breakdown"><h4>Répartition par mois</h4><div className="lmv-expense-breakdown-list">
        {totals.monthTotals.map(({ month, cents }) => <div className="lmv-expense-breakdown-row" key={month}><span>{new Date(`${month}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span><strong>{currency(cents)}</strong></div>)}
        {!totals.monthTotals.length && <p className="lmv-expense-breakdown-empty">Aucune dépense.</p>}
      </div></div>
    </div>
    <div className="lmv-expense-journal"><h4>Écritures détaillées ({totals.count})</h4>{renderTable(expenses, { showReceiptReference: true, responsiveCards: true })}</div>
  </section>;
}
