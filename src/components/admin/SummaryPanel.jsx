import { styles } from "./adminStyles";
import { StatCard, SummaryList } from "./AdminUi";
import { formatMoney } from "../../utils/adminFormatters";

export default function SummaryPanel({ stats, sourceStats, visitSourceStats, onNavigate }) {
  function goTo(tab) { if (onNavigate) onNavigate(tab); }

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>Synthèse CRM & exploitation</h2>
        <p style={styles.muted}>Encaissements, réservations et trafic du site.</p>
      </div>

      <h3 style={styles.subTitle}>Encaissements réels</h3>
      <section style={styles.statsGrid}>
        <StatCard label="Acomptes encaissés" value={formatMoney(stats.depositCollected)} onClick={() => goTo("payments")} />
        <StatCard label="Soldes encaissés" value={formatMoney(stats.balanceCollected)} onClick={() => goTo("payments")} />
        <StatCard label="Total encaissé réservations" value={formatMoney(stats.totalCollected)} onClick={() => goTo("payments")} />
        <StatCard label="Paiements Stripe bruts" value={formatMoney(stats.stripeGrossPaymentTotal)} onClick={() => goTo("payments")} />
        <StatCard label="Remboursements Stripe" value={formatMoney(stats.stripeRefundTotal)} onClick={() => goTo("payments")} />
        <StatCard label="Frais Stripe réels" value={formatMoney(stats.stripeFeeTotal)} onClick={() => goTo("payments")} />
        <StatCard label="Net Stripe après remboursements" value={formatMoney(stats.stripeNetTotal)} onClick={() => goTo("payments")} />
        <StatCard label="Net bancaire attendu" value={formatMoney(stats.stripeBankExpectedNetTotal)} onClick={() => goTo("stripe_payouts")} />
        <StatCard label="Net réellement viré" value={formatMoney(stats.stripeReconciledNetTotal)} onClick={() => goTo("stripe_payouts")} />
        <StatCard label="Payouts Stripe rapprochés" value={formatMoney(stats.stripePayoutTotal)} onClick={() => goTo("stripe_payouts")} />
        <StatCard label="Écart bancaire Stripe" value={formatMoney(stats.stripePayoutDifference)} onClick={() => goTo("stripe_payouts")} />
        <StatCard label="À rapprocher Stripe" value={stats.stripeFinancialsIncompleteCount} onClick={() => goTo("payments")} />
      </section>

      <h3 style={styles.subTitle}>Réservations confirmées</h3>
      <section style={styles.statsGrid}>
        <StatCard label="CA confirmé" value={formatMoney(stats.caConfirmed)} onClick={() => goTo("reservations")} />
        <StatCard label="Déjà encaissé" value={formatMoney(stats.totalCollected)} onClick={() => goTo("payments")} />
        <StatCard label="Reste à encaisser" value={formatMoney(stats.remainingToCollect)} onClick={() => goTo("payments")} />
        <StatCard label="Réservations confirmées" value={stats.confirmed} onClick={() => goTo("reservations")} />
      </section>

      <h3 style={styles.subTitle}>Trafic du site</h3>
      <section style={styles.statsGrid}>
        <StatCard label="Pages vues aujourd’hui" value={stats.visitsToday} onClick={() => goTo("visits")} />
        <StatCard label="Pages vues 7 jours" value={stats.visitsWeek} onClick={() => goTo("visits")} />
        <StatCard label="Pages vues 30 jours" value={stats.visitsMonth} onClick={() => goTo("visits")} />
      </section>
      <div style={styles.summaryGrid}>
        <SummaryList title="Réservations par source" rows={sourceStats} />
        <SummaryList title="Pages vues par provenance (30 jours)" rows={visitSourceStats} />
      </div>
    </section>
  );
}
