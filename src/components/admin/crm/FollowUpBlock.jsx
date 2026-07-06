import { styles } from "../adminStyles";
import { formatDate } from "../../../utils/adminFormatters";

export default function FollowUpBlock({ customers, contactActions, onOpenCustomer, onOpenCommunication }) {
  return (
    <section style={styles.card}>
      <div style={styles.panelHeader}>
        <h3 style={styles.subTitle}>Relances possibles</h3>
        <p style={styles.muted}>Clients contactables, sans séjour futur connu, avec un ancien séjour à relancer.</p>
      </div>

      {customers.length === 0 ? (
        <p style={styles.empty}>Aucune relance prioritaire.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}>
              <tr>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Dernier séjour</th>
                <th style={styles.th}>Depuis</th>
                <th style={styles.th}>Contact</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.slice(0, 20).map((customer) => (
                <tr key={customer.id}>
                  <td style={styles.td}>{customer.displayName}</td>
                  <td style={styles.td}>{formatDate(customer.lastStay)}</td>
                  <td style={styles.td}>{customer.daysSinceLastStay} jours</td>
                  <td style={styles.td}>{customer.email || customer.phone || "-"}</td>
                  <td style={styles.td}>
                    <div style={styles.contactButtons}>
                      <button style={styles.smallButton} onClick={() => onOpenCustomer(customer)}>Fiche</button>
                      {customer.email && <button style={styles.smallButton} onClick={() => contactActions.email(customer.email)}>Email</button>}
                      {customer.phone && <button style={styles.smallButton} onClick={() => contactActions.sms(customer.phone)}>SMS</button>}
                      <button style={styles.smallButton} onClick={() => onOpenCommunication({ customer })}>Communication</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
