import { Helmet } from "react-helmet";

const pageStyle = {
  minHeight: "100vh",
  background: "#f6f3ee",
  padding: "120px 24px 70px",
};

const cardStyle = {
  maxWidth: "920px",
  margin: "0 auto",
  background: "white",
  borderRadius: "30px",
  padding: "42px",
  boxShadow: "0 14px 40px rgba(0,0,0,0.08)",
  lineHeight: "1.8",
  color: "#334155",
};

const titleStyle = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "clamp(2.4rem, 5vw, 3.5rem)",
  color: "#2f4f35",
  marginBottom: "20px",
};

const h2Style = {
  color: "#2f4f35",
  marginTop: "28px",
  marginBottom: "10px",
};

const linkStyle = {
  color: "#1f6f3d",
  fontWeight: 700,
};


export default function MentionsLegales() {
  return (
    <>
      <Helmet>
        <title>Mentions légales | La Maison Verte - Arreau</title>
        <meta
          name="description"
          content="Mentions légales du site officiel La Maison Verte à Arreau."
        />
        <link rel="canonical" href="https://lamaisonverte65.fr/mentions-legales" />
      </Helmet>

      <main style={pageStyle}>
        <article style={cardStyle}>
          <a href="/" style={{ ...linkStyle, textDecoration: "none" }}>
            ← Retour au site
          </a>

          <h1 style={titleStyle}>Mentions légales</h1>

          <p>
            Le présent site est le site officiel de <strong>La Maison Verte</strong>,
            location saisonnière située à Arreau, dans les Hautes-Pyrénées.
          </p>

          <h2 style={h2Style}>Éditeur du site</h2>
          <p>
            <strong>Responsable de publication :</strong> Raphaël BENOIT
            <br />
            <strong>Nom commercial :</strong> La Maison Verte
            <br />
            <strong>Adresse du logement :</strong> 3 Impasse Trassens, 65240 Arreau, France
            <br />
            <strong>Email :</strong> 
            <a href="mailto:lamaisonverte65@gmail.com" style={linkStyle}>
              lamaisonverte65@gmail.com
            </a>
            <br />
            <strong>Téléphone :</strong> 
            <a href="tel:+33663076314" style={linkStyle}>
              +33 6 63 07 63 14
            </a>
          </p>

          <h2 style={h2Style}>Hébergement</h2>
          <p>
            Le site est hébergé par :
            <br />
            <strong>Netlify, Inc.</strong>
            <br />
            101 2nd Street, San Francisco, CA 94105, États-Unis
            <br />
            Site : 
            <a href="https://www.netlify.com/" target="_blank" rel="noopener noreferrer" style={linkStyle}>
              netlify.com
            </a>
          </p>

          <h2 style={h2Style}>Propriété intellectuelle</h2>
          <p>
            Les textes, photographies, illustrations, éléments graphiques, logos et contenus
            présents sur ce site sont protégés par le droit d’auteur. Toute reproduction,
            représentation, modification ou diffusion, totale ou partielle, sans autorisation
            préalable est interdite.
          </p>

          <h2 style={h2Style}>Responsabilité</h2>
          <p>
            Les informations présentées sur le site sont fournies à titre indicatif et peuvent
            être modifiées à tout moment. La Maison Verte s’efforce d’assurer l’exactitude des
            informations publiées, mais ne saurait être tenue responsable d’une erreur,
            omission ou indisponibilité temporaire du site.
          </p>

          <h2 style={h2Style}>Liens externes</h2>
          <p>
            Le site peut contenir des liens vers des sites tiers, notamment des services de
            cartographie, plateformes d’avis, offices de tourisme ou prestataires locaux.
            La Maison Verte n’exerce aucun contrôle sur ces sites et ne peut être tenue
            responsable de leur contenu ou de leur politique de confidentialité.
          </p>

          <h2 style={h2Style}>Documents contractuels</h2>
          <p>
            Le contrat de location et les conditions générales de réservation sont accessibles ici :
             
            <a
              href="/documents/contrat-location.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              contrat de location et conditions générales de réservation
            </a>.
          </p>

          <p style={{marginTop: "32px", fontSize: "0.9rem", color: "#64748b"}}>
            Dernière mise à jour : juin 2026.
          </p>
        </article>
      </main>
    </>
  );
}
