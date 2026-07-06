import { styles } from "../adminStyles";

export default function CrmActionsBlock({ selectedCustomers = [], contactActions, onOpenCustomer, onOpenCommunication }) {
  const firstCustomer = selectedCustomers[0];
  const emails = selectedCustomers.map((customer) => customer.email).filter(Boolean);

  function emailSegment() {
    if (emails.length === 0) return alert("Aucun email disponible dans ce segment.");
    const first = emails[0];
    const bcc = emails.slice(1).join(",");
    window.location.href = `mailto:${encodeURIComponent(first)}?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent("La Maison Verte - message client")}`;
  }

  return (
    <section style={styles.card}>
      <h3 style={styles.subTitle}>Actions CRM rapides</h3>
      <p style={styles.muted}>Actions manuelles uniquement : aucun envoi automatique n'est déclenché.</p>
      <div style={styles.contactButtons}>
        <button style={styles.smallButton} onClick={emailSegment}>Email segment</button>
        {firstCustomer && <button style={styles.smallButton} onClick={() => onOpenCustomer(firstCustomer)}>Ouvrir premier client</button>}
        {firstCustomer && <button style={styles.smallButton} onClick={() => onOpenCommunication({ customer: firstCustomer })}>Communication premier client</button>}
        {firstCustomer?.email && <button style={styles.smallButton} onClick={() => contactActions.email(firstCustomer.email)}>Email direct</button>}
      </div>
    </section>
  );
}
