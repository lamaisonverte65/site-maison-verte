import { styles } from "../adminStyles";
import { Info } from "../AdminUi";
import { formatDateTime, formatMoney } from "../../../utils/adminFormatters";

export default function StripeHistoryBlock({ request, payments = [] }) {
  const stripePayments = (payments || []).filter((payment) =>
    payment.stripe_payment_intent_id || payment.stripe_checkout_session_id || payment.stripe_refund_id || payment.provider === "stripe"
  );

  return (
    <section style={{ marginTop: 22 }}>
      <h3 style={styles.subTitle}>Stripe / banque</h3>
      <div style={styles.detailGrid}>
        <Info label="Frais Stripe" value={formatMoney(request.stripe_fee_amount || 0)} />
        <Info label="Net Stripe" value={request.stripe_net_amount ? formatMoney(request.stripe_net_amount) : "À récupérer Stripe"} />
        <Info label="Payout Stripe" value={request.stripe_payout_status || "-"} />
        <Info label="Date payout / virement" value={formatDateTime(request.stripe_payout_arrival_date || request.transfer_date)} />
        <Info label="Total remboursé" value={formatMoney(request.refunded_amount || 0)} />
        <Info label="Dernier remboursement Stripe" value={request.stripe_refund_id || "-"} />
      </div>

      {stripePayments.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {stripePayments.map((payment) => (
            <div key={payment.id || payment.stripe_payment_intent_id} style={styles.noteBox}>
              <strong>{formatDateTime(payment.paid_at || payment.created_at)} · {formatMoney(payment.amount || 0)}</strong>
              <p style={styles.muted}>{payment.payment_type || "paiement"} · {payment.status || "-"}</p>
              {payment.stripe_payment_intent_id && <p style={styles.muted}>PaymentIntent : {payment.stripe_payment_intent_id}</p>}
              {payment.stripe_checkout_session_id && <p style={styles.muted}>CheckoutSession : {payment.stripe_checkout_session_id}</p>}
              {payment.stripe_refund_id && <p style={styles.muted}>Refund : {payment.stripe_refund_id}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
