import { styles } from "../adminStyles";

const fieldStyle = { display: "grid", gap: "6px" };
const labelStyle = { fontSize: "12px", color: "#64748b", fontWeight: 700 };
const inputStyle = { ...styles.input, width: "100%", boxSizing: "border-box" };

export default function CustomerContactBlock({ customer, form, onChange, contactActions }) {
  return (
    <section style={styles.card}>
      <h3 style={styles.subTitle}>Coordonnées</h3>
      <div style={styles.detailGrid}>
        <label style={fieldStyle}><span style={labelStyle}>Téléphone</span><input style={inputStyle} value={form.phone} onChange={(event) => onChange("phone", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Email</span><input style={inputStyle} type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Adresse</span><input style={inputStyle} value={form.address} onChange={(event) => onChange("address", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Code postal</span><input style={inputStyle} value={form.postal_code} onChange={(event) => onChange("postal_code", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Ville</span><input style={inputStyle} value={form.city} onChange={(event) => onChange("city", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Pays</span><input style={inputStyle} value={form.country} onChange={(event) => onChange("country", event.target.value)} /></label>
      </div>
      <div style={{ ...styles.contactButtons, marginTop: "12px" }}>
        <button style={styles.smallButton} onClick={() => contactActions.email(form.email || customer.email)}>Email</button>
        <button style={styles.smallButton} onClick={() => contactActions.phone(form.phone || customer.phone)}>Appel</button>
        <button style={styles.smallButton} onClick={() => contactActions.sms(form.phone || customer.phone)}>SMS</button>
      </div>
    </section>
  );
}
