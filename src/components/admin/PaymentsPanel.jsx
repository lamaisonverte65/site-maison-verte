import { useState } from "react";
import { styles } from "./adminStyles";
import { StatusBadge } from "./AdminUi";
import {
  formatDate,
  formatDateTime,
  formatMoney,
} from "../../utils/adminFormatters";
import { usePaymentFilters } from "../../hooks/usePaymentFilters";
import PaymentSummary from "./payments/PaymentSummary";
import PaymentFilters from "./payments/PaymentFilters";
import PaymentAlerts from "./payments/PaymentAlerts";
import PaymentActions from "./payments/PaymentActions";
import PaymentTimeline from "./payments/PaymentTimeline";

export default function PaymentsPanel({ paymentRows }) {
  const filters = usePaymentFilters(paymentRows);
  const [selectedPaymentRow, setSelectedPaymentRow] = useState(null);

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>Paiements</h2>
          <p style={styles.muted}>Synthèse financière, alertes, filtres et export des paiements.</p>
        </div>
      </div>

      <PaymentSummary stats={filters.stats} />
      <PaymentAlerts stats={filters.stats} />
      <PaymentFilters filters={filters} />
      <PaymentActions rows={filters.filteredRows} />

      {selectedPaymentRow && (
        <section style={{ ...styles.reservationSheet, marginBottom: 18 }}>
          <div style={styles.detailHeader}>
            <div>
              <p style={styles.kicker}>Détail paiement</p>
              <h3 style={styles.detailTitle}>{selectedPaymentRow.name}</h3>
            </div>
            <button style={styles.smallButton} onClick={() => setSelectedPaymentRow(null)}>Fermer le détail</button>
          </div>
          <PaymentTimeline row={selectedPaymentRow} />
        </section>
      )}

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead style={styles.stickyHead}>
            <tr>
              <th style={styles.th}>Détail</th>
              <th style={styles.th}>Client</th>
              <th style={styles.th}>Dates</th>
              <th style={styles.th}>Statut réservation</th>
              <th style={styles.th}>CA confirmé</th>
              <th style={styles.th}>Payé client</th>
              <th style={styles.th}>Reste</th>
              <th style={styles.th}>Frais Stripe</th>
              <th style={styles.th}>Net Stripe théorique</th>
              <th style={styles.th}>Acompte</th>
              <th style={styles.th}>Solde</th>
              <th style={styles.th}>Statut virement</th>
              <th style={styles.th}>Lien</th>
            </tr>
          </thead>
          <tbody>
            {filters.filteredRows.map((row) => {
              const remaining = Math.max(Number(row.confirmedAmount || 0) - Number(row.paidClientAmount || 0), 0);
              return (
                <tr key={row.id} style={selectedPaymentRow?.id === row.id ? styles.selectedRow : undefined}>
                  <td style={styles.td}>
                    <button style={styles.smallButton} onClick={() => setSelectedPaymentRow(row)}>Voir</button>
                  </td>
                  <td style={styles.td}>{row.name}</td>
                  <td style={styles.td}>
                    {formatDate(row.startDate)} → {formatDate(row.endDate)}
                  </td>
                  <td style={styles.td}>
                    <StatusBadge status={row.status} />
                  </td>
                  <td style={styles.td}>{formatMoney(row.confirmedAmount)}</td>
                  <td style={styles.td}>{formatMoney(row.paidClientAmount)}</td>
                  <td style={styles.td}>{formatMoney(remaining)}</td>
                  <td style={styles.td}>{formatMoney(row.stripeFeeAmount)}</td>
                  <td style={styles.td}>
                    {row.stripeNetAmount ? (
                      formatMoney(row.stripeNetAmount)
                    ) : (
                      <span style={styles.muted}>À récupérer Stripe</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    {row.depositStatus}
                    <br />
                    {formatMoney(row.amounts.deposit)}
                    <br />
                    <span style={styles.muted}>
                      payé : {formatDateTime(row.depositPaidAt)}
                      <br />
                      prévu : {formatDateTime(row.depositDueAt)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {row.balanceStatus}
                    <br />
                    {formatMoney(row.amounts.balance)}
                    <br />
                    <span style={styles.muted}>
                      payé : {formatDateTime(row.balancePaidAt)}
                      <br />
                      prévu : {formatDateTime(row.balanceDueAt)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <strong>{row.stripeTransferStatus}</strong>
                    <br />
                    <span style={styles.muted}>
                      {row.payoutIds.length
                        ? `Payout : ${row.payoutIds.join(", ")}`
                        : "Payout : -"}
                      <br />
                      Date : {formatDateTime(row.payoutArrivalDate || row.transferDate)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {row.paymentLink ? (
                      <a href={row.paymentLink} target="_blank" rel="noreferrer">
                        Stripe
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
