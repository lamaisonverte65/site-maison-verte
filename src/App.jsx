import { Helmet } from "react-helmet";
import { resolvePublicPage, languageForPublicPage } from "../shared/publicSiteLocale.js";
import { lazy, Suspense, useEffect, useState } from "react";

// Le formulaire lourd de l’accueil est chargé uniquement sur la route publique accueil.
const MaisonVerte = lazy(() => import("./pages/MaisonVerte"));
const Admin = lazy(() => import("./pages/Admin"));
const GuideValleesAureLouron = lazy(() => import("./pages/GuideValleesAureLouron"));
const LivretAccueil = lazy(() => import("./pages/LivretAccueil"));
const SkiValleesAureLouron = lazy(() => import("./pages/SkiValleesAureLouron"));
const ReviewValidation = lazy(() => import("./pages/ReviewValidation"));
const ContactRedirect = lazy(() => import("./pages/ContactRedirect"));
const AppelerRedirect = lazy(() => import("./pages/AppelerRedirect"));
const MentionsLegales = lazy(() => import("./pages/MentionsLegales"));
const PolitiqueConfidentialite = lazy(() => import("./pages/PolitiqueConfidentialite"));
import { getArrivalLinkMode } from "./utils/arrivalLink";
import { requestArrivalRecovery } from "./utils/requestArrivalRecovery.js";
import { normalizeGuestLanguage } from "../shared/guestLocale.js";
import { guestFlowTranslations, publicShellTranslations } from "./pages/guestFlowTranslations.js";
import SiteAnalyticsTracker from "./components/SiteAnalyticsTracker";
function PaymentSuccess({ language = "fr" }) {
  const t = guestFlowTranslations[normalizeGuestLanguage(language)].success;
  const homeHref = language === "fr" ? "/" : `/${normalizeGuestLanguage(language)}/`;
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f0e8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "28px",
          padding: "40px",
          maxWidth: "700px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "90px",
            height: "90px",
            borderRadius: "999px",
            background: "#64748b",
            margin: "0 auto 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "42px",
            fontWeight: "bold",
          }}
        >
          …
        </div>

        <h1
          style={{
            marginBottom: "18px",
            color: "#334155",
            fontSize: "clamp(28px, 4vw, 42px)",
          }}
        >
          {t.title}
        </h1>

        <p
          style={{
            fontSize: "18px",
            lineHeight: 1.7,
            color: "#334155",
          }}
        >
          {t.saved}
        </p>

        <p
          style={{
            fontSize: "18px",
            lineHeight: 1.7,
            color: "#334155",
          }}
        >
          {t.email}
        </p>

        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.7,
            color: "#64748b",
            marginTop: "20px",
          }}
        >
          {t.spam}
        </p>

        <div
          style={{
            marginTop: "30px",
            padding: "20px",
            borderRadius: "18px",
            background: "#f8fafc",
            textAlign: "left",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {t.next}
          </h3>

          <ul
            style={{
              lineHeight: 1.8,
              color: "#334155",
              paddingLeft: "20px",
            }}
          >
            {t.steps[0] && <li>{t.steps[0]}</li>}
            {t.steps[1] && <li>{t.steps[1]}</li>}
            {t.steps[2] && <li>{t.steps[2]}</li>}
          </ul>
        </div>

        <a
          href={homeHref}
          style={{
            marginTop: "30px",
            display: "inline-block",
            background: "#2f4f35",
            color: "white",
            padding: "14px 24px",
            borderRadius: "999px",
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          {t.home}
        </a>
      </div>
    </main>
  );
}

function PaymentCancel({ language = "fr" }) {
  const t = guestFlowTranslations[normalizeGuestLanguage(language)].cancel;
  const homeHref = language === "fr" ? "/" : `/${normalizeGuestLanguage(language)}/`;
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f0e8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "28px",
          padding: "40px",
          maxWidth: "650px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            marginBottom: "20px",
            color: "#b91c1c",
          }}
        >
          {t.title}
        </h1>

        <p
          style={{
            fontSize: "18px",
            lineHeight: 1.7,
            color: "#334155",
          }}
        >
          {t.notPaid}
        </p>

        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.7,
            color: "#64748b",
          }}
        >
          {t.later}
        </p>

        <a
          href={homeHref}
          style={{
            marginTop: "30px",
            display: "inline-block",
            background: "#2f4f35",
            color: "white",
            padding: "14px 24px",
            borderRadius: "999px",
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          {t.home}
        </a>
      </div>
    </main>
  );
}

