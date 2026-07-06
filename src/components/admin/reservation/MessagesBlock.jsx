import { styles } from "../adminStyles";

function MessageCard({ title, children }) {
  if (!children) return null;
  return (
    <div style={styles.noteBox}>
      <strong>{title}</strong>
      <p style={{ whiteSpace: "pre-wrap" }}>{children}</p>
    </div>
  );
}

export default function MessagesBlock({ request }) {
  const clientMessage = request.message || "";
  const ownerMessage = request.owner_message || "";
  const adminReservationNotes = request.housekeeping_notes || "";
  const manualPaymentMessage = request.manual_payment_message || "";
  const hasAnyMessage = Boolean(clientMessage || ownerMessage || adminReservationNotes || manualPaymentMessage);

  return (
    <section style={{ marginTop: 22 }}>
      <h3 style={styles.subTitle}>Messages et observations</h3>
      {!hasAnyMessage ? (
        <p style={styles.empty}>Aucun message enregistré pour cette réservation.</p>
      ) : (
        <>
          <MessageCard title="Message client">{clientMessage}</MessageCard>
          <MessageCard title="Message propriétaire / admin">{ownerMessage}</MessageCard>
          <MessageCard title="Notes admin réservation">{adminReservationNotes}</MessageCard>
          <MessageCard title="Dernier message paiement manuel">{manualPaymentMessage}</MessageCard>
        </>
      )}
    </section>
  );
}
