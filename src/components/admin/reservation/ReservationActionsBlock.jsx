import { styles } from "../adminStyles";

export default function ReservationActionsBlock({ request, status, onAccept, onRefuse, onConfirm, onCancel }) {
  return (
    <div style={styles.actions}>
      {status === "pending" && (
        <>
          <button style={styles.acceptButton} onClick={() => onAccept(request)}>Accepter</button>
          <button style={styles.refuseButton} onClick={() => onRefuse(request)}>Refuser</button>
          <button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler</button>
        </>
      )}
      {status === "accepted" && (
        <>
          <button style={styles.confirmButton} onClick={() => onConfirm(request)}>Confirmer manuellement</button>
          <button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler</button>
        </>
      )}
      {["deposit_paid", "paid", "fully_paid", "confirmed"].includes(status) && <button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler / remboursement</button>}
      {["refused", "expired", "cancelled"].includes(status) && <p style={styles.empty}>Dossier conservé dans l’historique.</p>}
    </div>
  );
}
