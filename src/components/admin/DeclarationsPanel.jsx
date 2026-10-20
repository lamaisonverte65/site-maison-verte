import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { styles } from "./adminStyles";
import {
  accountingYearSummary,
  createAccountingCategory,
  createManualAccountingEntry,
  deleteManualAccountingEntry,
  fetchAccountingData,
  updateManualAccountingEntry,
  saveAccountingImportSnapshot,
  saveExternalReservationFinancials,
  sha256File,
} from "../../services/accountingService";
import {
  bookingStatementToEntries,
  matchBookingStatementReservations,
  parseBookingStatement,
} from "../../utils/bookingStatementImport";
import { airbnbStatementToEntries, detectAccountingImportFormat, importExerciseYear, parseAirbnbReservations, parseAirbnbStatement } from "../../utils/accountingImport";
import { matchBookingOverviewReservations, parseBookingOverview } from "../../utils/bookingOverviewImport";
import { airbnbReservationsToFinancialRows, airbnbStatementToFinancialRows, bookingOverviewToFinancialRows, bookingStatementToFinancialRows } from "../../utils/externalReservationFinancialImport";
import {
  fetchTouristTaxDeclaration,
  fetchTouristTaxRemittances,
  saveTouristTaxRemittance,
  voidTouristTaxRemittance,
} from "../../services/touristTaxDeclarationService";
import { fetchAccountingReconciliation } from "../../services/accountingReconciliationService";
import { fetchPlatformFinancialRegistry } from "../../services/accountingImportHistoryService.js";
import AccountingImportHistory from "./AccountingImportHistory";
import AccountingImportGuide from "./AccountingImportGuide";
import DirectStripeAccountingImport from "./DirectStripeAccountingImport.jsx";
import ReconciliationTableView from "./AccountingReconciliationPanel";
import ExpenseAnalysisPanel from "./ExpenseAnalysisPanel.jsx";
import AccountingJournalFilters from "./AccountingJournalFilters.jsx";
import { EMPTY_JOURNAL_FILTERS, JOURNAL_TAB_SCOPES, filterAccountingJournalEntries } from "../../utils/accountingJournalFilters.js";
import "./declarationsV414Responsive.css";
import { findPotentialDuplicateExpense } from "../../utils/expenseAnalysis.js";

