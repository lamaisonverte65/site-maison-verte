import { styles } from './adminStyles';

// Exemples issus des imports La Maison Verte : les noms des CSV peuvent varier
// selon la langue, la période et la version des interfaces Booking/Airbnb.
const formats = [
  {
    source: 'Booking',
    name: 'Statement — relevé des paiements',
    example: '2025-01-01_to_2025-12-31_statements(1).csv',
    columns: 'Type · Numéro de réservation · Montant · Commission · Net · Date du paiement · Identifiant du paiement',
    effect: 'Écritures comptables + dates et montants du registre financier',
    advice: 'Dans les relevés de paiements Booking, exporter le CSV des versements (pas la liste des séjours). Choisir un exercice d’encaissement à la fois.',
  },
  {
    source: 'Booking',
    name: 'Overview — détail des réservations',
    example: 'reservation_statements_overview_2024-05-01_2026-09-30.csv',
    columns: 'Reservation number · Arrival · Departure · Final amount · Commission amount · Payment fee',
    effect: 'Registre financier uniquement ; aucune écriture comptable',
    advice: 'Exporter le détail des réservations. La période peut couvrir plusieurs années : le séjour n’est pas une preuve d’encaissement.',
  },
  {
    source: 'Airbnb',
    name: 'Transactions — revenus et versements',
    example: 'airbnb_01_2025-12_2025.csv',
    columns: 'Type · Code de confirmation · Date · Revenus bruts · Frais de service · Montant · Taxes reversées par Airbnb',
    effect: 'Écritures comptables + dates et montants du registre financier',
    advice: 'Dans l’historique des transactions/revenus Airbnb, exporter les transactions détaillées au format CSV pour une année de versement. Le PDF « Rapport de revenus » ne contient pas ces lignes.',
  },
  {
    source: 'Airbnb',
    name: 'Réservations — liste des séjours',
    example: 'reservations-3.csv',
    columns: 'Code de confirmation · Date de début · Date de fin · # des adultes · # des nuits · Revenus',
    effect: 'Registre financier uniquement ; aucune écriture comptable',
    advice: 'Exporter la liste des réservations au format CSV, éventuellement depuis le début de l’activité. Le champ « Revenus » n’est pas utilisé comme preuve d’un paiement.',
  },
];

export default function AccountingImportGuide() {
  return <section aria-label="Guide des fichiers à exporter" style={{ ...styles.accountingAssetBox, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
    <h4 style={{ margin: '0 0 6px' }}>Quel fichier faut-il exporter ?</h4>
    <p style={styles.muted}>Le format est identifié automatiquement <strong>à partir des colonnes du CSV</strong>, pas de son nom. Voici des exemples réels de fichiers rencontrés pour La Maison Verte.</p>
    <div style={{ ...styles.tableWrapper, width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'auto' }}>
      <table style={{ ...styles.table, minWidth: 780 }}>
        <thead><tr><th style={styles.th}>Plateforme</th><th style={styles.th}>Fichier recherché / exemple</th><th style={styles.th}>Effet dans le site</th></tr></thead>
        <tbody>{formats.map(format => <tr key={`${format.source}:${format.name}`}>
          <td style={styles.td}><strong>{format.source}</strong></td>
          <td style={styles.td}><strong>{format.name}</strong><div style={{ marginTop: 4, overflowWrap: 'anywhere' }}><code>{format.example}</code></div></td>
          <td style={styles.td}>{format.effect}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <details style={{ marginTop: 10 }}><summary>Comment reconnaître les quatre exports et choisir la période ?</summary>
      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        {formats.map(format => <div key={`${format.source}:${format.name}:details`}>
          <strong>{format.source} — {format.name}</strong>
          <div style={{ fontSize: 13, marginTop: 3 }}>{format.advice}</div>
          <div style={{ fontSize: 12, marginTop: 3 }}>Colonnes permettant de l’identifier : {format.columns}.</div>
        </div>)}
      </div>
    </details>
    <p style={{ ...styles.muted, marginBottom: 0 }}><strong>Important :</strong> une réservation importée ne crée pas une recette. Pour les fichiers de transactions comptables, le site accepte actuellement un seul exercice d’encaissement par CSV ; les listes de réservations peuvent couvrir plusieurs années. Un fichier déjà validé ne doit pas être réimporté à l’aveugle.</p>
  </section>;
}
