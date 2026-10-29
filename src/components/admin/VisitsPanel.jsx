import { styles } from "./adminStyles";
import { MiniBarChart, StatCard, SummaryList } from "./AdminUi";

function ViewsTrend({ days }) {
  const values = days.map((day) => Number(day.pages || 0));
  const max = Math.max(1, ...values);
  const span = Math.max(days.length - 1, 1);
  const points = values.map((value, index) => {
    const x = 22 + (index * 660) / span;
    const y = 130 - (value / max) * 104;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div style={styles.chartBox}>
      <strong>Évolution des pages vues sur 30 jours</strong>
      <svg viewBox="0 0 704 162" role="img" aria-label="Courbe des pages vues quotidiennes sur 30 jours" style={{ width: "100%", height: "auto" }}>
        <line x1="22" y1="130" x2="682" y2="130" stroke="currentColor" opacity="0.25" />
        <polyline points={points} fill="none" stroke="#15803d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {days.map((day, i) => (
          <circle key={day.date} cx={22 + (i * 660) / span} cy={130 - (values[i] / max) * 104} r="3" fill="#15803d">
            <title>{day.label} : {values[i]} pages vues</title>
          </circle>
        ))}
        <text x="22" y="151" fontSize="12" fill="currentColor">{days[0]?.label || ""}</text>
        <text x="682" y="151" fontSize="12" textAnchor="end" fill="currentColor">{days[days.length - 1]?.label || ""}</text>
      </svg>
    </div>
  );
}


export default function VisitsPanel({ data, onRefresh }) {
  const { stats, requestsLast30, dailyVisitStats, visitSourceStats,
    pageStats, languageStats, deviceStats } = data;
  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>Statistiques du site</h2>
          <p style={styles.muted}>
            Pages vues enregistrées, et non visiteurs uniques. Période : 30 derniers jours.
            Les événements de défilement et de durée ne sont plus collectés.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.smallButton} onClick={onRefresh}>Actualiser</button>
        </div>
      </div>

      <section style={styles.statsGrid}>
        <StatCard label="Pages vues aujourd’hui" value={stats.visitsToday} />
        <StatCard label="Pages vues 7 jours" value={stats.visitsWeek} />
        <StatCard label="Pages vues 30 jours" value={stats.visitsMonth} />
        <StatCard label="Demandes enregistrées 30 jours" value={requestsLast30} />
      </section>

      <div style={styles.analyticsChartsGrid}>
        <ViewsTrend days={dailyVisitStats} />
        <MiniBarChart
          title="Provenance des consultations"
          rows={visitSourceStats}
        />
      </div>

      <div style={styles.summaryGrid}>
        <SummaryList title="Pages les plus consultées" rows={pageStats} />
        <SummaryList title="Origines" rows={visitSourceStats} />
        <SummaryList title="Langues des navigateurs" rows={languageStats} />
        <SummaryList title="Appareils" rows={deviceStats} />
      </div>
    </section>
  );
}
