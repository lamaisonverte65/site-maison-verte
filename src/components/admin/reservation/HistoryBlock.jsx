import { styles } from "../adminStyles";
import { HistorySection } from "../AdminUi";
import { formatDateTime, formatMoney } from "../../../utils/adminFormatters";

export default function HistoryBlock({ payments = [], events = [], emailLogs = [] }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h3 style={styles.subTitle}>Historiques détaillés</h3>
      <HistorySection title="Historique paiements" empty="Aucun paiement historisé." items={payments} renderItem={(payment) => (
        <div>
          <strong>{formatDateTime(payment.paid_at || payment.created_at)} · {formatMoney(payment.amount)}</strong>
          <p style={styles.muted}>{payment.payment_type || "paiement"} · {payment.status || "-"}{payment.refunded_amount ? ` · remboursé : ${formatMoney(payment.refunded_amount)}` : ""}</p>
          {payment.stripe_payment_intent_id && <p style={styles.muted}>PaymentIntent : {payment.stripe_payment_intent_id}</p>}
        </div>
      )} />

      <HistorySection title="Historique actions" empty="Aucune action historisée." items={events} renderItem={(item) => (
        <div>
          <strong>{formatDateTime(item.created_at)} · {item.label || item.event_type}</strong>
          <p style={styles.muted}>{item.message || "-"}</p>
        </div>
      )} />

      <HistorySection title="Emails envoyés" empty="Aucun email historisé." items={emailLogs} renderItem={(email) => (
        <div>
          <strong>{formatDateTime(email.sent_at || email.created_at)} · {email.email_type}</strong>
          <p style={styles.muted}>{email.subject || "Sans objet"} · {email.to_email || "-"} · {email.status || "-"}</p>
          {email.error_message && <p style={styles.muted}>Erreur : {email.error_message}</p>}
        </div>
      )} />
    </section>
  );
}
