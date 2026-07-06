import { styles } from "../adminStyles";

export default function CommunicationSummary({ stats, filteredCount }) {
  return (
    <section style={styles.statsGrid}>
      <div style={styles.statCard}><span>Total visible</span><strong>{filteredCount}</strong></div>
      <div style={styles.statCard}><span>Emails</span><strong>{stats.emails}</strong></div>
      <div style={styles.statCard}><span>Actions</span><strong>{stats.events}</strong></div>
      <div style={styles.statCard}><span>Messages</span><strong>{stats.messages}</strong></div>
    </section>
  );
}
