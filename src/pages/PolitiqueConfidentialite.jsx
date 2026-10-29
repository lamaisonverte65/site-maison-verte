import { languageForPublicPage } from "../../shared/publicSiteLocale.js";
import TranslatedLegalPage from "./TranslatedLegalPage.jsx";
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


export default function PolitiqueConfidentialite() {
  const language = typeof window === "undefined" ? "fr" : languageForPublicPage(window.location.href);
  if (language === "en" || language === "es") return <TranslatedLegalPage type="privacy" language={language} />;
  return (
    <>
      <Helmet>
        <title>Politique de confidentialité | La Maison Verte - Arreau</title>
        <meta
          name="description"
          content="Politique de confidentialité et informations RGPD du site La Maison Verte à Arreau."
        />
        <link rel="canonical" href="https://lamaisonverte65.fr/politique-confidentialite" />
      </Helmet>

      <main style={pageStyle}>
        <article style={cardStyle}>
          <a href="/" style={{ ...linkStyle, textDecoration: "none" }}>
            ← Retour au site
          </a>

          <h1 style={titleStyle}>Politique de confidentialité</h1>

          <p>
            La présente politique explique comment les données personnelles sont collectées
            et utilisées dans le cadre du site officiel de <strong>La Maison Verte</strong>.
          </p>

          <h2 style={h2Style}>Responsable du traitement</h2>
          <p>
            Le responsable du traitement est Raphaël BENOIT, pour La Maison Verte.
            <br />
            Contact : 
            <a href="mailto:lamaisonverte65@gmail.com" style={linkStyle}>
              lamaisonverte65@gmail.com
            </a>.
          </p>

          <h2 style={h2Style}>Données collectées</h2>
          <p>
            Les données susceptibles d’être collectées sont :
          </p>
          <ul>
            <li>nom, prénom, adresse email et numéro de téléphone ;</li>
            <li>adresse postale (rue, code postal, ville et pays) du réservant ;</li>
            <li>coordonnées et informations facultatives des contacts supplémentaires indiqués par le réservant ;</li>
            <li>langue de communication choisie pour les échanges liés au séjour ;</li>
            <li>dates de séjour demandées, nombre de voyageurs, âge des enfants le cas échéant ;</li>
            <li>message libre envoyé avec une demande de réservation ;</li>
            <li>préférences liées au séjour, comme la demande d’un lit bébé ;</li>
            <li>consentement éventuel à recevoir des nouvelles ou offres ;</li>
            <li>avis voyageurs déposés sur le site ;</li>
            <li>données techniques de visite limitées nécessaires aux statistiques internes du site.</li>
          </ul>

          <h2 style={h2Style}>Finalités</h2>
          <p>
            Ces données sont utilisées pour :
          </p>
          <ul>
            <li>répondre aux demandes de réservation ;</li>
            <li>préparer, gérer et suivre les séjours ;</li>
            <li>envoyer les emails liés à la réservation ;</li>
            <li>gérer les paiements sécurisés et le suivi administratif ;</li>
            <li>publier les avis voyageurs, uniquement après consentement ;</li>
            <li>envoyer occasionnellement des nouvelles ou offres, uniquement en cas d’accord ;</li>
            <li>mesurer la fréquentation du site et améliorer son fonctionnement.</li>
          </ul>

          <h2 style={h2Style}>Bases légales</h2>
          <p>
            Les traitements reposent selon les cas sur l’exécution de mesures précontractuelles
            ou contractuelles, l’intérêt légitime de gestion du site et des réservations,
            le respect d’obligations légales, ou le consentement lorsque celui-ci est demandé.
          </p>

          <h2 style={h2Style}>Destinataires et prestataires</h2>
          <p>
            Les données sont destinées à La Maison Verte. Elles peuvent être traitées par des
            prestataires techniques nécessaires au fonctionnement du site et de la réservation,
            notamment l’hébergement du site, la base de données, l’envoi d’emails et le paiement
            sécurisé. Le site utilise notamment Netlify, Supabase, Resend et Stripe.
          </p>

          <h2 style={h2Style}>Durée de conservation</h2>
          <p>
            Les données relatives aux demandes et réservations sont conservées pendant la durée
            nécessaire à la gestion du séjour, puis archivées le temps nécessaire au suivi
            administratif, comptable ou juridique. Les données utilisées pour l’envoi de nouvelles
            ou offres sont conservées jusqu’au retrait du consentement. Les avis publiés peuvent
            rester visibles tant que le voyageur n’en demande pas le retrait.
          </p>

          <h2 style={h2Style}>Cookies et statistiques</h2>
          <p>
            Pour les statistiques internes, le site enregistre actuellement les pages vues,
            et non le nombre de visiteurs uniques. Un identifiant de visiteur et un identifiant
            de session sont conservés uniquement pendant la session de navigation. Chaque page vue
            peut comprendre le chemin de la page, le type d’appareil, la langue indiquée par le
            navigateur et la provenance de la consultation (domaine du site référent ou source
            de campagne « utm_source »). Les données saisies dans les formulaires ne sont pas
            collectées à cette fin. Le suivi actuel n’enregistre plus les clics, le défilement,
            les sections consultées, le temps passé sur les pages ni les débuts de formulaire.
            Les événements collectés avant cette simplification restent conservés dans
            l’historique technique. La Maison Verte ne met pas en place de suivi publicitaire.
          </p>

          <h2 style={h2Style}>Services externes</h2>
          <p>
            Certains liens peuvent ouvrir des services externes, comme Google Maps, Google Avis,
            Booking.com, Airbnb ou des sites touristiques. Ces services disposent de leurs propres
            politiques de confidentialité.
          </p>

          <h2 style={h2Style}>Vos droits</h2>
          <p>
            Vous pouvez demander l’accès à vos données, leur rectification, leur effacement,
            la limitation du traitement, ou vous opposer à certains traitements lorsque la loi
            le permet. Vous pouvez également retirer votre consentement à tout moment pour les
            communications facultatives.
          </p>

          <p>
            Pour exercer vos droits, contactez-nous à :
             
            <a href="mailto:lamaisonverte65@gmail.com" style={linkStyle}>
              lamaisonverte65@gmail.com
            </a>.
          </p>

          <p>
            Vous pouvez également introduire une réclamation auprès de la CNIL :
             
            <a href="https://www.cnil.fr/" target="_blank" rel="noopener noreferrer" style={linkStyle}>
              cnil.fr
            </a>.
          </p>

          <p style={{marginTop: "32px", fontSize: "0.9rem", color: "#64748b"}}>
            Dernière mise à jour : octobre 2026.
          </p>
        </article>
      </main>
    </>
  );
}
