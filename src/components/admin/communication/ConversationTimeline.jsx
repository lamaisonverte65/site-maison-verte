import { styles } from "../adminStyles";
import { formatDateTime } from "../../../utils/adminFormatters";

export default function ConversationTimeline({ items = [], onOpenReservation, onOpenCustomer, onOpenPayments, onOpenInvoices }) {
  return (
    <section aria-label="Messages clients et propriétaire" style={{ display: "grid", gap: 6 }}>
      {items.length === 0 ? <p style={styles.empty}>Aucun message enregistré.</p> : items.map((item) => (
        <article key={item.id} style={{ background: item.type === "message" ? "#f0fdf4" : "#f8fafc", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 9 }}>
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
            <strong style={{ fontSize: 13 }}>{item.title}</strong>
            <small style={{ color: "#64748b" }}>{formatDateTime(item.date)}</small>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {item.reservation && <>
                <button style={styles.smallButton} onClick={() => onOpenReservation?.(item.reservation)}>Séjour</button>
                <button style={styles.smallButton} onClick={() => onOpenPayments?.(item.reservation)}>Paiement</button>
                <button style={styles.smallButton} onClick={() => onOpenInvoices?.(item.reservation)}>Factures</button>
              </>}
              {item.customer && <button style={styles.smallButton} onClick={() => onOpenCustomer?.(item.customer)}>Client</button>}
            </div>
          </div>
          <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0", fontSize: 13 }}>{item.description}</p>
        </article>
      ))}
    </section>
  );
}
