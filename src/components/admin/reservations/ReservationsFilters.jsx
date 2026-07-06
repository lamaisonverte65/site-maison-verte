import { styles } from "../adminStyles";

export default function ReservationsFilters({ filters, onFilterChange, onReset }) {
  return (
    <div style={{ ...styles.toolbar, alignItems: "center", flexWrap: "wrap" }}>
      <select style={styles.select} value={filters.status} onChange={(event) => onFilterChange("status", event.target.value)}>
        <option value="all">Tous les statuts</option>
        <option value="pending">À confirmer</option>
        <option value="accepted">Acceptée</option>
        <option value="deposit_paid">Acompte payé</option>
        <option value="paid_group">Payées / confirmées</option>
        <option value="confirmed">Confirmée</option>
        <option value="refused">Refusée</option>
        <option value="expired">Expirée</option>
        <option value="cancelled">Annulée</option>
      </select>

      <select style={styles.select} value={filters.source} onChange={(event) => onFilterChange("source", event.target.value)}>
        <option value="all">Toutes sources</option>
        <option value="site">Site</option>
        <option value="booking">Booking</option>
        <option value="airbnb">Airbnb</option>
        <option value="admin">Admin</option>
        <option value="direct">Direct</option>
        <option value="téléphone">Téléphone</option>
      </select>

      <select style={styles.select} value={filters.payment} onChange={(event) => onFilterChange("payment", event.target.value)}>
        <option value="all">Tous paiements</option>
        <option value="paid">Paiement reçu</option>
        <option value="unpaid">Aucun paiement</option>
        <option value="partial">Paiement partiel</option>
        <option value="complete">Total réglé</option>
      </select>

      <label style={styles.muted}>Début séjour depuis</label>
      <input style={styles.searchInput} type="date" value={filters.dateFrom} onChange={(event) => onFilterChange("dateFrom", event.target.value)} />

      <label style={styles.muted}>jusqu'au</label>
      <input style={styles.searchInput} type="date" value={filters.dateTo} onChange={(event) => onFilterChange("dateTo", event.target.value)} />

      <button style={styles.smallButton} onClick={onReset}>Réinitialiser</button>
    </div>
  );
}
