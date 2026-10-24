import { getHomeCopy } from "./homeTranslations.js";
import { languageForPublicPage, localizePublicHref } from "../../../shared/publicSiteLocale.js";
export function HomePresentation() {
  const language = typeof window === "undefined" ? "fr" : languageForPublicPage(window.location.href);
  const copy = getHomeCopy(language).presentation;
  return (
<section id="presentation" className="section" style={{ scrollMarginTop: "86px" }}>
        <h2
          style={{
            marginBottom: "34px",
          }}
        >
          {copy.title}
        </h2>
        <div
          className="home-presentation-grid"
          style={{
            display: "grid",
            gap: "40px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "clamp(20px, 3.3vw, 40px)",
              borderRadius: "35px",
              boxShadow: "0 15px 45px rgba(0,0,0,0.08)",
            }}
          >
            <h3>{copy.subtitle}</h3>

            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
                marginTop: "20px",
              }}
            >
              {copy.paragraphs[0]}
            </p>

            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
              }}
            >
              {copy.paragraphs[1]}
            </p>


            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
              }}
            >
              {copy.paragraphs[2]}
            </p>

            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
              }}
            >
              {copy.paragraphs[3]}
            </p>
          </div>

          <div
            style={{
              background: "#1f6f3d",
              color: "white",
              padding: "clamp(20px, 3vw, 35px)",
              borderRadius: "35px",
              boxShadow: "0 15px 45px rgba(0,0,0,0.12)",
            }}
          >
            <h3
              style={{
                color: "white",
                marginBottom: "25px",
              }}
            >
              {copy.quick}
            </h3>

            <div
              style={{
                display: "grid",
                gap: "18px",
              }}
            >
              {copy.benefits.map((benefit) => <div key={benefit}>{benefit}</div>)}
            </div>

            <div
              style={{
                marginTop: "26px",
                paddingTop: "22px",
                borderTop: "1px solid rgba(255,255,255,0.28)",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <img
                loading="lazy"
                decoding="async"
                src="/classement/panonceau-meuble-tourisme-3-etoiles-2026.webp"
                alt={copy.classification}
                style={{ width: "92px", height: "auto", flex: "0 0 auto" }}
              />
              <div style={{ lineHeight: 1.45, fontSize: "0.92rem" }}>
                <strong>{copy.classification}</strong>
                <br />
                {copy.classAuthority}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "45px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))",
            gap: "18px",
          }}
        >
          {copy.amenities.map((item) => (
            <div
              key={item}
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "22px",
                boxShadow: "0 8px 25px rgba(0,0,0,0.06)",
                textAlign: "center",
                fontWeight: "500",
              }}
            >
              ✓ {item}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "34px",
            textAlign: "center",
          }}
        >
          <a
            href={localizePublicHref("/livret", language)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "20px 38px",
              borderRadius: "999px",
              background: "#eef7f0",
              color: "#1f6f3d",
              fontWeight: "700",
              fontSize: "1.12rem",
              textDecoration: "none",
              boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            }}
          >
            {copy.booklet}
          </a>

          <p
            style={{
              marginTop: "12px",
              color: "#666",
              lineHeight: "1.7",
            }}
          >
            {copy.bookletDescription}
          </p>
        </div>
      </section>
  );
}
