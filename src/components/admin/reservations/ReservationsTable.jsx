import { styles } from "../adminStyles";
import { StatusBadge } from "../AdminUi";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  getAmounts,
  getBalanceStatus,
  getDepositStatus,
  normalizeSource,
  shortId,
} from "../../../utils/adminFormatters";

function SortButton({ label, sortKey, sort, onSort }) {
  const isActive = sort.key === sortKey;
  const suffix = !isActive ? "" : sort.direction === "asc" ? " ↑" : " ↓";

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      style={{
        border: "none",
        background: "transparent",
        font: "inherit",
        fontWeight: isActive ? 700 : 600,
        cursor: "pointer",
        padding: 0,
        textAlign: "left",
      }}
    >
      {label}{suffix}
    </button>
  );
}
function displayFirstName(request = {}) {
  return request.guest_first_name || request.first_name || "-";
}

function displayLastName(request = {}) {
  return (
    request.guest_last_name ||
    request.last_name ||
    request.display_name ||
    request.title ||
    "-"
  );
}

export default function ReservationsTable({
  reservations,
  selectedRequest,
  selectedIds,
  sort,
  onSort,
  onSelectReservation,
  onToggleReservation,
  onToggleAllVisible,
}) {
  const allVisibleSelected = reservations.length > 0 && reservations.every((reservation) => selectedIds.includes(reservation.id));

  if (reservations.length === 0) {
    return <p style={styles.empty}>Aucune réservation trouvée.</p>;
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead style={styles.stickyHead}>
          <tr>
            <th style={styles.th}>
              <input type="checkbox" checked={allVisibleSelected} onChange={onToggleAllVisible} aria-label="Sélectionner les réservations visibles" />
            </th>
            <th style={styles.th}><SortButton label="N° résa" sortKey="id" sort={sort} onSort={onSort} /></th>
            <th style={styles.th}><SortButton label="Prénom" sortKey="guest_first_name" sort={sort} onSort={onSort} /></th>
            <th style={styles.th}><SortButton label="Nom" sortKey="guest_last_name" sort={sort} onSort={onSort} /></th>
            <th style={styles.th}><SortButton label="Source" sortKey="source" sort={sort} onSort={onSort} /></th>
            <th style={styles.th}><SortButton label="Date demande" sortKey="created_at" sort={sort} onSort={onSort} /></th>
            <th style={styles.th}><SortButton label="Début séjour" sortKey="start_date" sort={sort} onSort={onSort} /></th>
            <th style={styles.th}><SortButton label="Fin séjour" sortKey="end_date" sort={sort} onSort={onSort} /></th>
            <th style={styles.th}><SortButton label="Statut" sortKey="status" sort={sort} onSort={onSort} /></th>
            <th style={styles.th}><SortButton label="Acompte" sortKey="deposit" sort={sort} onSort={onSort} /></th>
            <th style={styles.th}><SortButton label="Solde" sortKey="balance" sort={sort} onSort={onSort} /></th>
            <th style={styles.th}><SortButton label="Total" sortKey="total" sort={sort} onSort={onSort} /></th>
            <th style={styles.th}><SortButton label="Total payé" sortKey="paid" sort={sort} onSort={onSort} /></th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((request) => {
            const amounts = getAmounts(request);
            const isSelected = selectedIds.includes(request.id);

            return (
              <tr
                key={request.id}
                onClick={() => onSelectReservation(request)}
                style={selectedRequest?.id === request.id ? styles.selectedRow : styles.clickableRow}
              >
                <td style={styles.td} onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleReservation(request.id)}
                    aria-label={`Sélectionner ${shortId(request.id)}`}
                  />
                </td>
                <td style={styles.td}>{shortId(request.id)}</td>
                <td style={styles.td}>{displayFirstName(request)}</td>
                <td style={styles.td}>{displayLastName(request)}</td>
                <td style={styles.td}>{normalizeSource(request.source || "Direct")}</td>
                <td style={styles.td}>{formatDateTime(request.created_at)}</td>
                <td style={styles.td}>{formatDate(request.start_date)}</td>
                <td style={styles.td}>{formatDate(request.end_date)}</td>
                <td style={styles.td}><StatusBadge status={request.status || "pending"} /></td>
                <td style={styles.td}>{getDepositStatus(request)}<br /><span style={styles.muted}>{formatMoney(amounts.deposit)}</span></td>
                <td style={styles.td}>{getBalanceStatus(request)}<br /><span style={styles.muted}>{formatMoney(amounts.balance)}</span></td>
                <td style={styles.td}>{formatMoney(amounts.total)}</td>
                <td style={styles.td}>{formatMoney(amounts.paid)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
