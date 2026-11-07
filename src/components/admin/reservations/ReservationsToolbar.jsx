import ReservationsFilters from "./ReservationsFilters";
import ReservationsBulkActions from "./ReservationsBulkActions";
import { exportReservationsCsv } from "./ReservationsExport";

export default function ReservationsToolbar({
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
    <div style={{ marginBottom: "9px" }}>
      <ReservationsFilters
        filters={filters}
        onFilterChange={onFilterChange}
        onReset={onResetFilters}
        tableSearch={tableSearch}
        onTableSearchChange={onTableSearchChange}
        onExport={() => exportReservationsCsv(visibleReservations, "reservations_filtrees.csv")}
      />
      <ReservationsBulkActions selectedReservations={selectedReservations} onClearSelection={onClearSelection} />
    </div>
  );
}
