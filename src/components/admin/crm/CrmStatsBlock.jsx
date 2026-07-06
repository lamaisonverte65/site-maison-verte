import { styles } from "../adminStyles";
import { StatCard } from "../AdminUi";

export default function CrmStatsBlock({ stats, onShowAllCustomers, onShowLoyalCustomers }) {
  return (
    <section style={styles.statsGrid}>
      <StatCard label="Clients" value={stats.totalCustomers} onClick={onShowAllCustomers} />
      <StatCard label="Clients fidèles" value={stats.loyalCustomers} onClick={onShowLoyalCustomers} />
      <StatCard label="Clients > 1000 €" value={stats.highValueCustomers} />
      <StatCard label="Opt-in marketing" value={stats.marketingOptIn} />
      <StatCard label="À relancer" value={stats.followUpCustomers} />
      <StatCard label="Contact manquant" value={stats.customersWithoutContact} />
    </section>
  );
}
