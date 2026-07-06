import { styles } from "../adminStyles";

const fieldStyle = { display: "grid", gap: "6px" };
const labelStyle = { fontSize: "12px", color: "#64748b", fontWeight: 700 };
const inputStyle = { ...styles.input, width: "100%", boxSizing: "border-box" };

export default function CustomerIdentityBlock({ customer, form, onChange }) {
  return (
    <section style={styles.card}>
      <h3 style={styles.subTitle}>Identité</h3>
      <div style={styles.detailGrid}>
        <label style={fieldStyle}><span style={labelStyle}>Nom</span><input style={inputStyle} value={form.last_name} onChange={(event) => onChange("last_name", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Prénom</span><input style={inputStyle} value={form.first_name} onChange={(event) => onChange("first_name", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Source</span><input style={inputStyle} value={form.source} onChange={(event) => onChange("source", event.target.value)} placeholder="direct, booking, airbnb..." /></label>
        <div style={styles.infoItem}>
          <span style={labelStyle}>Créé le</span>
          <strong>{customer.created_at ? new Date(customer.created_at).toLocaleDateString("fr-FR") : "-"}</strong>
        </div>
      </div>
    </section>
  );
}
