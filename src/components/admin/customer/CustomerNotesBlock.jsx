import { styles } from "../adminStyles";

const fieldStyle = { display: "grid", gap: "6px" };
const labelStyle = { fontSize: "12px", color: "#64748b", fontWeight: 700 };
const textareaStyle = { ...styles.largeTextarea, minHeight: "150px", width: "100%", boxSizing: "border-box" };

export default function CustomerNotesBlock({ form, onChange }) {
  return (
    <section style={styles.card}>
      <h3 style={styles.subTitle}>Infos utiles fiche client</h3>
      <div style={{ display: "grid", gap: "14px" }}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Notes permanentes / infos utiles</span>
          <textarea
            style={textareaStyle}
            value={form.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            placeholder="Notes internes générales sur le client..."
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Infos utiles ménage / accueil</span>
          <textarea
            style={textareaStyle}
            value={form.housekeeping_notes}
            onChange={(event) => onChange("housekeeping_notes", event.target.value)}
            placeholder="Informations utiles pour le ménage : particularités, objets fragiles, accès, consignes..."
          />
        </label>
      </div>
    </section>
  );
}
