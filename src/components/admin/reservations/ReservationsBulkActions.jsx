import { styles } from "../adminStyles";
import { exportReservationsCsv } from "./ReservationsExport";

export default function ReservationsBulkActions({ selectedReservations, onClearSelection }) {
  const selectedCount = selectedReservations.length;

  if (selectedCount === 0) {
    return <p style={styles.muted}>Aucune réservation sélectionnée.</p>;
  }

  return (
    <div style={{ ...styles.actions, marginTop: "12px", marginBottom: "12px" }}>
      <strong>{selectedCount} réservation{selectedCount > 1 ? "s" : ""} sélectionnée{selectedCount > 1 ? "s" : ""}</strong>
      <button style={styles.smallButton} onClick={() => exportReservationsCsv(selectedReservations, "reservations_selection.csv")}>Exporter la sélection</button>
      <button style={styles.smallButton} onClick={onClearSelection}>Vider la sélection</button>
    </div>
  );
}
