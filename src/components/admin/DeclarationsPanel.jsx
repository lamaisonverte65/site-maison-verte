import { useEffect, useMemo, useState } from "react";
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
import { airbnbStatementToEntries, detectAccountingImportFormat, importExerciseYear, parseAirbnbStatement } from "../../utils/accountingImport";
import { matchBookingOverviewReservations, parseBookingOverview } from "../../utils/bookingOverviewImport";
import { bookingOverviewToFinancialRows, bookingStatementToFinancialRows } from "../../utils/externalReservationFinancialImport";
import { fetchTouristTaxDeclaration } from "../../services/touristTaxDeclarationService";

const SUBTABS = [
  ["summary", "Synthèse"], ["income", "Recettes"], ["expense", "Dépenses"],
  ["assets", "Immobilisations"], ["imports", "Imports"], ["tax", "Taxe de séjour"],
];
const money = (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
const today = () => new Date().toISOString().slice(0, 10);
const TREATMENT_LABELS = { current: "Courant", fixed_asset: "Immobilisation", to_review: "À revoir", non_deductible: "Non déductible" };
const SOURCE_LABELS = { manual: "Manuel", booking: "Booking", airbnb: "Airbnb", stripe: "Stripe", other: "Autre" };
const emptyForm = (kind = "expense") => ({
  id: null, entry_date: today(), entry_kind: kind, category_id: "", label: "", counterparty: "",
  amount_ttc: "", treatment: "current", payment_method: "", notes: "", asset_category: "",
  in_service_date: today(), acquisition_value: "", depreciation_method: "", depreciation_duration_months: "",
  residual_value: "0", asset_notes: "", receipt_origin: "Direct",
});

function EntryModal({ form, categories, onChange, onClose, onSave }) {
  const relevant = categories.filter((category) => category.entry_kind === form.entry_kind && category.is_active !== false);
  return <div style={styles.modalOverlay}><form style={styles.modal} onSubmit={onSave}>
    <div style={styles.modalHeader}><h2 style={{ margin: 0 }}>{form.id ? "Modifier l'écriture" : form.entry_kind === "income" ? "Ajouter une recette" : "Ajouter une dépense"}</h2><button type="button" style={styles.closeButton} onClick={onClose}>×</button></div>
    <div style={styles.accountingFormGrid}>
      <label style={styles.label}>Date<input style={styles.input} type="date" value={form.entry_date} onChange={(e) => onChange("entry_date", e.target.value)} required /></label>
      <label style={styles.label}>Domaine<select style={styles.input} value={form.category_id} onChange={(e) => onChange("category_id", e.target.value)}><option value="">Sans domaine</option>{relevant.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label style={styles.label}>Libellé<input style={styles.input} value={form.label} onChange={(e) => onChange("label", e.target.value)} required /></label>
      <label style={styles.label}>{form.entry_kind === "income" ? "Client / origine" : "Fournisseur"}<input style={styles.input} value={form.counterparty} onChange={(e) => onChange("counterparty", e.target.value)} /></label>
      <label style={styles.label}>Montant TTC (€)<input style={styles.input} type="number" min="0" step="0.01" value={form.amount_ttc} onChange={(e) => onChange("amount_ttc", e.target.value)} required /></label>
      {form.entry_kind === "income" && <label style={styles.label}>Origine de l’encaissement<input style={styles.input} value={form.receipt_origin || ""} onChange={(e) => onChange("receipt_origin", e.target.value)} placeholder="Direct, Airbnb, Clévacances, Autre…" /></label>}
      <label style={styles.label}>Mode de paiement<input style={styles.input} value={form.payment_method} onChange={(e) => onChange("payment_method", e.target.value)} placeholder="Carte, virement, espèces…" /></label>
      <label style={styles.label}>Traitement<select style={styles.input} value={form.treatment} onChange={(e) => onChange("treatment", e.target.value)}><option value="current">{form.entry_kind === "income" ? "Recette courante" : "Charge courante"}</option>{form.entry_kind === "expense" && <option value="fixed_asset">Immobilisation</option>}<option value="to_review">À revoir</option><option value="non_deductible">Non déductible</option></select></label>
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
    <label style={styles.label}>Notes<textarea style={{ ...styles.input, minHeight: 80 }} value={form.notes} onChange={(e) => onChange("notes", e.target.value)} /></label>
    <div style={styles.modalActions}><button type="button" style={styles.smallButton} onClick={onClose}>Annuler</button><button type="submit" style={styles.addButton}>Enregistrer</button></div>
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
    {statement && preview.externalFinancialOnly && <div style={{ ...styles.accountingAssetBox, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
      <div style={styles.panelHeader}><div><h3 style={{ margin: 0 }}>Prévisualisation Booking Overview</h3><p style={styles.muted}>{preview.file.name} · ces données enrichissent le registre financier plateforme et ne créent aucune écriture comptable.</p></div><button style={styles.smallButton} onClick={onCancel}>Annuler</button></div>
      <div style={styles.homeFinanceGrid}>
        <div style={styles.accountingStat}><span>Réservations</span><strong>{statement.items.length}</strong></div>
        <div style={styles.accountingStat}><span>Rapprochées site</span><strong>{statement.items.filter((item) => item.matchStatus === "matched_persisted").length}</strong></div>
        <div style={styles.accountingStat}><span>À vérifier</span><strong>{statement.items.filter((item) => ["ambiguous", "not_found"].includes(item.matchStatus)).length}</strong></div>
      </div>
      <p style={styles.muted}><strong>Aucune déduction financière :</strong> Original amount et Final amount sont conservés comme données source. Ils ne deviennent automatiquement ni hébergement, ni taxe de séjour, ni ménage. Les valeurs inconnues restent NULL.</p>
      <div style={{ ...styles.tableWrapper, width: "100%", maxWidth: "100%", minWidth: 0, maxHeight: 430, overflowX: "auto" }}><table style={{ ...styles.table, minWidth: 1050 }}><thead><tr><th style={styles.th}>Rapprochement</th><th style={styles.th}>Réservation</th><th style={styles.th}>Séjour</th><th style={styles.th}>Client</th><th style={styles.th}>Personnes</th><th style={styles.th}>Nuits</th><th style={styles.th}>Original</th><th style={styles.th}>Final</th><th style={styles.th}>Commission</th><th style={styles.th}>Frais paiement</th></tr></thead><tbody>
        {statement.items.map((item) => <tr key={`${item.line}-${item.reservationNumber}`}><td style={styles.td}>{item.matchStatus === "matched_persisted" ? "Réservation du site retrouvée" : item.matchStatus === "matched_calendar" ? "Séjour iCal retrouvé" : item.matchStatus === "ambiguous" ? "À vérifier" : "Non rapprochée"}</td><td style={styles.td}>{item.reservationNumber || "—"}</td><td style={styles.td}>{item.arrivalDate ? `${item.arrivalDate} → ${item.checkoutDate}` : "—"}</td><td style={styles.td}>{item.guestName || "—"}</td><td style={styles.td}>{item.persons ?? "—"}</td><td style={styles.td}>{item.nights ?? "—"}</td><td style={styles.td}>{money(item.originalAmount)}</td><td style={styles.td}>{money(item.finalAmount)}</td><td style={styles.td}>{money(item.commissionAmount)}</td><td style={styles.td}>{money(item.paymentFee)}</td></tr>)}
      </tbody></table></div>
      <div style={styles.modalActions}><button style={styles.smallButton} onClick={onCancel}>Annuler</button><button style={styles.addButton} disabled={importing || !preview.financialRows?.length} onClick={onValidate}>{importing ? "Import en cours…" : "Valider l'import"}</button></div>
    </div>}
    {statement && !preview.externalFinancialOnly && <div style={{ ...styles.accountingAssetBox, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
      <div style={styles.panelHeader}><div><h3 style={{ margin: 0 }}>Prévisualisation {preview.sourceLabel}</h3><p style={styles.muted}>{preview.file.name} · aucune écriture n'est enregistrée avant « Valider l'import ».</p></div><button style={styles.smallButton} onClick={onCancel}>Annuler</button></div>
      <div style={styles.homeFinanceGrid}>
        <div style={styles.accountingStat}><span>Lignes source</span><strong>{statement.items.length}</strong></div>
        <div style={styles.accountingStat}><span>Lignes à synchroniser</span><strong>{newRows.length}</strong></div>
        <div style={styles.accountingStat}><span>Mode</span><strong>{preview.sameFile && preview.source === "booking" ? "Registre financier uniquement" : preview.activeBatch ? "Remplacement comptable + synchronisation" : "Nouvel import + synchronisation"}</strong></div>
        <div style={styles.accountingStat}><span>Versements</span><strong>{statement.payments.length}</strong></div>
        <div style={styles.accountingStat}><span>Brut</span><strong>{money(statement.totals.gross)}</strong></div>
        <div style={styles.accountingStat}><span>Commissions + frais</span><strong>{money((statement.totals.commission || 0) + (statement.totals.paymentFee || statement.totals.serviceFee || 0))}</strong></div>
        <div style={styles.accountingStat}><span>Net {preview.sourceLabel}</span><strong>{money(statement.totals.net)}</strong></div>
      </div>
      {preview.sameFile && preview.source === "booking" && <p style={styles.info}><strong>Comptabilité déjà à jour :</strong> ce fichier est identique au snapshot Booking déjà importé. La validation ne remplacera pas la comptabilité ; elle synchronisera seulement le registre financier plateforme.</p>}
      {preview.sameFile && preview.source !== "booking" && <p style={styles.info}><strong>Aucune donnée nouvelle :</strong> ce fichier a déjà été importé. Choisis un export cumulatif plus récent.</p>}
      {preview.activeBatch && !preview.sameFile && <p style={styles.info}><strong>Instantané existant :</strong> cet import remplacera uniquement {preview.sourceLabel} {preview.exerciseYear}. Les écritures manuelles et les autres sources resteront intactes.</p>}
      <p style={styles.muted}><strong>Rapprochement :</strong> il recherche d’abord les réservations Booking déjà enregistrées dans le site (dates du séjour, puis nom du client en cas d’ambiguïté). Le calendrier iCal Booking actuel n’est utilisé qu’en secours. Une ligne non rapprochée n’empêche pas l’import comptable.</p>
      <p style={styles.muted}><strong>Principe :</strong> la <strong>Date d'encaissement</strong> détermine l'exercice comptable. Un nouvel export cumulatif du même exercice remplace l'ancien instantané de cette source ; les autres sources et les écritures manuelles ne sont pas touchées.</p>
      <div style={{ ...styles.tableWrapper, width: "100%", maxWidth: "100%", minWidth: 0, maxHeight: 430, overflowX: "auto" }}><table style={{ ...styles.table, minWidth: 1250 }}><thead><tr><th style={styles.th}>État</th><th style={styles.th}>Rapprochement</th><th style={styles.th}>Type</th><th style={styles.th}>Réservation</th><th style={styles.th}>Séjour</th><th style={styles.th}>Client</th><th style={styles.th}>Date d'encaissement</th><th style={styles.th}>Paiement</th><th style={styles.th}>Brut</th><th style={styles.th}>Commission</th><th style={styles.th}>Frais paiement</th><th style={styles.th}>Net</th></tr></thead><tbody>
        {statement.items.map((item) => <tr key={`${item.line}-${item.reservationNumber}-${item.paymentId}`}><td style={styles.td}>{preview.activeBatch ? "Remplace l’ancien instantané" : "Nouvelle"}</td><td style={styles.td}>{item.matchStatus === "matched_persisted" ? "Réservation du site retrouvée" : item.matchStatus === "matched_calendar" ? "Séjour iCal retrouvé" : item.matchStatus === "ambiguous" ? "À vérifier" : item.matchStatus === "not_found" ? "Non rapprochée" : "—"}</td><td style={styles.td}>{item.type}</td><td style={styles.td}>{item.reservationNumber || "—"}</td><td style={styles.td}>{item.arrivalDate ? `${item.arrivalDate} → ${item.checkoutDate}` : "—"}</td><td style={styles.td}>{item.guestName || "—"}</td><td style={styles.td}><strong>{item.paymentDate}</strong></td><td style={styles.td}>{item.paymentId || "—"}</td><td style={styles.td}>{money(item.gross)}</td><td style={styles.td}>{money(item.commission)}</td><td style={styles.td}>{money(item.paymentFee)}</td><td style={styles.td}><strong>{money(item.net)}</strong>{Math.abs(item.netDifference) > 0.01 && <div style={{ color: "#b45309" }}>Écart {money(item.netDifference)}</div>}</td></tr>)}
      </tbody></table></div>
      <div style={styles.modalActions}><button style={styles.smallButton} onClick={onCancel}>Annuler</button><button style={styles.addButton} disabled={importing || !newRows.length || (preview.sameFile && preview.source !== "booking")} onClick={onValidate}>{importing ? "Import en cours…" : preview.sameFile && preview.source === "booking" ? "Synchroniser le registre financier" : "Valider l'import"}</button></div>
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

  useEffect(() => {
    setMonth(String(Number(year) === now.getFullYear() ? now.getMonth() + 1 : 1));
  }, [year]);

  useEffect(() => {
    let cancelled = false;
    setLoadingRegistry(true);
    setRegistryError("");
    fetchTouristTaxDeclaration(Number(year), Number(month))
      .then((result) => { if (!cancelled) setRegistry(result); })
      .catch((error) => { if (!cancelled) { setRegistry(null); setRegistryError(error.message); } })
      .finally(() => { if (!cancelled) setLoadingRegistry(false); });
    return () => { cancelled = true; };
  }, [year, month]);

  const totals = registry?.totals || {};
  const centsMoney = (value) => money((Number(value) || 0) / 100);
  return <>
    <div style={styles.panelHeader}>
      <div><h3>Taxe de séjour — registre réglementaire</h3><p style={styles.muted}>Registre en lecture seule, ventilé par nuit. Le calcul réglementaire ne modifie jamais la taxe facturée au voyageur.</p></div>
      <label style={styles.accountingYear}>Mois <select style={styles.select} value={month} onChange={(event) => setMonth(event.target.value)}>
        {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date(2026, index, 1))}</option>)}
      </select></label>
    </div>
    {loadingRegistry && <p style={styles.info}>Calcul du registre réglementaire…</p>}
    {registryError && <p style={styles.error}>{registryError}</p>}
    {!loadingRegistry && registry && <>
      <div style={styles.homeFinanceGrid}>
        <div style={styles.accountingStat}><span>Facturé voyageurs</span><strong>{centsMoney(totals.commercialTaxCents)}</strong></div>
        <div style={styles.accountingStat}><span>Encaissé net</span><strong>{centsMoney(totals.netCollectedCents)}</strong></div>
        <div style={styles.accountingStat}><span>Dû Aure-Louron</span><strong>{centsMoney(totals.regulatoryTaxCents)}</strong></div>
        <div style={styles.accountingStat}><span>Écart réglementaire</span><strong>{centsMoney(totals.regulatoryDeltaCents)}</strong></div>
      </div>
      <p style={styles.muted}>Encaissé : {centsMoney(totals.collectedCents)} · Remboursé : {centsMoney(totals.refundedCents)} · Nuitées LMV : {totals.nights || 0} · Nuitées plateforme en contrôle : {totals.platformNights || 0}</p>
      {totals.missingRegulatoryNights > 0 && <p style={styles.error}>{totals.missingRegulatoryNights} nuitée(s) sans classement ou barème réglementaire historique complet : elles ne sont pas incluses dans le total « Dû Aure-Louron ».</p>}
      <div style={styles.tableWrapper}><table style={{ ...styles.table, minWidth: 1180 }}><thead><tr>
        <th style={styles.th}>Nuit</th><th style={styles.th}>Voyageur</th><th style={styles.th}>Occupants</th><th style={styles.th}>Taxables</th>
        <th style={styles.th}>Classement client</th><th style={styles.th}>Facturé</th><th style={styles.th}>Encaissé</th><th style={styles.th}>Remboursé</th>
        <th style={styles.th}>Net</th><th style={styles.th}>Classement réglementaire</th><th style={styles.th}>Dû Aure-Louron</th><th style={styles.th}>Écart</th>
      </tr></thead><tbody>
        {(registry.directRows || []).map((row) => <tr key={`${row.bookingId}-${row.nightDate}`}>
          <td style={styles.td}>{row.nightDate}</td><td style={styles.td}>{row.guestName}</td><td style={styles.td}>{row.occupants}</td><td style={styles.td}>{row.taxablePeople}</td>
          <td style={styles.td}>{row.commercialClassification || "—"}</td><td style={styles.td}>{centsMoney(row.commercialTaxCents)}</td><td style={styles.td}>{centsMoney(row.collectedCents)}</td><td style={styles.td}>{centsMoney(row.refundedCents)}</td>
          <td style={styles.td}>{centsMoney(row.netCollectedCents)}</td><td style={styles.td}>{row.regulatoryClassification || "À compléter"}</td>
          <td style={styles.td}>{row.regulatoryTaxCents === null ? "—" : centsMoney(row.regulatoryTaxCents)}</td><td style={styles.td}>{row.regulatoryDeltaCents === null ? "—" : centsMoney(row.regulatoryDeltaCents)}</td>
        </tr>)}
        {!(registry.directRows || []).length && <tr><td style={styles.td} colSpan="12">Aucune nuitée directe LMV à déclarer pour ce mois. Registre à 0.</td></tr>}
      </tbody></table></div>
      {(registry.platformRows || []).length > 0 && <><h4>Plateformes — contrôle uniquement</h4><p style={styles.muted}>Ces nuitées sont isolées du montant LMV à reverser. Leur collecte doit rester justifiée par les données de la plateforme.</p></>}
    </>}
  </>;
}

export default function DeclarationsPanel() {
  const [data, setData] = useState({ categories: [], entries: [], importBatches: [] });
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [subtab, setSubtab] = useState("summary"); const [form, setForm] = useState(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [bookingPreview, setBookingPreview] = useState(null);
  const [bookingImporting, setBookingImporting] = useState(false);

  async function reload() { setLoading(true); setError(""); try { setData(await fetchAccountingData(supabase)); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { reload(); }, []);
  useEffect(() => { const handler=()=>setForm(emptyForm("income")); window.addEventListener("lmv:add-manual-receipt",handler); return()=>window.removeEventListener("lmv:add-manual-receipt",handler); }, []);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const entryYears = data.entries.map((e) => Number(String(e.entry_date || "").slice(0, 4))).filter(Number.isFinite);
    const firstYear = Math.min(currentYear - 2, ...entryYears, currentYear);
    return Array.from({ length: currentYear - firstYear + 1 }, (_, index) => String(currentYear - index));
  }, [data.entries]);
  const summary = accountingYearSummary(data.entries, year);
  const yearEntries = data.entries.filter((entry) => String(entry.entry_date || "").startsWith(`${year}-`));
  const categoryName = (entry) => entry.accounting_categories?.name || "Sans domaine";

  function openNew(kind) { setForm(emptyForm(kind)); }
  function openEdit(entry) { const asset = Array.isArray(entry.accounting_fixed_assets) ? entry.accounting_fixed_assets[0] : entry.accounting_fixed_assets; setForm({ ...emptyForm(entry.entry_kind), ...entry, category_id: entry.category_id || "", ...(asset || {}) }); }
  async function save(event) { event.preventDefault(); try { if (form.id) await updateManualAccountingEntry(supabase, form.id, form); else await createManualAccountingEntry(supabase, form); setForm(null); await reload(); } catch (e) { alert(`Erreur : ${e.message}`); } }
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
          fetch("/.netlify/functions/calendar", { cache: "no-store" }),
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
      } else {
        statement = parseAirbnbStatement(text);
        entries = airbnbStatementToEntries(statement, data.categories);
      }
      const exerciseYear = importExerciseYear(entries);
      const activeBatch = data.importBatches.find((batch) => batch.source === source && Number(batch.exercise_year) === exerciseYear && batch.status === "validated");
      const sameFile = data.importBatches.find((batch) => batch.source === source && batch.file_sha256 === hash);
      setBookingPreview({ file, sha256: hash, source, sourceLabel: source === "booking" ? "Booking" : "Airbnb", statement, entries, exerciseYear, activeBatch, sameFile });
    } catch (e) {
      setBookingPreview(null);
      alert(`Erreur import : ${e.message}`);
    }
  }
  async function validateBookingImport() {
    if (!bookingPreview || bookingImporting) return;
    if (bookingPreview.externalFinancialOnly) {
      if (!bookingPreview.financialRows?.length) { alert("Aucune donnée Booking Overview à importer."); return; }
      if (!confirm(`Enregistrer ${bookingPreview.financialRows.length} réservation(s) Booking Overview dans le registre financier plateforme ?`)) return;
      setBookingImporting(true);
      try {
        await saveExternalReservationFinancials(supabase, bookingPreview.financialRows);
        setBookingPreview(null);
        alert("Booking Overview enregistré dans le registre financier plateforme.");
      } catch (e) {
        alert(`Erreur import : ${e.message}`);
      } finally { setBookingImporting(false); }
      return;
    }
    if (!bookingPreview.entries.length) { alert("Aucune donnée à importer dans ce fichier."); return; }
    const replacing = Boolean(bookingPreview.activeBatch);
    const accountingAlreadyCurrent = Boolean(bookingPreview.sameFile);
    const message = accountingAlreadyCurrent && bookingPreview.source === "booking"
      ? `La comptabilité Booking ${bookingPreview.exerciseYear} est déjà à jour avec ce fichier. Synchroniser uniquement le registre financier plateforme ?`
      : replacing
        ? `Remplacer l'import ${bookingPreview.sourceLabel} ${bookingPreview.exerciseYear} existant par ce nouvel export cumulatif ?`
        : `Importer ${bookingPreview.sourceLabel} ${bookingPreview.exerciseYear} et créer ${bookingPreview.entries.length} écritures comptables ?`;
    if (!confirm(message)) return;
    setBookingImporting(true);
    try {
      if (bookingPreview.source === "booking") {
        await saveExternalReservationFinancials(supabase, bookingStatementToFinancialRows(bookingPreview.statement));
      }
      if (!accountingAlreadyCurrent) {
        await saveAccountingImportSnapshot(supabase, { ...bookingPreview, format: bookingPreview.source === "booking" ? "booking_statements_csv_v2" : "airbnb_payout_csv_v1" });
      }
      setBookingPreview(null);
      await reload();
      alert(accountingAlreadyCurrent && bookingPreview.source === "booking"
        ? "Registre financier Booking synchronisé ; comptabilité inchangée."
        : replacing ? `Import ${bookingPreview.sourceLabel} ${bookingPreview.exerciseYear} remplacé.` : "Import validé.");
    } catch (e) {
      alert(`Erreur import : ${e.message}`);
    } finally { setBookingImporting(false); }
  }
  async function addDomain(kind) { const name = prompt(`Nom du nouveau domaine ${kind === "income" ? "de recette" : "de dépense"} :`); if (!name?.trim()) return; const code = `custom_${name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${Date.now()}`; try { await createAccountingCategory(supabase, { entry_kind: kind, name, code }); await reload(); } catch (e) { alert(`Erreur : ${e.message}`); } }

  const renderTable = (entries) => <div style={styles.tableWrapper}><table style={{ ...styles.table, minWidth: 900 }}><thead><tr><th style={styles.th}>Date</th><th style={styles.th}>Domaine</th><th style={styles.th}>Libellé</th><th style={styles.th}>Tiers</th><th style={styles.th}>Traitement</th><th style={styles.th}>Source</th><th style={styles.th}>Montant</th><th style={styles.th}>Actions</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td style={styles.td}>{entry.entry_date}</td><td style={styles.td}>{categoryName(entry)}</td><td style={styles.td}>{entry.label}</td><td style={styles.td}>{entry.counterparty || "—"}</td><td style={styles.td}>{entry.treatment === "current" ? (entry.entry_kind === "income" ? "Recette courante" : "Charge courante") : (TREATMENT_LABELS[entry.treatment] || entry.treatment)}</td><td style={styles.td}>{SOURCE_LABELS[entry.source] || entry.source}</td><td style={styles.td}><strong>{money(entry.amount_ttc)}</strong></td><td style={styles.td}>{entry.source === "manual" ? <div style={styles.contactButtons}><button style={styles.smallButton} onClick={() => openEdit(entry)}>Modifier</button><button style={styles.deleteButton} onClick={() => remove(entry)}>Supprimer</button></div> : "Import"}</td></tr>)}{!entries.length && <tr><td style={styles.td} colSpan="8">Aucune écriture pour cet exercice.</td></tr>}</tbody></table></div>;

  return <div style={{ ...styles.accountingPanel, minWidth: 0, maxWidth: "100%" }}>
    <div style={styles.accountingToolbar}><div style={styles.tabs}>{SUBTABS.map(([key, label]) => <button key={key} style={subtab === key ? styles.activeTab : styles.tab} onClick={() => setSubtab(key)}>{label}</button>)}</div><label style={styles.accountingYear}>Exercice <select style={styles.select} value={year} onChange={(e) => setYear(e.target.value)}>{years.map((y) => <option key={y}>{y}</option>)}</select></label></div>
    {loading && <p style={styles.info}>Chargement de la comptabilité…</p>}{error && <p style={styles.error}>{error}</p>}
    {!loading && !error && subtab === "summary" && <><div style={styles.homeFinanceGrid}><div style={styles.accountingStat}><span>Recettes</span><strong>{money(summary.income)}</strong></div><div style={styles.accountingStat}><span>Dépenses</span><strong>{money(summary.expense)}</strong></div><div style={styles.accountingStat}><span>Solde indicatif</span><strong>{money(summary.result)}</strong></div><div style={styles.accountingStat}><span>Écritures</span><strong>{summary.count}</strong></div></div><p style={styles.muted}>Synthèse comptable indicative. Le traitement fiscal de la déclaration sera défini séparément selon le régime applicable à l'exercice.</p>{renderTable(yearEntries)}</>}
    {!loading && !error && ["income", "expense"].includes(subtab) && <><div style={styles.panelHeader}><h3>{subtab === "income" ? "Recettes" : "Dépenses"} {year}</h3><div style={styles.contactButtons}><button style={styles.smallButton} onClick={() => addDomain(subtab)}>+ Ajouter un domaine</button><button style={styles.addButton} onClick={() => openNew(subtab)}>+ Ajouter {subtab === "income" ? "une recette" : "une dépense"}</button></div></div>{renderTable(yearEntries.filter((entry) => entry.entry_kind === subtab))}</>}
    {!loading && !error && subtab === "assets" && <><h3>Immobilisations</h3><p style={styles.muted}>Inventaire des dépenses classées en immobilisation. Aucun amortissement fiscal n'est calculé automatiquement à ce stade.</p>{renderTable(yearEntries.filter((entry) => entry.treatment === "fixed_asset"))}</>}
    {!loading && !error && subtab === "imports" && <BookingImportPanel data={data} year={year} preview={bookingPreview} importing={bookingImporting} onFile={previewBookingFile} onCancel={() => setBookingPreview(null)} onValidate={validateBookingImport} />}
    {!loading && !error && subtab === "tax" && <TouristTaxDeclarationPanel year={year} />}
    {form && <EntryModal form={form} categories={data.categories} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} onClose={() => setForm(null)} onSave={save} />}
  </div>;
}
