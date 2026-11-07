export default function CalendarToolbar({ summary = {}, selectedPeriod, pendingRangeStart, onClearSelection }) {
  return (
    <div style={styles.bar}>
      <div style={styles.stats} aria-label="Statistiques du calendrier chargé">
        <Stat label="Direct" value={summary.direct} />
        <Stat label="Booking / Airbnb" value={summary.external} />
        <Stat label="Blocages" value={summary.adminBlocks} />
        <Stat label="Règles tarifaires" value={summary.priceRules} />
      </div>
      {(selectedPeriod || pendingRangeStart) && (
        <button style={styles.clear} type="button" onClick={onClearSelection}>Effacer la sélection</button>
      )}
    </div>
  );
}
function Stat({ label, value }) {
  return <span style={styles.stat}><strong>{value ?? 0}</strong> {label}</span>;
}
const styles = {
  bar: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 8 },
  stats: { display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12, color: "#475569" },
  stat: { whiteSpace: "nowrap" },
  clear: { border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", background: "#fed7aa", color: "#7c2d12", fontSize: 12 },
};
