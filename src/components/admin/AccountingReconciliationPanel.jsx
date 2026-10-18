import { useMemo, useState } from "react";
import {
  DEFAULT_RECONCILIATION_FILTERS,
  filterReconciliationRows,
  sortReconciliationRows,
  summarizeVisibleReconciliationRows,
} from "../../utils/accountingReconciliationView";
import "./accountingReconciliation.css";

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const cents = (value) => Number.isSafeInteger(value) ? euro.format(value / 100) : "—";
const statusText = {
  coherent: "Cohérent", manquant: "Manquant", a_verifier: "À vérifier", non_applicable: "Sans objet",
};
const sourceText = { direct: "Direct", booking: "Booking", airbnb: "Airbnb", manual: "Manuel", stripe: "Stripe", other: "Autre" };
const typeText = {
  receipt: "Encaissement", refund: "Remboursement", expense: "Dépense",
  income: "Recette comptable", additional_charge: "Supplément",
  post_stay_cleaning: "Ménage après séjour",
};
const categoryText = {
  tourist_furnished_classified: "Meublé classé", tourist_furnished_unclassified: "Meublé non classé",
};
const readable = (map, value) => map[value] || value || "Non renseigné";
const choices = (rows, field) => [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));

function State({ value }) {
  return <span className={`lmv-reconciliation-state lmv-reconciliation-state--${value || 'unknown'}`}>
    {readable(statusText, value)}
  </span>;
}

function Stat({ label, value, description }) {
  return <div className="lmv-reconciliation-stat"><span>{label}</span><strong>{value}</strong>{description && <small>{description}</small>}</div>;
}

function MoneyDisplay({ value }) {
  return <span className={Number.isSafeInteger(value) && value < 0 ? "lmv-reconciliation-negative" : undefined}>{cents(value)}</span>;
}

function CompactRow({ row }) {
  return <article className="lmv-reconciliation-mobile-card" key={row.id}>
    <div className="lmv-reconciliation-card-header"><div><strong>{readable(sourceText, row.source)} · {readable(typeText, row.type)}</strong><small>{row.date || "Date inconnue"}</small></div><State value={row.status} /></div>
    <div className="lmv-reconciliation-mobile-fields">
      <span>Référence</span><span title={row.externalReference || row.bookingRequestId || ""}>{row.externalReference || row.bookingRequestId || "—"}</span>
      <span>Brut connu</span><strong><MoneyDisplay value={row.grossKnownCents} /></strong>
      <span>Net connu</span><strong><MoneyDisplay value={row.netCents} /></strong>
      <span>Taxe de séjour</span><MoneyDisplay value={row.touristTaxCents} />
      <span>Commissions</span><MoneyDisplay value={row.commissionCents} />
      <span>Frais de paiement</span><MoneyDisplay value={row.paymentFeeCents} />
      <span>Comptabilité</span><State value={row.accountingStatus} />
      <span>Fiscal</span><State value={row.fiscalStatus} />
    </div>
  </article>;
}

