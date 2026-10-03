import { styles } from "../adminStyles";
import { Info } from "../AdminUi";
import { formatDateTime, formatMoney } from "../../../utils/adminFormatters";
import { toPaymentView } from "../../../utils/paymentViewAdapter";

const STATUS_LABELS = {
  pending: "À confirmer",
  accepted: "Acceptée",
  deposit_paid: "Acompte payé",
  paid: "Payée",
  fully_paid: "Séjour soldé",
  confirmed: "Confirmée",
  refused: "Refusée",
  cancelled: "Annulée",
  expired: "Expirée",
};

function formatManualPayment(manualPayment) {
  if (!manualPayment) return "-";
  return `${manualPayment.status} — ${formatMoney(manualPayment.amount)}`;
}

export default function PaymentBlock({ request, status, amounts }) {
  const payment = toPaymentView(request, amounts);
  const fullPayment = request?.payment_preference === "full";

  return (
    <>
      <h3 style={styles.subTitle}>Paiement du séjour</h3>
      <div style={styles.detailGrid}>
        <Info label="Statut demande" value={STATUS_LABELS[status] || status} />
        <Info label="Total séjour" value={formatMoney(payment.total)} />
        <Info label="Total payé" value={formatMoney(payment.paid)} />
        <Info label="Reste à encaisser" value={formatMoney(payment.remaining)} />
        <Info label="CA confirmé" value={formatMoney(payment.confirmedRevenue)} />
        <Info label="Payé par le client" value={formatMoney(payment.realPaid)} />
      </div>

      {!fullPayment && (
        <>
          <h4 style={{ margin: "14px 0 8px" }}>Acompte</h4>
          <div style={styles.detailGrid}>
            <Info label="Statut acompte" value={payment.deposit.status} />
            <Info label="Montant acompte" value={formatMoney(payment.deposit.amount)} />
            <Info label="Acompte payé le" value={formatDateTime(payment.deposit.paidAt)} />
            <Info label="Acompte prévu pour" value={formatDateTime(payment.deposit.dueAt)} />
            <Info label="Expiration lien acompte" value={formatDateTime(payment.deposit.linkExpiresAt)} />
          </div>
        </>
      )}

      <h4 style={{ margin: "14px 0 8px" }}>{fullPayment ? "Paiement total" : "Solde"}</h4>
      <div style={styles.detailGrid}>
        <Info label={fullPayment ? "Statut paiement" : "Statut solde"} value={payment.balance.status} />
        <Info label={fullPayment ? "Montant paiement total" : "Montant solde"} value={formatMoney(payment.balance.amount)} />
        <Info label={fullPayment ? "Paiement reçu le" : "Solde payé le"} value={formatDateTime(payment.balance.paidAt)} />
        <Info label={fullPayment ? "Paiement prévu pour" : "Solde prévu pour"} value={formatDateTime(payment.balance.dueAt)} />
        <Info label="Paiement manuel" value={formatManualPayment(payment.manualPayment)} />
      </div>
    </>
  );
}
