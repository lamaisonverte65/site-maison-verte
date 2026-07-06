import { styles } from "../adminStyles";

export default function PaymentFilters({ filters }) {
  return (
    <section style={{ ...styles.toolbar, marginBottom: 18 }}>
      <input
        style={styles.searchInput}
        value={filters.query}
        onChange={(event) => filters.setQuery(event.target.value)}
        placeholder="Rechercher client, statut, payout, dates..."
      />
      <select style={styles.select} value={filters.statusFilter} onChange={(event) => filters.setStatusFilter(event.target.value)}>
        <option value="all">Tous les statuts</option>
        <option value="pending">À confirmer</option>
        <option value="accepted">Acceptée</option>
        <option value="deposit_paid">Acompte payé</option>
        <option value="paid_group">Payées / confirmées</option>
        <option value="confirmed">Confirmée</option>
        <option value="cancelled">Annulée</option>
      </select>
      <select style={styles.select} value={filters.alertFilter} onChange={(event) => filters.setAlertFilter(event.target.value)}>
        <option value="all">Toutes les situations</option>
        <option value="remaining_balance">Reste à encaisser</option>
        <option value="missing_net">Net Stripe manquant</option>
        <option value="missing_payout">Payout manquant</option>
        <option value="paid">Paiement reçu</option>
      </select>
    </section>
  );
}
