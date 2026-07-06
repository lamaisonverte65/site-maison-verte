import { styles } from "../adminStyles";
import { formatMoney } from "../../../utils/adminFormatters";

export default function PaymentStatistics({ reconciliation }) {
  if (!reconciliation) return null;

  return (
    <section style={{ marginBottom: 18 }}>
      <h3 style={styles.subTitle}>Rapprochement Stripe</h3>
      <div style={styles.detailGrid}>
        <div style={styles.infoItem}><span>Payouts</span><strong>{reconciliation.payoutCount}</strong></div>
        <div style={styles.infoItem}><span>Montant viré</span><strong>{formatMoney(reconciliation.payoutTotal)}</strong></div>
        <div style={styles.infoItem}><span>Transactions</span><strong>{reconciliation.transactionCount}</strong></div>
        <div style={styles.infoItem}><span>Brut Stripe</span><strong>{formatMoney(reconciliation.transactionTotal)}</strong></div>
        <div style={styles.infoItem}><span>Frais Stripe</span><strong>{formatMoney(reconciliation.feeTotal)}</strong></div>
        <div style={styles.infoItem}><span>Net Stripe</span><strong>{formatMoney(reconciliation.netTotal)}</strong></div>
        <div style={styles.infoItem}><span>Écart payouts</span><strong>{formatMoney(reconciliation.payoutDifferenceTotal)}</strong></div>
      </div>
    </section>
  );
}
