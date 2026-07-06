import { styles } from "../adminStyles";

function AlertLine({ children }) {
  return <li style={{ marginBottom: 6 }}>{children}</li>;
}

export default function PaymentAlerts({ stats, reconciliation }) {
  const alerts = [];

  if (stats.remainingBalanceCount > 0) {
    alerts.push(`${stats.remainingBalanceCount} réservation(s) avec un reste à encaisser.`);
  }
  if (stats.missingStripeNetCount > 0) {
    alerts.push(`${stats.missingStripeNetCount} paiement(s) avec net Stripe à récupérer.`);
  }
  if (stats.missingPayoutCount > 0) {
    alerts.push(`${stats.missingPayoutCount} paiement(s) sans payout rapproché.`);
  }
  if (reconciliation?.payoutsWithDifference?.length) {
    alerts.push(`${reconciliation.payoutsWithDifference.length} payout(s) avec écart de rapprochement.`);
  }
  if (reconciliation?.unreconciledTransactions?.length) {
    alerts.push(`${reconciliation.unreconciledTransactions.length} transaction(s) Stripe non rapprochée(s).`);
  }

  if (alerts.length === 0) {
    return <p style={styles.info || styles.muted}>Aucune alerte paiement détectée sur les données chargées.</p>;
  }

  return (
    <section style={{ ...styles.noteBox, marginBottom: 18 }}>
      <strong>Alertes paiement</strong>
      <ul style={{ marginBottom: 0 }}>
        {alerts.map((alert) => <AlertLine key={alert}>{alert}</AlertLine>)}
      </ul>
    </section>
  );
}
