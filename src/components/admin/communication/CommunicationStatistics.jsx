import { styles } from "../adminStyles";
import { formatDateTime } from "../../../utils/adminFormatters";

export default function CommunicationStatistics({ statistics }) {
  const statuses = Object.entries(statistics.emailStatusCounts || {});

  return (
    <section style={styles.reservationSheet}>
      <h3 style={styles.subTitle}>Statistiques communication</h3>
      <div style={styles.summaryGrid}>
        <div style={styles.infoItem}><span>Total filtré</span><strong>{statistics.total}</strong></div>
        <div style={styles.infoItem}><span>Emails filtrés</span><strong>{statistics.emails}</strong></div>
        <div style={styles.infoItem}><span>Actions filtrées</span><strong>{statistics.events}</strong></div>
        <div style={styles.infoItem}><span>Messages filtrés</span><strong>{statistics.messages}</strong></div>
        <div style={styles.infoItem}><span>Dernière communication</span><strong>{formatDateTime(statistics.lastItem?.date)}</strong></div>
      </div>

      {statuses.length > 0 && (
        <div style={{ marginTop: "14px" }}>
          <h4 style={{ marginBottom: "8px" }}>Statuts emails</h4>
          <div style={styles.chipList}>
            {statuses.map(([status, count]) => (
              <span key={status} style={styles.historyChip}>{status} · {count}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
