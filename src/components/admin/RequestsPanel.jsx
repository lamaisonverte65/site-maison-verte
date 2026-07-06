import { styles } from "./adminStyles";
import { StatusBadge } from "./AdminUi";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  getRequestName,
  shortId,
} from "../../utils/adminFormatters";

export default function RequestsPanel({
  pendingRequests,
  selectedRequest,
  onSelectReservation,
  onShowReservations,
}) {
  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>Demandes en cours</h2>
        <button style={styles.smallButton} onClick={onShowReservations}>Voir toutes les réservations</button>
      </div>

      {pendingRequests.length === 0 ? (
        <p style={styles.empty}>Aucune demande en attente.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}>
              <tr>
                <th style={styles.th}>N° demande</th>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Date demande</th>
                <th style={styles.th}>Début séjour</th>
                <th style={styles.th}>Fin séjour</th>
                <th style={styles.th}>Statut</th>
                <th style={styles.th}>Nuits</th>
                <th style={styles.th}>Total estimatif</th>
                <th style={styles.th}>Contact</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((request) => (
                <tr
                  key={request.id}
                  onClick={() => onSelectReservation(request)}
                  style={selectedRequest?.id === request.id ? styles.selectedRow : styles.clickableRow}
                >
                  <td style={styles.td}>{shortId(request.id)}</td>
                  <td style={styles.td}>{getRequestName(request)}</td>
                  <td style={styles.td}>{formatDateTime(request.created_at)}</td>
                  <td style={styles.td}>{formatDate(request.start_date)}</td>
                  <td style={styles.td}>{formatDate(request.end_date)}</td>
                  <td style={styles.td}><StatusBadge status={request.status || "pending"} /></td>
                  <td style={styles.td}>{request.nights || "-"}</td>
                  <td style={styles.td}>{formatMoney(request.estimated_total)}</td>
                  <td style={styles.td}>{request.guest_email || request.guest_phone || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
