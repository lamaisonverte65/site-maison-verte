import { styles } from "../adminStyles";
import { Info } from "../AdminUi";
import {
  formatDate,
  formatMoney,
  getBalanceStatus,
  getDepositStatus,
  getRealPaidAmount,
  getRequestName,
} from "../../../utils/adminFormatters";

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

export default function ReservationSummaryBlock({ reservation, status, amounts }) {
  const fullPayment = reservation?.payment_preference === "full";

  return (
    <section style={{ ...styles.panel, marginBottom: 18 }}>
      <h3 style={styles.subTitle}>Résumé du dossier</h3>
      <div style={styles.summaryGrid || styles.detailGrid}>
        <Info label="Client" value={getRequestName(reservation)} />
        <Info label="Téléphone" value={reservation.guest_phone || "-"} />
        <Info label="Email" value={reservation.guest_email || "-"} />
        <Info label="Adresse" value={[reservation.guest_address, reservation.guest_postal_code, reservation.guest_city, reservation.guest_country].filter(Boolean).join(", ") || "-"} />
        <Info label="Statut" value={STATUS_LABELS[status] || status} />
        <Info label="Arrivée" value={formatDate(reservation.start_date)} />
        <Info label="Départ" value={formatDate(reservation.end_date)} />
        <Info label="Nuits" value={reservation.nights ?? "-"} />
        <Info label="Total séjour" value={formatMoney(amounts.total)} />
        <Info label="Acompte" value={fullPayment ? "non applicable" : `${getDepositStatus(reservation)} — ${formatMoney(amounts.deposit)}`} />
        <Info label={fullPayment ? "Paiement total" : "Solde"} value={`${getBalanceStatus(reservation)} — ${formatMoney(amounts.balance)}`} />
        <Info label="Total payé" value={formatMoney(amounts.paid)} />
        <Info label="Payé client réel" value={formatMoney(getRealPaidAmount(reservation))} />
      </div>
    </section>
  );
}
