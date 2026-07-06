import { styles } from "../adminStyles";
import { Info } from "../AdminUi";

export default function CustomerDocumentsBlock({ customer, reservations = [] }) {
  const contracts = reservations.filter((reservation) => reservation.contract_accepted || reservation.contract_url);
  const reviewRequests = reservations.filter((reservation) => reservation.review_requested_at);

  return (
    <section style={styles.card}>
      <h3 style={styles.subTitle}>Documents</h3>
      <div style={styles.detailGrid}>
        <Info label="Adresse renseignée" value={customer.address || customer.city || customer.country ? "Oui" : "Non"} />
        <Info label="Contrats liés" value={contracts.length} />
        <Info label="Demandes d'avis" value={reviewRequests.length} />
        <Info label="Documents futurs" value="Facture / reçu / pièces jointes" />
      </div>
      {contracts.length > 0 && (
        <div style={styles.chipList}>
          {contracts.slice(0, 5).map((reservation) => reservation.contract_url ? (
            <a key={reservation.id} style={styles.historyChip} href={reservation.contract_url} target="_blank" rel="noreferrer">
              Contrat {reservation.contract_version || ""}
            </a>
          ) : (
            <span key={reservation.id} style={styles.historyChip}>Contrat accepté</span>
          ))}
        </div>
      )}
    </section>
  );
}
