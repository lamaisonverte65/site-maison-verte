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

export default function MessagesBlock({ request, housekeepingNotes = [] }) {
  const clientMessage = request.message || "";
  const ownerMessage = request.owner_message || "";
  const adminReservationNotes = request.housekeeping_notes || "";
  const manualPaymentMessage = request.manual_payment_message || "";
  const hasAnyMessage = Boolean(clientMessage || ownerMessage || adminReservationNotes || manualPaymentMessage || housekeepingNotes.length);

  return (
    <section style={{ marginTop: 22 }}>
      <h3 style={styles.subTitle}>Messages et observations</h3>
      {!hasAnyMessage ? (
        <p style={styles.empty}>Aucun message enregistré pour cette réservation.</p>
      ) : (
        <>
          <MessageCard title="Message client">{clientMessage}</MessageCard>
          <MessageCard title="Valeur historique propriétaire — provenance non qualifiée">{ownerMessage}</MessageCard>
          <MessageCard title="Note du propriétaire destinée au ménage">{adminReservationNotes}</MessageCard>
          <MessageCard title="Dernier message paiement manuel">{manualPaymentMessage}</MessageCard>
          {housekeepingNotes.map((note) => (
            <div key={note.id} style={styles.noteBox}>
              <strong>Note ménage · {note.author_display_name || "Compte ménage"}</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{note.note}</p>
              <small style={styles.muted}>{note.created_at ? new Date(note.created_at).toLocaleString("fr-FR") : ""}</small>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
