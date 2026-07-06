export default function CalendarConflictDialog({ conflicts = [], onClose }) {
  if (!conflicts.length) return null;
  return (
    <section style={styles.panel}>
      <div style={styles.header}><strong>Conflits détectés</strong><button style={styles.button} type="button" onClick={onClose}>Fermer</button></div>
      {conflicts.map((conflict) => <p key={conflict.id || conflict.title} style={styles.item}>{conflict.title || "Occupation"} · {conflict.start} → {conflict.end}</p>)}
    </section>
  );
}
const styles = { panel: { padding: "14px", borderRadius: "16px", border: "1px solid #fdba74", background: "#fff7ed", color: "#9a3412", marginBottom: "12px" }, header: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }, item: { margin: "8px 0 0" }, button: { border: "none", borderRadius: "999px", padding: "6px 10px", background: "#fed7aa", cursor: "pointer", fontWeight: 800 } };
