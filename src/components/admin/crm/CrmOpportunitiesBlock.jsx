import { styles } from "../adminStyles";
import { formatDate, formatMoney } from "../../../utils/adminFormatters";

export default function CrmOpportunitiesBlock({ customers = [], onOpenCustomer, onOpenCommunication }) {
  const opportunities = customers
    .filter((customer) => customer.canBeContacted && !customer.nextStay)
    .map((customer) => {
      const score = Number(customer.bookingCount || 0) * 20 + Number(customer.totalSpent || 0) / 100 - Math.min(Number(customer.daysSinceLastStay || 0) / 30, 30);
      return { ...customer, opportunityScore: Math.round(score) };
    })
    .filter((customer) => customer.opportunityScore > 0)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 20);

  return (
    <section style={styles.card}>
      <div style={styles.panelHeader}>
        <h3 style={styles.subTitle}>Opportunités commerciales</h3>
        <p style={styles.muted}>Priorisation simple des clients à potentiel, sans automatisme.</p>
      </div>

      {opportunities.length === 0 ? (
        <p style={styles.empty}>Aucune opportunité prioritaire détectée.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}>
              <tr>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Score</th>
                <th style={styles.th}>Séjours</th>
                <th style={styles.th}>Dernier séjour</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((customer) => (
                <tr key={customer.id}>
                  <td style={styles.td}>{customer.displayName}</td>
                  <td style={styles.td}>{customer.opportunityScore}</td>
                  <td style={styles.td}>{customer.bookingCount}</td>
                  <td style={styles.td}>{formatDate(customer.lastStay)}</td>
                  <td style={styles.td}>{formatMoney(customer.totalSpent)}</td>
                  <td style={styles.td}>
                    <div style={styles.contactButtons}>
                      <button style={styles.smallButton} onClick={() => onOpenCustomer(customer)}>Fiche</button>
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
