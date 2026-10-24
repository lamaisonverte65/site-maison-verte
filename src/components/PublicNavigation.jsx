import { useEffect, useState } from "react";
import {
  languageForPublicPage, localizePublicHref, publicUrlForLanguage,
} from "../../shared/publicSiteLocale.js";

const translatedLabels = {
  en: {
    "Accueil": "Home", "Présentation": "The house", "Galerie": "Gallery",
    "Avis": "Reviews", "Réservation": "Booking", "Activités": "Activities",
    "Situation": "Location", "FAQ": "FAQ", "Guide des vallées": "Valleys guide",
    "Livret d'accueil": "Welcome booklet", "Ski – Moniteur": "Ski lessons",
    "Contact": "Contact", "WhatsApp": "WhatsApp", "Appeler": "Call",
    "Réserver": "Book", "Langue": "Language",
  },
  es: {
    "Accueil": "Inicio", "Présentation": "La casa", "Galerie": "Galería",
    "Avis": "Opiniones", "Réservation": "Reservas", "Activités": "Actividades",
    "Situation": "Ubicación", "FAQ": "Preguntas frecuentes", "Guide des vallées": "Guía de los valles",
    "Livret d'accueil": "Guía de bienvenida", "Ski – Moniteur": "Clases de esquí",
    "Contact": "Contacto", "WhatsApp": "WhatsApp", "Appeler": "Llamar",
    "Réserver": "Reservar", "Langue": "Idioma",
  },
};

function whatsappUrlForLanguage(language, original) {
  if (language === "fr") return original;
  const message = language === "en"
    ? "Hello, I would like more information about La Maison Verte."
    : "Hola, me gustaría recibir información sobre La Maison Verte.";
  return `https://wa.me/33695938315?text=${encodeURIComponent(message)}`;
}


const menuItems = [
  ["Accueil", "/#accueil"],
  ["Présentation", "/#presentation"],
  ["Galerie", "/#galerie"],
  ["Avis", "/#avis"],
  ["Réservation", "/#reservation"],
  ["Activités", "/#activites"],
  ["Situation", "/#meteo"],
  ["FAQ", "/#faq"],
  ["Guide des vallées", "/guide-vallees-aure-louron"],
  ["Livret d'accueil", "/livret"],
  ["Ski – Moniteur", "/ski-vallees-aure-louron"],
  ["Contact", "/#contact"],
  ["WhatsApp", "https://wa.me/33695938315?text=Bonjour%2C%20je%20souhaite%20des%20renseignements%20concernant%20La%20Maison%20Verte."],
  ["Appeler", "/appeler"],
];

