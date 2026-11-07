import { styles } from "../adminStyles";

export default function PaymentFilters({ filters }) {
  return (
    <section style={{ display: "flex", flexWrap: "wrap", gap: 7, margin: "8px 0" }}>
      <input
        style={{ ...styles.searchInput, minWidth: 170, flex: "1 1 210px", fontSize: 13 }}
        value={filters.query}
        onChange={(event) => filters.setQuery(event.target.value)}
        placeholder="Client, référence, séjour…"
        aria-label="Recherche paiements"
      />
      <select style={{ ...styles.select, fontSize: 13 }} value={filters.sourceFilter} onChange={(event) => filters.setSourceFilter(event.target.value)} aria-label="Origine du paiement">
        <option value="all">Toutes origines</option>
        <option value="site">Site</option>
        <option value="booking">Booking</option>
        <option value="airbnb">Airbnb</option>
        <option value="other">Autres</option>
      </select>
      <select style={{ ...styles.select, fontSize: 13 }} value={filters.statusFilter} onChange={(event) => filters.setStatusFilter(event.target.value)} aria-label="Statut réservation">
        <option value="all">Tous statuts</option>
        <option value="pending">À confirmer</option>
        <option value="accepted">Acceptée</option>
        <option value="deposit_paid">Acompte payé</option>
        <option value="paid_group">Payées / confirmées</option>
        <option value="confirmed">Confirmée</option>
        <option value="cancelled">Annulée</option>
      </select>
      <select style={{ ...styles.select, fontSize: 13 }} value={filters.alertFilter} onChange={(event) => filters.setAlertFilter(event.target.value)} aria-label="Situation paiement">
        <option value="all">Toutes situations</option>
        <option value="remaining_balance">Reste à encaisser</option>
        <option value="payment_reference_missing">Mode de paiement à vérifier</option>
        <option value="missing_net">Net Stripe manquant</option>
        <option value="missing_payout">Virement Stripe manquant</option>
        <option value="platform_missing">Plateforme à rapprocher</option>
        <option value="paid">Paiement renseigné</option>
      </select>
    </section>
  );
}
