import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { supabase } from "../supabaseClient";


export default function MaisonVerte() {

  const [selectedDates, setSelectedDates] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [pricingRules, setPricingRules] = useState({ defaultNightPrice: 80, seasonPrices: [], priceOverrides: [] });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scrolled, setScrolled] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestMessage, setGuestMessage] = useState(""); 
  const [contractAccepted, setContractAccepted] = useState(false);
  const galleryPhotos = [

  {
    src: "/cuisine-equipee-maison-verte.jpg",
    caption: "Cuisine équipée"
  },

  {
    src: "/chambre-parentale-grand-lit.jpg",
    caption: "Chambre parentale - grand lit et rangements"
  },

  {
    src: "/chambre-parentale-balcon.jpg",
    caption: "Chambre parentale - bureau et sortie balcon"
  },

  {
    src: "/chambre-sous-combles-lits-jumeaux.jpg",
    caption: "Chambre sous combles - les lits jumeaux"
  },

  {
    src: "/chambre-sous-combles-vue-montagne.jpg",
    caption: "Chambre sous combles - la vue sur le clocher et les montagnes"
  },

  {
    src: "/salle-de-bain-maison-verte.jpg",
    caption: "Salle de bain"
  },

  {
    src: "/douche-maison-verte.jpg",
    caption: "Douche"
  },

  {
    src: "/wc-et-palier.jpg",
    caption: "WC et palier"
  },

  {
    src: "/balcon-plein-sud-ouest.jpg",
    caption: "Balcon plein sud - côté Ouest"
  },

  {
    src: "/balcon-plein-sud-est.jpg",
    caption: "Balcon plein sud - côté Est"
  },

  {
    src: "/smart-tv-salon.jpg",
    caption: "Smart TV"
  },

  {
    src: "/passage-sous-le-porche-arreau.jpg",
    caption: "Passage sous le porche"
  },

  {
    src: "/rue-de-la-coutellerie-arreau.jpg",
    caption: "Rue de la coutellerie"
  },

  {
    src: "/impasse-trassens-arreau.jpg",
    caption: "Impasse Trassens"
  },

  {
    src: "/halle-et-mairie-arreau.jpg",
    caption: "La halle et la mairie"
  },

  {
    src: "/vue-calvaire-arreau-nuit.jpg",
    caption: "Vue du calvaire d'Arreau de nuit"
  }

 ];

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

  useEffect(() => {

    function handleScroll() {
      setScrolled(window.scrollY > 80);
    }

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };

  }, []);


  useEffect(() => {

    async function fetchCalendar() {

      try {

        const response =
          await fetch("/.netlify/functions/calendar");

        const data =
          await response.json();

        setUnavailableDates(
          data.unavailableDates || []
        );

        setPricingRules({
          defaultNightPrice: data.defaultNightPrice || 80,
          seasonPrices: data.seasonPrices || [],
          priceOverrides: data.priceOverrides || [],
        });

      } catch (error) {

        console.error(
          "Erreur calendrier :",
          error
        );

      }

    }

    fetchCalendar();

  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const daysInMonth = lastDay.getDate();

  const startingDay =
    (firstDay.getDay() + 6) % 7;

  const days = [];

  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {

    days.push(
      new Date(year, month, day)
    );

  }

function isDateSelected(key) {

  if (selectedDates.length === 1) {
    return selectedDates[0] === key;
  }

  if (selectedDates.length === 2) {
    return key >= selectedDates[0] && key <= selectedDates[1];
  }

  return false;

}

function toggleDay(day) {
  if (!day) return;

  const key = formatLocalDate(day);

  if (unavailableDates.includes(key)) {
    return;
  }

  // Nouveau départ si aucune date, ou si une période est déjà complète
  if (selectedDates.length === 0 || selectedDates.length === 2) {
    setSelectedDates([key]);
    return;
  }

  const start = selectedDates[0];
  const end = key < start ? start : key;
  const realStart = key < start ? key : start;

  // Empêche de sélectionner une période qui traverse une date réservée
  const startDate = parseLocalDate(realStart);
  const endDate = parseLocalDate(end);

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    const dKey = formatLocalDate(d);

    if (unavailableDates.includes(dKey)) {
      alert("Cette période contient une date déjà réservée.");
      setSelectedDates([]);
    setContractAccepted(false);
      return;
    }
  }

  setSelectedDates([realStart, end]);
}

  const defaultPrice = pricingRules.defaultNightPrice || 80;

const pricePeriods = (pricingRules.seasonPrices || []).map((period) => ({
  name: period.label,
  start: period.start_date,
  end: period.end_date,
  price: Number(period.night_price || defaultPrice),
  minimumNights: period.minimum_nights,
  allowedArrivalDays: period.allowed_arrival_days,
}));

const priceOverrides = (pricingRules.priceOverrides || []).map((override) => ({
  name: override.label,
  start: override.start_date,
  end: override.end_date,
  price: Number(override.night_price || defaultPrice),
}));

const stayRules = pricePeriods
  .filter((period) => period.minimumNights || period.allowedArrivalDays)
  .map((period) => ({
    name: period.name,
    start: period.start,
    end: period.end,
    minimumNights: Number(period.minimumNights || 2),
    allowedArrivalDays: Array.isArray(period.allowedArrivalDays) ? period.allowedArrivalDays : [0, 6],
  }));

function getPriceForDate(key) {
  const override = priceOverrides.find(
    override => key >= override.start && key < override.end
  );

  if (override) return override.price;

  const period = pricePeriods.find(
    period => key >= period.start && key < period.end
  );

  return period ? period.price : defaultPrice;
}

function getSelectedNights() {
  if (selectedDates.length !== 2) {
    return [];
  }

  const nights = [];
  const startDate = parseLocalDate(selectedDates[0]);
  const endDate = parseLocalDate(selectedDates[1]);

  for (
    let d = new Date(startDate);
    d < endDate;
    d.setDate(d.getDate() + 1)
  ) {
    nights.push(formatLocalDate(d));
  }

  return nights;
}

function getRuleForStay(nights) {
  return stayRules.find(rule =>
    nights.some(night => night >= rule.start && night < rule.end)
  );
}

const numberOfNights =
  selectedDates.length === 2
    ? Math.round(
        (parseLocalDate(selectedDates[1]) - parseLocalDate(selectedDates[0]))
        / (1000 * 60 * 60 * 24)
      )
    : 0;

const selectedNights = getSelectedNights();

const accommodationTotal =
  selectedNights.reduce(
    (sum, nightKey) => sum + getPriceForDate(nightKey),
    0
  );

const activeStayRule = getRuleForStay(selectedNights);

const arrivalDay =
  selectedDates.length >= 1
    ? parseLocalDate(selectedDates[0]).getDay()
    : null;

const minimumNights =
  activeStayRule ? activeStayRule.minimumNights : 2;

const isLongStay =
  numberOfNights >= 6;

const isArrivalDayAllowed =
  !activeStayRule ||
  isLongStay ||
  activeStayRule.allowedArrivalDays.includes(arrivalDay);

const reservationMessage =
  selectedDates.length !== 2
    ? "Sélectionnez vos dates d’arrivée et de départ."
    : numberOfNights < minimumNights
    ? `Séjour minimum : ${minimumNights} nuits sur cette période.`
    : !isArrivalDayAllowed
    ? "Pendant les vacances, les arrivées sont possibles le samedi ou le dimanche pour les courts séjours. Pour 6 nuits ou plus, les arrivées sont possibles tous les jours."
    : activeStayRule
    ? "Votre demande concerne une période de forte demande. Elle sera étudiée avant confirmation."
    : "Renseignez vos coordonnées.";

const canRequestBooking =
  selectedDates.length === 2 &&
  numberOfNights >= minimumNights &&
  isArrivalDayAllowed;

const isEmailValid =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail);

