import { styles } from "../adminStyles";

const fieldStyle = { display: "grid", gap: "6px" };
const labelStyle = { fontSize: "12px", color: "#64748b", fontWeight: 700 };
const inputStyle = { ...styles.input, width: "100%", boxSizing: "border-box" };

export default function CustomerLoyaltyBlock({ reservations, form, onChange }) {
  return (
    <section style={styles.card}>
      <h3 style={styles.subTitle}>Relation client</h3>
      <div style={styles.detailGrid}>
        <label style={fieldStyle}><span style={labelStyle}>Séjours</span><input style={inputStyle} type="number" min="0" value={form.booking_count} onChange={(event) => onChange("booking_count", event.target.value)} placeholder={String(reservations.length || 0)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>1ère réservation</span><input style={inputStyle} type="date" value={form.first_stay ? String(form.first_stay).slice(0, 10) : ""} onChange={(event) => onChange("first_stay", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Dernière réservation</span><input style={inputStyle} type="date" value={form.last_stay ? String(form.last_stay).slice(0, 10) : ""} onChange={(event) => onChange("last_stay", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Total dépensé</span><input style={inputStyle} inputMode="decimal" value={form.total_spent} onChange={(event) => onChange("total_spent", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Net propriétaire</span><input style={inputStyle} inputMode="decimal" value={form.owner_net_total} onChange={(event) => onChange("owner_net_total", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Remise fidélité (%)</span><input style={inputStyle} inputMode="decimal" value={form.loyalty_discount_percent} onChange={(event) => onChange("loyalty_discount_percent", event.target.value)} /></label>
        <label style={{ ...fieldStyle, alignContent: "center" }}>
          <span style={labelStyle}>Opt-in marketing</span>
          <span style={{ display: "flex", gap: "8px", alignItems: "center", minHeight: "44px" }}>
            <input type="checkbox" checked={Boolean(form.marketing_consent)} onChange={(event) => onChange("marketing_consent", event.target.checked)} />
            {form.marketing_consent ? "Oui" : "Non"}
          </span>
        </label>
      </div>
    </section>
  );
}