const SUBTABS = [
  ["summary", "Synthèse"], ["income", "Recettes"], ["refund", "Remboursements"], ["fees", "Frais"], ["expense", "Dépenses"],
  ["assets", "Immobilisations"], ["imports", "Imports"], ["reconciliation", "Rapprochement"], ["tax", "Taxe de séjour"],
];
const money = (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const TREATMENT_LABELS = { current: "Courant", fixed_asset: "Immobilisation", to_review: "À revoir", non_deductible: "Non déductible" };
const SOURCE_LABELS = { manual: "Manuel", booking: "Booking", airbnb: "Airbnb", stripe: "Stripe", other: "Autre" };
const emptyForm = (kind = "expense") => ({
  id: null, entry_date: today(), entry_kind: kind, category_id: "", label: "", counterparty: "", receipt_reference: "",
  amount_ttc: "", treatment: "current", payment_method: "", notes: "", asset_category: "",
  in_service_date: today(), acquisition_value: "", depreciation_method: "", depreciation_duration_months: "",
  residual_value: "0", asset_notes: "", receipt_origin: "Direct",
});

function EntryModal({ form, categories, onChange, onClose, onSave, inline = false, saving = false }) {
  const relevant = categories.filter((category) => category.entry_kind === form.entry_kind && category.is_active !== false);
  return <div style={inline ? { minWidth: 0 } : styles.modalOverlay}><form className={inline ? "lmv-fee-form" : undefined} style={inline ? { ...styles.modal, maxWidth: "100%", maxHeight: "none", overflow: "visible", boxShadow: "none", border: "1px solid #e5e7eb", borderRadius: 18 } : styles.modal} onSubmit={onSave}>
    <div style={styles.modalHeader}><h2 style={{ margin: 0 }}>{inline ? "Enregistrer un frais payé" : form.id ? "Modifier l'écriture" : form.entry_kind === "income" ? "Ajouter une recette" : "Ajouter une dépense"}</h2>{!inline && <button type="button" style={styles.closeButton} onClick={onClose}>×</button>}</div>
    {inline && <p style={styles.muted}>Uniquement les dépenses réellement réglées. Les factures et justificatifs restent classés sur ton PC, avec sauvegarde pCloud.</p>}
    <div className={inline ? "lmv-fee-form-fields" : undefined} style={inline ? undefined : styles.accountingFormGrid}>
      <label className={inline ? "lmv-fee-field lmv-fee-date" : undefined} style={styles.label}>{form.entry_kind === "expense" ? "Date réelle du paiement" : "Date"}<input style={styles.input} type="date" max={inline && form.entry_kind === "expense" ? today() : undefined} value={form.entry_date} onChange={(e) => onChange("entry_date", e.target.value)} required /></label>
      <label className={inline ? "lmv-fee-field lmv-fee-domain" : undefined} style={styles.label}>Domaine<select style={styles.input} value={form.category_id} onChange={(e) => onChange("category_id", e.target.value)} required={inline}><option value="">Sans domaine</option>{relevant.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className={inline ? "lmv-fee-field lmv-fee-label" : undefined} style={styles.label}>Libellé<input style={styles.input} value={form.label} onChange={(e) => onChange("label", e.target.value)} required /></label>
      <label className={inline ? "lmv-fee-field lmv-fee-supplier" : undefined} style={styles.label}>{form.entry_kind === "income" ? "Client / origine" : "Fournisseur"}<input style={styles.input} value={form.counterparty} onChange={(e) => onChange("counterparty", e.target.value)} /></label>
      <label className={inline ? "lmv-fee-field lmv-fee-amount" : undefined} style={styles.label}>Montant TTC (€)<input style={styles.input} type="number" min="0" step="0.01" value={form.amount_ttc} onChange={(e) => onChange("amount_ttc", e.target.value)} required /></label>
      {form.entry_kind === "income" && <label style={styles.label}>Origine de l’encaissement<input style={styles.input} value={form.receipt_origin || ""} onChange={(e) => onChange("receipt_origin", e.target.value)} placeholder="Direct, Airbnb, Clévacances, Autre…" /></label>}
      {form.entry_kind === "expense" && <label className={inline ? "lmv-fee-field lmv-fee-receipt" : undefined} style={styles.label}>Référence du justificatif (facultatif)<input style={styles.input} maxLength={250} value={form.receipt_reference || ""} onChange={(e) => onChange("receipt_reference", e.target.value)} placeholder="2026-10_EDF.pdf (sur le PC)" /></label>}
      <label className={inline ? "lmv-fee-field lmv-fee-payment" : undefined} style={styles.label}>Mode de paiement<input style={styles.input} value={form.payment_method} onChange={(e) => onChange("payment_method", e.target.value)} placeholder="Carte, virement, espèces…" /></label>
      <label className={inline ? "lmv-fee-field lmv-fee-treatment" : undefined} style={styles.label}>Traitement<select style={styles.input} value={form.treatment} onChange={(e) => onChange("treatment", e.target.value)}><option value="current">{form.entry_kind === "income" ? "Recette courante" : "Charge courante"}</option>{form.entry_kind === "expense" && <option value="fixed_asset">Immobilisation</option>}<option value="to_review">À revoir</option><option value="non_deductible">Non déductible</option></select></label>
    </div>
    {form.treatment === "fixed_asset" && <div style={styles.accountingAssetBox}>
      <h3 style={{ marginTop: 0 }}>Fiche immobilisation</h3><p style={styles.muted}>La méthode et la durée restent facultatives : aucun traitement fiscal n'est imposé à ce stade.</p>
      <div style={styles.accountingFormGrid}>
        <label style={styles.label}>Catégorie d'actif<input style={styles.input} value={form.asset_category} onChange={(e) => onChange("asset_category", e.target.value)} /></label>
        <label style={styles.label}>Mise en service<input style={styles.input} type="date" value={form.in_service_date} onChange={(e) => onChange("in_service_date", e.target.value)} /></label>
        <label style={styles.label}>Valeur d'acquisition (€)<input style={styles.input} type="number" min="0" step="0.01" value={form.acquisition_value || form.amount_ttc} onChange={(e) => onChange("acquisition_value", e.target.value)} /></label>
        <label style={styles.label}>Méthode<select style={styles.input} value={form.depreciation_method} onChange={(e) => onChange("depreciation_method", e.target.value)}><option value="">Non définie</option><option value="straight_line">Linéaire</option></select></label>
        <label style={styles.label}>Durée (mois)<input style={styles.input} type="number" min="1" value={form.depreciation_duration_months} onChange={(e) => onChange("depreciation_duration_months", e.target.value)} /></label>
        <label style={styles.label}>Valeur résiduelle (€)<input style={styles.input} type="number" min="0" step="0.01" value={form.residual_value} onChange={(e) => onChange("residual_value", e.target.value)} /></label>
      </div>
    </div>}
    <label className={inline ? "lmv-fee-notes" : undefined} style={styles.label}>Notes<textarea style={{ ...styles.input, minHeight: 80 }} value={form.notes} onChange={(e) => onChange("notes", e.target.value)} /></label>
    <div style={styles.modalActions}>{!inline && <button type="button" style={styles.smallButton} onClick={onClose} disabled={saving}>Annuler</button>}<button type="submit" className={inline ? "lmv-fee-save" : undefined} style={styles.addButton} disabled={saving}>{saving ? "Enregistrement…" : inline ? "Enregistrer le frais" : "Enregistrer"}</button></div>
  </form></div>;
}


function BookingImportPanel({ data, year, preview, importing, onFile, onCancel, onValidate }) {
  const statement = preview?.statement;
  const newRows = statement?.items || [];
  const yearBatchIds = new Set(data.entries.filter((entry) => String(entry.entry_date || "").startsWith(`${year}-`) && entry.import_batch_id).map((entry) => entry.import_batch_id));
  const yearBatches = data.importBatches.filter((batch) => yearBatchIds.has(batch.id));
  return <div style={{ display: "grid", gap: 16, minWidth: 0, maxWidth: "100%" }}>
    <div style={styles.panelHeader}><div><h3 style={{ margin: 0 }}>Imports</h3><p style={styles.muted}>{yearBatches.length} lot{yearBatches.length > 1 ? "s" : ""} avec des écritures encaissées en {year}. L'import ne modifie ni ne recrée les réservations.</p></div>
      <div style={styles.contactButtons}><button style={styles.smallButton} onClick={() => window.dispatchEvent(new CustomEvent("lmv:add-manual-receipt"))}>+ Encaissement manuel</button><label style={styles.addButton}>Importer un fichier<input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
    </div>
    <AccountingImportGuide />
    {statement && preview.externalFinancialOnly && <div style={{ ...styles.accountingAssetBox, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
      <div style={styles.panelHeader}><div><h3 style={{ margin: 0 }}>Prévisualisation {preview.sourceLabel}</h3><p style={styles.muted}>{preview.file.name} · ces données enrichissent le registre financier plateforme et ne créent aucune écriture comptable.</p></div><button style={styles.smallButton} onClick={onCancel}>Annuler</button></div>
      <div style={styles.homeFinanceGrid}>
        <div style={styles.accountingStat}><span>Réservations</span><strong>{statement.items.length}</strong></div>
        <div style={styles.accountingStat}><span>Rapprochées site</span><strong>{statement.items.filter((item) => item.matchStatus === "matched_persisted").length}</strong></div>
        <div style={styles.accountingStat}><span>À vérifier</span><strong>{statement.items.filter((item) => ["ambiguous", "not_found"].includes(item.matchStatus)).length}</strong></div>
      </div>
      <p style={styles.muted}><strong>Aucune déduction financière :</strong> les champs sources sont conservés avec leur provenance. Les valeurs inconnues restent NULL et aucun montant n’est requalifié en hébergement, taxe ou ménage sans preuve explicite.</p>
      <div style={{ ...styles.tableWrapper, width: "100%", maxWidth: "100%", minWidth: 0, maxHeight: 430, overflowX: "auto" }}><table style={{ ...styles.table, minWidth: 1050 }}><thead><tr><th style={styles.th}>Rapprochement</th><th style={styles.th}>Réservation</th><th style={styles.th}>Séjour</th><th style={styles.th}>Client</th><th style={styles.th}>Personnes</th><th style={styles.th}>Nuits</th><th style={styles.th}>Original</th><th style={styles.th}>Final</th><th style={styles.th}>Commission</th><th style={styles.th}>Frais paiement</th></tr></thead><tbody>
        {statement.items.map((item) => <tr key={`${item.line}-${item.reservationNumber}`}><td style={styles.td}>{item.matchStatus === "matched_persisted" ? "Réservation du site retrouvée" : item.matchStatus === "matched_calendar" ? "Séjour iCal retrouvé" : item.matchStatus === "ambiguous" ? "À vérifier" : item.matchStatus === "not_applicable" ? "Non applicable" : "Non rapprochée"}</td><td style={styles.td}>{item.reservationNumber || "—"}</td><td style={styles.td}>{item.arrivalDate ? `${item.arrivalDate} → ${item.checkoutDate}` : "—"}</td><td style={styles.td}>{item.guestName || "—"}</td><td style={styles.td}>{item.persons ?? "—"}</td><td style={styles.td}>{item.nights ?? "—"}</td><td style={styles.td}>{item.originalAmount == null ? "—" : money(item.originalAmount)}</td><td style={styles.td}>{item.finalAmount == null ? "—" : money(item.finalAmount)}</td><td style={styles.td}>{item.commissionAmount == null ? "—" : money(item.commissionAmount)}</td><td style={styles.td}>{item.paymentFee == null ? "—" : money(item.paymentFee)}</td></tr>)}
      </tbody></table></div>
      <div style={styles.modalActions}><button style={styles.smallButton} onClick={onCancel}>Annuler</button><button style={styles.addButton} disabled={importing || !preview.financialRows?.length} onClick={onValidate}>{importing ? "Import en cours…" : "Valider l'import"}</button></div>
    </div>}
    {statement && !preview.externalFinancialOnly && <div style={{ ...styles.accountingAssetBox, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
      <div style={styles.panelHeader}><div><h3 style={{ margin: 0 }}>Prévisualisation {preview.sourceLabel}</h3><p style={styles.muted}>{preview.file.name} · aucune écriture n'est enregistrée avant « Valider l'import ».</p></div><button style={styles.smallButton} onClick={onCancel}>Annuler</button></div>
      <div style={styles.homeFinanceGrid}>
        <div style={styles.accountingStat}><span>Lignes source</span><strong>{statement.items.length}</strong></div>
        <div style={styles.accountingStat}><span>Lignes à synchroniser</span><strong>{newRows.length}</strong></div>
        <div style={styles.accountingStat}><span>Mode</span><strong>{preview.sameFile && ["booking", "airbnb"].includes(preview.source) ? "Registre financier uniquement" : preview.activeBatch ? "Remplacement comptable + synchronisation" : "Nouvel import + synchronisation"}</strong></div>
        <div style={styles.accountingStat}><span>Versements</span><strong>{statement.payments.length}</strong></div>
        <div style={styles.accountingStat}><span>Brut</span><strong>{money(statement.totals.gross)}</strong></div>
        <div style={styles.accountingStat}><span>Commissions + frais</span><strong>{money((statement.totals.commission || statement.totals.serviceFee || 0) + (statement.totals.paymentFee || 0))}</strong></div>
        <div style={styles.accountingStat}><span>Net {preview.sourceLabel}</span><strong>{money(statement.totals.net)}</strong></div>
      </div>
      {preview.sameFile && ["booking", "airbnb"].includes(preview.source) && <p style={styles.info}><strong>Comptabilité déjà à jour :</strong> ce fichier est identique au snapshot déjà importé. La validation ne remplacera pas la comptabilité ; elle synchronisera seulement le registre financier plateforme.</p>}
      {preview.activeBatch && !preview.sameFile && <p style={styles.info}><strong>Instantané existant :</strong> cet import remplacera uniquement {preview.sourceLabel} {preview.exerciseYear}. Les écritures manuelles et les autres sources resteront intactes.</p>}
      {preview.source === "booking"
        ? <p style={styles.muted}><strong>Rapprochement :</strong> il recherche d’abord les réservations Booking déjà enregistrées dans le site (dates du séjour, puis nom du client en cas d’ambiguïté). Le calendrier iCal Booking actuel n’est utilisé qu’en secours. Une ligne non rapprochée n’empêche pas l’import comptable.</p>
        : <p style={styles.muted}><strong>Airbnb :</strong> le code de confirmation alimente le registre financier plateforme. L’import ne modifie ni ne recrée les réservations du site.</p>}
      <p style={styles.muted}><strong>Principe :</strong> la <strong>Date d'encaissement</strong> détermine l'exercice comptable. Un nouvel export cumulatif du même exercice remplace l'ancien instantané de cette source ; les autres sources et les écritures manuelles ne sont pas touchées.</p>
      <div style={{ ...styles.tableWrapper, width: "100%", maxWidth: "100%", minWidth: 0, maxHeight: 430, overflowX: "auto" }}><table style={{ ...styles.table, minWidth: preview.source === "airbnb" ? 1450 : 1250 }}><thead><tr><th style={styles.th}>État</th><th style={styles.th}>Rapprochement</th><th style={styles.th}>Type</th><th style={styles.th}>Réservation</th><th style={styles.th}>Séjour</th><th style={styles.th}>Client</th><th style={styles.th}>Date d'encaissement</th><th style={styles.th}>Paiement</th><th style={styles.th}>Brut</th><th style={styles.th}>Commission</th>{preview.source === "airbnb" && <><th style={styles.th}>Ménage</th><th style={styles.th}>Taxe Airbnb</th></>}<th style={styles.th}>Frais paiement</th><th style={styles.th}>Net</th></tr></thead><tbody>
        {statement.items.map((item) => <tr key={`${item.line}-${item.reservationNumber}-${item.paymentId}`}><td style={styles.td}>{preview.activeBatch ? "Remplace l’ancien instantané" : "Nouvelle"}</td><td style={styles.td}>{item.matchStatus === "matched_persisted" ? "Réservation du site retrouvée" : item.matchStatus === "matched_calendar" ? "Séjour iCal retrouvé" : item.matchStatus === "ambiguous" ? "À vérifier" : item.matchStatus === "not_found" ? "Non rapprochée" : "—"}</td><td style={styles.td}>{item.type}</td><td style={styles.td}>{item.reservationNumber || "—"}</td><td style={styles.td}>{item.arrivalDate ? `${item.arrivalDate} → ${item.checkoutDate}` : "—"}</td><td style={styles.td}>{item.guestName || "—"}</td><td style={styles.td}><strong>{item.paymentDate || "—"}</strong></td><td style={styles.td}>{item.paymentId || "—"}</td><td style={styles.td}>{money(item.gross)}</td><td style={styles.td}>{money(item.commission)}</td>{preview.source === "airbnb" && <><td style={styles.td}>{item.cleaningFee == null ? "—" : money(item.cleaningFee)}</td><td style={styles.td}>{item.taxRemitted == null ? "—" : money(item.taxRemitted)}</td></>}<td style={styles.td}>{item.paymentFee == null ? "—" : money(item.paymentFee)}</td><td style={styles.td}><strong>{money(item.net)}</strong>{Math.abs(item.netDifference) > 0.01 && <div style={{ color: "#b45309" }}>Écart {money(item.netDifference)}</div>}</td></tr>)}
      </tbody></table></div>
      <div style={styles.modalActions}><button style={styles.smallButton} onClick={onCancel}>Annuler</button><button style={styles.addButton} disabled={importing || !newRows.length} onClick={onValidate}>{importing ? "Import en cours…" : preview.sameFile && preview.source === "booking" ? "Synchroniser le registre financier" : preview.sameFile && preview.source === "airbnb" ? "Synchroniser le registre financier" : "Valider l'import"}</button></div>
    </div>}
  </div>;
}


function TouristTaxDeclarationPanel({ year }) {
  const now = new Date();
  const defaultMonth = String(Number(year) === now.getFullYear() ? now.getMonth() + 1 : 1);
  const [month, setMonth] = useState(defaultMonth);
  const [registry, setRegistry] = useState(null);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [registryError, setRegistryError] = useState("");
  const [remittances, setRemittances] = useState([]);
  const [remittancesError, setRemittancesError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setMonth(String(Number(year) === now.getFullYear() ? now.getMonth() + 1 : 1));
  }, [year]);

  useEffect(() => {
    let cancelled = false;
    setLoadingRegistry(true);
    setRegistry(null);
    setRemittances([]);
    setRegistryError("");
    setRemittancesError("");
    fetchTouristTaxDeclaration(Number(year), Number(month))
      .then((result) => { if (!cancelled) setRegistry(result); })
      .catch((error) => { if (!cancelled) setRegistryError(error.message); })
      .finally(() => { if (!cancelled) setLoadingRegistry(false); });
    if (Number(year) >= 2026) {
      fetchTouristTaxRemittances(Number(year), Number(month))
        .then((result) => { if (!cancelled) setRemittances(result.entries || []); })
        .catch((error) => { if (!cancelled) setRemittancesError(error.message); });
    }
    return () => { cancelled = true; };
  }, [year, month, version]);

  async function registerPayment(event) {
    event.preventDefault();
    if (busy) return;
    const normalized = paymentAmount.trim().replace(",", ".");
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) { alert("Indique un montant positif en euros, avec au maximum deux décimales."); return; }
    const [whole, decimal = ""] = normalized.split(".");
    const amountCents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) { alert("Montant invalide."); return; }
    if (!confirm(`Enregistrer le prélèvement bancaire réel de ${centsMoney(amountCents)} pour ${String(month).padStart(2, "0")}/${year} ?`)) return;
    setBusy(true);
    try {
      await saveTouristTaxRemittance({ year: Number(year), month: Number(month), paymentDate, amountCents, reference, notes });
      setPaymentAmount(""); setReference(""); setNotes(""); setVersion((v) => v + 1);
    } catch (error) { alert(`Prélèvement non enregistré : ${error.message}`); }
    finally { setBusy(false); }
  }

  async function voidPayment(entry) {
    if (busy || !confirm(`Annuler la saisie du prélèvement du ${entry.payment_date} (${centsMoney(entry.amount_cents)}) ? L'historique sera conservé.`)) return;
    setBusy(true);
    try { await voidTouristTaxRemittance(entry.id); setVersion((v) => v + 1); }
    catch (error) { alert(`Annulation impossible : ${error.message}`); }
    finally { setBusy(false); }
  }

  const centsMoney = (value) => money((Number(value) || 0) / 100);
  const totals = registry?.totals || {};
  const activeRemittances = remittances.filter((entry) => !entry.voided_at);
  const paidCents = activeRemittances.reduce((sum, entry) => sum + Number(entry.amount_cents || 0), 0);
  const dueCents = Number(totals.dueTaxCents || 0);
  const difference = Number(totals.differenceDueBilledCents || 0);
  return <>
    <div style={styles.panelHeader}>
      <div><h3>Taxe de séjour — Aure Louron</h3><p style={styles.muted}>Réservations directes uniquement pour la déclaration. Taxe réglementaire indicative selon chaque nuit, distincte de la taxe facturée et des mouvements bancaires.</p></div>
      <label style={styles.accountingYear}>Mois <select style={styles.select} value={month} onChange={(event) => setMonth(event.target.value)}>
        {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date(2026, index, 1))}</option>)}
      </select></label>
    </div>
    {loadingRegistry && <p style={styles.info}>Calcul des nuitées…</p>}
    {registryError && <p style={styles.error}>{registryError}</p>}
    {!loadingRegistry && registry && <>
      <div style={styles.homeFinanceGrid}>
        <div style={styles.accountingStat}><span>Taxe indicative à déclarer</span><strong>{centsMoney(dueCents)}</strong></div>
        <div style={styles.accountingStat}><span>Taxe facturée — nuits présumées</span><strong>{centsMoney(totals.billedForDueCents)}</strong></div>
        <div style={styles.accountingStat}><span>Écart dû − facturé</span><strong>{centsMoney(difference)}</strong></div>
        <div style={styles.accountingStat}><span>Prélèvements bancaires saisis</span><strong>{centsMoney(paidCents)}</strong></div>
      </div>
      <p style={styles.muted}>Taxe enregistrée au contrat : {centsMoney(totals.snapshotTaxCents)} · Encaissement client enregistré : {centsMoney(totals.collectedCents)} · Remboursé : {centsMoney(totals.refundedCents)} · Encaissé net enregistré : {centsMoney(totals.netCollectedCents)}. Ces données historiques ne sont pas modifiées.</p>
      <p style={styles.muted}>Nuitées directes présumées réalisées : {totals.presumedPerformedNights || 0} · Annulées : {totals.cancelledNights || 0} · Futures : {totals.upcomingNights || 0} · À vérifier : {totals.needsReviewNights || 0} · Plateformes en contrôle : {totals.platformNights || 0}.</p>
      <p style={styles.info}>Avant la déclaration, confirme les nuitées effectivement réalisées (départs anticipés et absences non détectés automatiquement). Le montant bancaire réellement prélevé reste indépendant du calcul. Un encaissement client enregistré à 0 € peut nécessiter un rapprochement avec Stripe : ne pas l'interpréter comme une preuve de non-paiement.</p>
      {totals.cancelledTaxStillCollectedCents > 0 && <p style={styles.error}>Taxe encore enregistrée comme collectée sur des nuitées annulées : {centsMoney(totals.cancelledTaxStillCollectedCents)}. Vérifier la restitution au voyageur ; ne pas déclarer ces nuits à Aure Louron.</p>}
      {(totals.needsReviewNights > 0 || totals.missingSnapshotNights > 0) && <p style={styles.error}>Attention : {totals.needsReviewNights || 0} nuitée(s) réglementaires non calculables et {totals.missingSnapshotNights || 0} snapshot(s) contractuels incomplets. Total indicatif partiel : ne pas déclarer sans correction.</p>}
      <div style={styles.tableWrapper}><table style={{ ...styles.table, minWidth: 1350 }}><thead><tr>
        <th style={styles.th}>Nuit</th><th style={styles.th}>Voyageur</th><th style={styles.th}>Occupants</th><th style={styles.th}>Taxables</th>
        <th style={styles.th}>Classement contrat</th><th style={styles.th}>Taxe facturée</th><th style={styles.th}>Classement nuitée</th><th style={styles.th}>Taxe indicative</th><th style={styles.th}>Écart</th><th style={styles.th}>Statut</th>
      </tr></thead><tbody>
        {(registry.directRows || []).map((row) => <tr key={`${row.bookingId}-${row.nightDate}`}>
          <td style={styles.td}>{row.nightDate}</td><td style={styles.td}>{row.guestName}</td><td style={styles.td}>{row.occupants}</td><td style={styles.td}>{row.taxablePeople}</td>
          <td style={styles.td}>{row.snapshotClassification || "—"}</td><td style={styles.td}>{row.snapshotTaxCents === null ? "—" : centsMoney(row.snapshotTaxCents)}</td>
          <td style={styles.td}>{row.dueClassification || "—"}</td><td style={styles.td}>{row.dueTaxCents === null ? "—" : centsMoney(row.dueTaxCents)}</td>
          <td style={styles.td}>{row.dueDifferenceCents === null ? "—" : centsMoney(row.dueDifferenceCents)}</td>
          <td style={styles.td}>{({ presumed_performed: "Présumée effectuée", cancelled: "Annulée : 0 € dû", upcoming: "À venir", to_review: "À vérifier", not_calculated: "Non calculé" })[row.dueStatus] || "À vérifier"}{row.issue ? ` — ${row.issue}` : ""}</td>
        </tr>)}
        {!(registry.directRows || []).length && <tr><td style={styles.td} colSpan="10">Aucune nuitée directe LMV à déclarer pour ce mois. Registre à 0.</td></tr>}
      </tbody></table></div>
      {(registry.platformRows || []).length > 0 && <><h4>Plateformes — contrôle uniquement</h4><p style={styles.muted}>Ces nuitées sont isolées des sommes LMV à déclarer à Aure Louron. Les reversements des plateformes ne bloquent pas ce registre.</p></>}
    </>}
    {Number(year) >= 2026 && <div style={{ ...styles.accountingAssetBox, marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>Prélèvements bancaires Aure Louron — {String(month).padStart(2, "0")}/{year}</h3>
      <p style={styles.muted}>Saisis uniquement un débit effectivement constaté sur ton compte bancaire. Cette écriture est distincte des charges d'exploitation et n'est jamais créée automatiquement à partir de la taxe calculée.</p>
      {remittancesError && <p style={styles.error}>{remittancesError} — Vérifier que la migration de création du registre des prélèvements a été appliquée.</p>}
      <form onSubmit={registerPayment}>
        <div style={styles.accountingFormGrid}>
          <label style={styles.label}>Date réelle du débit bancaire<input style={styles.input} type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></label>
          <label style={styles.label}>Montant réellement prélevé (€)<input style={styles.input} type="text" inputMode="decimal" placeholder="0,00" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required /></label>
          <label style={styles.label}>Référence bancaire (facultatif)<input style={styles.input} value={reference} maxLength={200} onChange={(event) => setReference(event.target.value)} /></label>
          <label style={styles.label}>Note (facultatif)<input style={styles.input} value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} /></label>
        </div>
        <div style={styles.modalActions}><button style={styles.addButton} type="submit" disabled={busy || !!remittancesError}>{busy ? "Enregistrement…" : "Enregistrer le prélèvement"}</button></div>
      </form>
      <p style={styles.muted}>Total des prélèvements saisis pour ce mois déclaré : <strong>{centsMoney(paidCents)}</strong>. Différence indicative calcul − payé : {centsMoney(dueCents - paidCents)} (ce n'est pas une dette certifiée).</p>
      <div style={styles.tableWrapper}><table style={styles.table}><thead><tr>
        <th style={styles.th}>Date du débit</th><th style={styles.th}>Montant</th><th style={styles.th}>Référence</th><th style={styles.th}>État</th><th style={styles.th}>Action</th>
      </tr></thead><tbody>
        {remittances.map((entry) => <tr key={entry.id}>
          <td style={styles.td}>{entry.payment_date}</td><td style={styles.td}>{centsMoney(entry.amount_cents)}</td><td style={styles.td}>{entry.bank_reference || "—"}</td>
          <td style={styles.td}>{entry.voided_at ? "Saisie annulée (historique conservé)" : "Prélèvement enregistré"}</td>
          <td style={styles.td}>{!entry.voided_at && <button style={styles.smallButton} disabled={busy} onClick={() => voidPayment(entry)} type="button">Annuler la saisie</button>}</td>
        </tr>)}
        {!remittances.length && <tr><td style={styles.td} colSpan="5">Aucun prélèvement saisi pour ce mois.</td></tr>}
      </tbody></table></div>
    </div>}
  </>;
}

function AccountingReconciliationPanel({ year, reconciliation, loading, error }) {
  if (loading) return <p style={styles.info}>Chargement du rapprochement…</p>;
  if (error) return <p style={styles.error}>{error}</p>;
  if (!reconciliation || !Array.isArray(reconciliation.rows)) {
    return <p style={styles.empty}>Aucune opération à rapprocher pour cet exercice.</p>;
  }
  return <ReconciliationTableView year={year} reconciliation={reconciliation} />;
}

export default function DeclarationsPanel() {
  const [data, setData] = useState({ categories: [], entries: [], importBatches: [] });
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [subtab, setSubtab] = useState("summary"); const [form, setForm] = useState(null);
  const [journalFilters, setJournalFilters] = useState({});
  const [expenseForm, setExpenseForm] = useState(() => emptyForm("expense"));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [bookingPreview, setBookingPreview] = useState(null);
  const [bookingImporting, setBookingImporting] = useState(false);
  const [financialRegistry, setFinancialRegistry] = useState(null);
  const [financialRegistryLoading, setFinancialRegistryLoading] = useState(false);
  const [financialRegistryError, setFinancialRegistryError] = useState("");
  const [financialRegistryVersion, setFinancialRegistryVersion] = useState(0);
  const [reconciliation, setReconciliation] = useState(null);
  const [reconciliationRequestYear, setReconciliationRequestYear] = useState(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [reconciliationError, setReconciliationError] = useState("");

  async function reload() { setLoading(true); setError(""); try { setData(await fetchAccountingData(supabase)); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    if (subtab !== "reconciliation") return;
    let cancelled = false;
    setReconciliationRequestYear(Number(year));
    setReconciliation(null);
    setReconciliationLoading(true);
    setReconciliationError("");
    fetchAccountingReconciliation(Number(year))
      .then((result) => { if (!cancelled) setReconciliation(result); })
      .catch((reconciliationError) => { if (!cancelled) { setReconciliation(null); setReconciliationError(reconciliationError.message); } })
      .finally(() => { if (!cancelled) setReconciliationLoading(false); });
    return () => { cancelled = true; };
  }, [year, subtab]);
  useEffect(() => {
    if (subtab !== "imports") return;
    let cancelled = false;
    setFinancialRegistryLoading(true);
    setFinancialRegistryError("");
    fetchPlatformFinancialRegistry(supabase)
      .then((rows) => { if (!cancelled) setFinancialRegistry(rows); })
      .catch((importError) => { if (!cancelled) { setFinancialRegistry(null); setFinancialRegistryError(importError.message); } })
      .finally(() => { if (!cancelled) setFinancialRegistryLoading(false); });
    return () => { cancelled = true; };
  }, [subtab, financialRegistryVersion]);
  useEffect(() => { const handler=()=>setForm(emptyForm("income")); window.addEventListener("lmv:add-manual-receipt",handler); return()=>window.removeEventListener("lmv:add-manual-receipt",handler); }, []);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsFromDates = [
      ...data.entries.map((entry) => entry.entry_date),
      ...(financialRegistry || []).flatMap((entry) => [entry.payment_date, entry.start_date]),
    ].map((date) => Number(String(date || "").slice(0, 4))).filter((value) => Number.isInteger(value) && value >= 2000 && value <= currentYear);
    const batchYears = data.importBatches.map((batch) => Number(batch.exercise_year)).filter((value) => Number.isInteger(value) && value >= 2000 && value <= currentYear);
    const firstYear = Math.min(currentYear - 2, ...yearsFromDates, ...batchYears, currentYear);
    return Array.from({ length: currentYear - firstYear + 1 }, (_, index) => String(currentYear - index));
  }, [data.entries, data.importBatches, financialRegistry]);
  // Les filtres sont indépendants par onglet : ils n'altèrent jamais les écritures
  // ni les calculs de Rapprochement / Taxe de séjour.
  const currentJournalFilters = journalFilters[subtab] || EMPTY_JOURNAL_FILTERS;
  const currentJournalScope = JOURNAL_TAB_SCOPES[subtab] || {};
  const filteredJournalEntries = filterAccountingJournalEntries(data.entries, {
    year, ...currentJournalScope, ...currentJournalFilters,
  });
  const summaryEntries = subtab === "summary" ? filteredJournalEntries : data.entries;
  const summary = accountingYearSummary(summaryEntries, year);
  const categoryName = (entry) => entry.accounting_categories?.name || "Sans domaine";
  const journalFilterBar = JOURNAL_TAB_SCOPES[subtab] && <AccountingJournalFilters
    key={subtab} tab={subtab} year={year} entries={data.entries}
    scope={currentJournalScope} filters={currentJournalFilters}
    onChange={(filters) => setJournalFilters((previous) => ({ ...previous, [subtab]: filters }))}
    count={filteredJournalEntries.length}
  />;

  function openNew(kind) { setForm(emptyForm(kind)); }
  function openEdit(entry) {
    const asset = Array.isArray(entry.accounting_fixed_assets) ? entry.accounting_fixed_assets[0] : entry.accounting_fixed_assets;
    setForm({ ...emptyForm(entry.entry_kind), ...entry, category_id: entry.category_id || "", receipt_reference: entry.metadata?.receipt_reference || "", ...(asset || {}) });
  }
  async function persistManualEntry(values, onSuccess) {
    if (savingRef.current) return;
    if (values.entry_kind === "expense") {
      const duplicate = findPotentialDuplicateExpense(data.entries, values);
      if (duplicate && !confirm(`Une dépense similaire est déjà enregistrée le ${duplicate.entry_date} (${money(duplicate.amount_ttc)}, ${SOURCE_LABELS[duplicate.source] || duplicate.source}). Enregistrer malgré tout ?`)) return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      if (values.id) await updateManualAccountingEntry(supabase, values.id, values);
      else await createManualAccountingEntry(supabase, values);
      onSuccess();
      await reload();
    } catch (e) { alert(`Erreur : ${e.message}`); }
    finally { savingRef.current = false; setSaving(false); }
  }
  async function save(event) { event.preventDefault(); if (form) await persistManualEntry(form, () => setForm(null)); }
  async function saveExpense(event) {
    event.preventDefault();
    if (!expenseForm.category_id || !Number.isFinite(Number(expenseForm.amount_ttc)) || Number(expenseForm.amount_ttc) <= 0) { alert("Choisis une catégorie et un montant payé supérieur à zéro."); return; }
    if (!expenseForm.entry_date || expenseForm.entry_date > today()) { alert("La date de paiement doit être réelle et ne peut pas être dans le futur."); return; }
    await persistManualEntry(expenseForm, () => {
      setYear(expenseForm.entry_date.slice(0, 4));
      setExpenseForm(emptyForm("expense"));
    });
  }
  async function remove(entry) { if (entry.source !== "manual" || !confirm(`Supprimer « ${entry.label} » ?`)) return; try { await deleteManualAccountingEntry(supabase, entry.id); await reload(); } catch (e) { alert(`Erreur : ${e.message}`); } }
  async function previewBookingFile(file) {
    if (!file) return;
    try {
      const [text, hash] = await Promise.all([file.text(), sha256File(file)]);
      const source = detectAccountingImportFormat(text);
      let statement;
      let entries;
      if (source === "booking" || source === "booking_overview") {
        const [calendarResponse, persistedResponse] = await Promise.all([
          supabase.auth.getSession().then(({ data: { session } }) => fetch("/.netlify/functions/admin-calendar", { cache: "no-store", headers: { Authorization: `Bearer ${session?.access_token || ""}` } })),
          supabase.from("booking_requests").select("id,source,start_date,end_date,guest_first_name,guest_last_name"),
        ]);
        const calendar = calendarResponse.ok ? await calendarResponse.json() : { externalReservations: [] };
        if (persistedResponse.error) throw persistedResponse.error;
        if (source === "booking") {
          statement = matchBookingStatementReservations(
            parseBookingStatement(text),
            calendar.externalReservations || [],
            persistedResponse.data || [],
          );
          entries = bookingStatementToEntries(statement, data.categories);
        } else {
          statement = matchBookingOverviewReservations(
            parseBookingOverview(text),
            calendar.externalReservations || [],
            persistedResponse.data || [],
          );
          const financialRows = bookingOverviewToFinancialRows(statement);
          const exerciseYear = Number(statement.items.find((item) => item.arrivalDate)?.arrivalDate?.slice(0, 4)) || Number(year);
          setBookingPreview({
            file, sha256: hash, source, sourceLabel: "Booking Overview",
            statement, entries: [], financialRows, exerciseYear,
            activeBatch: null, sameFile: null, externalFinancialOnly: true,
          });
          return;
        }
      } else if (source === "airbnb_reservations") {
        statement = parseAirbnbReservations(text);
        const financialRows = airbnbReservationsToFinancialRows(statement);
        const exerciseYear = Number(statement.items.find((item) => item.arrivalDate)?.arrivalDate?.slice(0, 4)) || Number(year);
        setBookingPreview({
          file, sha256: hash, source: "airbnb", sourceLabel: "Airbnb Réservations",
          statement, entries: [], financialRows, exerciseYear,
          activeBatch: null, sameFile: null, externalFinancialOnly: true,
        });
        return;
      } else {
        statement = parseAirbnbStatement(text);
        entries = airbnbStatementToEntries(statement, data.categories);
      }
      const exerciseYear = importExerciseYear(entries);
      const activeBatch = data.importBatches.find((batch) => batch.source === source && Number(batch.exercise_year) === exerciseYear && batch.status === "validated");
      // Un ancien lot « replaced » ne certifie pas que la comptabilité actuelle
      // correspond au fichier : seul le lot encore validé autorise la synchronisation seule.
      const sameFile = activeBatch?.file_sha256 === hash ? activeBatch : null;
      setBookingPreview({
        file, sha256: hash, source, sourceLabel: source === "booking" ? "Booking" : "Airbnb",
        statement, entries,
        financialRows: source === "airbnb" ? airbnbStatementToFinancialRows(statement) : undefined,
        exerciseYear, activeBatch, sameFile,
      });
    } catch (e) {
      setBookingPreview(null);
      alert(`Erreur import : ${e.message}`);
    }
  }
  async function validateBookingImport() {
    if (!bookingPreview || bookingImporting) return;
    if (bookingPreview.externalFinancialOnly) {
      const sourceLabel = bookingPreview.sourceLabel || "Plateforme";
      if (!bookingPreview.financialRows?.length) { alert(`Aucune donnée ${sourceLabel} à importer.`); return; }
      if (!confirm(`Enregistrer ${bookingPreview.financialRows.length} réservation(s) ${sourceLabel} dans le registre financier plateforme ?`)) return;
      setBookingImporting(true);
      try {
        await saveExternalReservationFinancials(supabase, bookingPreview.financialRows);
        setBookingPreview(null);
        setFinancialRegistryVersion((version) => version + 1);
        alert(`${sourceLabel} : réservations enregistrées dans le registre financier. Aucune écriture comptable n'a été créée. Consulte l'historique ci-dessous.`);
      } catch (e) {
        alert(`Erreur import : ${e.message}`);
      } finally { setBookingImporting(false); }
      return;
    }
    if (!bookingPreview.entries.length) { alert("Aucune donnée à importer dans ce fichier."); return; }
    const replacing = Boolean(bookingPreview.activeBatch);
    const accountingAlreadyCurrent = Boolean(bookingPreview.sameFile);
    const financialSyncOnly = accountingAlreadyCurrent && ["booking", "airbnb"].includes(bookingPreview.source);
    const message = financialSyncOnly
      ? `La comptabilité ${bookingPreview.sourceLabel} ${bookingPreview.exerciseYear} est déjà à jour avec ce fichier. Synchroniser uniquement le registre financier plateforme ?`
      : replacing
        ? `Remplacer l'import ${bookingPreview.sourceLabel} ${bookingPreview.exerciseYear} existant par ce nouvel export cumulatif ?`
        : `Importer ${bookingPreview.sourceLabel} ${bookingPreview.exerciseYear} et créer ${bookingPreview.entries.length} écritures comptables ?`;
    if (!confirm(message)) return;
    setBookingImporting(true);
    try {
      if (bookingPreview.source === "booking") {
        await saveExternalReservationFinancials(supabase, bookingStatementToFinancialRows(bookingPreview.statement));
      } else if (bookingPreview.source === "airbnb") {
        await saveExternalReservationFinancials(supabase, bookingPreview.financialRows || airbnbStatementToFinancialRows(bookingPreview.statement));
      }
      if (!accountingAlreadyCurrent) {
        await saveAccountingImportSnapshot(supabase, { ...bookingPreview, format: bookingPreview.source === "booking" ? "booking_statements_csv_v2" : "airbnb_payout_csv_v1" });
      }
      setBookingPreview(null);
      setFinancialRegistryVersion((version) => version + 1);
      await reload();
      alert(accountingAlreadyCurrent && bookingPreview.source === "booking"
        ? "Registre financier Booking synchronisé ; comptabilité inchangée."
        : financialSyncOnly
          ? `Registre financier ${bookingPreview.sourceLabel} synchronisé ; comptabilité inchangée.`
          : replacing ? `Import ${bookingPreview.sourceLabel} ${bookingPreview.exerciseYear} remplacé.` : "Import validé.");
    } catch (e) {
      alert(`Erreur import : ${e.message}`);
    } finally { setBookingImporting(false); }
  }
  async function addDomain(kind) { const name = prompt(`Nom du nouveau domaine ${kind === "income" ? "de recette" : "de dépense"} :`); if (!name?.trim()) return; const code = `custom_${name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${Date.now()}`; try { await createAccountingCategory(supabase, { entry_kind: kind, name, code }); await reload(); } catch (e) { alert(`Erreur : ${e.message}`); } }

  const renderTable = (entries, { showReceiptReference = false, responsiveCards = false } = {}) => <><div className={responsiveCards ? "lmv-journal-desktop" : undefined} style={styles.tableWrapper}><table style={{ ...styles.table, minWidth: 900 }}><thead><tr><th style={styles.th}>Date</th><th style={styles.th}>Domaine</th><th style={styles.th}>Libellé</th><th style={styles.th}>Tiers</th>{showReceiptReference && <th style={styles.th}>Justificatif local</th>}<th style={styles.th}>Traitement</th><th style={styles.th}>Source</th><th style={styles.th}>Montant</th><th style={styles.th}>Actions</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td style={styles.td}>{entry.entry_date}</td><td style={styles.td}>{categoryName(entry)}</td><td style={styles.td}>{entry.label}</td><td style={styles.td}>{entry.counterparty || "—"}</td>{showReceiptReference && <td style={styles.td}>{entry.metadata?.receipt_reference || "—"}</td>}<td style={styles.td}>{entry.entry_kind === "refund" ? "Remboursement client" : entry.treatment === "current" ? (entry.entry_kind === "income" ? "Recette courante" : "Charge courante") : (TREATMENT_LABELS[entry.treatment] || entry.treatment)}</td><td style={styles.td}>{SOURCE_LABELS[entry.source] || entry.source}</td><td style={styles.td}><strong>{money(entry.amount_ttc)}</strong></td><td style={styles.td}>{entry.source === "manual" && entry.entry_kind !== "refund" ? <div style={styles.contactButtons}><button type="button" style={styles.smallButton} onClick={() => openEdit(entry)}>Modifier</button><button type="button" style={styles.deleteButton} onClick={() => remove(entry)}>Supprimer</button></div> : "Import"}</td></tr>)}{!entries.length && <tr><td style={styles.td} colSpan={showReceiptReference ? 9 : 8}>Aucune écriture pour cette sélection.</td></tr>}</tbody></table></div>
    {responsiveCards && <div className="lmv-journal-mobile" aria-label="Écritures comptables">
      {entries.length ? entries.map((entry) => <article className="lmv-journal-card" key={entry.id}>
        <div className="lmv-journal-card-top"><strong>{entry.label || "Sans libellé"}</strong><strong>{money(entry.amount_ttc)}</strong></div>
        <div className="lmv-journal-card-meta"><span>{entry.entry_date}</span><span>{categoryName(entry)}</span></div>
        {entry.counterparty && <p><b>{entry.entry_kind === "income" ? "Client / origine" : entry.entry_kind === "expense" ? "Fournisseur" : "Tiers"} :</b> {entry.counterparty}</p>}
        <p><b>Source :</b> {SOURCE_LABELS[entry.source] || entry.source} · <b>Traitement :</b> {entry.entry_kind === "refund" ? "Remboursement client" : entry.treatment === "current" ? (entry.entry_kind === "income" ? "Recette courante" : "Charge courante") : (TREATMENT_LABELS[entry.treatment] || entry.treatment)}</p>
        {showReceiptReference && entry.metadata?.receipt_reference && <p className="lmv-journal-receipt"><b>Justificatif local :</b> {entry.metadata.receipt_reference}</p>}
        {entry.source === "manual" && entry.entry_kind !== "refund" && <div className="lmv-journal-card-actions"><button type="button" style={styles.smallButton} onClick={() => openEdit(entry)}>Modifier</button><button type="button" style={styles.deleteButton} onClick={() => remove(entry)}>Supprimer</button></div>}
      </article>) : <p className="lmv-journal-empty">Aucune écriture pour cette sélection.</p>}
    </div>}
  </>;

  return <div style={{ ...styles.accountingPanel, minWidth: 0, maxWidth: "100%" }}>
    <div className="lmv-declarations-toolbar" style={styles.accountingToolbar}><div className="lmv-declarations-tabs" role="tablist" aria-label="Rubriques des déclarations" style={styles.tabs}>{SUBTABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={subtab === key} style={subtab === key ? styles.activeTab : styles.tab} onClick={() => setSubtab(key)}>{label}</button>)}</div><label className="lmv-declarations-year" style={styles.accountingYear}>Exercice <select style={styles.select} value={year} onChange={(e) => setYear(e.target.value)}>{years.map((y) => <option key={y}>{y}</option>)}</select></label></div>
    {subtab !== "reconciliation" && loading && <p style={styles.info}>Chargement de la comptabilité…</p>}{subtab !== "reconciliation" && error && <p style={styles.error}>{error}</p>}
    {!loading && !error && subtab === "summary" && <>{journalFilterBar}<div style={styles.homeFinanceGrid}><div style={styles.accountingStat}><span>Recettes</span><strong>{money(summary.income)}</strong></div><div style={styles.accountingStat}><span>Dépenses</span><strong>{money(summary.expense)}</strong></div><div style={styles.accountingStat}><span>Remboursements</span><strong>{money(summary.refunds)}</strong></div><div style={styles.accountingStat}><span>Solde indicatif</span><strong>{money(summary.result)}</strong></div><div style={styles.accountingStat}><span>Écritures</span><strong>{summary.count}</strong></div></div><p style={styles.muted}>Les montants reflètent les filtres sélectionnés. Synthèse comptable indicative : le traitement fiscal de la déclaration sera défini séparément selon le régime applicable à l'exercice.</p>{renderTable(filteredJournalEntries, { responsiveCards: true })}</>}
    {!loading && !error && subtab === "fees" && <section style={{ display: "grid", gap: 18, minWidth: 0 }}>
      <div className="lmv-fees-header" style={styles.panelHeader}><div><h3 style={{ margin: 0 }}>Frais — dépenses payées</h3><p style={styles.muted}>Saisie manuelle dans le journal existant. Aucun PDF ou photo n'est envoyé à Supabase.</p></div><button type="button" style={styles.smallButton} onClick={() => addDomain("expense")}>+ Ajouter une catégorie</button></div>
      <EntryModal inline form={expenseForm} categories={data.categories} onChange={(key, value) => setExpenseForm((current) => ({ ...current, [key]: value }))} onSave={saveExpense} saving={saving} />
      <div>{journalFilterBar}<div className="lmv-fees-header" style={styles.panelHeader}><h4 style={{ margin: 0 }}>Frais manuels de {year}</h4><button type="button" style={styles.smallButton} onClick={() => setSubtab("expense")}>Voir toutes les dépenses et les synthèses</button></div>{renderTable(filteredJournalEntries, { showReceiptReference: true, responsiveCards: true })}</div>
    </section>}
    {!loading && !error && subtab === "expense" && <ExpenseAnalysisPanel entries={data.entries} categories={data.categories} year={year} renderTable={renderTable} onAddCategory={() => addDomain("expense")} onNewExpense={() => { setSubtab("fees"); }} />}
    {!loading && !error && subtab === "income" && <><div style={styles.panelHeader}><h3>Recettes {year}</h3><div style={styles.contactButtons}><button style={styles.smallButton} onClick={() => addDomain("income")}>+ Ajouter un domaine</button><button style={styles.addButton} onClick={() => openNew("income")}>+ Ajouter une recette</button></div></div>{journalFilterBar}{renderTable(filteredJournalEntries, { responsiveCards: true })}</>}
    {!loading && !error && subtab === "refund" && <><h3>Remboursements {year}</h3><p style={styles.muted}>Mouvements comptables enregistrés, en lecture seule. Les remboursements ne sont pas des charges d’exploitation. Les écritures Stripe doivent être rapprochées de chaque remboursement confirmé.</p>{journalFilterBar}{renderTable(filteredJournalEntries, { responsiveCards: true })}</>}
    {!loading && !error && subtab === "assets" && <><h3>Immobilisations</h3><p style={styles.muted}>Inventaire des dépenses classées en immobilisation. Aucun amortissement fiscal n'est calculé automatiquement à ce stade.</p>{journalFilterBar}{renderTable(filteredJournalEntries, { responsiveCards: true })}</>}
    {subtab === "imports" && <>
      {!loading && !error && <BookingImportPanel data={data} year={year} preview={bookingPreview} importing={bookingImporting} onFile={previewBookingFile} onCancel={() => setBookingPreview(null)} onValidate={validateBookingImport} />}
      {!loading && !error && <DirectStripeAccountingImport year={Number(year)} onCreated={reload} />}
      <AccountingImportHistory
        year={year}
        entries={data.entries}
        batches={data.importBatches}
        financialRows={financialRegistry || []}
        registryLoading={financialRegistryLoading}
        registryError={financialRegistryError}
        accountingLoading={loading}
        accountingError={error}
        onRefresh={() => { reload(); setFinancialRegistryVersion((version) => version + 1); }}
      />
    </>}
    {subtab === "reconciliation" && <AccountingReconciliationPanel
      year={year}
      reconciliation={reconciliationRequestYear === Number(year) ? reconciliation : null}
      loading={reconciliationRequestYear !== Number(year) || reconciliationLoading}
      error={reconciliationRequestYear === Number(year) ? reconciliationError : ""}
    />}
    {!loading && !error && subtab === "tax" && <TouristTaxDeclarationPanel year={year} />}
    {form && <EntryModal form={form} categories={data.categories} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} onClose={() => { if (!saving) setForm(null); }} onSave={save} saving={saving} />}
  </div>;
}