const isPhoneValid =
  /^[0-9+\s().-]{8,}$/.test(guestPhone);

const isFormValid =
  guestFirstName.trim() !== "" &&
  guestLastName.trim() !== "" &&
  isEmailValid &&
  isPhoneValid;

const canSubmitRequest =
  canRequestBooking &&
  isFormValid &&
  contractAccepted;
    
const total = accommodationTotal;

 

  function previousMonth() {

    setCurrentMonth(
      new Date(year, month - 1, 1)
    );

  }

  function nextMonth() {

    setCurrentMonth(
      new Date(year, month + 1, 1)
    );

  }

async function submitBookingRequest() {

  if (!canSubmitRequest) {
    return;
  }

  try {

    const { error } = await supabase
      .from("booking_requests")
      .insert([
        {
          guest_first_name: guestFirstName,
          guest_last_name: guestLastName,

          guest_email: guestEmail,
          guest_phone: guestPhone,

          start_date: selectedDates[0],
          end_date: selectedDates[1],

          nights: numberOfNights,
          estimated_total: total,
          message: guestMessage,
          contract_accepted: contractAccepted,
          contract_accepted_at: new Date().toISOString(),
          contract_version: "v1",
          contract_url: "https://lamaisonverte65.fr/documents/contrat-location.pdf"
        }
      ]);

    if (error) {

      console.error(error);

      alert("Erreur lors de l'envoi de la demande.");

      return;

    }

    await fetch("/.netlify/functions/send-booking-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({

        guestFirstName,
        guestLastName,

        guestEmail,
        guestPhone,
        guestMessage,

        startDate: selectedDates[0],
        endDate: selectedDates[1],

        nights: numberOfNights,
        total

      })
    });

    alert("Votre demande de réservation a bien été envoyée. Un email de confirmation vient de vous être adressé. Pensez à vérifier vos courriers indésirables / spams si vous ne le recevez pas rapidement. Le calendrier va maintenant se mettre à jour.");

    setGuestFirstName("");
    setGuestLastName("");

    setGuestEmail("");
    setGuestPhone("");
    setGuestMessage("");

    setSelectedDates([]);
    setContractAccepted(false);

    window.location.reload();

  } catch (err) {

    console.error(err);

    alert("Une erreur est survenue.");

  }

}
return (

    <>

      <Helmet>

        <title>
          La Maison Verte - Arreau
        </title>

        <meta property="og:title" content="La Maison Verte - Arreau" />

            <meta
              property="og:description"
              content="Ravissante maison rénovée en location pour 4 personnes à Arreau. Un gîte proche de Saint-Lary, de Loudenvielle, du Néouvielle et de l'Espagne, dans un cadre naturel et reposant."
            />  

            <meta
              property="og:image"
              content="https://tonsite.fr/hero.jpg"
            />

            <meta
              property="og:type"
              content="website"
            />


       {/* FAVICONS */}     

       <link
        rel="icon"
        type="image/x-icon"
        href="/favicon/favicon.ico"
        />

        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon/favicon-32x32.png"
        />

        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon/favicon-16x16.png"
        />

        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/favicon/apple-touch-icon.png"
        />

        <link
          rel="manifest"
          href="/favicon/manifest.json"
        />


        {/* JSON-LD */}

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VacationRental",
            "name": "La Maison Verte - Arreau",
            "description": "Ravissante maison rénovée à Arreau, proche de Saint-Lary, Loudenvielle et de la réserve du Néouvielle. Une location chaleureuse pour 4 personnes au cœur des Pyrénées.",
            "url": "https://www.lamaisonverte-arreau.fr/",
            "image": [
              "https://www.lamaisonverte-arreau.fr/hero.jpg",
              "https://www.lamaisonverte-arreau.fr/cuisine-equipee-maison-verte.jpg",
              "https://www.lamaisonverte-arreau.fr/chambre-parentale-grand-lit.jpg"
            ],
            "telephone": "+33663076314",
            "email": "lamaisonverte65@gmail.com",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "3 Impasse Trassens",
              "addressLocality": "Arreau",
              "postalCode": "65240",
              "addressCountry": "FR"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": 42.903534,
              "longitude": 0.361304
            },
            "maximumAttendeeCapacity": 4,
            "numberOfRooms": 2,
            "containsPlace": {
              "@type": "Accommodation",
              "name": "La Maison Verte",
              "occupancy": {
                "@type": "QuantitativeValue",
                "maxValue": 4
              },
              "numberOfBedrooms": 2
            },
            "amenityFeature": [
              {
                "@type": "LocationFeatureSpecification",
                "name": "Cuisine équipée",
                "value": true
              },
              {
                "@type": "LocationFeatureSpecification",
                "name": "Balcon plein sud",
                "value": true
              },
              {
                "@type": "LocationFeatureSpecification",
                "name": "Lave-vaisselle",
                "value": true
              },
              {
                "@type": "LocationFeatureSpecification",
                "name": "Machine à laver",
                "value": true
              },
              {
                "@type": "LocationFeatureSpecification",
                "name": "Smart TV",
                "value": true
              },
              {
                "@type": "LocationFeatureSpecification",
                "name": "Parking gratuit proche",
                "value": true
              }
            ],
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "9.5",
              "bestRating": "10",
              "ratingCount": "42"
            },
            "priceRange": "À partir de 80€ par nuit"
          })}
        </script>