function ArrivalTimePage({ language = "fr" }) {
  const t = guestFlowTranslations[normalizeGuestLanguage(language)].arrival;
  const homeHref = language === "fr" ? "/" : `/${normalizeGuestLanguage(language)}/`;
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("booking") || "";
  const token = params.get("token") || "";
  const linkMode = getArrivalLinkMode({ bookingId, token });
  const [arrivalTime, setArrivalTime] = useState("");
  const [status, setStatus] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryLastName, setRecoveryLastName] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [arrivalLoading, setArrivalLoading] = useState(linkMode === "secure");

  useEffect(() => {
    if (linkMode !== "secure") return;
    let active = true;

    async function loadArrivalTime() {
      try {
        const query = new URLSearchParams({ bookingId, token });
        const response = await fetch(`/.netlify/functions/update-arrival-time?${query.toString()}`);
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        if (active) setArrivalTime(data.arrivalTime || "");
      } catch (_) {
        if (active) setStatus(t.invalidSecure);
      } finally {
        if (active) setArrivalLoading(false);
      }
    }

    loadArrivalTime();
    return () => { active = false; };
  }, [bookingId, token, linkMode]);

  async function requestSecureArrivalLink(event) {
    event.preventDefault();
    if (!recoveryEmail.trim() || !recoveryLastName.trim()) {
      setRecoveryStatus(t.fillRecovery);
      return;
    }
    setRecoverySubmitting(true);
    try {
      await requestArrivalRecovery({ bookingId, email: recoveryEmail, lastName: recoveryLastName });
      setRecoveryStatus(t.recoverySent);
    } catch (_) {
      setRecoveryStatus(t.recoveryError);
    } finally {
      setRecoverySubmitting(false);
    }
  }

  async function submitArrivalTime(event) {
    event.preventDefault();

    if (!bookingId || !token || !arrivalTime) {
      setStatus(!token ? t.invalidLink : t.missingTime);
      return;
    }

    try {
      const response = await fetch("/.netlify/functions/update-arrival-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, token, arrivalTime }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setArrivalTime(data.arrivalTime || arrivalTime);
      setStatus(t.timeSaved);
    } catch (error) {
      setStatus(t.saveError);
    }
  }

  if (linkMode !== "secure") return (
    <main style={{ minHeight: "100vh", background: "#f3f0e8", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "Inter, sans-serif" }}>
      <form onSubmit={requestSecureArrivalLink} style={{ background: "white", borderRadius: "28px", padding: "40px", maxWidth: "640px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.12)", textAlign: "center" }}>
        <h1 style={{ color: "#14532d", marginTop: 0 }}>{t.recoveryTitle}</h1>
        {linkMode === "recovery" ? <>
          <p style={{ color: "#334155", lineHeight: 1.7 }}>{t.recoveryIntro}</p>
          <label htmlFor="arrival-recovery-email" style={{ display: "block", textAlign: "left", marginTop: "18px", color: "#334155", fontWeight: 600 }}>{t.emailPlaceholder}</label>
          <input id="arrival-recovery-email" type="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} placeholder={t.emailPlaceholder} autoComplete="email" style={{ width: "100%", padding: "16px", borderRadius: "16px", border: "1px solid #d1d5db", fontSize: "16px", marginTop: "18px" }} />
          <label htmlFor="arrival-recovery-surname" style={{ display: "block", textAlign: "left", marginTop: "12px", color: "#334155", fontWeight: 600 }}>{t.lastNamePlaceholder}</label>
          <input id="arrival-recovery-surname" type="text" value={recoveryLastName} onChange={(event) => setRecoveryLastName(event.target.value)} placeholder={t.lastNamePlaceholder} autoComplete="family-name" style={{ width: "100%", padding: "16px", borderRadius: "16px", border: "1px solid #d1d5db", fontSize: "16px", marginTop: "12px" }} />
          <button type="submit" disabled={recoverySubmitting} style={{ marginTop: "22px", border: "none", background: "#2f4f35", color: "white", padding: "14px 24px", borderRadius: "999px", fontWeight: "bold", cursor: recoverySubmitting ? "wait" : "pointer" }}>{recoverySubmitting ? t.sending : t.sendLink}</button>
        </> : <p style={{ color: "#b91c1c", lineHeight: 1.7 }}>{t.incompleteLink}</p>}
        {recoveryStatus && <p style={{ marginTop: "22px", color: "#334155" }}>{recoveryStatus}</p>}
        <a href={homeHref} style={{ marginTop: "24px", display: "inline-block", color: "#2f4f35" }}>{t.home}</a>
      </form>
    </main>
  );

  return (
    <main style={{ minHeight: "100vh", background: "#f3f0e8", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "Inter, sans-serif" }}>
      <form onSubmit={submitArrivalTime} style={{ background: "white", borderRadius: "28px", padding: "40px", maxWidth: "640px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.12)", textAlign: "center" }}>
        <h1 style={{ color: "#14532d", marginTop: 0 }}>{t.title}</h1>
        <p style={{ color: "#334155", lineHeight: 1.7 }}>
          {arrivalLoading
            ? t.loading
            : arrivalTime
            ? <>{t.currentTime} <strong>{arrivalTime}</strong>. {t.changeTime}</>
            : t.noTime}
        </p>
        <label htmlFor="arrival-time-input" style={{ display: "block", textAlign: "left", marginTop: "18px", color: "#334155", fontWeight: 600 }}>{t.timeInputLabel}</label>
        <input id="arrival-time-input" type="time" value={arrivalTime} onChange={(event) => { setArrivalTime(event.target.value); setStatus(""); }} step="300" disabled={arrivalLoading} style={{ width: "100%", padding: "16px", borderRadius: "16px", border: "1px solid #d1d5db", fontSize: "16px", marginTop: "18px" }} />
        <button type="submit" disabled={arrivalLoading} style={{ marginTop: "22px", border: "none", background: "#2f4f35", color: "white", padding: "14px 24px", borderRadius: "999px", fontWeight: "bold", cursor: arrivalLoading ? "wait" : "pointer" }}>{arrivalTime ? t.saveTime : t.chooseTime}</button>
        {status && <p style={{ marginTop: "22px", color: status.includes("✅") ? "#166534" : "#b91c1c" }}>{status}</p>}
        <a href={homeHref} style={{ marginTop: "24px", display: "inline-block", color: "#2f4f35" }}>{t.home}</a>
      </form>
    </main>
  );
}

