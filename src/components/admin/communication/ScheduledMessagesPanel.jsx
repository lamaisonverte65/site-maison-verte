import { styles } from "../adminStyles";

const FUTURE_MESSAGES = [
  { key: "balance", label: "Relance solde", timing: "J-30", status: "Prévu pour automatisation future" },
  { key: "welcome", label: "Livret d'accueil", timing: "Avant arrivée", status: "Déjà géré par les actions existantes" },
  { key: "review", label: "Demande d'avis", timing: "Après départ", status: "Déjà géré par les actions existantes" },
  { key: "loyalty", label: "Message fidélité", timing: "Après séjour", status: "Prévu pour campagnes clients" },
];

export default function ScheduledMessagesPanel() {
  return (
    <section style={styles.reservationSheet}>
      <h3 style={styles.subTitle}>Messages programmés</h3>
      <p style={styles.muted}>Vue de préparation : aucun nouveau déclenchement automatique n'est ajouté dans cette version.</p>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead style={styles.stickyHead}>
            <tr>
              <th style={styles.th}>Message</th>
              <th style={styles.th}>Moment</th>
              <th style={styles.th}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {FUTURE_MESSAGES.map((item) => (
              <tr key={item.key}>
                <td style={styles.td}>{item.label}</td>
                <td style={styles.td}>{item.timing}</td>
                <td style={styles.td}>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