</Helmet>



<style>{`
  .mobile-reserve-button {
    display: none;
  }

  @media (max-width: 640px) and (orientation: portrait) {
    nav {
      padding: 12px 18px !important;
      gap: 12px;
    }

    nav .nav-links,
    nav .nav-contact {
      display: none !important;
    }

    .mobile-reserve-button {
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      margin-left: auto;
      padding: 10px 16px !important;
      font-size: 0.95rem !important;
      white-space: nowrap;
      box-shadow: 0 8px 22px rgba(0,0,0,0.16);
    }

    nav img {
      height: 52px !important;
    }
  }
`}</style>

{/* MENU */}

<nav
  style={{
    position: "fixed",
    top: 0,
    width: "100%",
    padding: "18px 40px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1000,

    background: scrolled
    ? "#f6f3ee"
    : "rgba(246,243,238,0)",

    backdropFilter: "none",
    boxShadow: "none",
    transition: "0.35s"
   }}
    >

  {/* LOGO */}
  <div style={{ display: "flex", justifyContent: "flex-start" }}>
    <a href="#accueil" style={{ display: "flex", alignItems: "center" }}>
      <img
        src="/logo.png"
        alt="La Maison Verte"
        style={{ height: scrolled ? "58px" : "64px", objectFit: "contain" }}
      />
    </a>
  </div>

  {/* MENU CENTRE */}
  <div
    className="nav-links"
    style={{
      display: "flex",
      justifyContent: "center",
      gap: "34px",
      alignItems: "center",
      flexWrap: "wrap",
      flex: 1
    }}
  > 
    <a href="#presentation" style={{ textDecoration: "none", color: scrolled ? "#1e2b1f" : "white", fontWeight: "500", transition: "0.35s" }}>Présentation</a>
    <a href="#galerie" style={{ textDecoration: "none", color: scrolled ? "#1e2b1f" : "white", fontWeight: "500", transition: "0.35s" }}>Galerie</a>
    <a href="#avis" style={{ textDecoration: "none", color: scrolled ? "#1e2b1f" : "white", fontWeight: "500", transition: "0.35s" }}>Avis</a>    
    <a href="#reservation" style={{ textDecoration: "none", color: scrolled ? "#1e2b1f" : "white", fontWeight: "500", transition: "0.35s" }}>Réservation</a>
    <a href="#activites" style={{ textDecoration: "none", color: scrolled ? "#1e2b1f" : "white", fontWeight: "500", transition: "0.35s" }}>Activités</a>
    <a href="#meteo" style={{ textDecoration: "none", color: scrolled ? "#1e2b1f" : "white", fontWeight: "500", transition: "0.35s" }}>Situation</a>

  </div>

  {/* BOUTON RESERVER MOBILE PORTRAIT */}
  <a
    href="#reservation"
    className="button mobile-reserve-button"
    style={{ textDecoration: "none" }}
  >
    Réserver
  </a>

  {/* CONTACT DROITE */}
  <div className="nav-contact" style={{ display: "flex", justifyContent: "flex-end" }}>
    <a href="#contact" className="button" style={{ textDecoration: "none" }}>Contact</a>
  </div>

</nav>

      {/* HERO PREMIUM */}

<section id="accueil" className="hero">

  <div className="overlay">

    <div
      style={{
        animation: "fadeUp 1.2s ease",
        maxWidth: "920px",
        padding: "0 24px"
      }}
    >

      

      <h1
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "clamp(3.4rem, 9vw, 7rem)",
          marginBottom: "24px",
          fontWeight: "600",
          letterSpacing: "-2px",
          lineHeight: "0.95",
          textShadow:
            "0 8px 35px rgba(0,0,0,0.45)"
        }}
      >
        La Maison Verte
      </h1>
          <div
        style={{
          fontFamily: "'Lora', serif",
          fontSize: "clamp(0.95rem, 2vw, 1.25rem)",
          letterSpacing: "5px",
          textTransform: "uppercase",
          marginBottom: "18px",
          opacity: 0.95
        }}
      >
        -Arreau-<br />
        Pyrénées
      </div>
      <p
        style={{
          fontFamily: "'Lora', serif",
          fontSize: "clamp(1.05rem, 2.4vw, 1.45rem)",
          maxWidth: "760px",
          lineHeight: "1.8",
          margin: "auto",
          marginBottom: "42px",
          textShadow:
            "0 5px 22px rgba(0,0,0,0.45)"
        }}
      >
        Location de charme au cœur historique d’Arreau, entre montagnes,
        ski, randonnées et détente. Entièrement rénovée, alliant
        authenticité, calme et confort moderne.
      </p>

      <div
        style={{
          display: "flex",
          gap: "20px",
          justifyContent: "center",
          flexWrap: "wrap"
        }}
      >

        <a
          href="#reservation"
          className="button"
          style={{
            fontSize: "17px",
            padding: "17px 34px",
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.25)",
            textDecoration: "none"
          }}
        >
          Réserver maintenant
        </a>

        <a
          href="#galerie"
          style={{
            border: "1px solid white",
            color: "white",
            padding: "17px 34px",
            borderRadius: "999px",
            textDecoration: "none",
            backdropFilter: "blur(10px)",
            background: "rgba(255,255,255,0.1)",
            fontSize: "17px"
          }}
        >
          Voir les photos
        </a>

      </div>

    </div>

  </div>

