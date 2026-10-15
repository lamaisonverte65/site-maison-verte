export function HomeWeather() {
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
            Voir le plan d’accès et de stationnement
          </a>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
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
            }}
          >
            <h2
              style={{
                marginBottom: "20px",
                paddingLeft: "10px",
              }}
            >
              Météo montagne
            </h2>

            <iframe
              title="Météo Arreau Meteoblue"
              src="https://www.meteoblue.com/fr/meteo/widget/daily/arreau_france_3036770?geoloc=fixed&days=4&tempunit=CELSIUS&windunit=KILOMETER_PER_HOUR&layout=light"
              frameBorder="0"
              scrolling="NO"
              style={{
                width: "125%",
                height: "620px",
                border: "0",
                borderRadius: "25px",
                overflow: "hidden",
                transform: "scale(0.8)",
                transformOrigin: "top left",
              }}
            />
          </div>

          {/* CARTE */}

          <div
            style={{
              background: "white",
              borderRadius: "35px",
              padding: "20px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
            }}
          >
            <h2
              style={{
                marginBottom: "20px",
                paddingLeft: "15px",
              }}
            >
              Emplacement idéal à Arreau
            </h2>

            <iframe
              title="Carte Arreau"
              src="https://www.google.com/maps?q=3+Impasse+Trassens+65240+Arreau&output=embed"
              style={{
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
