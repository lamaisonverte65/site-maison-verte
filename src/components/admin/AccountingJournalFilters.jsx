import { useState } from "react";
import { styles } from "./adminStyles";
import { EMPTY_JOURNAL_FILTERS, journalFilterOptions } from "../../utils/accountingJournalFilters.js";

const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: new Date(2020, index, 1).toLocaleDateString("fr-FR", { month: "long" }),
}));
const SOURCE_NAMES = { manual: "Manuel", booking: "Booking", airbnb: "Airbnb", stripe: "Stripe", other: "Autre" };
const TREATMENTS = { current: "Courant", fixed_asset: "Immobilisation", to_review: "À revoir", non_deductible: "Non déductible" };

export default function AccountingJournalFilters({ tab, year, entries, scope, filters, onChange, count }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const choices = journalFilterOptions(entries, { year, ...scope });
  const active = Object.values(filters).some(Boolean);
  const setField = (field, value) => onChange({ ...filters, [field]: value });
  const inputStyle = { ...styles.input, width: "100%", minWidth: 0 };
  const fieldsId = `lmv-journal-filters-${tab}`;
  return <section className="lmv-accounting-journal-filters" aria-label="Filtres du journal" style={{ ...styles.accountingAssetBox, marginTop: 0 }}>
    <div className="lmv-accounting-filters-heading">
      <h4 style={{ margin: 0 }}>Filtres du journal</h4>
      {active && <button type="button" style={styles.smallButton} onClick={() => onChange({ ...EMPTY_JOURNAL_FILTERS })}>Effacer les filtres</button>}
    </div>
    <label className="lmv-accounting-filter-search" style={styles.label}>Rechercher
      <input type="search" style={inputStyle} placeholder="Libellé, tiers, référence, justificatif…" value={filters.search || ""} onChange={(event) => setField("search", event.target.value)} />
    </label>
    <button type="button" className="lmv-accounting-filters-toggle" aria-controls={fieldsId} aria-expanded={showAdvanced} onClick={() => setShowAdvanced((shown) => !shown)}>{showAdvanced ? "Masquer les filtres" : "Afficher les filtres"}{active && !showAdvanced ? " · filtres actifs" : ""}</button>
    <div id={fieldsId} className={`lmv-accounting-filter-fields${showAdvanced ? " is-expanded" : ""}`}>
      <label style={styles.label}>Mois
        <select style={inputStyle} value={filters.month || ""} onChange={(event) => setField("month", event.target.value)}><option value="">Toute l'année</option>{MONTHS.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}</select>
      </label>
      {tab === "summary" && <label style={styles.label}>Type d'écriture
        <select style={inputStyle} value={filters.entryKind || ""} onChange={(event) => setField("entryKind", event.target.value)}>
          <option value="">Toutes les écritures</option><option value="income">Recettes</option><option value="expense">Dépenses</option><option value="refund">Remboursements</option>
        </select>
      </label>}
      <label style={styles.label}>Domaine
        <select style={inputStyle} value={filters.categoryId || ""} onChange={(event) => setField("categoryId", event.target.value)}><option value="">Tous les domaines</option>{choices.categories.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
      </label>
      <label style={styles.label}>{tab === "income" ? "Client / origine" : "Tiers / fournisseur"}
        <select style={inputStyle} value={filters.counterparty || ""} onChange={(event) => setField("counterparty", event.target.value)}><option value="">Tous les tiers</option>{choices.counterparties.map((value) => <option value={value} key={value}>{value}</option>)}</select>
      </label>
      {tab !== "fees" && <label style={styles.label}>Source
        <select style={inputStyle} value={filters.source || ""} onChange={(event) => setField("source", event.target.value)}><option value="">Toutes les sources</option><option value="automatic">Écritures automatiques</option>{choices.sources.map((value) => <option value={value} key={value}>{SOURCE_NAMES[value] || value}</option>)}</select>
      </label>}
      {tab !== "assets" && <label style={styles.label}>Traitement
        <select style={inputStyle} value={filters.treatment || ""} onChange={(event) => setField("treatment", event.target.value)}><option value="">Tous les traitements</option>{Object.entries(TREATMENTS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
      </label>}
      <label style={styles.label}>Date de début
        <input type="date" style={inputStyle} value={filters.startDate || ""} max={filters.endDate || undefined} onChange={(event) => setField("startDate", event.target.value)} />
      </label>
      <label style={styles.label}>Date de fin
        <input type="date" style={inputStyle} value={filters.endDate || ""} min={filters.startDate || undefined} onChange={(event) => setField("endDate", event.target.value)} />
      </label>
    </div>
    <p className="lmv-accounting-filter-count">{count} écriture{count > 1 ? "s" : ""} affichée{count > 1 ? "s" : ""} sur l'exercice {year}{active ? " · filtres actifs" : ""}.</p>
  </section>;
}