</section>

{/* PRESENTATION + EQUIPEMENTS */}

<section
  id="presentation"
  className="section"
  >

  <h2
    style={{
      marginBottom: "34px"
    }}
    >
    La maison
  </h2>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1.2fr 0.8fr",
      gap: "40px",
      alignItems: "start"
    }}
    >

    <div
      style={{
        background: "white",
        padding: "40px",
        borderRadius: "35px",
        boxShadow: "0 15px 45px rgba(0,0,0,0.08)"
      }}
      >

      <h3>
        Un petit cocon niché au cœur d'un village traditionnel
      </h3>

      <p
        style={{
          lineHeight: "1.9",
          color: "#555",
          marginTop: "20px"
        }}
        >
        Hébergement entièrement rénové pour 4 personnes, niché dans le centre historique
        d’Arreau. Situé à la Confluence des vallées d’Aure (Saint-Lary) et du Louron (Loudenvielle), au pied de 4 stations
        de ski, de nombreux cols mythiques et de multiples possibilités de randonnées.
      </p>
<br></br>
      <p
        style={{
          lineHeight: "1.9",
          color: "#555"
        }}
        >
        Sur 3 niveaux, elle offre un séjour avec cuisine entièrement équipée, une chambre
        parentale avec balcon ensoleillé, une salle de bain, des WC séparés et
        une chambre sous combles avec deux lits jumeaux.
      </p>

      <p
        style={{
          lineHeight: "1.9",
          color: "#555"
        }}
        >
        Toutes les commodités sont accessibles à pied en moins de 3 minutes :
        boulangerie, boucherie, pharmacie, librairie, bars, restaurants et
        commerces du village.
      </p>

    </div>

    <div
      style={{
        background: "#1f6f3d",
        color: "white",
        padding: "35px",
        borderRadius: "35px",
        boxShadow: "0 15px 45px rgba(0,0,0,0.12)"
      }}
      >

      <h3
        style={{
          color: "white",
          marginBottom: "25px"
        }}
        >
        En bref
      </h3>

      <div
        style={{
          display: "grid",
          gap: "18px"
        }}
        >

        <div>🏡 Maison rénovée sur 3 niveaux</div>
        <div>👨‍👩‍👧‍👦 Idéale pour 4 personnes</div>
        <div>🛏️ 2 chambres : 1 grand lit, 2 lits jumeaux</div>
        <div>☀️ Balcon exposé sud</div>
        <div>🚶 Commerces à pied</div>
        <div>⛷️ Situation centrale stratégique </div>

      </div>

    </div>

  </div>

  <div
    style={{
      marginTop: "45px",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
      gap: "18px"
    }}
    >

    {[
      "Cuisine équipée",
      "Machine à laver",
      "Lave-vaisselle",
      "Smart TV",
      "Cafetière italienne",
      "Cafetière à filtres",
      "Bouilloire",
      "Grille-pain",
      "Appareil à raclette",
      "Fer à repasser",
      "Lit parapluie",
      "58 m²",
      "Balcon avec table et chaises",
      "Linge de lit fourni",
      "Parking gratuit proche",
      "Impasse piétonne",
      ].map(item => (

      <div
        key={item}
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "22px",
          boxShadow: "0 8px 25px rgba(0,0,0,0.06)",
          textAlign: "center",
          fontWeight: "500"
        }}
        >
        ✓ {item}
      </div>

    ))}

  </div>

</section>
     
{/* GALERIE */}

<section
  id="galerie"
  className="section"
  >

  <h2>
    Galerie immersive
  </h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "16px"
    }}
    >

    {galleryPhotos.map((photo, index) => (

      <div
        key={photo.src}
        className="gallery-item"
        onClick={() => {
          setCurrentImageIndex(index);
          setLightboxOpen(true);
        }}
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "22px",
          cursor: "pointer",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)"
        }}
      >

        <img
          src={photo.src}
          alt={photo.caption}
          style={{
            width: "100%",
            height: "210px",
            objectFit: "cover",
            display: "block",
            transition: "0.35s"
          }}
        />

        <div
        className="gallery-caption"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          padding: "35px 16px 14px",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
          color: "white",
          fontSize: "0.95rem",
          fontWeight: "500",
          opacity: 0,
          transition: "0.35s",
          pointerEvents: "none"
        }}
        >
        {photo.caption}
      </div>

      </div>

    ))}

  </div>

</section>


{/* AVIS */}


