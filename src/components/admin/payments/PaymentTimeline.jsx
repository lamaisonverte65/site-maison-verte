import { styles } from "../adminStyles";
import { formatDateTime, formatMoney } from "../../../utils/adminFormatters";

function TimelineItem({ label, date, amount, status }) {
  return (
    <div style={styles.historyItem || styles.blockItem}>
      <strong>{label}</strong>
      <p style={styles.muted}>{formatDateTime(date)}{amount !== undefined ? ` · ${formatMoney(amount)}` : ""}{status ? ` · ${status}` : ""}</p>
    </div>
  );
}

export default function PaymentTimeline({ row }) {
  if (!row) return null;

  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={styles.subTitle}>Timeline financière</h3>
      <TimelineItem label="Création / demande" date={row.createdAt || row.startDate} status={row.status} />
      <TimelineItem label="Acompte" date={row.depositPaidAt || row.depositDueAt} amount={row.amounts?.deposit} status={row.depositStatus} />
      <TimelineItem label="Solde" date={row.balancePaidAt || row.balanceDueAt} amount={row.amounts?.balance} status={row.balanceStatus} />
      <TimelineItem label="Payout Stripe" date={row.payoutArrivalDate || row.transferDate} status={(row.payoutIds || []).join(", ") || row.stripeTransferStatus} />
    </section>
  );
}
