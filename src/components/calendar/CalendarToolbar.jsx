export default function CalendarToolbar({ loading, summary = {}, selectedPeriod, pendingRangeStart, onRefresh, onClearSelection }) {
  return (
    <section style={styles.toolbar}>
      <div>
        <p style={styles.kicker}>Calendrier admin</p>
        <h3 style={styles.title}>Disponibilités, blocages, réservations et tarifs</h3>
        <p style={styles.muted}>Sélectionne une période pour bloquer, créer une réservation ou appliquer un tarif spécifique.</p>
      </div>

      <div style={styles.actions}>
        <button style={styles.secondaryButton} type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Chargement..." : "Actualiser"}
        </button>
        {(selectedPeriod || pendingRangeStart) && (
          <button style={styles.warningButton} type="button" onClick={onClearSelection}>
            Effacer la sélection
          </button>
        )}
      </div>

      <div style={styles.stats}>
        <Stat label="Direct" value={summary.direct} />
        <Stat label="Booking / Airbnb" value={summary.external} />
        <Stat label="Blocages" value={summary.adminBlocks} />
        <Stat label="Règles tarifaires" value={summary.priceRules} />
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <strong>{value ?? 0}</strong>
      <span>{label}</span>
    </div>
  );
}

const styles = {
  toolbar: { display: "grid", gap: "14px", marginBottom: "18px", padding: "18px", borderRadius: "22px", border: "1px solid #e2e8f0", background: "#f8fafc" },
  kicker: { margin: 0, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.78rem", fontWeight: 900 },
  title: { margin: "4px 0", color: "#1f6f3d", fontSize: "1.25rem" },
  muted: { margin: 0, color: "#64748b", lineHeight: 1.5 },
  actions: { display: "flex", gap: "10px", flexWrap: "wrap" },
  secondaryButton: { border: "none", borderRadius: "999px", padding: "10px 14px", background: "#2f4f35", color: "white", cursor: "pointer", fontWeight: 800 },
  warningButton: { border: "none", borderRadius: "999px", padding: "10px 14px", background: "#f97316", color: "white", cursor: "pointer", fontWeight: 800 },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" },
  stat: { display: "grid", gap: "2px", padding: "12px", borderRadius: "16px", background: "white", border: "1px solid #e5e7eb" },
};