<section id="avis" className="section">

        <h2>
          Avis voyageurs
        </h2>

  {/* NOTES PLATEFORMES */}

  <div id="notes">

    <h3 style={{
      marginBottom: "34px"}}>
      Un établissement très apprécié des voyageurs
    </h3>
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(260px,1fr))",
        gap: "24px"
      }}
      >

      <a
        href="https://www.booking.com/hotel/fr/la-maison-verte-arreau.fr.html#tab-reviews"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          textDecoration: "none",
          color: "inherit"
        }}
      >
        <div
          style={{
            background: "white",
            padding: "32px",
            borderRadius: "30px",
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.08)",
            transition: "0.3s",
            cursor: "pointer"
          }}
        >

          <h3>
            Booking.com
          </h3>

          <div
            style={{
              fontSize: "3rem",
              fontWeight: "700",
              color: "#1f6f3d"
            }}
          >
            9,5/10
          </div>

          <p>
            Basé sur 42 expériences vécues
          </p>

          <div
            style={{
              marginTop: "16px",
              color: "#1f6f3d",
              fontWeight: "600"
            }}
          >
            Voir les avis →
          </div>

        </div>
      </a>

      <a
        href="https://www.airbnb.fr/rooms/1085595615567954443"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          textDecoration: "none",
          color: "inherit"
        }}
      >
        <div
          style={{
            background: "white",
            padding: "32px",
            borderRadius: "30px",
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.08)",
            transition: "0.3s",
            cursor: "pointer"
          }}
        >

          <h3>
            Airbnb
          </h3>

          <div
            style={{
              fontSize: "3rem",
              fontWeight: "700",
              color: "#1f6f3d"
            }}
          >
            4,89/5
          </div>

          <p>
            Basé sur 9 évaluations voyageurs
          </p>

          <div
            style={{
              marginTop: "16px",
              color: "#1f6f3d",
              fontWeight: "600"
            }}
          >
            Voir les avis →
          </div>

        </div>
      </a>

    </div>

  </div>
  
  
</section>


{/* RESERVATION */}
      
<section id="reservation" className="section">

  <h2>
    Réserver votre séjour
  </h2>

  <p
    style={{
      textAlign: "center",
      color: "#666",
      marginBottom: "45px"
    }}
  >
    Sélectionnez vos dates d’arrivée et de départ.
  </p>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 360px",
      gap: "24px",
      alignItems: "start"
    }}
  >

    {/* CALENDRIER */}

    <div className="calendar-wrapper">

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "35px"
        }}
      >

        <button
          className="button"
          onClick={previousMonth}
        >
          ←
        </button>

        <h3
          style={{
            color: "#1f6f3d",
            textTransform: "capitalize",
            fontSize: "1.6rem"
          }}
        >
          {
            currentMonth.toLocaleDateString(
              "fr-FR",
              {
                month: "long",
                year: "numeric"
              }
            )
          }
        </h3>

        <button
          className="button"
          onClick={nextMonth}
        >
          →
        </button>

      </div>

      {/* JOURS */}

      <div
        className="calendar"
        style={{
          marginBottom: "12px"
        }}
      >

        {
          [
            "Lun",
            "Mar",
            "Mer",
            "Jeu",
            "Ven",
            "Sam",
            "Dim"
          ].map(day => (

            <div
              key={day}
              style={{
                textAlign: "center",
                fontWeight: "700",
                color: "#1f6f3d"
              }}
            >
              {day}
            </div>

          ))
        }

      </div>

      {/* DATES */}

      <div className="calendar">

        {
          days.map((day, index) => {

            if (!day) {

              return (
                <div key={index}></div>
              );

            }

            const key =
              formatLocalDate(day);

            const todayKey =
              formatLocalDate(new Date());

            const isPastDate =
              key < todayKey;

            return (

              <div
                key={key}

                className={`day ${
                  isPastDate || unavailableDates.includes(key)
                    ? "unavailable"
                    : isDateSelected(key)
                    ? "selected"
                    : ""
                }`}

                onClick={() => {
                  if (isPastDate) return;
                  toggleDay(day);
                }}

                style={{
                  borderRadius: "22px",
                  minHeight: "85px",
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  pointerEvents: "auto"
                }}
              >

                <div
                  style={{
                    pointerEvents: "none"
                  }}
                >

                  <div>
                    {day.getDate()}
                  </div>

                  {
                    !unavailableDates.includes(key)
                    && (

                      <div
                        style={{
                          marginTop: "6px",
                          fontSize: "0.8rem",
                          opacity: 0.7
                        }}
                      >
                        {getPriceForDate(key)}€
                      </div>

                    )
                  }

                </div>

              </div>

            );

          })
        }

      </div>

    </div>

    {/* CARTE RESERVATION */}

    <div
      style={{
        maxWidth: "520px",
        width: "100%",
        margin: "0 auto"
      }}
    >

      <div
        style={{
          background: "white",
          padding: "35px",
          borderRadius: "35px",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.12)",
          border:
            "1px solid rgba(0,0,0,0.05)"
        }}
      >

        <div
          style={{
            marginBottom: "25px"
          }}
        >

          <div
            style={{
              fontSize: "2rem",
              fontWeight: "700"
            }}
          >
            À partir de {defaultPrice}€
            <span
              style={{
                fontSize: "1rem",
                color: "#666"
              }}
            >
              / nuit
            </span>
          </div>

        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "12px",
            marginBottom: "18px"
          }}
        >

          <p
            style={{
              color: "#666",
              marginBottom: "12px",
              fontSize: "0.95rem"
            }}
          >
            Choisissez vos dates directement dans le calendrier.
          </p>

          

          <input
            type="text"
            placeholder="Date d’arrivée sélectionnée"
            value={selectedDates[0] || ""}
            readOnly
            style={{
              padding: "16px",
              borderRadius: "16px",
              border:
                "1px solid #ddd"
            }}
          />

          <input
            type="text"
            placeholder="Date de départ sélectionnée"
            value={selectedDates[1] || ""}
            readOnly
            style={{
              padding: "16px",
              borderRadius: "16px",
              border:
                "1px solid #ddd"
            }}
          />

          

        </div>

        <p
          style={{
            color: canRequestBooking ? "#1f6f3d" : "#9a5a2e",
            background: canRequestBooking ? "#eef7f0" : "#fff3e8",
            padding: "14px",
            borderRadius: "16px",
            fontSize: "0.95rem",
            lineHeight: "1.5",
            marginBottom: "18px"
          }}
        >
          {reservationMessage}
        </p>

        <input
          type="text"
          placeholder="Votre prénom"
          value={guestFirstName}
          onChange={(e) =>
            setGuestFirstName(e.target.value)
          }
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "16px",
            border: "1px solid #ddd",
            marginBottom: "14px"
          }}
        />

        <input
          type="text"
          placeholder="Votre nom"
          value={guestLastName}
          onChange={(e) =>
            setGuestLastName(e.target.value)
          }
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "16px",
            border: "1px solid #ddd",
            marginBottom: "14px"
          }}
        />

        
        <div>

          <input
            type="email"
            placeholder="Votre email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "16px",
              border:
                isEmailValid || guestEmail === ""
                  ? "1px solid #ddd"
                  : "1px solid #d33",
              marginBottom: "8px"
            }}
          />

          {
            guestEmail !== "" &&
            !isEmailValid && (

              <div
                style={{
                  color: "#d33",
                  fontSize: "0.85rem",
                  marginBottom: "14px"
                }}
              >
                Adresse email invalide.
              </div>

            )
          }

        </div>

        <div>

          <input
            type="tel"
            placeholder="Votre téléphone"
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "16px",
              border:
                isPhoneValid || guestPhone === ""
                  ? "1px solid #ddd"
                  : "1px solid #d33",
              marginBottom: "8px"
            }}
          />
          <textarea
            value={guestMessage}
            onChange={(event) => setGuestMessage(event.target.value)}
            placeholder="Message optionnel : arrivée tardive, question particulière, ancien client..."
            style={{
              width: "100%",
              minHeight: "110px",
              marginTop: "14px",
              padding: "14px",
              borderRadius: "14px",
              border: "1px solid #d1d5db",
              fontSize: "15px",
              resize: "vertical"
            }}
          />
          {
            guestPhone !== "" &&
            !isPhoneValid && (

              <div
                style={{
                  color: "#d33",
                  fontSize: "0.85rem",
                  marginBottom: "14px"
                }}
              >
                Numéro de téléphone invalide.
              </div>

            )
          }

        </div>


        <div
          style={{
            marginTop: "18px",
            marginBottom: "22px",
            padding: "16px",
            borderRadius: "16px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0"
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              cursor: "pointer",
              lineHeight: "1.6",
              color: "#334155"
            }}
          >
            <input
              type="checkbox"
              checked={contractAccepted}
              onChange={(e) =>
                setContractAccepted(e.target.checked)
              }
              style={{
                marginTop: "4px",
                transform: "scale(1.2)"
              }}
            />

            <span>
              J’ai lu et j’accepte le{" "}
              <a
                href="/documents/contrat-location.pdf"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#1f6f3d",
                  fontWeight: "700"
                }}
              >
                contrat de location
              </a>{" "}
              ainsi que les conditions de réservation.
            </span>
          </label>
        </div>

        <button
          className="button"
          disabled={!canSubmitRequest}
          onClick={submitBookingRequest}
          style={{
            width: "100%",
            padding: "18px",
            fontSize: "1rem",
            fontWeight: "700",
            opacity: canSubmitRequest ? 1 : 0.55,
            cursor: canSubmitRequest ? "pointer" : "not-allowed"
          }}
        >
          Faire une demande de réservation
        </button>

        <div
          style={{
            marginTop: "30px"
          }}
        >

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              marginBottom: "12px"
            }}
          >
            <span>
              Séjour x {numberOfNights} nuits
            </span>

            <span>
              {accommodationTotal}€
            </span>
          </div>

          <hr
            style={{
              margin: "18px 0"
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              fontWeight: "700",
              fontSize: "1.2rem"
            }}
          >
            <span>Total estimatif</span>

            <span>
              {total}€
            </span>
          </div>

        </div>

      </div>

    </div>

  </div>

