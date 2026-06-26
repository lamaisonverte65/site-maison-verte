import { useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

const INTERNAL_STORAGE_KEY = "lmv_admin_browser";
const VISITOR_STORAGE_KEY = "lmv_visitor_id";
const SESSION_STORAGE_KEY = "lmv_session_id";

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getBrowser() {
  const ua = navigator.userAgent || "";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome") && !ua.includes("Edg/")) return "Chrome";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  return "Autre";
}

function getOS() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Autre";
}

function getDeviceType() {
  const ua = navigator.userAgent || "";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  if (/iPad|Tablet/i.test(ua)) return "tablette";
  return "ordinateur";
}

function getReferrerDomain(referrer) {
  try {
    return referrer ? new URL(referrer).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

function getDetectedSource(referrerDomain, params) {
  const utmSource = params.get("utm_source");
  if (utmSource) return utmSource;
  if (referrerDomain.includes("google")) return "google";
  if (referrerDomain.includes("booking")) return "booking";
  if (referrerDomain.includes("airbnb")) return "airbnb";
  if (referrerDomain.includes("facebook") || referrerDomain.includes("fb.")) return "facebook";
  if (referrerDomain.includes("instagram")) return "instagram";
  if (referrerDomain) return "referral";
  return "direct";
}

function getScrollPercent() {
  const doc = document.documentElement;
  const body = document.body;
  const scrollTop = window.scrollY || doc.scrollTop || body.scrollTop || 0;
  const scrollHeight = Math.max(body.scrollHeight, doc.scrollHeight, body.offsetHeight, doc.offsetHeight);
  const viewport = window.innerHeight || doc.clientHeight || 1;
  const maxScrollable = Math.max(scrollHeight - viewport, 1);
  return Math.min(100, Math.max(0, Math.round((scrollTop / maxScrollable) * 100)));
}

function getCountryHint(language, timezone) {
  const region = String(language || "").split("-")[1];
  if (region) return region.toUpperCase();
  if (String(timezone || "").includes("Paris")) return "FR";
  return "";
}

function getCommonData(visitorId, sessionId) {
  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || "";
  const referrerDomain = getReferrerDomain(referrer);
  const language = navigator.language || "";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const source = getDetectedSource(referrerDomain, params);

  return {
    page: window.location.pathname || "/",
    visitor_id: visitorId,
    session_id: sessionId,
    referrer,
    referrer_domain: referrerDomain || null,
    source,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    device_type: getDeviceType(),
    browser: getBrowser(),
    os: getOS(),
    language,
    timezone,
    country: null,
    screen_size: `${window.screen?.width || 0}×${window.screen?.height || 0}`,
    viewport_size: `${window.innerWidth || 0}×${window.innerHeight || 0}`,
    is_internal: false,
    metadata: {
      page: window.location.pathname || "/",
      title: document.title,
      country_hint: getCountryHint(language, timezone),
      user_agent: navigator.userAgent,
      touch_points: navigator.maxTouchPoints || 0,
      platform: navigator.platform || "",
      color_depth: window.screen?.colorDepth || null,
      pixel_ratio: window.devicePixelRatio || 1,
    },
  };
}

async function insertAnalyticsEvent(payload) {
  const enrichedPayload = {
    ...payload,
    metadata: {
      ...(payload.metadata || {}),
      event_type: payload.event_type,
      page: payload.page,
      session_id: payload.session_id,
    },
  };

  const { data, error } = await supabase
    .from("site_visits")
    .insert([enrichedPayload])
    .select("id")
    .single();

  if (!error) return data?.id || null;

  // Sécurité : si la base n'a pas encore les nouvelles colonnes,
  // on garde l'ancien compteur au lieu de casser le site.
  console.warn("Analytics enrichi non enregistré, fallback simple :", error.message);
  await supabase.from("site_visits").insert([
    {
      page: payload.page,
      visitor_id: payload.visitor_id,
      referrer: payload.referrer,
      referrer_domain: payload.referrer_domain,
      source: payload.source,
      country: payload.country,
    },
  ]);

  return null;
}

export default function SiteAnalyticsTracker() {
  const pageViewIdRef = useRef(null);
  const startedAtRef = useRef(Date.now());
  const maxScrollRef = useRef(0);
  const scrollMilestonesRef = useRef(new Set());
  const sectionSeenRef = useRef(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/admin") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("no_stats") === "1" || params.get("stats") === "off") {
      window.localStorage.setItem(INTERNAL_STORAGE_KEY, "1");
      return;
    }

    if (window.localStorage.getItem(INTERNAL_STORAGE_KEY) === "1") return;

    let visitorId = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!visitorId) {
      visitorId = createId("visiteur");
      window.localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
    }

    let sessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = createId("session");
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }

    const commonData = getCommonData(visitorId, sessionId);
    let cancelled = false;

    async function trackPageView() {
      const id = await insertAnalyticsEvent({
        ...commonData,
        event_type: "page_view",
        max_scroll_percent: 0,
        duration_seconds: 0,
      });
      if (!cancelled) pageViewIdRef.current = id;
    }

    async function updatePageView() {
      const id = pageViewIdRef.current;
      if (!id) return;
      const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const maxScroll = Math.max(maxScrollRef.current, getScrollPercent());
      await supabase
        .from("site_visits")
        .update({
          duration_seconds: duration,
          max_scroll_percent: maxScroll,
          metadata: {
            ...commonData.metadata,
            event_type: "page_view",
            duration_seconds: duration,
            max_scroll_percent: maxScroll,
            last_update_at: new Date().toISOString(),
          },
        })
        .eq("id", id);
    }

    function trackEvent(eventType, extra = {}) {
      insertAnalyticsEvent({
        ...commonData,
        ...extra,
        event_type: eventType,
        max_scroll_percent: Math.max(maxScrollRef.current, getScrollPercent()),
        duration_seconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        metadata: {
          ...commonData.metadata,
          ...(extra.metadata || {}),
        },
      });
    }

    function handleScroll() {
      const percent = getScrollPercent();
      maxScrollRef.current = Math.max(maxScrollRef.current, percent);

      for (const milestone of [25, 50, 75, 90]) {
        if (percent >= milestone && !scrollMilestonesRef.current.has(milestone)) {
          scrollMilestonesRef.current.add(milestone);
          trackEvent("scroll_depth", { metadata: { scroll_percent: milestone } });
        }
      }
    }

    function handleClick(event) {
      const target = event.target?.closest?.("a, button, [role='button']");
      if (!target) return;

      const href = target.href || target.getAttribute("href") || "";
      const text = (target.innerText || target.textContent || target.getAttribute("aria-label") || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);

      trackEvent("link_click", {
        href: href || null,
        link_text: text || null,
        element_type: target.tagName?.toLowerCase() || null,
        element_text: text || null,
        metadata: {
          href,
          link_text: text,
          element_type: target.tagName?.toLowerCase() || null,
          is_external: href ? !href.includes(window.location.hostname) : false,
        },
      });
    }

    function handleFormStart(event) {
      const target = event.target;
      if (!target?.closest) return;
      const form = target.closest("form");
      if (!form) return;
      const label = form.getAttribute("aria-label") || form.id || form.className || "formulaire";
      const key = `form_${label}`;
      if (sectionSeenRef.current.has(key)) return;
      sectionSeenRef.current.add(key);
      trackEvent("form_start", { metadata: { form: String(label).slice(0, 120) } });
    }

    trackPageView();
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("click", handleClick, true);
    document.addEventListener("focusin", handleFormStart, true);

    const updateTimer = window.setInterval(updatePageView, 10000);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target;
          const sectionId = element.id || element.getAttribute("aria-label") || element.className || "section";
          const key = String(sectionId).slice(0, 120);
          if (sectionSeenRef.current.has(key)) continue;
          sectionSeenRef.current.add(key);
          trackEvent("section_view", {
            section_id: key,
            metadata: { section_id: key },
          });
        }
      },
      { threshold: 0.45 }
    );

    document.querySelectorAll("section[id], main section[aria-label], #reservation, #galerie, #avis, #faq").forEach((element) => {
      observer.observe(element);
    });

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") updatePageView();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", updatePageView);

    return () => {
      cancelled = true;
      updatePageView();
      window.clearInterval(updateTimer);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("focusin", handleFormStart, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", updatePageView);
      observer.disconnect();
    };
  }, []);

  return null;
}
