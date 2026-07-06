import { styles } from "../adminStyles";

export default function FinancialActionsBlock({ request, amounts, onManualPayment, onRefundOnly }) {
  return (
    <>
      <h3 style={styles.subTitle}>Actions financières</h3>
      <div style={styles.financeActionsBox}>
        <button style={styles.paymentButton} onClick={() => onManualPayment(request, "acompte")}>Demander acompte</button>
        <button style={styles.paymentButton} onClick={() => onManualPayment(request, "solde")}>Demander solde</button>
        <button style={styles.paymentButton} onClick={() => onManualPayment(request, "complement")}>Demander complément</button>
        <button style={styles.paymentButton} onClick={() => onManualPayment(request, "total")}>Demander paiement total</button>
        {amounts.paid > 0 && <button style={styles.refundButton} onClick={() => onRefundOnly(request)}>Remboursement simple</button>}
      </div>
    </>
  );
}
