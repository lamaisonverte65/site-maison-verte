import { styles } from "../adminStyles";
import { formatDateTime } from "../../../utils/adminFormatters";

export default function EmailHistoryBlock({ emails = [] }) {
  return (
    <section style={styles.reservationSheet}>
      <h3 style={styles.subTitle}>Historique des emails</h3>
      {emails.length === 0 ? (
        <p style={styles.empty}>Aucun email envoyé dans ce contexte.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Destinataire</th>
                <th style={styles.th}>Sujet</th>
                <th style={styles.th}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((item) => {
                const email = item.raw || {};
                return (
                  <tr key={item.id}>
                    <td style={styles.td}>{formatDateTime(email.sent_at || email.created_at)}</td>
                    <td style={styles.td}>{email.email_type || "-"}</td>
                    <td style={styles.td}>{email.to_email || "-"}</td>
                    <td style={styles.td}>{email.subject || "Sans objet"}</td>
                    <td style={styles.td}>{email.status || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
