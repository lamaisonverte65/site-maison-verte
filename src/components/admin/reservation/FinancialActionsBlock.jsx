import { styles } from "../adminStyles";

const PAYABLE_STATUSES = new Set(["accepted", "deposit_paid", "paid"]);

export default function FinancialActionsBlock({ request, status, amounts, onManualPayment, onRefundOnly }) {
  const canRequestPayment = PAYABLE_STATUSES.has(status);
  return (
    <>
      <h3 style={styles.subTitle}>Actions financières</h3>
      <div style={styles.financeActionsBox}>
        {canRequestPayment && (
          <>
            <button style={styles.paymentButton} onClick={() => onManualPayment(request, "acompte")}>Demander acompte</button>
            <button style={styles.paymentButton} onClick={() => onManualPayment(request, "solde")}>Demander solde</button>
            <button style={styles.paymentButton} onClick={() => onManualPayment(request, "complement")}>Demander complément</button>
            <button style={styles.paymentButton} onClick={() => onManualPayment(request, "total")}>Demander paiement total</button>
          </>
        )}
        {amounts.paid > 0 && <button style={styles.refundButton} onClick={() => onRefundOnly(request)}>Remboursement simple</button>}
        {!canRequestPayment && amounts.paid <= 0 && <p style={styles.empty}>Aucun paiement manuel disponible pour ce statut.</p>}
      </div>
    </>
  );
}
