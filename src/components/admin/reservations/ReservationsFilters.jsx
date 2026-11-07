import { styles } from "../adminStyles";

export default function ReservationsFilters({ filters, onFilterChange, onReset, tableSearch, onTableSearchChange, onExport }) {
  return (
    <div style={{ display: "grid", gap: "7px" }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "7px" }}>
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

        <button
          type="button"
          style={{ ...styles.smallButton, marginLeft: "auto" }}
          onClick={onExport}
        >Exporter la liste filtrée</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "7px" }}>
        <input
          type="search"
          aria-label="Rechercher dans les réservations"
          style={{ ...styles.searchInput, flex: "1 1 280px", minWidth: "180px", width: "auto" }}
          value={tableSearch}
          onChange={(event) => onTableSearchChange(event.target.value)}
          placeholder="Rechercher un client, une réservation..."
        />
        <label style={{ ...styles.muted, display: "flex", alignItems: "center", gap: "5px", margin: 0, whiteSpace: "nowrap" }}>
          Du
          <input
            aria-label="Début séjour depuis"
            style={dateInputStyle}
            type="date"
            value={filters.dateFrom}
            onChange={(event) => onFilterChange("dateFrom", event.target.value)}
          />
        </label>
        <label style={{ ...styles.muted, display: "flex", alignItems: "center", gap: "5px", margin: 0, whiteSpace: "nowrap" }}>
          au
          <input
            aria-label="Début séjour jusqu'au"
            style={dateInputStyle}
            type="date"
            value={filters.dateTo}
            onChange={(event) => onFilterChange("dateTo", event.target.value)}
          />
        </label>
        <button type="button" style={{ ...styles.smallButton, marginLeft: "auto" }} onClick={onReset}>Réinitialiser</button>
      </div>
    </div>
  );
}

// Les champs date ne doivent plus hériter du flex: 1 1 280px de searchInput.
const dateInputStyle = {
  width: "139px",
  minWidth: "0",
  maxWidth: "139px",
  boxSizing: "border-box",
  padding: "7px 6px",
  borderRadius: "9px",
  border: "1px solid #d6d3c8",
  background: "white",
  fontSize: "12px",
};
