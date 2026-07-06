import { styles } from "../adminStyles";

export default function MarketingConsentBlock({ optInCustomers, noConsentCustomers, onShowAllCustomers }) {
  const total = optInCustomers.length + noConsentCustomers.length;
  const ratio = total ? Math.round((optInCustomers.length / total) * 100) : 0;

  return (
    <section style={styles.card}>
      <h3 style={styles.subTitle}>Consentement marketing</h3>
      <div style={styles.detailGrid}>
        <div style={styles.infoItem}><span>Opt-in oui</span><strong>{optInCustomers.length}</strong></div>
        <div style={styles.infoItem}><span>Opt-in non / inconnu</span><strong>{noConsentCustomers.length}</strong></div>
        <div style={styles.infoItem}><span>Taux opt-in</span><strong>{ratio} %</strong></div>
      </div>
      <p style={styles.muted}>Ce bloc prépare les futures campagnes CRM sans envoyer automatiquement de message.</p>
      <button style={styles.smallButton} onClick={onShowAllCustomers}>Voir la page clients</button>
    </section>
  );
}
