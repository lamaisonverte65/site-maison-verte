import { useCallback, useMemo } from "react";
import {
  uniqueVisitorCount,
  groupCount,
  getVisitMetadata,
  getVisitEventType,
  isPageView,
  isInternalVisit,
  getDeviceLabel,
  getCountryLabel,
  getLinkLabel,
  getVisitPageLabel,
  getSessionId,
  average,
  getUniqueSessionCount,
  groupVisitsByDay,
} from "../utils/adminFormatters";
import {
  getPageViewDurationSamples,
  getVisitSessionDuration,
  mergePageViewsWithEngagement,
} from "../services/siteAnalyticsService";

export function useVisitsData({ siteVisits, ownVisitorId }) {
  const visibleSiteVisits = useMemo(
    () => (siteVisits || []).filter((visit) => !isInternalVisit(visit, ownVisitorId)),
    [siteVisits, ownVisitorId]
  );

  const storedPageViewVisits = useMemo(
    () => visibleSiteVisits.filter(isPageView),
    [visibleSiteVisits]
  );

  const pageViewVisits = useMemo(
    () => mergePageViewsWithEngagement(storedPageViewVisits, visibleSiteVisits),
    [storedPageViewVisits, visibleSiteVisits]
  );

  const clickEvents = useMemo(
    () => visibleSiteVisits.filter((visit) => getVisitEventType(visit) === "link_click"),
    [visibleSiteVisits]
  );

  const sectionEvents = useMemo(
    () => visibleSiteVisits.filter((visit) => getVisitEventType(visit) === "section_view"),
    [visibleSiteVisits]
  );

  const visitSessions = useMemo(() => {
    const map = new Map();
    for (const visit of pageViewVisits) {
      const key = getSessionId(visit);
      if (!key) continue;
      const existing = map.get(key) || {
        sessionId: key,
        visitorId: visit.visitor_id,
        firstAt: visit.created_at,
        lastAt: visit.created_at,
        pages: [],
        source: visit.source,
        referrerDomain: visit.referrer_domain,
        country: getCountryLabel(visit),
        device: getDeviceLabel(visit),
        pageViewRows: [],
        maxScroll: 0,
      };
      existing.firstAt = new Date(visit.created_at) < new Date(existing.firstAt) ? visit.created_at : existing.firstAt;
      existing.lastAt = new Date(visit.created_at) > new Date(existing.lastAt) ? visit.created_at : existing.lastAt;
      existing.pages.push(getVisitPageLabel(visit));
      existing.pageViewRows.push(visit);
      existing.maxScroll = Math.max(existing.maxScroll, Number(visit.max_scroll_percent || getVisitMetadata(visit).max_scroll_percent || 0));
      map.set(key, existing);
    }
    return [...map.values()]
      .map(({ pageViewRows, ...session }) => ({
        ...session,
        duration: getVisitSessionDuration(pageViewRows, visibleSiteVisits),
      }))
      .sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
  }, [pageViewVisits, visibleSiteVisits]);

  const analyticsStats = useMemo(() => {
    const uniqueVisitors = uniqueVisitorCount(pageViewVisits);
    const sessions = getUniqueSessionCount(pageViewVisits);
    const pagesPerSession = sessions ? pageViewVisits.length / sessions : 0;
    const avgDuration = average(getPageViewDurationSamples(pageViewVisits));
    const mobileShare = pageViewVisits.length
      ? (pageViewVisits.filter((visit) => String(visit.device_type || getVisitMetadata(visit).device_type || "").toLowerCase() === "mobile").length / pageViewVisits.length) * 100
      : 0;
    const clickRate = pageViewVisits.length ? (clickEvents.length / pageViewVisits.length) * 100 : 0;

    return { uniqueVisitors, sessions, pagesPerSession, avgDuration, mobileShare, clickRate };
  }, [pageViewVisits, clickEvents]);

  const pageStats = useMemo(() => groupCount(pageViewVisits, getVisitPageLabel, 12), [pageViewVisits]);
  const deviceStats = useMemo(() => groupCount(pageViewVisits, getDeviceLabel, 8), [pageViewVisits]);
  const browserStats = useMemo(() => groupCount(pageViewVisits, (visit) => visit.browser || getVisitMetadata(visit).browser, 8), [pageViewVisits]);
  const screenStats = useMemo(() => groupCount(pageViewVisits, (visit) => visit.screen_size || getVisitMetadata(visit).screen_size, 8), [pageViewVisits]);
  const clickedLinkStats = useMemo(() => groupCount(clickEvents, getLinkLabel, 12), [clickEvents]);
  const sectionStats = useMemo(() => groupCount(sectionEvents, (visit) => visit.section_id || getVisitMetadata(visit).section_id, 12), [sectionEvents]);
  const languageStats = useMemo(() => groupCount(pageViewVisits, (visit) => visit.language || getVisitMetadata(visit).language, 8), [pageViewVisits]);
  const dailyVisitStats = useMemo(() => groupVisitsByDay(visibleSiteVisits, 14), [visibleSiteVisits]);

  const visitsSince = useCallback((days) => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    if (days > 1) since.setDate(since.getDate() - (days - 1));
    return pageViewVisits.filter((visit) => new Date(visit.created_at) >= since).length;
  }, [pageViewVisits]);

  return {
    visibleSiteVisits,
    pageViewVisits,
    clickEvents,
    analyticsStats,
    pageStats,
    deviceStats,
    browserStats,
    screenStats,
    clickedLinkStats,
    sectionStats,
    languageStats,
    dailyVisitStats,
    visitSessions,
    visitsSince,
  };
}
