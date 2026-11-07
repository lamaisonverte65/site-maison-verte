import { styles } from "./adminStyles";
import ReservationsToolbar from "./reservations/ReservationsToolbar";
import ReservationsTable from "./reservations/ReservationsTable";
import { useReservationsTable } from "../../hooks/useReservationsTable";

export default function ReservationsPanel({
  sortedReservations,
  selectedRequest,
  onSelectReservation,
}) {
  const table = useReservationsTable(sortedReservations);

  return (
    <section style={styles.panel}>
      <ReservationsToolbar
        tableSearch={table.tableSearch}
        onTableSearchChange={table.setTableSearch}
        filters={table.filters}
        onFilterChange={table.updateFilter}
        onResetFilters={table.resetFilters}
        selectedReservations={table.selectedReservations}
        onClearSelection={table.clearSelection}
        visibleReservations={table.visibleReservations}
      />

      <ReservationsTable
        reservations={table.visibleReservations}
        selectedRequest={selectedRequest}
        selectedIds={table.selectedIds}
        sort={table.sort}
        onSort={table.updateSort}
        onSelectReservation={onSelectReservation}
        onToggleReservation={table.toggleReservation}
        onToggleAllVisible={table.toggleAllVisible}
      />
    </section>
  );
}