function UntranslatedPublicPreview({ language }) {
  // R13.1 : les pages EN/ES restent noindex jusqu'a la recette de publication.
  // Ne pas lever ce verrou par erreur en ne modifiant que le sitemap.
  if (language === "fr") return null;
  return <Helmet><meta name="robots" content="noindex,follow" /></Helmet>;
}

function PublicNotFound({ language = "fr" }) {
  const normalizedLanguage = normalizeGuestLanguage(language);
  const t = publicShellTranslations[normalizedLanguage];
  const homeHref = normalizedLanguage === "fr" ? "/" : `/${normalizedLanguage}/`;
  return (
    <>
      <Helmet><meta name="robots" content="noindex,follow" /></Helmet>
      <main style={{ minHeight: "100vh", padding: "14vh 24px", textAlign: "center", background: "#f6f3ee", fontFamily: "Inter, sans-serif" }}>
        <h1>{t.notFoundTitle}</h1>
        <p>{t.notFoundMessage}</p>
        <a href={homeHref}>{t.home}</a>
      </main>
    </>
  );
}

export default function App() {
  const path = window.location.pathname;
  const publicPage = resolvePublicPage(path);
  const publicLanguage = languageForPublicPage(window.location.href);
  const previewMarker = <UntranslatedPublicPreview language={publicLanguage} />;

  function withAnalytics(page) {
    return (
      <>
        <SiteAnalyticsTracker />
        {page}
      </>
    );
  }

  function withLazyAnalytics(page) {
    const loadingText = publicShellTranslations[normalizeGuestLanguage(publicLanguage)].loading;
    return withAnalytics(
      <Suspense fallback={<main style={{ padding: "24px", fontFamily: "Inter, sans-serif" }}>{loadingText}</main>}>
        {page}
      </Suspense>,
    );
  }

  if (path === "/admin") {
    return (
      <Suspense fallback={<main style={{ padding: "24px", fontFamily: "Inter, sans-serif" }}>Chargement de l’administration…</main>}>
        <Admin />
      </Suspense>
    );
  }

  if (path === "/success") {
    return withAnalytics(<>{previewMarker}<PaymentSuccess language={publicLanguage} /></>);
  }

  if (path === "/cancel") {
    return withAnalytics(<>{previewMarker}<PaymentCancel language={publicLanguage} /></>);
  }

  if (path === "/arrival") {
    return withAnalytics(<>{previewMarker}<ArrivalTimePage language={publicLanguage} /></>);
  }

  if (path === "/avis-validation") {
    return withLazyAnalytics(<ReviewValidation />);
  }

  
  if (path === "/guide-vallees-aure-louron" || publicPage?.page === "guide") {
    return withLazyAnalytics(<>{previewMarker}<GuideValleesAureLouron /></>);
  }
  
  if (path === "/livret" || path === "/livret-accueil" || publicPage?.page === "booklet") {
    return withLazyAnalytics(<LivretAccueil />);
  }

  if (path === "/ski-vallees-aure-louron" || publicPage?.page === "ski") {
    return withLazyAnalytics(<>{previewMarker}<SkiValleesAureLouron /></>);
  }

  if (/^\/(?:en\/|es\/)?mentions-legales\/?$/.test(path)) {
    return withLazyAnalytics(<MentionsLegales />);
  }

  if (/^\/(?:en\/|es\/)?politique-confidentialite\/?$/.test(path)) {
    return withLazyAnalytics(<PolitiqueConfidentialite />);
  }

  if (path === "/contact") {
    return withLazyAnalytics(<ContactRedirect />);
  }

  if (path === "/appeler") {
    return withLazyAnalytics(<AppelerRedirect />);
  }
  
  if (publicPage?.page === "home") {
    return withLazyAnalytics(<>{previewMarker}<MaisonVerte /></>);
  }

  // Éviter que les URL inventées soient silencieusement affichées comme l'accueil.
  // Réponse HTTP Netlify encore 200 à cause du fallback SPA : traitement SEO en R13.
  return withAnalytics(<PublicNotFound language={publicLanguage} />);
}