export default function PublicNavigation({ solid = true }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState(() =>
    typeof window === "undefined" ? "fr" : languageForPublicPage(window.location.href)
  );
  const label = (name) => translatedLabels[language]?.[name] || name;
  const internalHref = (href) => localizePublicHref(href, language);

  useEffect(() => {
    // Le livret modifie l'URL via history.replaceState sans recharger la page.
    const sync = () => setLanguage(languageForPublicPage(window.location.href));
    window.addEventListener("popstate", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  function changeLanguage(nextLanguage) {
    if (nextLanguage === language) return;
    window.location.assign(publicUrlForLanguage(window.location.href, nextLanguage));
  }

  const languageSelector = (id, className) => (
    <label htmlFor={id} className={className} style={{ display: "inline-flex", alignItems: "center", gap: "7px", color: "#173823", fontSize: "0.85rem", fontWeight: 800, background: "rgba(255,255,255,0.96)", border: "1px solid rgba(31,111,61,0.34)", padding: "5px 7px 5px 11px", borderRadius: "12px", boxShadow: "0 3px 14px rgba(0,0,0,0.2)", whiteSpace: "nowrap" }}>
      <span className="public-navigation-language-label">{label("Langue")}</span>
      <select
        id={id}
        aria-label={label("Langue")}
        value={language}
        onChange={(event) => changeLanguage(event.target.value)}
        style={{ background: "white", color: "#1e2b1f", border: "1px solid rgba(47,79,53,0.28)", borderRadius: "9px", fontSize: "14px", padding: "9px 6px", cursor: "pointer" }}
      >
        <option value="fr">FR</option>
        <option value="en">EN</option>
        <option value="es">ES</option>
      </select>
    </label>
  );

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <style>{`
        @media (max-width: 650px) {
          /* Choix de langue visible même sur mobile, sans cacher le bouton Réserver. */
          .public-nav-language-header { padding: 3px 4px !important; gap: 0 !important; }
          .public-nav-language-header .public-navigation-language-label { display: none; }
          .public-nav-language-header select { padding: 7px 3px !important; }
        }
        @media (max-width: 420px) {
          .public-navigation-shell { padding-left: 8px !important; padding-right: 8px !important; }
        }
        @media print {
          .public-navigation-shell,
          .public-navigation-backdrop,
          .public-navigation-drawer {
            display: none !important;
          }
        }
      `}</style>

      <header
        className="public-navigation-shell"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          boxSizing: "border-box",
          padding: "12px clamp(16px, 4vw, 40px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 1200,
          background: solid ? "rgba(246,243,238,0.97)" : "transparent",
          boxShadow: solid ? "0 8px 26px rgba(0,0,0,0.08)" : "none",
          transition: "background 0.3s ease, box-shadow 0.3s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <a
            href={internalHref("/#accueil")}
            aria-label="La Maison Verte - accueil"
            style={{ display: "flex", alignItems: "center", textDecoration: "none" }}
          >
            <img
              src="/logo.webp"
              alt="La Maison Verte"
              style={{
                height: "clamp(48px, 6vw, 62px)",
                maxWidth: "min(44vw, 220px)",
                objectFit: "contain",
                display: "block",
              }}
            />
          </a>

          <button
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={open}
            aria-controls="public-navigation-drawer"
            onClick={() => setOpen(true)}
            style={{
              width: "46px",
              height: "46px",
              border: "1px solid rgba(255,255,255,0.72)",
              borderRadius: "14px",
              padding: "10px",
              background: "#1f6f3d",
              color: "white",
              cursor: "pointer",
              display: "grid",
              alignContent: "center",
              gap: "5px",
              boxShadow: "0 6px 16px rgba(31,111,61,0.28)",
              transform: "translateY(8px)",
            }}
          >
            {[0, 1, 2].map((line) => (
              <span
                key={line}
                aria-hidden="true"
                style={{
                  display: "block",
                  width: "25px",
                  height: "2px",
                  borderRadius: "999px",
                  background: "white",
                }}
              />
            ))}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", minWidth: 0 }}>
        {languageSelector("public-language-header", "public-nav-language-header")}
        <a
          href={internalHref("/#reservation")}
          className="button"
          style={{
            textDecoration: "none",
            whiteSpace: "nowrap",
            padding: "11px clamp(14px, 3vw, 22px)",
            fontSize: "clamp(0.9rem, 2vw, 1rem)",
          }}
        >
          {label("Réserver")}
        </a>
        </div>
      </header>

      {open && (
        <>
          <button
            type="button"
            className="public-navigation-backdrop"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1250,
              border: 0,
              background: "rgba(15,23,18,0.48)",
              cursor: "default",
            }}
          />

          <aside
            id="public-navigation-drawer"
            className="public-navigation-drawer"
            aria-label="Menu principal"
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              left: 0,
              width: "min(360px, 90vw)",
              zIndex: 1300,
              background: "#f6f3ee",
              boxShadow: "18px 0 60px rgba(0,0,0,0.22)",
              padding: "22px 22px 28px",
              boxSizing: "border-box",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "14px",
                paddingBottom: "16px",
                marginBottom: "10px",
                borderBottom: "1px solid rgba(47,79,53,0.16)",
              }}
            >
              <a href={internalHref("/#accueil")} onClick={() => setOpen(false)} style={{ display: "flex" }}>
                <img
                  src="/logo.webp"
                  alt="La Maison Verte"
                  style={{ height: "58px", maxWidth: "210px", objectFit: "contain" }}
                />
              </a>
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
                style={{
                  width: "42px",
                  height: "42px",
                  border: "1px solid rgba(47,79,53,0.16)",
                  borderRadius: "50%",
                  background: "white",
                  color: "#1e2b1f",
                  fontSize: "25px",
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "12px 8px 16px", borderBottom: "1px solid rgba(47,79,53,0.12)", marginBottom: "8px" }}>
              {languageSelector("public-language-drawer", "public-nav-language-drawer")}
            </div>
            <nav aria-label="Navigation publique">
              {menuItems.map(([itemLabel, href]) => (
                <a
                  key={href}
                  href={href.startsWith("https://wa.me/") ? whatsappUrlForLanguage(language, href) : internalHref(href)}
                  target={href.startsWith("https://wa.me/") ? "_blank" : undefined}
                  rel={href.startsWith("https://wa.me/") ? "noopener noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                  style={{
                    display: "block",
                    padding: "11px 8px",
                    color: "#1e2b1f",
                    textDecoration: "none",
                    fontWeight: itemLabel === "Réservation" ? "800" : "600",
                    fontSize: "1.04rem",
                    borderRadius: "10px",
                  }}
                >
                  {label(itemLabel)}
                </a>
              ))}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
