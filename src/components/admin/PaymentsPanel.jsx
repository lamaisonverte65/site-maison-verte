import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { styles } from "./adminStyles";
import { formatDate, formatMoney, formatDateTime } from "../../utils/adminFormatters";
import { usePaymentFilters } from "../../hooks/usePaymentFilters";
import PaymentSummary from "./payments/PaymentSummary";
import PaymentFilters from "./payments/PaymentFilters";
import PaymentAlerts from "./payments/PaymentAlerts";
import PaymentActions from "./payments/PaymentActions";
import PaymentTimeline from "./payments/PaymentTimeline";

const tableStyle = { ...styles.table, minWidth: 0, width: "100%", fontSize: 12, tableLayout: "auto" };
const cell = { ...styles.td, padding: "7px 6px", whiteSpace: "nowrap", verticalAlign: "middle", cursor: "default" };
const head = { ...styles.th, padding: "8px 6px", fontSize: 12 };
const compactDetail = { display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, padding: "6px 0" };

function DetailValue({ label, value }) {
  return <span><strong>{label} :</strong> {value ?? "—"}</span>;
}

function PaymentDetails({ row }) {
  const platform = row.source === "booking" || row.source === "airbnb";
  if (platform) return <>
    <div style={compactDetail}>
      <DetailValue label="Source" value={row.sourceLabel} />
      <DetailValue label="Référence réservation" value={row.externalReference} />
      <DetailValue label="Référence paiement" value={row.paymentReference} />
      <DetailValue label="Date versement" value={formatDate(row.paymentDate)} />
      <DetailValue label="Montant brut connu" value={formatMoney(row.confirmedAmount)} />
      <DetailValue label="Commission" value={formatMoney(row.commissionAmount)} />
      <DetailValue label="Frais de paiement" value={formatMoney(row.platformFeeAmount)} />
      <DetailValue label="Ménage" value={formatMoney(row.cleaningFeeAmount)} />
      <DetailValue label="Taxe versée par plateforme" value={formatMoney(row.touristTaxAmount)} />
      <DetailValue label="Net plateforme importé" value={formatMoney(row.platformNetAmount)} />
    </div>
    <p style={{ ...styles.muted, fontSize: 12, margin: "4px 0" }}>
      Valeurs issues du registre des imports. Montant inconnu = « — » ; aucun versement bancaire n'est déduit d'un net importé sans date de paiement.
    </p>
  </>;
  if (row.adminPaymentMethod === "cash") return <div style={compactDetail}>
    <DetailValue label="Mode" value="Espèces" />
    <DetailValue label="Encaissement" value={row.paymentStatus === "cash_pending" ? "À encaisser à l'arrivée" : "Encaissé et enregistré"} />
    <DetailValue label="Total contractuel" value={formatMoney(row.confirmedAmount)} />
    <DetailValue label="Montant reçu" value={formatMoney(row.paidClientAmount)} />
    <DetailValue label="Reste à encaisser" value={formatMoney(Math.max(Number(row.confirmedAmount || 0) - Number(row.paidClientAmount || 0), 0))} />
  </div>;
  return <>
    <div style={compactDetail}>
      <DetailValue label="Acompte" value={`${row.depositStatus} · ${formatMoney(row.amounts?.deposit)} · ${formatDateTime(row.depositPaidAt)}`} />
      <DetailValue label="Solde" value={`${row.balanceStatus} · ${formatMoney(row.amounts?.balance)} · ${formatDateTime(row.balancePaidAt)}`} />
      <DetailValue label="Acompte prévu" value={formatDateTime(row.depositDueAt)} />
      <DetailValue label="Solde prévu" value={formatDateTime(row.balanceDueAt)} />
      <DetailValue label="Demandeur (fiche réservation)" value={row.name} />
      <DetailValue label="Payeur Stripe" value="Identité non enregistrée dans cette fiche : peut être différente du demandeur" />
      <DetailValue label="Comptabilité Stripe" value={row.stripeEvidenceStatus} />
      <DetailValue label="Net Stripe après remboursements" value={row.stripeFinancialsComplete ? formatMoney(row.stripeNetAmount) : (Number(row.paidClientAmount || 0) <= 0 ? "Non applicable : non payé" : row.hasStripeReference ? "Frais / net à vérifier" : "Mode de paiement non identifié")} />
      <DetailValue label="Transactions Stripe reliées" value={row.linkedChargeCount ?? 0} />
      <DetailValue label="PaymentIntent" value={row.stripePaymentIntentId} />
      <DetailValue label="Session Checkout" value={row.stripeCheckoutSessionId} />
      <DetailValue label="Statut virement" value={row.stripeTransferStatus} />
      <DetailValue label="Payouts" value={row.payoutIds?.join(", ") || "Non rapproché"} />
      {row.paymentLink && <a href={row.paymentLink} target="_blank" rel="noreferrer">Lien de paiement Stripe</a>}
    </div>
    <PaymentTimeline row={row} />
  </>;
}

