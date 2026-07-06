export default function ReservationPreview({ reservation, onOpen }) {
  if (!reservation) return null;
  const name = [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ") || "Client";
  return (
    <section style={styles.card}>
      <p style={styles.kicker}>Aperçu réservation</p>
      <strong>{name}</strong>
      <p style={styles.muted}>{reservation.start_date} → {reservation.end_date}</p>
      <p style={styles.muted}>Statut : {reservation.status || "-"}</p>
      <button style={styles.button} type="button" onClick={() => onOpen?.(reservation)}>Ouvrir la fiche</button>
    </section>
  );
}
const styles = { card: { padding: "14px", borderRadius: "16px", border: "1px solid #e5e7eb", background: "#ffffff", marginBottom: "12px" }, kicker: { margin: 0, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.75rem", fontWeight: 900 }, muted: { color: "#64748b", margin: "6px 0" }, button: { border: "none", borderRadius: "999px", padding: "8px 12px", background: "#2f4f35", color: "white", cursor: "pointer", fontWeight: 800 } };
