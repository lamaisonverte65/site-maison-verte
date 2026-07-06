import { styles } from "../adminStyles";
import { formatDate, formatMoney, getRequestName } from "../../../utils/adminFormatters";
import { toReservationView } from "../../../adapters/reservationViewAdapter";

export default function CustomerReservationsBlock({ reservations, customerActions }) {
  return (
    <section style={{ marginTop: "22px" }}>
      <h3 style={styles.subTitle}>Historique des réservations</h3>
      {reservations.length === 0 ? (
        <p style={styles.empty}>Aucune réservation reliée à ce client.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}>
              <tr>
                <th style={styles.th}>Séjour</th>
                <th style={styles.th}>Dates</th>
                <th style={styles.th}>Statut</th>
                <th style={styles.th}>Montant</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => {
                const reservationView = toReservationView(reservation);
                return (
                  <tr key={reservationView.id}>
                    <td style={styles.td}>{reservationView.displayName || getRequestName(reservationView)}</td>
                    <td style={styles.td}>{formatDate(reservationView.stay?.startDate || reservationView.start_date)} → {formatDate(reservationView.stay?.endDate || reservationView.end_date)}</td>
                    <td style={styles.td}>{reservationView.status || "-"}</td>
                    <td style={styles.td}>{formatMoney(reservationView.financial?.confirmedAmount || reservationView.owner_price || reservationView.estimated_total || reservationView.amount_paid || 0)}</td>
                    <td style={styles.td}>
                      <button style={styles.smallButton} onClick={() => customerActions.selectReservation(reservationView)}>
                        Ouvrir la réservation
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
