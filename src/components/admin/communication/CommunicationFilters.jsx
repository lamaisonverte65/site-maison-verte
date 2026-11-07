import { styles } from "../adminStyles";
export default function CommunicationFilters({ filters, onChange, onReset }) {
  return (
    <div style={styles.toolbar}>
      <input style={styles.searchInput} value={filters.search} onChange={(event) => onChange("search", event.target.value)} placeholder="Rechercher client ou message…" aria-label="Rechercher des messages" />
      <select style={styles.select} value={filters.type} onChange={(event) => onChange("type", event.target.value)} aria-label="Auteur du message">
        <option value="all">Client et propriétaire</option>
        <option value="message">Client</option>
        <option value="owner_note">Archive propriétaire</option>
        <option value="owner_reply">Réponse propriétaire</option>
      </select>
      <input style={styles.input} type="date" value={filters.startDate} onChange={(event) => onChange("startDate", event.target.value)} title="Du" aria-label="Date de début" />
      <input style={styles.input} type="date" value={filters.endDate} onChange={(event) => onChange("endDate", event.target.value)} title="Au" aria-label="Date de fin" />
      <button style={styles.smallButton} type="button" onClick={onReset}>Effacer</button>
    </div>
  );
}
