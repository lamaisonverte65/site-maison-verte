import { styles } from "../adminStyles";
import { formatMoney } from "../../../utils/adminFormatters";

function SummaryCard({ label, value, hint }) {
  return (
    <div style={styles.card || styles.infoItem}>
      <span style={styles.muted}>{label}</span>
      <strong style={{ display: "block", marginTop: 6, fontSize: "1.15rem" }}>{value}</strong>
      {hint && <p style={styles.muted}>{hint}</p>}
    </div>
  );
}

export default function PaymentSummary({ stats }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h3 style={styles.subTitle}>Synthèse financière</h3>
      <div style={styles.summaryGrid || styles.detailGrid}>
        <SummaryCard label="CA confirmé" value={formatMoney(stats.confirmedTotal)} />
        <SummaryCard label="Payé par les clients" value={formatMoney(stats.paidTotal)} />
        <SummaryCard label="Reste à encaisser" value={formatMoney(stats.remainingTotal)} />
        <SummaryCard label="Frais Stripe" value={formatMoney(stats.stripeFeesTotal)} />
        <SummaryCard label="Net Stripe après remboursements" value={formatMoney(stats.stripeNetTotal)} />
        <SummaryCard label="Lignes filtrées" value={`${stats.filteredCount} / ${stats.count}`} />
      </div>
    </section>
  );
}
