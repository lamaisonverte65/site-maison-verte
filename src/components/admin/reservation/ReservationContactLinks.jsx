import { styles } from "../adminStyles";

export default function ReservationContactLinks({ request, onEmail, onPhone, onSms }) {
  return (
    <div style={styles.contactButtons}>
      <button style={styles.smallButton} onClick={() => onEmail(request.guest_email)}>Email</button>
      <button style={styles.smallButton} onClick={() => onPhone(request.guest_phone)}>Appel</button>
      <button style={styles.smallButton} onClick={() => onSms(request.guest_phone)}>SMS</button>
      {request.payment_link && <a style={styles.linkButton} href={request.payment_link} target="_blank" rel="noreferrer">Lien Stripe acompte/total</a>}
      {request.balance_payment_link && <a style={styles.linkButton} href={request.balance_payment_link} target="_blank" rel="noreferrer">Lien solde</a>}
      {request.manual_payment_link && <a style={styles.linkButton} href={request.manual_payment_link} target="_blank" rel="noreferrer">Lien paiement manuel</a>}
    </div>
  );
}