export default function PaymentsPanel({ paymentRows, platformReadError, focusedBookingId = null, onOpenCustomer, onOpenReservation, onOpenInvoices, onOpenCommunication, onOpenStripePayouts, onRefresh }) {
  const filters = usePaymentFilters(paymentRows);
  const [selectedPaymentRow, setSelectedPaymentRow] = useState(null);
  const [recordingCash, setRecordingCash] = useState(false);
  async function recordCashPayment(row) {
    const amount = Number(row.confirmedAmount || 0);
    if (!amount || recordingCash) return;
    if (!window.confirm(`Confirmer la réception effective de ${formatMoney(amount)} en espèces ? Cette action crée la recette comptable et ne doit être faite qu'après remise de l'argent.`)) return;
    setRecordingCash(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const date = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
      const res = await fetch("/.netlify/functions/admin-record-cash-payment", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify({ bookingId: row.bookingRequestId, receiptDate: date }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Échec de l'encaissement");
      setSelectedPaymentRow(null);
      await onRefresh?.();
      window.alert(`Espèces encaissées et enregistrées : ${formatMoney(result.amount)}.`);
    } catch (error) { window.alert(`Erreur : ${error.message}`); }
    finally { setRecordingCash(false); }
  }
  useEffect(() => {
    if (!focusedBookingId) return;
    const row = paymentRows.find((candidate) => String(candidate.bookingRequestId) === String(focusedBookingId));
    if (row) setSelectedPaymentRow(row);
  }, [focusedBookingId, paymentRows]);
  return (
    <section style={{ ...styles.panel, padding: 10 }}>
      {platformReadError && <p role="alert" style={{ ...styles.error, padding: 10, fontSize: 12 }}>
        Les données de paiement Booking/Airbnb sont indisponibles : {platformReadError}. Les données du site restent affichées.
      </p>}
      <PaymentSummary stats={filters.stats} />
      <PaymentAlerts stats={filters.stats} onSelectAlert={filters.showAlert} />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <div style={{ flex: "1 1 550px", minWidth: 0 }}><PaymentFilters filters={filters} /></div>
        <PaymentActions rows={filters.filteredRows} />
      </div>
      <div style={{ fontSize: 12, color: "#64748b", margin: "4px 0" }}>
        {filters.filteredRows.length} ligne(s) · Les montants des plateformes proviennent des imports comptables, et non de Stripe.
      </div>
      {focusedBookingId && !paymentRows.some((row) => String(row.bookingRequestId) === String(focusedBookingId)) &&
        <p role="status" style={{ ...styles.info, fontSize: 12 }}>Aucun paiement lié à cette réservation n'est enregistré.</p>}
      {selectedPaymentRow && (
        <section style={{ ...styles.reservationSheet, border: "1px solid #d7dfd9", borderRadius: 10, padding: 10, marginBottom: 8, gap: 4 }}>
          <div style={{ ...styles.detailHeader, alignItems: "center" }}>
            <strong>{selectedPaymentRow.name} · {selectedPaymentRow.sourceLabel}</strong>
            <button type="button" style={styles.smallButton} onClick={() => setSelectedPaymentRow(null)}>Fermer</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "7px 0" }} aria-label="Accès aux fiches liées">
            {selectedPaymentRow.bookingRequestId && <>
              <button type="button" style={styles.smallButton} onClick={() => onOpenCustomer?.(selectedPaymentRow)}>Fiche client</button>
              <button type="button" style={styles.smallButton} onClick={() => onOpenReservation?.(selectedPaymentRow)}>Réservation</button>
              <button type="button" style={styles.smallButton} onClick={() => onOpenInvoices?.(selectedPaymentRow)}>Factures</button>
              <button type="button" style={styles.smallButton} onClick={() => onOpenCommunication?.(selectedPaymentRow)}>Messages</button>
            </>}
            {selectedPaymentRow.source === "site" && <button type="button" style={styles.smallButton} onClick={() => onOpenStripePayouts?.(selectedPaymentRow)}>Virements Stripe</button>}
          </div>
          <PaymentDetails row={selectedPaymentRow} />
          {selectedPaymentRow.adminPaymentMethod === "cash" && selectedPaymentRow.paymentStatus === "cash_pending" && (
            <button type="button" style={styles.primaryButton || styles.smallButton} disabled={recordingCash} onClick={() => recordCashPayment(selectedPaymentRow)}>
              {recordingCash ? "Enregistrement…" : `Enregistrer le paiement en espèces (${formatMoney(selectedPaymentRow.confirmedAmount)})`}
            </button>
          )}
        </section>
      )}
      <div style={{ ...styles.tableWrapper, maxHeight: "66vh" }}>
        <table style={tableStyle}>
          <thead style={styles.stickyHead}><tr>
            {["Détail", "Client", "Origine", "Séjour", "Brut", "Reçu site", "Frais", "Net", "Reste", "Situation"].map((label) =>
              <th key={label} style={head}>{label}</th>)}
          </tr></thead>
          <tbody>
            {filters.filteredRows.map((row) => {
              const platform = row.source === "booking" || row.source === "airbnb";
              const remaining = platform || row.confirmedAmount == null ? null : Math.max(Number(row.confirmedAmount) - Number(row.paidClientAmount || 0), 0);
              const net = platform ? row.platformNetAmount : row.adminPaymentMethod === "cash" ? null : row.stripeFinancialsComplete ? row.stripeNetAmount : null;
              const fees = platform ? row.platformFeeAmount : row.stripeFeeAmount;
              const situation = platform ? row.paymentState : row.adminPaymentMethod === "cash"
                ? (row.paymentStatus === "cash_pending" ? "Espèces à encaisser" : "Espèces encaissées")
                : (Number(row.paidClientAmount || 0) <= 0 ? "Non payé" : remaining > 0 ? "Reste à encaisser" : row.stripeTransferStatus);
              return <tr key={row.id} style={selectedPaymentRow?.id === row.id ? styles.selectedRow : undefined}>
                <td style={cell}><button type="button" style={{ ...styles.smallButton, fontSize: 11, padding: "4px 7px" }} onClick={() => setSelectedPaymentRow(row)}>Voir</button></td>
                <td style={{ ...cell, maxWidth: 165, overflow: "hidden", textOverflow: "ellipsis" }} title={row.name}>{row.name}</td>
                <td style={cell}>{platform ? row.sourceLabel : row.source === "site" ? "Site" : "Autre"}</td>
                <td style={cell}>{formatDate(row.startDate)} – {formatDate(row.endDate)}</td>
                <td style={cell}>{formatMoney(row.confirmedAmount)}</td>
                <td style={cell}>{platform ? "—" : formatMoney(row.paidClientAmount)}</td>
                <td style={cell}>{formatMoney(fees)}</td>
                <td style={cell} title={platform ? "Net issu de l'import plateforme" : row.adminPaymentMethod === "cash" ? "Pas de Stripe pour les espèces" : "Net Stripe après remboursements"}>{row.adminPaymentMethod === "cash" ? "Sans Stripe" : net === null || net === undefined ? (platform ? "Non renseigné" : Number(row.paidClientAmount || 0) > 0 ? (row.hasStripeReference ? "Net à vérifier" : "Mode à vérifier") : "—") : formatMoney(net)}</td>
                <td style={cell}>{formatMoney(remaining)}</td>
                <td style={{ ...cell, maxWidth: 175, overflow: "hidden", textOverflow: "ellipsis" }} title={situation}>{situation}</td>
              </tr>;
            })}
            {!filters.filteredRows.length && <tr><td colSpan={10} style={cell}>Aucun paiement pour ces filtres.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
