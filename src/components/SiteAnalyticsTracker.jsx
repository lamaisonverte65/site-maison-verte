import { useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { writePageViewOnce } from "../services/siteAnalyticsService";

const INTERNAL_STORAGE_KEY = "lmv_admin_browser";
const VISITOR_STORAGE_KEY = "lmv_visitor_id";
const SESSION_STORAGE_KEY = "lmv_session_id";

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getDeviceType() {
  const userAgent = navigator.userAgent || "";
  if (/Mobi|Android|iPhone|iPod/i.test(userAgent)) return "mobile";
  if (/iPad|Tablet/i.test(userAgent)) return "tablette";
  return "ordinateur";
}

function getReferrerDomain() {
  try {
    return document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

function getSource(referrerDomain, params) {
  const utmSource = params.get("utm_source");
  if (utmSource) return utmSource;
  if (referrerDomain.includes("google")) return "google";
  if (referrerDomain.includes("booking")) return "booking";
  if (referrerDomain.includes("airbnb")) return "airbnb";
  if (/facebook|fb\./.test(referrerDomain)) return "facebook";
  if (referrerDomain.includes("instagram")) return "instagram";
  return referrerDomain ? "referral" : "direct";
}

// R18 : un seul événement par page chargée. Les événements heartbeat,
// scroll, section, clic et formulaire ne sont plus collectés.
export default function SiteAnalyticsTracker() {
  const pageViewWriteStateRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.pathname === "/admin") return;

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("no_stats") === "1" || params.get("stats") === "off") {
        window.localStorage.setItem(INTERNAL_STORAGE_KEY, "1");
        return;
      }
      if (window.localStorage.getItem(INTERNAL_STORAGE_KEY) === "1") return;

      let visitorId = window.sessionStorage.getItem(VISITOR_STORAGE_KEY);
      if (!visitorId) {
        visitorId = createId("visiteur");
        window.sessionStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
      }
      let sessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionId) {
        sessionId = createId("session");
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      }

      const referrerDomain = getReferrerDomain();
      const page = window.location.pathname || "/";
      writePageViewOnce({
        writeState: pageViewWriteStateRef,
        supabase,
        payload: {
          page,
          visitor_id: visitorId,
          session_id: sessionId,
          event_type: "page_view",
          source: getSource(referrerDomain, params),
          referrer_domain: referrerDomain || null,
          device_type: getDeviceType(),
          language: navigator.language || null,
          is_internal: false,
          metadata: { page },
        },
      }).catch((error) => console.warn("Analytics page_view non enregistré :", error?.message || error));
    } catch (error) {
      console.warn("Analytics indisponible :", error?.message || error);
    }
  }, []);

  return null;
}
