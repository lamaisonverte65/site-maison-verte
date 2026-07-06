import { styles } from "../adminStyles";
import { Info } from "../AdminUi";
import { formatDate, formatMoney } from "../../../utils/adminFormatters";

export default function CustomerStatisticsBlock({ profile }) {
  return (
    <section style={styles.card}>
      <h3 style={styles.subTitle}>Statistiques client</h3>
      <div style={styles.detailGrid}>
        <Info label="Séjours enregistrés" value={profile.bookingCount} />
        <Info label="Séjours actifs" value={profile.activeReservations} />
        <Info label="Séjours passés" value={profile.pastReservations} />
        <Info label="Premier séjour" value={formatDate(profile.firstStay)} />
        <Info label="Dernier séjour" value={formatDate(profile.lastStay)} />
        <Info label="Total payé" value={formatMoney(profile.totalSpent || profile.calculatedPaid)} />
        <Info label="Total séjours calculé" value={formatMoney(profile.calculatedTotalStay)} />
        <Info label="Total remboursé" value={formatMoney(profile.totalRefunded)} />
      </div>
    </section>
  );
}
