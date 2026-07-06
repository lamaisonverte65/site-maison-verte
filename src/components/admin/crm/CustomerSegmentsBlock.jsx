import { styles } from "../adminStyles";

export default function CustomerSegmentsBlock({ segments = [], activeSegment, onSelectSegment, onClearSegment }) {
  return (
    <section style={styles.card}>
      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.subTitle}>Segments clients</h3>
          <p style={styles.muted}>Lecture rapide de la base client par groupes exploitables.</p>
        </div>
        {activeSegment && <button style={styles.smallButton} onClick={onClearSegment}>Tous les segments</button>}
      </div>

      <div style={styles.summaryGrid}>
        {segments.map((segment) => (
          <button
            key={segment.key}
            type="button"
            style={activeSegment === segment.key ? styles.acceptButton : styles.smallButton}
            onClick={() => onSelectSegment(segment.key)}
          >
            {segment.label} · {segment.customers.length}
          </button>
        ))}
      </div>

      {segments.map((segment) => activeSegment === segment.key && (
        <div key={segment.key} style={{ marginTop: "14px" }}>
          <strong>{segment.label}</strong>
          <p style={styles.muted}>{segment.description}</p>
        </div>
      ))}
    </section>
  );
}
