import { styles } from "../adminStyles";
import { formatDateTime } from "../../../utils/adminFormatters";

function getTypeLabel(type) {
  const labels = {
    reservation: "Réservation",
    payment: "Paiement",
    stripe: "Stripe",
    email: "Email",
    event: "Action",
  };
  return labels[type] || "Historique";
}

export default function TimelineBlock({ items = [] }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h3 style={styles.subTitle}>Timeline du séjour</h3>
      {items.length === 0 ? (
        <p style={styles.empty}>Aucun événement à afficher.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => (
            <div key={item.id} style={{ ...styles.noteBox, margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{item.title}</strong>
                <span style={styles.muted}>{formatDateTime(item.date)} · {getTypeLabel(item.type)}</span>
              </div>
              {item.description && <p style={{ marginBottom: 0 }}>{item.description}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
