import { languageForPublicPage } from "../../../shared/publicSiteLocale.js";
import { getHomeCopy } from "./homeTranslations.js";
export function HomeHero() {
  const language = typeof window === "undefined" ? "fr" : languageForPublicPage(window.location.href);
  const copy = getHomeCopy(language).hero;
  return (
<section id="accueil" className="hero">
  <div className="overlay">
    <div
      className="hero-content"
      style={{
        animation: "fadeUp 1.2s ease",
        maxWidth: "920px",
        padding: "0 24px",
      }}
    >
      <h1
        className="hero-main-title"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "clamp(4.2rem, 11vw, 7rem)",
          marginBottom: "24px",
          fontWeight: "600",
          letterSpacing: "-2px",
          lineHeight: "0.95",
          color: "#eef5ee",
          textShadow: `-1.2px -1.2px 0 rgba(0,0,0,0.52),
           1.2px -1.2px 0 rgba(0,0,0,0.52),
          -1.2px  1.2px 0 rgba(0,0,0,0.52),
           1.2px  1.2px 0 rgba(0,0,0,0.52),
           0 6px 22px rgba(0,0,0,0.78)`,
        }}
      >
        La Maison Verte
      </h1>

      <h2
        className="hero-subtitle"
        style={{
          fontSize: "clamp(1rem, 2vw, 1.6rem)",
          fontWeight: "500",
          lineHeight: "1.4",
          color: "#e4efe4",
          textShadow: `-1px -1px 0 rgba(0,0,0,0.48),
           1px -1px 0 rgba(0,0,0,0.48),
          -1px  1px 0 rgba(0,0,0,0.48),
           1px  1px 0 rgba(0,0,0,0.48),
           0 4px 16px rgba(0,0,0,0.70)`,
          maxWidth: "900px",
          margin: "0 auto 30px",
        }}
      >
        {copy.subtitle1}
        <br />
        {copy.subtitle2}
      </h2>

      <div
        className="hero-classification"
        title={copy.classificationTitle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          padding: "9px 18px",
          margin: "0 auto 24px",
          border: "1px solid rgba(255,255,255,0.75)",
          borderRadius: "999px",
          background: "rgba(20,83,45,0.72)",
          color: "white",
          fontWeight: "800",
          fontSize: "clamp(0.9rem, 1.8vw, 1.05rem)",
          letterSpacing: "0.01em",
          backdropFilter: "blur(8px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.24)",
          textShadow: "0 2px 6px rgba(0,0,0,0.45)",
        }}
      >
        <span aria-hidden="true" style={{ letterSpacing: "2px" }}>★★★</span>
        <span>{copy.classification}</span>
      </div>

      <div
        className="hero-location"
        style={{
          marginBottom: "42px",
          padding: "8px 24px",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.14) 45%, rgba(0,0,0,0) 75%)",
        }}
      >
        <div
          className="hero-location-title"
          style={{
            fontFamily: "'Lora', serif",
            fontSize: "clamp(1.15rem, 2.3vw, 1.6rem)",
            letterSpacing: "8px",
            textTransform: "uppercase",
            marginBottom: "22px",
            fontWeight: "800",
            color: "white",
            textShadow: `-1px -1px 0 rgba(0,0,0,0.58),
           1px -1px 0 rgba(0,0,0,0.58),
          -1px  1px 0 rgba(0,0,0,0.58),
           1px  1px 0 rgba(0,0,0,0.58),
           0 6px 20px rgba(0,0,0,0.85)`,
          }}
        >
          -Arreau-
          <br />
          {copy.location}
        </div>
        <p
          className="hero-description"
          style={{
            fontFamily: "'Lora', serif",
            fontSize: "clamp(1.05rem, 2.4vw, 1.45rem)",
            maxWidth: "760px",
            lineHeight: "1.8",
            margin: "auto",
            color: "#f2f6f2",
            fontWeight: "600",
            textShadow: `-1px -1px 0 rgba(0,0,0,0.48),
           1px -1px 0 rgba(0,0,0,0.48),
          -1px  1px 0 rgba(0,0,0,0.48),
           1px  1px 0 rgba(0,0,0,0.48),
           0 4px 16px rgba(0,0,0,0.70)`,
          }}
        >
          {copy.description}
        </p>
      </div>

      <div
        className="hero-actions"
        style={{
          display: "flex",
          gap: "20px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <a
          href="#reservation"
          className="button"
          style={{
            fontSize: "17px",
            padding: "17px 34px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            textDecoration: "none",
          }}
        >
          {copy.book}
        </a>

        <a
          href="#galerie"
          className="hero-secondary-cta"
          style={{
            border: "1px solid white",
            color: "white",
            padding: "17px 34px",
            borderRadius: "999px",
            textDecoration: "none",
            backdropFilter: "blur(10px)",
            background: "rgba(255,255,255,0.1)",
            fontSize: "17px",
          }}
        >
          {copy.photos}
        </a>

        <a
          href="#faq"
          className="hero-secondary-cta"
          style={{
            border: "1px solid white",
            color: "white",
            padding: "17px 34px",
            borderRadius: "999px",
            textDecoration: "none",
            backdropFilter: "blur(10px)",
            background: "rgba(255,255,255,0.1)",
            fontSize: "17px",
          }}
        >
          FAQ
        </a>
      </div>
    </div>
  </div>
</section>
  );
}
