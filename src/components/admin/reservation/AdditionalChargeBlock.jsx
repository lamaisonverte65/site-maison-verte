import { useEffect, useRef, useState } from "react";
import { styles } from "../adminStyles";
import {
  cancelAdditionalCharge,
  createAdditionalCharge,
  createAdditionalChargeInvoiceDraft,
  requestAdditionalChargePayment,
} from "../../../services/additionalChargeService";

const STATUS_LABELS = {
  draft: "Brouillon",
  payment_requested: "Paiement demandé",
  paid: "Payé",
  cancelled: "Annulé",
};
const money = (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));

export default function AdditionalChargeBlock({ request, charges = [], invoices = [], prefill = null, onRefresh, onOpenInvoices }) {
  const [open, setOpen] = useState(false);
  const [reasonLabel, setReasonLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [category, setCategory] = useState("other");
  const [cleaningIssueId, setCleaningIssueId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const sectionRef = useRef(null);
  const reasonInputRef = useRef(null);
  const clientEmail = String(request?.guest_email || "").trim();
  const hasClientEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail);

  useEffect(() => {
    if (!prefill) return;
    setReasonLabel(prefill.reasonLabel || "");
    setAmount(prefill.amount == null ? "" : String(prefill.amount));
    setCustomerMessage(prefill.customerMessage || "");
    setCategory(prefill.category || "other");
    setCleaningIssueId(prefill.cleaningIssueId || null);
    setOpen(true);
    setMessage("");
  }, [prefill?.nonce]);

  useEffect(() => {
    if (!open || !prefill?.nonce) return;
    const frame = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      reasonInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, prefill?.nonce]);

  function resetForm() {
    setReasonLabel("");
    setAmount("");
    setCustomerMessage("");
    setCategory("other");
    setCleaningIssueId(null);
  }

  async function submitAndSend() {
    if (!hasClientEmail) {
      setMessage("Erreur : Aucune adresse email client n’est renseignée pour cette réservation.");
      return;
    }
    try {
      setBusy(true);
      setMessage("");
      const created = await createAdditionalCharge({
        bookingId: request.id,
        category,
        reasonLabel,
        amount,
        customerMessage,
        cleaningIssueId,
      });
      const sent = await requestAdditionalChargePayment(created.charge.id);
      setMessage(sent.notificationPending
        ? "Demande créée et lien Stripe généré, mais l’email client reste à renvoyer."
        : "Demande de paiement complémentaire envoyée au client.");
      setOpen(false);
      resetForm();
      await onRefresh?.();
    } catch (error) {
      setMessage(`Erreur : ${error.message}`);
      await onRefresh?.();
    } finally {
      setBusy(false);
    }
  }

  async function runChargeAction(fn, success) {
    try {
      setBusy(true);
      setMessage("");
      const result = await fn();
      setMessage(result?.notificationPending ? `${success} Email à renvoyer.` : success);
      await onRefresh?.();
    } catch (error) {
      setMessage(`Erreur : ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section ref={sectionRef} style={{ marginTop: 18, padding: 14, border: "1px solid #dbeafe", borderRadius: 16, background: "#f8fbff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ ...styles.subTitle, margin: 0 }}>Paiements complémentaires</h3>
          <p style={{ ...styles.muted, margin: "4px 0 0" }}>Demande indépendante de l’acompte, du solde et du total contractuel.</p>
        </div>
        <button type="button" style={styles.smallButton} onClick={() => { setOpen((value) => !value); setMessage(""); }}>
          {open ? "Fermer" : "Créer une demande de paiement complémentaire"}
        </button>
      </div>

      {open && (
        <div style={{ display: "grid", gap: 10, marginTop: 14, padding: 12, border: "1px solid #bfdbfe", borderRadius: 12, background: "#fff" }}>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Motif</span>
            <input ref={reasonInputRef} style={styles.input} value={reasonLabel} maxLength={200} onChange={(event) => setReasonLabel(event.target.value)} placeholder="Ex. Dégradation, lit supplémentaire, ménage partiel…" />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Montant (€)</span>
            <input style={styles.input} type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50,00" />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Message client</span>
            <textarea style={{ ...styles.largeTextarea, minHeight: 100 }} value={customerMessage} maxLength={3000} onChange={(event) => setCustomerMessage(event.target.value)} placeholder="Message explicatif joint à l’email de paiement…" />
          </label>
          {!hasClientEmail && <p style={{ ...styles.error, margin: 0 }}>Aucune adresse email client n’est renseignée : impossible d’envoyer une demande de paiement.</p>}
          <div>
            <button type="button" style={styles.addButton} disabled={busy || !hasClientEmail || !reasonLabel.trim() || !(Number(String(amount).replace(",", ".")) > 0)} onClick={submitAndSend}>
              {busy ? "Traitement…" : "Envoyer le lien de paiement"}
            </button>
          </div>
        </div>
      )}

      {charges.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {charges.map((charge) => {
            const invoice = invoices.find((item) => item.additional_charge_id === charge.id) || null;
            return <div key={charge.id} style={{ padding: 10, border: "1px solid #e2e8f0", borderRadius: 10, background: "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span><strong>{charge.reason_label}</strong> — {money(charge.amount)}</span>
                <span>{STATUS_LABELS[charge.status] || charge.status}</span>
              </div>
              {charge.customer_message && <p style={{ ...styles.muted, margin: "6px 0" }}>{charge.customer_message}</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {charge.status === "draft" && <button type="button" style={styles.addButton} disabled={busy || !hasClientEmail} onClick={() => runChargeAction(() => requestAdditionalChargePayment(charge.id), "Lien de paiement envoyé.")}>Envoyer le lien</button>}
                {charge.status === "payment_requested" && <button type="button" style={styles.addButton} disabled={busy || !hasClientEmail} onClick={() => runChargeAction(() => requestAdditionalChargePayment(charge.id), "Nouveau lien de paiement envoyé.")}>Renvoyer le lien</button>}
                {["draft", "payment_requested"].includes(charge.status) && <button type="button" style={styles.smallButton} disabled={busy} onClick={() => runChargeAction(() => cancelAdditionalCharge(charge.id), "Demande annulée.")}>Annuler</button>}
                {charge.status === "paid" && !invoice && <button type="button" style={styles.addButton} disabled={busy} onClick={() => runChargeAction(() => createAdditionalChargeInvoiceDraft(charge.id), "Brouillon de facture complémentaire créé.")}>Créer la facture</button>}
                {charge.status === "paid" && invoice && <button type="button" style={styles.smallButton} onClick={() => onOpenInvoices?.()}>Ouvrir la facture</button>}
              </div>
            </div>;
          })}
        </div>
      )}

      {message && <p style={message.startsWith("Erreur") ? styles.error : styles.info}>{message}</p>}
    </section>
  );
}
