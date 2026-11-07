import { styles } from "../adminStyles";

export default function PaymentAlerts({ stats, reconciliation, onSelectAlert }) {
  const alerts = [];
  if (stats.remainingBalanceCount > 0) alerts.push(["remaining_balance", stats.remainingBalanceCount, "Reste à encaisser", "Réservations du site dont le montant dû dépasse les paiements clients enregistrés."]);
  if (stats.paymentReferenceMissingCount > 0) alerts.push(["payment_reference_missing", stats.paymentReferenceMissingCount, "Mode de paiement à vérifier", "Paiement indiqué dans la réservation sans référence Stripe confirmée. Il peut s'agir d'un autre mode de paiement ou d'une liaison manquante : vérifier la transaction d'origine."]);
  if (stats.missingStripeNetCount > 0) alerts.push(["missing_net", stats.missingStripeNetCount, "Net Stripe manquant", "Paiements site détectés, mais comptabilité Stripe incomplète."]);
  if (stats.missingPayoutCount > 0) alerts.push(["missing_payout", stats.missingPayoutCount, "Virement Stripe non rapproché", "Paiements site sans identifiant de virement Stripe lié."]);
  if (stats.platformMissingCount > 0) alerts.push(["platform_missing", stats.platformMissingCount, "Plateforme à rapprocher", "Montant net absent du registre importé Booking/Airbnb ; aucun versement n'est présumé."]);
  if (reconciliation?.payoutsWithDifference?.length) alerts.push([null, reconciliation.payoutsWithDifference.length, "Écart Stripe", "À examiner dans Virements Stripe."]);
  if (!alerts.length) return null;
  return (
    <section style={{ ...styles.noteBox, padding: "8px 12px", marginBottom: 8 }} aria-label="Alertes paiement">
      <strong style={{ fontSize: 13 }}>Alertes paiement</strong>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 5 }}>
        {alerts.map(([key, count, name, explanation]) => key ? (
          <button type="button" key={key} title={explanation} style={{ ...styles.smallButton, fontSize: 12 }} onClick={() => onSelectAlert?.(key)}>
            {name} : {count} · Voir
          </button>
        ) : <span key={name} style={{ fontSize: 12 }} title={explanation}>{name} : {count} (Virements Stripe)</span>)}
      </div>
      <small style={{ color: "#64748b" }}>Cliquer sur une alerte pour voir les lignes concernées ; survoler pour comprendre la règle.</small>
    </section>
  );
}