</section>

{/* ACTIVITES */}


<section
  id="activites"
  className="section"
>

  <h2>
    Activités & expériences
  </h2>

  <p
    style={{
      textAlign: "center",
      maxWidth: "780px",
      margin: "0 auto 55px",
      lineHeight: "1.8",
      color: "#555"
    }}
  >
    Profitez de la centralité unique d'Arreau pour vous offir une multitude d'activités possibles. Au coeur d'un cadre naturel exceptionnel, organisez votre séjour sportif, culturel, récréatif ou bien-être selon vos envies.
  </p>

  {/* OFFRE SKI */}

  <div
    style={{
      background: "#1f6f3d",
      color: "white",
      borderRadius: "36px",
      padding: "42px",
      marginBottom: "42px",
      display: "grid",
      gridTemplateColumns: "1fr 320px",
      gap: "30px",
      alignItems: "center",
      boxShadow: "0 20px 60px rgba(0,0,0,0.14)"
    }}
  >

    <div>
      <h3
        style={{
          color: "white",
          marginBottom: "16px"
        }}
      >
        Offre hiver : logement + cours de ski
      </h3>

      <p
        style={{
          lineHeight: "1.8",
          opacity: 0.95,
          marginBottom: "20px"
        }}
      >
        En hiver, combinez votre séjour à La Maison Verte avec des cours
        de ski et de snowboard personnalisés sur la station de Peyragudes avec un moniteur de ski diplômé.
      </p>

      <strong>
        Tarif préférentiel : jusqu’à 15% de réduction sur le logement
        pour une formule séjour + cours de ski. Nous contacter pour plus d'information.
      </strong>
    </div>

    <img
      src="/activite-ski.jpg"
      alt="Cours de ski dans les Pyrénées"
      style={{
        width: "100%",
        height: "220px",
        objectFit: "cover",
        borderRadius: "28px"
      }}
    />

  </div>

  {/* CARTES ACTIVITES */}

  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(260px,1fr))",
      gap: "28px"
    }}
  >

    {[
      {
        title: "Nature & randonnées",
        image: "/activite-randonnee.jpg",
        alt: "Randonnée dans les Pyrénées et réserve du Néouvielle",
        text:
          "Lacs d’altitude, panoramas exceptionnels au coeur du massif, depuis un «3000» ou un sommet surplombant le piémont, Parcs Nationaux des Pyrénées et d'Ordessa, réserve du Néouvielle, circuits avec nuités en refuge : une destination idéale pour découvrir les Pyrénées, respirer l'air pur des montagnes, se ressourcer.",
        links: [
          {
            label: "Réserve du Néouvielle",
            url: "https://www.visit-neouvielle.com/"
          },
          {
            label: "Parc National Pyrénées",
            url: "https://www.pyrenees-parcnational.fr/"
          },
          {
            label: "Pyrénées 2 Vallées",
            url: "https://www.pyrenees2vallees.com/la-randonnee-%C3%A0-pyrenees2vall%C3%A9es"
          },
          {
            label: "Parc national d'Ordessa Mont Perdu",
            url: "https://www.turismodearagon.com/fr/ficha/ordesa-y-monte-perdido/"
          },
          {
            label: "Randonnée et activités outdoor",
            url: "https://www.agence-outdoor.fr"
          },
          {
            label: "Cabanes et refuges",
            url: "https://www.pyrenees-refuges.com/"
          },
          {
            label: "Guide de hte montagne",
            url: "http://pierre.guide.free.fr/"
          }

        ]

      },
      {
        title: "Vélo & cols mythiques",
        image: "/activite-velo.jpg",
        alt: "Cyclisme dans les cols des Hautes-Pyrénées",
        text:
          "Partez à la découverte des grands cols pyrénéens : Aspin, Peyresourde, Tourmalet, Hourquette d'Ancizan, Portet et Azet : un terrain de jeu rêvé pour les cyclistes. Dévalez en VTT les pistes de la Coupe du Monde Mountain Bike UCI de la vallée du Louron, mais aussi celles en vallée d'Aure et de la Zona Zero en Espagne.",
        links: [
          {
            label: "Route des cols",
            url: "https://www.tourisme-hautes-pyrenees.com/montagne-ete/velo/ascensions-cols-pyrenees/grande-route-cols/"
          },
          {
            label: "Cols, cartes et profils",
            url: "https://climbfinder.com/fr/carte#lnglat=0.359832/42.905098&position=11.22/42.905098/0.359832"
          },
          {
            label: "Louron Bike & Trail",
            url: "https://louronbikeandtrail.com/fr"
          },
          {
            label: "VTT Aure Louron ",
            url: "https://www.pyrenees2vallees.com/vtt"
          },
          {
            label: "VTT Ainsa - Zona Zero ",
            url: "https://zonazeropirineos.com/fr/"
          }
        ]
      },
      {
        title: "Eau vive & sensations",
        image: "/activite-eauvive.jpg",
        alt: "Rafting canyoning eau vive dans les Pyrénées",
        text:
          "Descente en rafting de la Neste d'Aure, canyon sportif sur les flancs du Mont Perdu ou ludique dans les eaux turquoises de la Sierra de Guara, via ferrata, activités sportives familiales ou sensationnelles pour ajouter une dose d’aventure à votre séjour.",
        links: [
          
          {
            label: "Rafting et Canyoning",
            url: "https://pyragua.com/"
          },
          {
            label: "Canyon Sierra de Guara",
            url: "https://www.canyonsierradeguara.com/"
          },
          {
            label: "Activités Louron",
            url: "https://www.vallee-du-louron.com/fr/activites-2"
          },
          {
            label: "Activités vallée d'Aure",
            url: "https://www.tourisme-hautes-pyrenees.com/montagne-ete/lieux-de-sejour/saint-lary-et-la-vallee-aure/"
          },
          {
            label: "Activités Piémont",
            url: "https://coeurdespyrenees.com/office-de-tourisme-lannemezan-et-capvern/je-suis-touriste/"
          },
          {
            label: "Baronnies - Barousse",
            url: "https://tourisme-neste-barousse.fr/"
          },
          {
            label: "Parapente",
            url: "https://virevolte.net/"
          }
        ]

      },
      {
        title: "Bien-être & découvertes",
        image: "/activite-detente.jpg",
        alt: "Balnéa Loudenvielle détente et patrimoine",
        text:
          "Après une journée en montagne, profitez d'un moment de détente à Balnéa, découvrez les villages pyrénéens, Saint-Lary, Loudenvielle, le patrimoine architectural, la gastronomie locale ou une escapade vers l’Espagne.",
        links: [
          {
            label: "Balnéa",
            url: "https://www.balnea.fr/"
          },
          {
            label: "Arreau",
            url: "https://www.mairie-arreau.fr/"
          },
          {
            label: "Le patrimoine des vallées d’Aure et du Louron",
            url: "https://patrimoine-aure-louron.fr/notre-patrimoine/focus-sur-les-monuments-incontournables/"
          },
          {
            label: "Gastronomie et producteurs locaux",
            url: "https://www.hapy-saveurs.com/"
          },
          {
            label: "Infos locales",
            url: "https://www.scoop.it.pyrenees-aure-louron.eu/"
          },
          {
            label: "Le marché d'Arreau",
            url: "https://www.paysdesnestes.fr/marche-de-arreau/"
          }
        ]
      }
    ].map((activity) => (

      <div
        key={activity.title}
        style={{
          background: "white",
          borderRadius: "32px",
          overflow: "hidden",
          boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
          transition: "0.35s"
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform =
            "translateY(-6px)";
          e.currentTarget.style.boxShadow =
            "0 22px 55px rgba(0,0,0,0.13)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform =
            "translateY(0)";
          e.currentTarget.style.boxShadow =
            "0 15px 40px rgba(0,0,0,0.08)";
        }}
      >

        <img
          src={activity.image}
          alt={activity.alt}
          style={{
            width: "100%",
            height: "240px",
            objectFit: "cover"
          }}
        />

        <div
          style={{
            padding: "28px"
          }}
        >

          <h3
            style={{
              marginBottom: "14px"
            }}
          >
            {activity.title}
          </h3>

          <p
            style={{
              lineHeight: "1.8",
              color: "#555",
              marginBottom: "24px"
            }}
          >
            {activity.text}
          </p>

          <details
            style={{
              marginTop: "18px"
            }}
          >
            <summary
              style={{
                color: "#1f6f3d",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              Liens utiles
            </summary>

            <div
              style={{
                display: "grid",
                gap: "10px",
                marginTop: "16px"
              }}
            >
              {activity.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#1f6f3d",
                    textDecoration: "none",
                    fontWeight: "500"
                  }}
                >
                  {link.label} →
                </a>
              ))}
            </div>
          </details>


        </div>

      </div>

    ))}

  </div>

