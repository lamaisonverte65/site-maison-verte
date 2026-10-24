import { languageForPublicPage } from "../../../shared/publicSiteLocale.js";
import { getHomeCopy } from "./homeTranslations.js";
export function HomeWeather() {
  const language = typeof window === "undefined" ? "fr" : languageForPublicPage(window.location.href);
  const copy = getHomeCopy(language).weather;
  return (
<section id="meteo" className="section">
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <a
            href="/livret/plan-acces.jpg"
            target="_blank"
            rel="noopener noreferrer"
            className="button"
            style={{ textDecoration: "none" }}
          >
            {copy.plan}
          </a>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(min(100%, 320px),1fr))",
            gap: "30px",
            alignItems: "stretch",
          }}
        >
          {/* METEO */}

          <div
            style={{
              background: "white",
              borderRadius: "35px",
              padding: "20px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <h2
              style={{
                marginBottom: "20px",
                paddingLeft: "10px",
              }}
            >
              {copy.weather}
            </h2>

            <div
              className="home-weather-embed"
              style={{ width: "100%", height: "496px", overflow: "hidden", borderRadius: "25px" }}
            >
              <iframe
              loading="lazy"
              title="Météo Arreau Meteoblue"
              src="https://www.meteoblue.com/fr/meteo/widget/daily/arreau_france_3036770?geoloc=fixed&days=4&tempunit=CELSIUS&windunit=KILOMETER_PER_HOUR&layout=light"
              frameBorder="0"
              scrolling="NO"
              style={{
                width: "125%",
                height: "620px",
                border: "0",
                borderRadius: "25px",
                display: "block",
                transform: "scale(0.8)",
                transformOrigin: "top left",
              }}
            />
            </div>
          </div>

          {/* CARTE */}

          <div
            style={{
              background: "white",
              borderRadius: "35px",
              padding: "20px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <h2
              style={{
                marginBottom: "20px",
                paddingLeft: "15px",
              }}
            >
              {copy.location}
            </h2>

            <iframe
              loading="lazy"
              title="Carte Arreau"
              src="https://www.google.com/maps?q=3+Impasse+Trassens+65240+Arreau&output=embed"
              style={{
                display: "block",
                width: "100%",
                height: "420px",
                border: "0",
                borderRadius: "25px",
              }}
            />
          </div>
        </div>
      </section>
  );
}
