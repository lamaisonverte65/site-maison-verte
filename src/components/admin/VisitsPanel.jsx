import { styles } from "./adminStyles";
import { MiniBarChart, StatCard, SummaryList } from "./AdminUi";
import {
  formatDateTime,
  formatDurationSeconds,
  formatPercent,
  getCountryLabel,
  getDeviceLabel,
  getLinkLabel,
  getVisitEventType,
  getVisitMetadata,
  getVisitPageLabel,
  normalizeSource,
} from "../../utils/adminFormatters";

export default function VisitsPanel({
  data,
  adminTrackingDisabled,
  onRefresh,
  onToggleAdminTracking,
}) {
  const {
    stats,
    analyticsStats,
    clickEvents,
    dailyVisitStats,
    visitSourceStats,
    pageStats,
    clickedLinkStats,
    visitCountryStats,
    deviceStats,
    browserStats,
    screenStats,
    languageStats,
    sectionStats,
    visitSessions,
    visibleSiteVisits,
  } = data;
  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>Statistiques de visite</h2>
          <p style={styles.muted}>
            Tes visites admin sont ignorées sur ce navigateur. Les pays peuvent être faussés par VPN/proxy ; quand le pays n&apos;est pas disponible, la langue et le fuseau horaire sont plus fiables.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.smallButton} onClick={onRefresh}>Actualiser</button>
          <button style={adminTrackingDisabled ? styles.smallButton : styles.warningButton} onClick={onToggleAdminTracking}>
            {adminTrackingDisabled ? "Ne pas compter mon navigateur" : "Attention : mon navigateur est compté"}
          </button>
        </div>
      </div>

      <section style={styles.statsGrid}>
        <StatCard label="Pages vues aujourd’hui" value={stats.visitsToday} />
        <StatCard label="Pages vues 7 jours" value={stats.visitsWeek} />
        <StatCard label="Pages vues 30 jours" value={stats.visitsMonth} />
        <StatCard label="Pages vues chargées" value={stats.visitsTotal} />
        <StatCard label="Visiteurs uniques" value={analyticsStats.uniqueVisitors} />
        <StatCard label="Sessions" value={analyticsStats.sessions} />
        <StatCard label="Pages / session" value={analyticsStats.pagesPerSession.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} />
        <StatCard label="Temps moyen / page" value={formatDurationSeconds(Math.round(analyticsStats.avgDuration))} />
        <StatCard label="Part mobile" value={formatPercent(analyticsStats.mobileShare)} />
        <StatCard label="Clics enregistrés" value={clickEvents.length} />
        <StatCard label="Taux clic / page" value={formatPercent(analyticsStats.clickRate)} />
        <StatCard label="Visiteurs → demandes" value={formatPercent(stats.conversionVisitorsToRequests)} />
      </section>

      <div style={styles.analyticsChartsGrid}>
        <MiniBarChart
          title="Pages vues sur 14 jours"
          rows={dailyVisitStats.map((row) => [row.label, row.pages])}
          emptyLabel="Aucune page vue"
        />
        <MiniBarChart
          title="Clics sur 14 jours"
          rows={dailyVisitStats.map((row) => [row.label, row.clicks])}
          emptyLabel="Aucun clic"
        />
        <MiniBarChart title="Origines principales" rows={visitSourceStats.slice(0, 8)} />
        <MiniBarChart title="Pages les plus vues" rows={pageStats.slice(0, 8)} />
      </div>

      <div style={styles.summaryGrid}>
        <SummaryList title="Pages les plus vues" rows={pageStats} />
        <SummaryList title="Liens cliqués" rows={clickedLinkStats} />
        <SummaryList title="Sources" rows={visitSourceStats} />
        <SummaryList title="Pays / indication pays" rows={visitCountryStats} />
        <SummaryList title="Appareils" rows={deviceStats} />
        <SummaryList title="Navigateurs" rows={browserStats} />
        <SummaryList title="Tailles écran" rows={screenStats} />
        <SummaryList title="Langues" rows={languageStats} />
        <SummaryList title="Sections vues" rows={sectionStats} />
      </div>

      <h3 style={styles.subTitle}>Sessions récentes</h3>
      {visitSessions.length === 0 ? <p style={styles.empty}>Aucune visite externe enregistrée pour le moment.</p> : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}>
              <tr>
                <th style={styles.th}>Dernière activité</th>
                <th style={styles.th}>Source</th>
                <th style={styles.th}>Appareil</th>
                <th style={styles.th}>Pays</th>
                <th style={styles.th}>Pages vues</th>
                <th style={styles.th}>Durée connue</th>
                <th style={styles.th}>Scroll max</th>
                <th style={styles.th}>Visiteur</th>
              </tr>
            </thead>
            <tbody>{visitSessions.slice(0, 80).map((session) => (
              <tr key={session.sessionId}>
                <td style={styles.td}>{formatDateTime(session.lastAt)}</td>
                <td style={styles.td}>{normalizeSource(session.source || session.referrerDomain || "Direct")}</td>
                <td style={styles.td}>{session.device}</td>
                <td style={styles.td}>{session.country || "-"}</td>
                <td style={{...styles.td, whiteSpace: "normal", minWidth: "220px"}}>{[...new Set(session.pages)].join(" → ")}</td>
                <td style={styles.td}>{formatDurationSeconds(session.duration)}</td>
                <td style={styles.td}>{session.maxScroll ? `${session.maxScroll} %` : "-"}</td>
                <td style={styles.td}>{String(session.visitorId || "-").slice(0, 18)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <h3 style={styles.subTitle}>Événements récents</h3>
      {visibleSiteVisits.length === 0 ? <p style={styles.empty}>Aucun événement enregistré pour le moment.</p> : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Page</th>
                <th style={styles.th}>Origine</th>
                <th style={styles.th}>Détail</th>
                <th style={styles.th}>Appareil</th>
                <th style={styles.th}>Pays</th>
                <th style={styles.th}>Durée / scroll</th>
                <th style={styles.th}>Visiteur</th>
              </tr>
            </thead>
            <tbody>{visibleSiteVisits.slice(0, 160).map((visit) => {
              const type = getVisitEventType(visit);
              const meta = getVisitMetadata(visit);
              const detail = type === "link_click"
                ? getLinkLabel(visit)
                : type === "section_view"
                  ? (visit.section_id || meta.section_id || "Section")
                  : (visit.referrer_domain || meta.referrer_domain || "-");
              const duration = visit.duration_seconds || meta.duration_seconds;
              const scroll = visit.max_scroll_percent || meta.max_scroll_percent;
              return <tr key={visit.id}>
                <td style={styles.td}>{formatDateTime(visit.created_at)}</td>
                <td style={styles.td}>{type}</td>
                <td style={styles.td}>{getVisitPageLabel(visit)}</td>
                <td style={styles.td}>{normalizeSource(visit.source || meta.source || "Direct")}</td>
                <td style={{...styles.td, whiteSpace: "normal", minWidth: "260px"}}>{detail}</td>
                <td style={styles.td}>{getDeviceLabel(visit)}</td>
                <td style={styles.td}>{getCountryLabel(visit)}</td>
                <td style={styles.td}>{formatDurationSeconds(duration)}{scroll ? ` · ${scroll} %` : ""}</td>
                <td style={styles.td}>{String(visit.visitor_id || "-").slice(0, 18)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
