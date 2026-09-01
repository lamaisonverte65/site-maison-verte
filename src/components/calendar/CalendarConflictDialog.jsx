import { getExternalConflictDisplayState } from "../admin/calendar/externalConflictPresentation";

export default function CalendarConflictDialog({ conflicts = [], error = "", onClose, onOpenLocal }) {
  const displayState = getExternalConflictDisplayState(conflicts, error);
  if (displayState.kind === "clear") return null;
  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <strong>{displayState.message}</strong>
        <button style={styles.button} type="button" onClick={onClose}>Fermer</button>
      </div>
      {error && <p style={styles.item}>{error}</p>}
      {conflicts.map((conflict) => (
        <div key={conflict.id} style={styles.item}>
          <strong>{conflict.source === "airbnb" ? "Airbnb" : "Booking"}</strong>
          <div>Période externe : {conflict.externalStartDate} → {conflict.externalEndDate}</div>
          <div>{conflict.localKind === "calendar_block" ? "Blocage administrateur" : "Réservation directe"} : {conflict.localStartDate} → {conflict.localEndDate}</div>
          {conflict.localKind === "booking_request" && onOpenLocal && (
            <button style={styles.openButton} type="button" onClick={() => onOpenLocal(conflict)}>
              Ouvrir la réservation locale
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
const styles = {
  panel: { padding: "14px", borderRadius: "16px", border: "1px solid #fdba74", background: "#fff7ed", color: "#9a3412", marginBottom: "12px" },
  header: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" },
  item: { margin: "10px 0 0", paddingTop: "8px", borderTop: "1px solid #fed7aa" },
  button: { border: "none", borderRadius: "999px", padding: "6px 10px", background: "#fed7aa", cursor: "pointer", fontWeight: 800 },
  openButton: { marginTop: "7px", border: "1px solid #fb923c", borderRadius: "999px", padding: "6px 10px", background: "#fff", color: "#9a3412", cursor: "pointer", fontWeight: 700 },
};
