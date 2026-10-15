export function HomeContact() {
  return (
<section id="contact" className="section">
        <div
          className="contact-card"
          style={{
            background: "white",
            borderRadius: "40px",
            padding: "60px 40px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
            maxWidth: "1100px",
            margin: "auto",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: "20px",
            }}
          >
            Contact & Réservation
          </h2>

          <p
            style={{
              textAlign: "center",
              maxWidth: "720px",
              margin: "auto",
              marginBottom: "42px",
              lineHeight: "1.8",
              color: "#555",
            }}
          >
            Une question sur votre séjour, les disponibilités ou autre ?
            <br></br>Nous serons ravis de vous répondre.
          </p>

          {/* CONTACT DIRECT : TELEPHONE + WHATSAPP BUSINESS */}

          <div
            className="contact-direct-actions"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
              marginBottom: "34px",
            }}
          >
            <a
              href="tel:+33695938315"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                background: "#f6f3ee",
                color: "#1f6f3d",
                padding: "18px 28px",
                borderRadius: "999px",
                textDecoration: "none",
                fontWeight: "700",
                fontSize: "1.1rem",
                boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
              }}
            >
              📞 06 95 93 83 15
            </a>

            <a
              href="https://wa.me/33695938315?text=Bonjour%2C%20je%20souhaite%20des%20renseignements%20concernant%20La%20Maison%20Verte."
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Écrire à La Maison Verte sur WhatsApp"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                background: "#1f6f3d",
                color: "white",
                padding: "18px 28px",
                borderRadius: "999px",
                textDecoration: "none",
                fontWeight: "700",
                fontSize: "1.1rem",
                boxShadow: "0 10px 30px rgba(31,111,61,0.18)",
              }}
            >
              💬 Écrire sur WhatsApp
            </a>
          </div>

          {/* BANNIERE CONTACT */}
          <a   href="mailto:lamaisonverte65@gmail.com"  title="Cliquez pour nous envoyer un email">
          <img
            className="contact-banner"
            src="/banniere.webp"
            alt="Email et adresse de La Maison Verte à Arreau"
            style={{
              width: "100%",
              maxWidth: "1050px",
              display: "block",
              margin: "0 auto",
              borderRadius: "28px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
            }}
          />
          </a>

          {/* GOOGLE MAPS */}

          <div
            className="contact-map-action"
            style={{
              textAlign: "center",
              marginTop: "34px",
            }}
          >
            <a
              href="https://www.google.com/maps?q=3+Impasse+Trassens+65240+Arreau"
              target="_blank"
              rel="noopener noreferrer"
              className="button contact-map-button"
              style={{
                textDecoration: "none",
              }}
            >
              Ouvrir dans Google Maps
            </a>
          </div>
        </div>
      </section>
  );
}
