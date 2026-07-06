import { styles } from "../adminStyles";
import ReservationsFilters from "./ReservationsFilters";
import ReservationsBulkActions from "./ReservationsBulkActions";
import { exportReservationsCsv } from "./ReservationsExport";

export default function ReservationsToolbar({
  totalCount,
  visibleCount,
  tableSearch,
  onTableSearchChange,
  filters,
  onFilterChange,
  onResetFilters,
  selectedReservations,
  onClearSelection,
  visibleReservations,
}) {
  return (
    <div style={{ marginTop: "18px", marginBottom: "18px" }}>
      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.subTitle}>Pilotage des réservations</h3>
          <p style={styles.muted}>{visibleCount} réservation{visibleCount > 1 ? "s" : ""} affichée{visibleCount > 1 ? "s" : ""} sur {totalCount}.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.smallButton} onClick={() => exportReservationsCsv(visibleReservations, "reservations_filtrees.csv")}>Exporter la liste filtrée</button>
        </div>
      </div>

      <div style={styles.toolbar}>
        <input
          style={styles.searchInput}
          value={tableSearch}
          onChange={(event) => onTableSearchChange(event.target.value)}
          placeholder="Recherche dans les réservations affichées..."
        />
      </div>

      <ReservationsFilters filters={filters} onFilterChange={onFilterChange} onReset={onResetFilters} />

      <ReservationsBulkActions selectedReservations={selectedReservations} onClearSelection={onClearSelection} />
    </div>
  );
}
