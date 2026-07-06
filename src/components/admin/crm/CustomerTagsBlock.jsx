import { styles } from "../adminStyles";

function buildTags(customer) {
  const tags = [];
  if (customer.isLoyal) tags.push("fidèle");
  if (customer.isHighValue) tags.push("forte valeur");
  if (customer.marketing_consent) tags.push("opt-in");
  if (customer.nextStay) tags.push("séjour à venir");
  if (!customer.email && !customer.phone) tags.push("contact manquant");
  if (customer.daysSinceLastStay > 900) tags.push("ancien client");
  return tags;
}

export default function CustomerTagsBlock({ customers = [], onOpenCustomer }) {
  const taggedCustomers = customers
    .map((customer) => ({ ...customer, tags: buildTags(customer) }))
    .filter((customer) => customer.tags.length > 0)
    .slice(0, 30);

  return (
    <section style={styles.card}>
      <h3 style={styles.subTitle}>Tags CRM automatiques</h3>
      <p style={styles.muted}>Première version sans modification de base : les tags sont calculés depuis les données existantes.</p>

      {taggedCustomers.length === 0 ? (
        <p style={styles.empty}>Aucun tag automatique détecté.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}>
              <tr>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Tags</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {taggedCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td style={styles.td}>{customer.displayName}</td>
                  <td style={styles.td}>
                    <div style={styles.chipList}>
                      {customer.tags.map((tag) => <span key={tag} style={styles.historyChip}>{tag}</span>)}
                    </div>
                  </td>
                  <td style={styles.td}><button style={styles.smallButton} onClick={() => onOpenCustomer(customer)}>Fiche</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