</section>

{/* METEO + CARTE */}

<section id="meteo" className="section">

  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(320px,1fr))",
      gap: "30px",
      alignItems: "stretch"
    }}
  >

    {/* METEO */}

    <div
      style={{
        background: "white",
        borderRadius: "35px",
        padding: "20px",
        boxShadow:
          "0 20px 50px rgba(0,0,0,0.08)"
      }}
    >

      <h2
        style={{
          marginBottom: "20px",
          paddingLeft: "10px"
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
        transformOrigin: "top left"
        }}
      />

    </div>

    {/* CARTE */}

    <div
      style={{
        background: "white",
        borderRadius: "35px",
        padding: "20px",
        boxShadow:
          "0 20px 50px rgba(0,0,0,0.08)"
      }}
    >

      <h2
        style={{
          marginBottom: "20px",
          paddingLeft: "15px"
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
          borderRadius: "25px"
        }}
      />

    </div>

  </div>

</section>

{/* CONTACT */}

<section
  id="contact"
  className="section"
  >

  <div
    style={{
      background: "white",
      borderRadius: "40px",
      padding: "60px 40px",
      boxShadow:
        "0 20px 60px rgba(0,0,0,0.08)",
      maxWidth: "1100px",
      margin: "auto"
    }}
  >

    <h2
      style={{
        textAlign: "center",
        marginBottom: "20px"
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
        color: "#555"
      }}
    >
      Une question sur votre séjour, les disponibilités ou autre ?<br></br>Nous serons ravis de vous répondre.
    </p>

    {/* TELEPHONE CLIQUABLE */}

    <div
      style={{
        textAlign: "center",
        marginBottom: "34px"
      }}
    >

      <a
        href="tel:+33663076314"
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
          fontSize: "1.2rem",
          boxShadow:
            "0 10px 30px rgba(0,0,0,0.06)"
        }}
      >
        📞 06 63 07 63 14
      </a>

    </div>

    {/* BANNIERE CONTACT */}

    <img
      src="/banniere.png"
      alt="Email et adresse de La Maison Verte à Arreau"
      style={{
        width: "100%",
        maxWidth: "1050px",
        display: "block",
        margin: "0 auto",
        borderRadius: "28px",
        boxShadow:
          "0 20px 60px rgba(0,0,0,0.08)"
      }}
    />

    {/* GOOGLE MAPS */}

    <div
      style={{
        textAlign: "center",
        marginTop: "34px"
      }}
    >

      <a
        href="https://www.google.com/maps?q=3+Impasse+Trassens+65240+Arreau"
        target="_blank"
        rel="noopener noreferrer"
        className="button"
        style={{
          textDecoration: "none"
        }}
      >
        Ouvrir dans Google Maps
      </a>

    </div>

  </div>