export default function AccountingReconciliationPanel({ year, reconciliation }) {
  const rows = reconciliation?.rows || [];
  const annual = reconciliation?.accountingSummary || {};
  const [filters, setFilters] = useState(DEFAULT_RECONCILIATION_FILTERS);
  const [sort, setSort] = useState("priority_date");
  const filtered = useMemo(() => filterReconciliationRows(rows, filters), [rows, filters]);
  const ordered = useMemo(() => sortReconciliationRows(filtered, sort), [filtered, sort]);
  const totals = useMemo(() => summarizeVisibleReconciliationRows(filtered, rows), [filtered, rows]);
  const updateFilter = (key, value) => setFilters((previous) => ({ ...previous, [key]: value }));
  const uniqueSources = useMemo(() => choices(rows, "source"), [rows]);
  const uniqueTypes = useMemo(() => choices(rows, "type"), [rows]);
  const uniqueCategories = useMemo(() => choices(rows, "fiscalCategory"), [rows]);
  const hasUnknownCategory = rows.some((row) => !row.fiscalCategory);

  return <section className="lmv-reconciliation" aria-label={`Rapprochement ${year}`}>
    <header className="lmv-reconciliation-header">
      <div><h3>Rapprochement {year}</h3><p>Vue calculée en lecture seule : aucune écriture, facture ou réservation n'est modifiée.</p></div>
    </header>

    <h4>Exercice complet</h4>
    <div className="lmv-reconciliation-stats" aria-label="Totaux de l'exercice">
      <Stat label="Opérations" value={annual.rowCount ?? rows.length} />
      <Stat label="Recettes connues" value={cents(annual.receiptsCents)} />
      <Stat label="À vérifier" value={annual.statuses?.a_verifier ?? 0} />
      <Stat label="Manquants" value={annual.statuses?.manquant ?? 0} />
    </div>

    <div className="lmv-reconciliation-controls">
      <h4>Filtres cumulables</h4>
      <div className="lmv-reconciliation-filters">
        <label>Afficher
          <select value={filters.scope} onChange={(event) => updateFilter("scope", event.target.value)}>
            <option value="all">Toutes les opérations</option>
            <option value="coherent">Cohérents uniquement</option>
            <option value="anomalies">Anomalies uniquement</option>
            <option value="ready">Prêts pour déclaration</option>
          </select>
        </label>
        <label>Source
          <select value={filters.source} onChange={(event) => updateFilter("source", event.target.value)}>
            <option value="all">Toutes les sources</option>
            {uniqueSources.map((source) => <option key={source} value={source}>{readable(sourceText, source)}</option>)}
          </select>
        </label>
        <label>Type d'opération
          <select value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}>
            <option value="all">Tous les types</option>
            {uniqueTypes.map((type) => <option key={type} value={type}>{readable(typeText, type)}</option>)}
          </select>
        </label>
        <label>État global
          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
            <option value="all">Tous les états</option>
            <option value="a_verifier">À vérifier</option>
            <option value="manquant">Manquant</option>
            <option value="coherent">Cohérent</option>
          </select>
        </label>
        <label>Catégorie fiscale
          <select value={filters.fiscalCategory} onChange={(event) => updateFilter("fiscalCategory", event.target.value)}>
            <option value="all">Toutes les catégories</option>
            {uniqueCategories.map((category) => <option key={category} value={category}>{readable(categoryText, category)}</option>)}
            {hasUnknownCategory && <option value="unknown">Non déterminée</option>}
          </select>
        </label>
        <label>Recherche (référence, réservation, motif)
          <input type="search" value={filters.query} placeholder="Référence, identifiant, motif…" onChange={(event) => updateFilter("query", event.target.value)} />
        </label>
        <label>Tri
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="priority_date">Anomalies en premier, date décroissante</option>
            <option value="date_desc">Date décroissante</option>
            <option value="date_asc">Date croissante</option>
            <option value="amount_desc">Brut décroissant</option>
            <option value="amount_asc">Brut croissant</option>
            <option value="fiscal_desc">Montant fiscal décroissant</option>
            <option value="source">Source A → Z</option>
          </select>
        </label>
        <div className="lmv-reconciliation-reset"><button type="button" onClick={() => { setFilters({ ...DEFAULT_RECONCILIATION_FILTERS }); setSort("priority_date"); }}>Réinitialiser les filtres</button></div>
      </div>
    </div>

    <h4>Sélection filtrée <span className="lmv-reconciliation-muted">({totals.rowCount} / {rows.length} lignes)</span></h4>
    <div className="lmv-reconciliation-stats" aria-live="polite" aria-label="Totaux des opérations filtrées">
      <Stat label="Recettes connues" value={cents(totals.receiptsCents)} />
      <Stat label="Remboursements" value={cents(totals.refundsCents)} />
      <Stat label="Dépenses" value={cents(totals.expensesCents)} />
      <Stat label="Commissions" value={cents(totals.commissionsCents)} />
      <Stat label="Frais de paiement" value={cents(totals.paymentFeesCents)} />
      <Stat label="Taxe identifiée" value={cents(totals.touristTaxCents)} />
      <Stat label="Net connu (gestion)" value={cents(totals.economicNetCents)} />
      <Stat label="Montant fiscal démontré" value={cents(totals.fiscalValidatedCents)} description="Sous-ensemble visible, non déduit des frais" />
      <Stat label="Recettes à contrôler" value={cents(totals.fiscalPendingKnownReceiptsCents)} description="Brut connu, montant fiscal non validé" />
      <Stat label="Remboursements à contrôler" value={cents(totals.fiscalPendingKnownRefundsCents)} description="Conservés séparément, sans compensation fiscale automatique" />
    </div>
    <p className="lmv-reconciliation-note">Les commissions et frais sont indiqués pour la gestion ; ils ne réduisent pas le brut micro-BIC. Ces sommes sont les <strong>totaux des lignes filtrées</strong>, pas la déclaration annuelle.</p>
    {(totals.unknownGrossCount > 0 || totals.unknownNetCount > 0 || totals.unknownTouristTaxCount > 0 || totals.fiscalUnknownCount > 0) &&
      <p className="lmv-reconciliation-warning">Montants inconnus (non assimilés à zéro) : {totals.unknownGrossCount} brut(s), {totals.unknownNetCount} net(s), {totals.unknownTouristTaxCount} taxe(s), {totals.fiscalUnknownCount} montant(s) en attente de contrôle fiscal.</p>}
    {totals.fiscalIncompleteGroupCount > 0 &&
      <p className="lmv-reconciliation-warning">{totals.fiscalIncompleteGroupCount} réservation(s) payée(s) en plusieurs fois ne sont que partiellement visibles : leur montant fiscal n'est pas inclus dans le total démontré.</p>}

    {ordered.length === 0 ? <p className="lmv-reconciliation-empty">Aucune opération ne correspond aux filtres.</p> : <>
      <div className="lmv-reconciliation-table" role="region" aria-label="Tableau des opérations rapprochées" tabIndex={0}>
        <table><thead><tr>
          <th>Date</th><th>Source</th><th>Type</th><th>Réservation / référence</th>
          <th className="lmv-reconciliation-number">Brut connu</th><th className="lmv-reconciliation-number">Taxe séjour</th>
          <th className="lmv-reconciliation-number">Commissions</th><th className="lmv-reconciliation-number">Frais paiement</th><th className="lmv-reconciliation-number">Net connu</th>
          <th>Financier</th><th>Comptable</th><th>Documentaire</th><th>Fiscal</th><th>État global</th>
        </tr></thead><tbody>
          {ordered.map((row) => <tr key={row.id}>
            <td>{row.date || "—"}</td>
            <td>{readable(sourceText, row.source)}</td>
            <td>{readable(typeText, row.type)}</td>
            <td className="lmv-reconciliation-reference" title={row.externalReference || row.bookingRequestId || ""}>{row.externalReference || row.bookingRequestId || "—"}</td>
            <td className="lmv-reconciliation-number"><MoneyDisplay value={row.grossKnownCents} /></td>
            <td className="lmv-reconciliation-number"><MoneyDisplay value={row.touristTaxCents} /></td>
            <td className="lmv-reconciliation-number"><MoneyDisplay value={row.commissionCents} /></td>
            <td className="lmv-reconciliation-number"><MoneyDisplay value={row.paymentFeeCents} /></td>
            <td className="lmv-reconciliation-number"><MoneyDisplay value={row.netCents} /></td>
            <td><State value={row.financialStatus} /></td>
            <td><State value={row.accountingStatus} /></td>
            <td><State value={row.documentStatus} /></td>
            <td><State value={row.fiscalStatus} /></td>
            <td><State value={row.status} /></td>
          </tr>)}
        </tbody></table>
      </div>
      <div className="lmv-reconciliation-mobile-list" aria-label="Opérations rapprochées format mobile">{ordered.map((row) => <CompactRow key={row.id} row={row} />)}</div>
    </>}
  </section>;
}
