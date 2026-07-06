import { styles } from "../adminStyles";

export default function CommunicationFilters({ filters, onChange, onReset }) {
  return (
    <section style={styles.toolbar}>
      <input
        style={styles.searchInput}
        value={filters.search}
        onChange={(event) => onChange("search", event.target.value)}
        placeholder="Rechercher client, email, sujet, action, message..."
      />
      <select style={styles.select} value={filters.type} onChange={(event) => onChange("type", event.target.value)}>
        <option value="all">Tous les types</option>
        <option value="email">Emails</option>
        <option value="event">Actions</option>
        <option value="message">Messages</option>
      </select>
      <select style={styles.select} value={filters.status} onChange={(event) => onChange("status", event.target.value)}>
        <option value="all">Tous les statuts</option>
        <option value="sent">Emails envoyés</option>
        <option value="error">Emails en erreur</option>
        <option value="logged">Actions historisées</option>
        <option value="received">Messages reçus</option>
        <option value="unknown">Statut inconnu</option>
      </select>
      <input
        style={styles.input}
        type="date"
        value={filters.startDate}
        onChange={(event) => onChange("startDate", event.target.value)}
        title="Début"
      />
      <input
        style={styles.input}
        type="date"
        value={filters.endDate}
        onChange={(event) => onChange("endDate", event.target.value)}
        title="Fin"
      />
      <button style={styles.smallButton} type="button" onClick={onReset}>Réinitialiser</button>
    </section>
  );
}
