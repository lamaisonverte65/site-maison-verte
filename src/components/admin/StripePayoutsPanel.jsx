import { styles } from "./adminStyles";
import { formatDateTime, formatMoney, shortId } from "../../utils/adminFormatters";
import { usePaymentReconciliation } from "../../hooks/usePaymentReconciliation";
import PaymentAlerts from "./payments/PaymentAlerts";
import PaymentStatistics from "./payments/PaymentStatistics";

export default function StripePayoutsPanel({
  stripePayouts,
  stripeBalanceTransactions,
  onRefresh,
}) {
  const reconciliation = usePaymentReconciliation({ stripePayouts, stripeBalanceTransactions });

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>Virements Stripe</h2>
          <p style={styles.muted}>Rapprochement automatique entre les virements bancaires Stripe et les transactions nettes calculées par réservation.</p>
        </div>
        <button style={styles.refreshButton} onClick={onRefresh}>Actualiser</button>
      </div>

      <PaymentStatistics reconciliation={reconciliation} />
      <PaymentAlerts stats={{ remainingBalanceCount: 0, missingStripeNetCount: 0, missingPayoutCount: 0 }} reconciliation={reconciliation} />

      <h3 style={styles.subTitle}>Payouts bancaires</h3>
      {stripePayouts.length === 0 ? <p style={styles.empty}>Aucun payout Stripe rapproché pour le moment.</p> : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}>
              <tr>
                <th style={styles.th}>Payout</th>
                <th style={styles.th}>Date virement</th>
                <th style={styles.th}>Statut</th>
                <th style={styles.th}>Montant viré</th>
                <th style={styles.th}>Somme transactions</th>
                <th style={styles.th}>Écart</th>
                <th style={styles.th}>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {stripePayouts.map((payout) => (
                <tr key={payout.id}>
                  <td style={styles.td}>{payout.id}</td>
                  <td style={styles.td}>{formatDateTime(payout.arrival_date || payout.created_at_stripe)}</td>
                  <td style={styles.td}>{payout.status || "-"}</td>
                  <td style={styles.td}>{formatMoney(payout.amount)}</td>
                  <td style={styles.td}>{formatMoney(payout.expected_net_total)}</td>
                  <td style={styles.td}>{formatMoney(payout.difference_amount)}</td>
                  <td style={styles.td}>{payout.transaction_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={styles.subTitle}>Transactions incluses</h3>
      {stripeBalanceTransactions.length === 0 ? <p style={styles.empty}>Aucune transaction Stripe rapprochée.</p> : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Réservation</th>
                <th style={styles.th}>Paiement</th>
                <th style={styles.th}>Brut</th>
                <th style={styles.th}>Frais</th>
                <th style={styles.th}>Net</th>
                <th style={styles.th}>Payout</th>
                <th style={styles.th}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {stripeBalanceTransactions.slice(0, 200).map((transaction) => (
                <tr key={transaction.id}>
                  <td style={styles.td}>{formatDateTime(transaction.created_at_stripe)}</td>
                  <td style={styles.td}>{transaction.type || "-"}</td>
                  <td style={styles.td}>{transaction.booking_request_id ? shortId(transaction.booking_request_id) : "-"}</td>
                  <td style={styles.td}>{transaction.payment_type || transaction.payment_intent_id || "-"}</td>
                  <td style={styles.td}>{formatMoney(transaction.amount)}</td>
                  <td style={styles.td}>{formatMoney(transaction.fee)}</td>
                  <td style={styles.td}>{formatMoney(transaction.net)}</td>
                  <td style={styles.td}>{transaction.payout_id || "-"}</td>
                  <td style={styles.td}>{transaction.reconciliation_status || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
