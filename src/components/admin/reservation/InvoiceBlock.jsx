import { useState } from "react";
import { styles } from "../adminStyles";
import { createBookingInvoiceDraft, createDirectInvoiceDraft, openInvoicePdf } from "../../../services/invoiceService";

const DIRECT_SOURCES = new Set(["website", "direct", "admin_client"]);

export default function InvoiceBlock({ request, invoice, onRefresh, onOpenInvoices }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const source = String(request?.source || "").toLowerCase();
  const directEligible = DIRECT_SOURCES.has(source);
  const bookingEligible = source === "booking_import" || source === "booking";
  const eligible = directEligible || bookingEligible;
  async function createDraft() {
    setBusy(true); setMessage("");
    try {
      if (bookingEligible) {
        await createBookingInvoiceDraft(request.id);
      } else await createDirectInvoiceDraft(request.id);
      setMessage("Brouillon créé."); await onRefresh?.();
    }
    catch (error) { setMessage(`Erreur : ${error.message}`); }
    finally { setBusy(false); }
  }
  async function viewPdf() { try { await openInvoicePdf(invoice.id); } catch (error) { setMessage(`Erreur : ${error.message}`); } }
  return <section style={{ marginTop:22 }}><h3 style={styles.subTitle}>Facture client</h3>
    {!invoice && eligible && <button style={styles.smallButton} disabled={busy} onClick={createDraft}>{busy ? "Création…" : "Créer la facture"}</button>}
    {!invoice && !eligible && <p style={styles.muted}>Création automatique non disponible pour cette source à ce stade.</p>}
    {invoice && <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><strong>{invoice.invoice_number || "Brouillon"}</strong><span>{invoice.status === "issued" ? "Émise" : "À vérifier avant émission"}</span>{invoice.pdf_storage_path && <button style={styles.smallButton} onClick={viewPdf}>Voir le PDF</button>}<button style={styles.smallButton} onClick={onOpenInvoices}>Ouvrir dans Factures</button></div>}
    {message && <p style={message.startsWith("Erreur") ? styles.error : styles.info}>{message}</p>}
  </section>;
}
