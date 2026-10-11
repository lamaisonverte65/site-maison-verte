import { useState } from "react";
import { styles } from "../adminStyles";
import { createCleaningInvoiceDraft } from "../../../services/invoiceService";
import { requestCleaningPayment, updateCleaningIssue } from "../../../services/cleaningIssueService";

const STATUS_LABELS = {
  reported: "Signalé",
  confirmed: "Confirmé",
  payment_requested: "Paiement demandé",
  paid: "Payé",
  cancelled: "Annulé",
};

const money = (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));

export default function PostStayCleaningBlock({ request, issue, cleaningInvoice, linkedAdditionalCharges = [], onRefresh, onOpenInvoices, onCreateAdditionalCharge }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canReport = Boolean(request?.id);
  const hasBillableSnapshot = Number(issue?.amount_due || 0) > 0;
  const hasActiveLinkedCharge = linkedAdditionalCharges.some((charge) => charge.status !== "cancelled");

  async function run(action, fn, successMessage) {
    try {
      setBusy(true);
      setMessage("");
      await fn();
      setMessage(successMessage);
      if (action === "report") setNote("");
      await onRefresh?.();
    } catch (error) {
      setMessage(`Erreur : ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 18, padding: 14, border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" }}>
      <h3 style={{ ...styles.subTitle, marginTop: 0 }}>Ménage après séjour</h3>

      {!issue && canReport && (
        <div style={{ display: "grid", gap: 10 }}>
          <p style={styles.muted}>À utiliser seulement si le ménage n’a pas été choisi au départ et que l’état du logement justifie une facturation séparée.</p>
          <textarea
            style={{ ...styles.largeTextarea, width: "100%", minHeight: 100, boxSizing: "border-box" }}
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Constat ménage..."
          />
          <div><button type="button" style={styles.addButton} disabled={busy || !note.trim()} onClick={() => run("report", () => updateCleaningIssue(request.id, "report", note), "Ménage signalé.")}>Signaler le ménage</button></div>
        </div>
      )}

      {issue && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={styles.detailGrid}>
            <div style={styles.infoItem}><span>Statut</span><strong>{STATUS_LABELS[issue.status] || issue.status}</strong></div>
            <div style={styles.infoItem}><span>Montant automatique</span><strong>{hasBillableSnapshot ? money(issue.amount_due) : "Non disponible"}</strong></div>
            <div style={styles.infoItem}><span>Signalé le</span><strong>{issue.reported_at ? new Date(issue.reported_at).toLocaleString("fr-FR") : "—"}</strong></div>
          </div>
          <div style={styles.noteBox}><strong>Constat</strong><p>{issue.notes || "—"}</p></div>
          {!hasBillableSnapshot && issue.status === "reported" && !hasActiveLinkedCharge && (
            <div style={{ padding: 10, border: "1px solid #f59e0b", borderRadius: 10, background: "#fffbeb" }}>
              <p style={{ ...styles.muted, marginTop: 0 }}>Aucun montant automatique n’est disponible pour cette réservation. Le signalement reste enregistré ; aucun montant n’est inventé.</p>
              <button type="button" style={styles.addButton} disabled={busy} onClick={() => onCreateAdditionalCharge?.({
                category: "cleaning",
                reasonLabel: "Ménage après séjour",
                amount: "",
                customerMessage: "À la suite de votre séjour, un nettoyage complémentaire a été nécessaire.",
                cleaningIssueId: issue.id,
              })}>Créer une demande de paiement</button>
            </div>
          )}

          {hasActiveLinkedCharge && issue.status === "reported" && <p style={styles.info}>Ce signalement est pris en charge par une demande de paiement complémentaire affichée ci-dessous.</p>}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {issue.status === "reported" && !hasActiveLinkedCharge && <>
              {hasBillableSnapshot && <button type="button" style={styles.addButton} disabled={busy} onClick={() => run("confirm", () => updateCleaningIssue(request.id, "confirm"), "Facturation ménage confirmée.")}>Confirmer la facturation</button>}
              <button type="button" style={styles.smallButton} disabled={busy} onClick={() => run("cancel", () => updateCleaningIssue(request.id, "cancel"), "Dossier ménage annulé.")}>Annuler</button>
            </>}
            {issue.status === "confirmed" && <>
              <button type="button" style={styles.addButton} disabled={busy} onClick={() => run("payment", () => requestCleaningPayment(request.id), "Lien de paiement ménage envoyé.")}>Envoyer le lien de paiement</button>
              <button type="button" style={styles.smallButton} disabled={busy} onClick={() => run("cancel", () => updateCleaningIssue(request.id, "cancel"), "Dossier ménage annulé.")}>Annuler</button>
            </>}
            {issue.status === "payment_requested" && <>
              <button type="button" style={styles.addButton} disabled={busy} onClick={() => run("payment", () => requestCleaningPayment(request.id), "Nouveau lien de paiement ménage envoyé.")}>Renvoyer le lien</button>
              <button type="button" style={styles.smallButton} disabled={busy} onClick={() => run("cancel", () => updateCleaningIssue(request.id, "cancel"), "Dossier ménage annulé.")}>Annuler</button>
            </>}
            {issue.status === "paid" && !cleaningInvoice && (
              <button type="button" style={styles.addButton} disabled={busy} onClick={() => run("invoice", () => createCleaningInvoiceDraft(request.id), "Brouillon de facture ménage créé.")}>Créer la facture ménage</button>
            )}
            {issue.status === "paid" && cleaningInvoice && (
              <button type="button" style={styles.smallButton} onClick={() => onOpenInvoices?.()}>Ouvrir la facture ménage</button>
            )}
          </div>
        </div>
      )}

      {message && <p style={message.startsWith("Erreur") ? styles.error : styles.info}>{message}</p>}
    </section>
  );
}
