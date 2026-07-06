import { styles } from "../adminStyles";
import { formatDateTime } from "../../../utils/adminFormatters";

const TYPE_LABELS = {
  email: "Email",
  event: "Action",
  message: "Message",
};

export default function ConversationTimeline({ items = [], onOpenReservation, onOpenCustomer }) {
  return (
    <section style={styles.reservationSheet}>
      <div style={styles.panelHeader}>
        <h3 style={styles.subTitle}>Chronologie de communication</h3>
        <p style={styles.muted}>Emails, messages et actions historisées dans un seul fil.</p>
      </div>

      {items.length === 0 ? (
        <p style={styles.empty}>Aucune communication trouvée pour ce contexte.</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {items.map((item) => (
            <article key={item.id} style={styles.noteBox}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                <div>
                  <strong>{TYPE_LABELS[item.type] || item.type} · {item.title}</strong>
                  <p style={styles.muted}>{formatDateTime(item.date)}</p>
                </div>
                <div style={styles.contactButtons}>
                  {item.reservation && (
                    <button style={styles.smallButton} onClick={() => onOpenReservation?.(item.reservation)}>
                      Réservation
                    </button>
                  )}
                  {item.customer && (
                    <button style={styles.smallButton} onClick={() => onOpenCustomer?.(item.customer)}>
                      Client
                    </button>
                  )}
                </div>
              </div>
              {item.description && <p style={{ marginBottom: 0 }}>{item.description}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
