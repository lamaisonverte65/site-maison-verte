import { styles } from "../adminStyles";

export default function MessageTemplatesBlock({ templates = [] }) {
  return (
    <section style={styles.reservationSheet}>
      <h3 style={styles.subTitle}>Modèles prévus</h3>
      <p style={styles.muted}>Première version en lecture seule : les envois restent gérés par les actions existantes.</p>
      <div style={styles.summaryGrid}>
        {templates.map((template) => (
          <div key={template.key} style={styles.infoItem}>
            <span>{template.label}</span>
            <strong>{template.description}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
