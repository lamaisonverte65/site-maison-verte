export default function CalendarFilters({ filters, onChange }) {
  return (
    <section style={styles.panel}>
      <strong>Filtres calendrier</strong>
      <label style={styles.line}><input type="checkbox" checked={filters.showDirect} onChange={(event) => onChange({ ...filters, showDirect: event.target.checked })} />Réservations directes</label>
      <label style={styles.line}><input type="checkbox" checked={filters.showExternal} onChange={(event) => onChange({ ...filters, showExternal: event.target.checked })} />Booking / Airbnb</label>
      <label style={styles.line}><input type="checkbox" checked={filters.showBlocks} onChange={(event) => onChange({ ...filters, showBlocks: event.target.checked })} />Blocages admin</label>
    </section>
  );
}

const styles = { panel: { display: "grid", gap: "8px", padding: "14px", borderRadius: "16px", border: "1px solid #e5e7eb", background: "#ffffff" }, line: { display: "flex", alignItems: "center", gap: "8px", color: "#334155", fontWeight: 700 } };