</section>

{/* FOOTER */}


      <footer>

        <h3>
          La Maison Verte
        </h3>

        <p>
          Arreau • Hautes-Pyrénées
        </p>

      </footer>

  {lightboxOpen && (

  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.9)",
      zIndex: 3000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "30px"
    }}
    >

    <button
      onClick={() => setLightboxOpen(false)}
      style={{
        position: "absolute",
        top: "25px",
        right: "30px",
        background: "white",
        border: "none",
        borderRadius: "50%",
        width: "45px",
        height: "45px",
        fontSize: "24px",
        cursor: "pointer"
      }}
      >
      ×
    </button>

    <button
      onClick={() =>
        setCurrentImageIndex(
          currentImageIndex === 0
            ? galleryPhotos.length - 1
            : currentImageIndex - 1
        )
      }
      style={{
        position: "absolute",
        left: "30px",
        background: "white",
        border: "none",
        borderRadius: "50%",
        width: "50px",
        height: "50px",
        fontSize: "28px",
        cursor: "pointer"
      }}
      >
      ‹
    </button>

    <img
      src={galleryPhotos[currentImageIndex].src}
      alt={galleryPhotos[currentImageIndex].caption}
      style={{
        maxWidth: "90%",
        maxHeight: "85vh",
        objectFit: "contain",
        borderRadius: "20px",
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.5)"
      }}
      />

    <button
      onClick={() =>
        setCurrentImageIndex(
          currentImageIndex === galleryPhotos.length - 1
            ? 0
            : currentImageIndex + 1
        )
      }
      style={{
        position: "absolute",
        right: "30px",
        background: "white",
        border: "none",
        borderRadius: "50%",
        width: "50px",
        height: "50px",
        fontSize: "28px",
        cursor: "pointer"
      }}
      >
      ›
    </button>

  </div>

)}
    </>

  );

}