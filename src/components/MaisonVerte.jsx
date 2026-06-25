import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { supabase } from "../supabaseClient";

export default function MaisonVerte() {
  const [selectedDates, setSelectedDates] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [pricingRules, setPricingRules] = useState({
    defaultNightPrice: null,
    seasonPrices: [],
    priceOverrides: [],
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scrolled, setScrolled] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestAdults, setGuestAdults] = useState("2");
  const [guestChildren, setGuestChildren] = useState("0");
  const [childrenAges, setChildrenAges] = useState("");
  const [babyBedNeeded, setBabyBedNeeded] = useState(false);
  const [guestMessage, setGuestMessage] = useState("");
  const [contractAccepted, setContractAccepted] = useState(false);
  const [publishedReviews, setPublishedReviews] = useState([]);
  const [reviewFirstName, setReviewFirstName] = useState("");
  const [reviewLastName, setReviewLastName] = useState("");
  const [reviewEmail, setReviewEmail] = useState("");
  const [reviewPhone, setReviewPhone] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewStayPeriod, setReviewStayPeriod] = useState("");
  const [reviewConsent, setReviewConsent] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const bookingFormRef = useRef(null);
  const guestFirstNameRef = useRef(null);
  const [openFaqCategory, setOpenFaqCategory] = useState(null);
  const googleReviewUrl = "https://g.page/r/CasA-_8IxkGjEBM/review";
  const googleProfileUrl = "https://g.page/r/CasA-_8IxkGjEBM";
  const ENABLE_SITE_REVIEWS = false;
  const galleryPhotos = [
    {
      src: "/salon-salle-a-manger-maison-verte.webp",
      caption: "Salon et salle à manger",
    },

    {
      src: "/cuisine-equipee-maison-verte.webp",
      caption: "Cuisine équipée",
    },

    {
      src: "/chambre-parentale-grand-lit.webp",
      caption: "Chambre parentale - grand lit et rangements",
    },

    {
      src: "/chambre-parentale-balcon.webp",
      caption: "Chambre parentale - bureau et sortie balcon",
    },

    {
      src: "/chambre-sous-combles-lits-jumeaux.webp",
      caption: "Chambre sous combles - les lits jumeaux",
    },

    {
      src: "/chambre-sous-combles-vue-montagne.webp",
      caption: "Chambre sous combles - la vue sur le clocher et les montagnes",
    },

    {
      src: "/salle-de-bain-maison-verte.webp",
      caption: "Salle de bain",
    },

    {
      src: "/douche-maison-verte.webp",
      caption: "Douche",
    },

    {
      src: "/wc-et-palier.webp",
      caption: "WC et palier",
    },

    {
      src: "/balcon-plein-sud-ouest.webp",
      caption: "Balcon plein sud - côté Ouest",
    },

    {
      src: "/smart-tv-salon.webp",
      caption: "Smart TV",
    },

    {
      src: "/passage-sous-le-porche-arreau.webp",
      caption: "Passage sous le porche",
    },

    {
      src: "/rue-de-la-coutellerie-arreau.webp",
      caption: "Rue de la coutellerie",
    },

    {
      src: "/impasse-trassens-arreau.webp",
      caption: "Impasse Trassens",
    },

    {
      src: "/halle-et-mairie-arreau.webp",
      caption: "La halle et la mairie",
    },

    {
      src: "/vue-calvaire-arreau-nuit.webp",
      caption: "Vue du calvaire d'Arreau de nuit",
    },
  ];
  const faqCategories = [
    {
      title: "La maison",
      items: [
        {
          question: "Combien de personnes peuvent séjourner dans la maison ?",
          answer:
            "La Maison Verte peut accueillir jusqu’à 4 personnes. Elle dispose d’une chambre parentale avec un lit double de 140 × 200 cm et d’une chambre sous combles équipée de deux lits simples de 90 × 190 cm.",
        },
        {
          question: "Comment est organisée la maison ?",
          answer:
            "La maison est répartie sur trois niveaux. Le rez-de-chaussée comprend le séjour, la salle à manger, la cuisine équipée, la salle de bain et les WC séparés. Le premier étage accueille la chambre parentale avec accès au balcon. Le deuxième étage accueille la chambre sous combles équipée de deux lits simples.",
        },
        {
          question: "Les draps et serviettes sont-ils fournis ?",
          answer:
            "Le linge de lit est fourni pour votre séjour. Les serviettes de toilette ne sont en revanche pas incluses dans la location.",
        },
        {
          question: "Les animaux sont-ils acceptés ?",
          answer:
            "Non. Les animaux ne sont pas acceptés à La Maison Verte afin de préserver le confort de tous les voyageurs et la qualité du logement.",
        },
        {
          question: "La maison est-elle adaptée aux familles avec enfants ?",
          answer:
            "Oui. La Maison Verte est adaptée à une famille de 4 personnes. Un lit parapluie peut être mis à disposition sur demande. La chambre sous combles dispose également d'une barrière de sécurité amovible pouvant être installée en haut de l'escalier. Notez cependant la présence des 2 escaliers",
        },
        {
          question:
            "La maison est-elle adaptée aux personnes à mobilité réduite ?",
          answer:
            "Non. La Maison Verte est une maison de village ancienne rénovée sur plusieurs niveaux. Elle comporte plusieurs escaliers intérieurs et n'est donc pas adaptée aux personnes à mobilité réduite.",
        },
      ],
    },
    {
      title: "Accès et village",
      items: [
        {
          question: "Peut-on se garer facilement à proximité ?",
          answer:
            "Oui. Plusieurs parkings gratuits sont accessibles à quelques dizaines de mètres de la maison. Il est généralement facile de stationner à proximité du logement tout au long de l'année.",
        },
        {
          question:
            "Les commerces et restaurants sont-ils accessibles à pied ?",
          answer:
            "Oui. La Maison Verte est située dans le centre historique d'Arreau. Boulangerie, boucherie, restaurants, cafés, pharmacie, marché, office de tourisme et commerces sont accessibles en quelques minutes à pied.",
        },
        {
          question: "Où se situe Arreau ?",
          answer:
            "Arreau se situe dans les Pyrénées centrales, à 1h30 de l'aéroport de Toulouse, à 1h de Lourdes, à 45 min de la frontière Espagnole, 2h15 de l'océan.",
        },
      ],
    },
    {
      title: "Ski, montagne et activités",
      items: [
        {
          question:
            "Quelles stations de ski et activités sont accessibles depuis la maison ?",
          answer:
            "La Maison Verte bénéficie d'une situation centrale idéale dans la vallée d'Aure. Le téléphérique de Saint-Lary est accessible en environ 10 minutes, le Pla d'Adet en 20 minutes, Peyragudes en 20 minutes, Val Louron en 25 minutes et Piau-Engaly en 35 minutes. Le centre de bien-être Balnéa à Loudenvielle se situe également à seulement 15 minutes de la maison.",
        },
        {
          question: "Quelles activités peut-on pratiquer au départ d'Arreau ?",
          answer:
            "Arreau constitue un point de départ idéal pour de nombreuses activités de montagne. Les cyclistes peuvent rejoindre directement les cols mythiques d'Aspin, d'Azet, de Peyresourde, du Portet ou la Hourquette d'Ancizan. Les amateurs de VTT trouveront de nombreux itinéraires adaptés à tous les niveaux, du cross-country à l'enduro. Le secteur est également apprécié pour le gravel. Les randonneurs bénéficient d'un vaste choix de balades et de randonnées vers la vallée d'Aure, la vallée du Louron et la réserve naturelle du Néouvielle.",
        },
        {
          question:
            "Quels cols mythiques des Pyrénées sont accessibles directement depuis Arreau ?",
          answer:
            "Depuis La Maison Verte, cyclistes et motards peuvent rejoindre directement plusieurs cols emblématiques des Pyrénées : le col d'Aspin, le col d'Azet, le col de Peyresourde, la Hourquette d'Ancizan et le col du Portet. Ces ascensions régulièrement empruntées par le Tour de France offrent des panoramas exceptionnels.",
        },
        {
          question: "Les lacs du Néouvielle sont-ils facilement accessibles ?",
          answer:
            "Oui. Depuis Arreau, il est facile d'accéder à la réserve naturelle nationale du Néouvielle. Les lacs d'Orédon, d'Aubert, d'Aumar et de Cap-de-Long constituent des destinations incontournables pour la randonnée, la photographie et l'observation de la faune et de la flore de montagne.",
        },
      ],
    },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqCategories.flatMap((category) =>
      category.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    ),
  };

  function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseLocalDate(value) {
    if (!value) return null;
    if (value instanceof Date)
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
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
        const response = await fetch("/.netlify/functions/calendar");

        const data = await response.json();

        setUnavailableDates(data.unavailableDates || []);

        setPricingRules({
          defaultNightPrice: Number(data.defaultNightPrice ?? 80),
          seasonPrices: data.seasonPrices || [],
          priceOverrides: data.priceOverrides || [],
        });
      } catch (error) {
        console.error("Erreur calendrier :", error);
      }
    }

    fetchCalendar();
  }, []);

  useEffect(() => {
    async function fetchPublishedReviews() {
      const { data, error } = await supabase
        .from("guest_reviews")
        .select("*")
        .eq("status", "published")
        .eq("consent_to_publish", true)
        .order("published_at", { ascending: false })
        .limit(6);

      if (!error) {
        setPublishedReviews(data || []);
      }
    }

    fetchPublishedReviews();
  }, []);

  useEffect(() => {
    async function trackSiteVisit() {
      try {
        const todayKey = formatLocalDate(new Date());
        const storageKey = `lmv_visit_${todayKey}`;
        if (window.localStorage.getItem(storageKey)) return;

        let visitorId = window.localStorage.getItem("lmv_visitor_id");
        if (!visitorId) {
          visitorId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
          window.localStorage.setItem("lmv_visitor_id", visitorId);
        }

        const referrer = document.referrer || "";
        let referrerDomain = "";
        try {
          referrerDomain = referrer
            ? new URL(referrer).hostname.replace(/^www\./, "")
            : "";
        } catch {
          referrerDomain = "";
        }

        const params = new URLSearchParams(window.location.search);
        const utmSource = params.get("utm_source");
        const detectedSource =
          utmSource ||
          (referrerDomain.includes("google")
            ? "google"
            : referrerDomain.includes("booking")
              ? "booking"
              : referrerDomain.includes("airbnb")
                ? "airbnb"
                : referrerDomain.includes("facebook")
                  ? "facebook"
                  : referrerDomain
                    ? "referral"
                    : "direct");

        window.localStorage.setItem(storageKey, "1");
        await supabase.from("site_visits").insert([
          {
            page: window.location.pathname || "/",
            visitor_id: visitorId,
            referrer,
            referrer_domain: referrerDomain || null,
            source: detectedSource,
          },
        ]);
      } catch (error) {
        console.error("Erreur compteur visites :", error);
      }
    }

    trackSiteVisit();
  }, []);

  useEffect(() => {
    if (
      window.location.hash === "#laisser-un-avis" ||
      window.location.search.includes("review=1") ||
      window.location.search.includes("booking=")
    ) {
      setShowReviewForm(true);
      setTimeout(
        () =>
          document
            .getElementById("laisser-un-avis")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        250,
      );
    }
  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const daysInMonth = lastDay.getDate();

  const startingDay = (firstDay.getDay() + 6) % 7;

  const days = [];

  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
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

    setTimeout(() => {
      bookingFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      guestFirstNameRef.current?.focus({ preventScroll: true });
    }, 250);
  }

  const pricingLoaded = pricingRules.defaultNightPrice !== null;
  const defaultPrice = pricingLoaded
    ? Number(pricingRules.defaultNightPrice)
    : 0;

  const pricePeriods = (pricingRules.seasonPrices || []).map((period) => ({
    name: period.label,
    start: period.start_date,
    end: period.end_date,
    price: Number(period.night_price || defaultPrice),
    minimumNights: period.minimum_nights,
  }));

  const priceOverrides = (pricingRules.priceOverrides || []).map(
    (override) => ({
      name: override.label,
      start: override.start_date,
      end: override.end_date,
      price: Number(override.night_price || defaultPrice),
    }),
  );

  const stayRules = pricePeriods
    .filter((period) => period.minimumNights)
    .map((period) => ({
      name: period.name,
      start: period.start,
      end: period.end,
      minimumNights: Number(period.minimumNights || 2),
    }));

  function getPriceForDate(key) {
    const override = priceOverrides.find(
      (override) => key >= override.start && key < override.end,
    );

    if (override) return override.price;

    const period = pricePeriods.find(
      (period) => key >= period.start && key < period.end,
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

    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      nights.push(formatLocalDate(d));
    }

    return nights;
  }

  function getRuleForStay(nights) {
    return stayRules.find((rule) =>
      nights.some((night) => night >= rule.start && night < rule.end),
    );
  }

  const numberOfNights =
    selectedDates.length === 2
      ? Math.round(
          (parseLocalDate(selectedDates[1]) -
            parseLocalDate(selectedDates[0])) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

  const selectedNights = getSelectedNights();

  const accommodationTotal = selectedNights.reduce(
    (sum, nightKey) => sum + getPriceForDate(nightKey),
    0,
  );

  const activeStayRule = getRuleForStay(selectedNights);

  const minimumNights = activeStayRule ? activeStayRule.minimumNights : 2;

  const reservationMessage =
    selectedDates.length !== 2
      ? "Sélectionnez vos dates d’arrivée et de départ."
      : numberOfNights < minimumNights
        ? `Séjour minimum : ${minimumNights} nuits sur cette période.`
        : activeStayRule
          ? "Votre demande concerne une période de forte demande. Elle sera étudiée avant confirmation."
          : "Renseignez vos coordonnées.";

  const canRequestBooking =
    selectedDates.length === 2 && numberOfNights >= minimumNights;

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail);

  const isPhoneValid = /^[0-9+\s().-]{8,}$/.test(guestPhone);

  const adultsCount = Number(guestAdults || 0);
  const childrenCount = Number(guestChildren || 0);
  const totalGuests = adultsCount + childrenCount;

  const isGuestCompositionValid =
    Number.isInteger(adultsCount) &&
    Number.isInteger(childrenCount) &&
    adultsCount >= 1 &&
    childrenCount >= 0 &&
    totalGuests >= 1 &&
    totalGuests <= 4 &&
    (childrenCount === 0 || childrenAges.trim() !== "");

  const isFormValid =
    guestFirstName.trim() !== "" &&
    guestLastName.trim() !== "" &&
    isEmailValid &&
    isPhoneValid &&
    isGuestCompositionValid;

  const canSubmitRequest = canRequestBooking && isFormValid && contractAccepted && !bookingSubmitting;

  const total = accommodationTotal;

  function previousMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
  }

  async function submitBookingRequest() {
    if (!canSubmitRequest) {
      return;
    }

    setBookingSubmitting(true);

    try {
      const { data: insertedBookings, error } = await supabase.from("booking_requests").insert([
        {
          status: "pending",
          guest_first_name: guestFirstName.trim(),
          guest_last_name: guestLastName.trim(),

          guest_email: guestEmail.trim(),
          guest_phone: guestPhone.trim(),
          adults_count: adultsCount,
          children_count: childrenCount,
          children_ages: childrenAges.trim() || null,
          baby_bed_needed: babyBedNeeded,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent
            ? new Date().toISOString()
            : null,

          start_date: selectedDates[0],
          end_date: selectedDates[1],

          nights: numberOfNights,
          estimated_total: total,
          message: guestMessage.trim() || null,
          contract_accepted: contractAccepted,
          contract_accepted_at: new Date().toISOString(),
          contract_version: "v1.1",
          contract_url:
            "https://lamaisonverte65.fr/documents/contrat-location.pdf",
        },
      ]).select("id");

      if (error) {
        console.error(error);

        alert("Erreur lors de l'envoi de la demande.");

        return;
      }

      const bookingRequestId = insertedBookings?.[0]?.id || null;

      const emailResponse = await fetch("/.netlify/functions/send-booking-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: bookingRequestId,
          guestFirstName: guestFirstName.trim(),
          guestLastName: guestLastName.trim(),

          guestEmail: guestEmail.trim(),
          guestPhone: guestPhone.trim(),
          adultsCount,
          childrenCount,
          childrenAges: childrenAges.trim(),
          babyBedNeeded,
          guestMessage,

          startDate: selectedDates[0],
          endDate: selectedDates[1],

          nights: numberOfNights,
          total,
        }),
      });

      if (!emailResponse.ok) {
        let errorMessage = "Erreur lors de l’envoi de l’email de confirmation.";
        try {
          const errorData = await emailResponse.json();
          errorMessage = errorData?.error || errorMessage;
        } catch (_) {}

        alert(
          `Votre demande a bien été enregistrée, mais l’email de confirmation n’a pas pu être envoyé automatiquement. Merci de nous contacter si vous ne recevez rien rapidement. Détail technique : ${errorMessage}`
        );
      } else {
        alert(
        "Votre demande de réservation a bien été envoyée. Un email de confirmation vient de vous être adressé. Pensez à vérifier vos courriers indésirables / spams si vous ne le recevez pas rapidement. Le calendrier va maintenant se mettre à jour.",
        );
      }

      setGuestFirstName("");
      setGuestLastName("");

      setGuestEmail("");
      setGuestPhone("");
      setGuestAdults("2");
      setGuestChildren("0");
      setChildrenAges("");
      setBabyBedNeeded(false);
      setMarketingConsent(false);
      setGuestMessage("");

      setSelectedDates([]);
      setContractAccepted(false);

      window.location.reload();
    } catch (err) {
      console.error(err);

      alert("Une erreur est survenue.");
    } finally {
      setBookingSubmitting(false);
    }
  }

  function getPublishedReviewAverage() {
    if (!publishedReviews.length) return null;
    const total = publishedReviews.reduce(
      (sum, review) => sum + Number(review.rating || 0),
      0,
    );
    return (total / publishedReviews.length).toFixed(1).replace(".", ",");
  }

  async function submitGuestReview(event) {
    event.preventDefault();
    setReviewSubmitted(false);

    const rating = Number(reviewRating);

    if (!reviewFirstName.trim()) {
      alert("Merci d’indiquer votre prénom.");
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      alert("Merci de sélectionner une note entre 1 et 5.");
      return;
    }

    if (!reviewComment.trim()) {
      alert("Merci d’écrire un petit commentaire.");
      return;
    }

    if (!reviewConsent) {
      alert("Merci de cocher l’autorisation de publication.");
      return;
    }

    setReviewSubmitting(true);

    const displayName = reviewFirstName.trim();

    const { error } = await supabase.from("guest_reviews").insert([
      {
        guest_first_name: reviewFirstName.trim(),
        guest_last_name: reviewLastName.trim() || null,
        guest_email: reviewEmail.trim() || null,
        guest_phone: reviewPhone.trim() || null,
        rating,
        comment: reviewComment.trim(),
        stay_period: reviewStayPeriod.trim() || null,
        display_name: displayName,
        consent_to_publish: reviewConsent,
        source: "website",
        status: "pending",
      },
    ]);

    setReviewSubmitting(false);

    if (error) {
      console.error(error);
      alert(
        "Erreur lors de l’envoi de l’avis. Vous pouvez aussi nous l’envoyer par email.",
      );
      return;
    }

    setReviewSubmitted(true);
    setReviewFirstName("");
    setReviewLastName("");
    setReviewEmail("");
    setReviewPhone("");
    setReviewRating("5");
    setReviewComment("");
    setReviewStayPeriod("");
    setReviewConsent(false);
  }

  return (
    <>
      <Helmet>
        <title>
          Location vacances Arreau – Gîte 4 personnes – Vallée d’Aure | La
          Maison Verte
        </title>
        <meta
          name="description"
          content="Location de vacances de particulier à particulier à Arreau pour 4 personnes. Réservation directe auprès du propriétaire, sans intermédiaire, proche Saint-Lary, Peyragudes, Loudenvielle, Val Louron et du Néouvielle."
        />
        <link rel="canonical" href="https://lamaisonverte65.fr/" />
        <meta
          property="og:title"
          content="Location vacances Arreau – Gîte 4 personnes | La Maison Verte"
        />
        <meta
          property="og:description"
          content="Ravissante maison rénovée en location de particulier à particulier pour 4 personnes à Arreau. Réservation directe propriétaire, sans intermédiaire, proche de Saint-Lary, Loudenvielle, Peyragudes, Val Louron, du Néouvielle et de l'Espagne."
        />

        <meta
          property="og:image"
          content="https://lamaisonverte65.fr/hero.webp"
        />
        <meta property="og:url" content="https://lamaisonverte65.fr/" />
        <meta property="og:type" content="website" />

        {/* FAVICONS */}

        <link rel="icon" type="image/x-icon" href="/favicon/favicon.ico" />

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

        <link rel="manifest" href="/favicon/manifest.json" />

        {/* JSON-LD */}

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VacationRental",
            additionalType: "House",
            identifier: "lamaisonverte65-arreau",
            name: "La Maison Verte - Arreau",
            description:
              "Ravissante maison rénovée à Arreau, proche de Saint-Lary, Loudenvielle, Peyragudes, Val Louron et de la réserve du Néouvielle. Une location chaleureuse de particulier à particulier pour 4 personnes, avec réservation directe auprès du propriétaire, au cœur des Pyrénées.",
            url: "https://lamaisonverte65.fr/",
            image: [
              "https://lamaisonverte65.fr/hero.webp",
              "https://lamaisonverte65.fr/salon-salle-a-manger-maison-verte.webp",
              "https://lamaisonverte65.fr/cuisine-equipee-maison-verte.webp",
              "https://lamaisonverte65.fr/chambre-parentale-grand-lit.webp",
              "https://lamaisonverte65.fr/chambre-parentale-balcon.webp",
              "https://lamaisonverte65.fr/chambre-sous-combles-lits-jumeaux.webp",
              "https://lamaisonverte65.fr/salle-de-bain-maison-verte.webp",
              "https://lamaisonverte65.fr/balcon-plein-sud-ouest.webp",
              "https://lamaisonverte65.fr/halle-et-mairie-arreau.webp",
            ],
            telephone: "+33663076314",
            email: "lamaisonverte65@gmail.com",
            address: {
              "@type": "PostalAddress",
              streetAddress: "3 Impasse Trassens",
              addressLocality: "Arreau",
              addressRegion: "Occitanie",
              postalCode: "65240",
              addressCountry: "FR",
            },
            geo: {
              "@type": "GeoCoordinates",
              latitude: 42.903534,
              longitude: 0.361304,
            },
            maximumAttendeeCapacity: 4,
            numberOfRooms: 2,
            containsPlace: {
              "@type": "Accommodation",
              identifier: "lamaisonverte65-arreau-accommodation",
              additionalType: "EntirePlace",
              name: "La Maison Verte",              occupancy: {
                "@type": "QuantitativeValue",
                value: 4,
                maxValue: 4,
              },
              numberOfBedrooms: 2,
              numberOfBathroomsTotal: 1,
              bed: [
                {
                  "@type": "BedDetails",
                  typeOfBed: "Double bed",
                  numberOfBeds: 1,
                },
                {
                  "@type": "BedDetails",
                  typeOfBed: "Single bed",
                  numberOfBeds: 2,
                },
              ],
              amenityFeature: [
                {
                  "@type": "LocationFeatureSpecification",
                  name: "Cuisine équipée",
                  value: true,
                },
                {
                  "@type": "LocationFeatureSpecification",
                  name: "Balcon plein sud",
                  value: true,
                },
                {
                  "@type": "LocationFeatureSpecification",
                  name: "Lave-vaisselle",
                  value: true,
                },
                {
                  "@type": "LocationFeatureSpecification",
                  name: "Machine à laver",
                  value: true,
                },
                {
                  "@type": "LocationFeatureSpecification",
                  name: "Smart TV",
                  value: true,
                },
                {
                  "@type": "LocationFeatureSpecification",
                  name: "Parking gratuit proche",
                  value: true,
                },
              ],
            },
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: "4.8",
              reviewCount: "51",
              bestRating: "5",
              worstRating: "1",
            },
            priceRange: `À partir de ${defaultPrice}€ par nuit`,
          })}
        </script>

        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
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

          background: scrolled ? "#f6f3ee" : "rgba(246,243,238,0)",

          backdropFilter: "none",
          boxShadow: "none",
          transition: "0.35s",
        }}
      >
        {/* LOGO */}
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <a href="#accueil" style={{ display: "flex", alignItems: "center" }}>
            <img
              src="/logo.png"
              alt="La Maison Verte"
              style={{
                height: scrolled ? "58px" : "64px",
                objectFit: "contain",
              }}
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
            flex: 1,
          }}
        >
          <a
            href="#presentation"
            style={{
              textDecoration: "none",
              color: scrolled ? "#1e2b1f" : "white",
              fontWeight: "500",
              transition: "0.35s",
            }}
          >
            Présentation
          </a>
          <a
            href="#galerie"
            style={{
              textDecoration: "none",
              color: scrolled ? "#1e2b1f" : "white",
              fontWeight: "500",
              transition: "0.35s",
            }}
          >
            Galerie
          </a>
          <a
            href="#avis"
            style={{
              textDecoration: "none",
              color: scrolled ? "#1e2b1f" : "white",
              fontWeight: "500",
              transition: "0.35s",
            }}
          >
            Avis
          </a>
          <a
            href="#faq"
            style={{
              textDecoration: "none",
              color: scrolled ? "#1e2b1f" : "white",
              fontWeight: "500",
              transition: "0.35s",
            }}
          >
            FAQ
          </a>
          <a
            href="#reservation"
            style={{
              textDecoration: "none",
              color: scrolled ? "#1e2b1f" : "white",
              fontWeight: "500",
              transition: "0.35s",
            }}
          >
            Réservation
          </a>
          <a
            href="#activites"
            style={{
              textDecoration: "none",
              color: scrolled ? "#1e2b1f" : "white",
              fontWeight: "500",
              transition: "0.35s",
            }}
          >
            Activités
          </a>
          <a
            href="#meteo"
            style={{
              textDecoration: "none",
              color: scrolled ? "#1e2b1f" : "white",
              fontWeight: "500",
              transition: "0.35s",
            }}
          >
            Situation
          </a>
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
        <div
          className="nav-contact"
          style={{ display: "flex", justifyContent: "flex-end" }}
        >
          <a
            href="#contact"
            className="button"
            style={{ textDecoration: "none" }}
          >
            Contact
          </a>
        </div>
      </nav>

      {/* HERO PREMIUM */}

<section id="accueil" className="hero">
  <div className="overlay">
    <div
      style={{
        animation: "fadeUp 1.2s ease",
        maxWidth: "920px",
        padding: "0 24px",
      }}
    >
      <h1
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "clamp(4.2rem, 11vw, 7rem)",
          marginBottom: "24px",
          fontWeight: "600",
          letterSpacing: "-2px",
          lineHeight: "0.95",
          color: "#eef5ee",
          textShadow: "0 6px 25px rgba(0,0,0,0.55)",
        }}
      >
        La Maison Verte
      </h1>

      <h2
        style={{
          fontSize: "clamp(1rem, 2vw, 1.6rem)",
          fontWeight: "500",
          lineHeight: "1.4",
          color: "#e4efe4",
          textShadow: "0 4px 15px rgba(0,0,0,0.65)",
          maxWidth: "900px",
          margin: "0 auto 30px",
        }}
      >
        Location de vacances dans les Hautes-Pyrénées
        <br />
        Gîte de charme pour 4 personnes au cœur de la vallée d'Aure
      </h2>

      <div
        style={{
          marginBottom: "42px",
          padding: "8px 24px",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.14) 45%, rgba(0,0,0,0) 75%)",
        }}
      >
        <div
          style={{
            fontFamily: "'Lora', serif",
            fontSize: "clamp(1.15rem, 2.3vw, 1.6rem)",
            letterSpacing: "8px",
            textTransform: "uppercase",
            marginBottom: "22px",
            fontWeight: "800",
            color: "white",
            textShadow: "0 6px 20px rgba(0,0,0,0.95)",
          }}
        >
          -Arreau-
          <br />
          Pyrénées
        </div>
        <p
          style={{
            fontFamily: "'Lora', serif",
            fontSize: "clamp(1.05rem, 2.4vw, 1.45rem)",
            maxWidth: "760px",
            lineHeight: "1.8",
            margin: "auto",
            color: "#f2f6f2",
            fontWeight: "600",
            textShadow: "0 3px 10px rgba(0,0,0,0.85)",
          }}
        >
          Entre cols mythiques, stations de ski et randonnées,
          profitez d'un séjour authentique dans une maison de caractère
          entièrement rénovée au cœur du quartier historique.
        </p>
      </div>

      <div
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
            fontSize: "17px",
          }}
        >
          Voir les photos
        </a>

        <a
          href="#faq"
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


      {/* PRESENTATION + EQUIPEMENTS */}

      <section id="presentation" className="section">
        <h2
          style={{
            marginBottom: "34px",
          }}
        >
          La maison
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "40px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "40px",
              borderRadius: "35px",
              boxShadow: "0 15px 45px rgba(0,0,0,0.08)",
            }}
          >
            <h3>Un petit cocon niché au cœur d'un village traditionnel</h3>

            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
                marginTop: "20px",
              }}
            >
              Hébergement entièrement rénové pour 4 personnes, niché dans le
              centre historique d’Arreau. Situé à la Confluence des vallées
              d’Aure (Saint-Lary) et du Louron (Loudenvielle), au pied de 4
              stations de ski, de nombreux cols mythiques et de multiples
              possibilités de randonnées.
            </p>

            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
              }}
            >
              La Maison Verte est une location de vacances de particulier à
              particulier située au cœur d'Arreau. Réservez directement auprès
              du propriétaire, sans intermédiaire ni frais de plateforme, pour
              préparer votre séjour dans les Pyrénées en toute simplicité. Une
              solution idéale pour les voyageurs recherchant un hébergement
              authentique proche de Saint-Lary, Loudenvielle, Peyragudes, Val
              Louron, du Néouvielle et du Mont-Perdu.
            </p>
            <br></br>
            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
              }}
            >
              Sur 3 niveaux, elle offre un séjour avec cuisine entièrement
              équipée, une chambre parentale avec balcon ensoleillé, une salle
              de bain, des WC séparés et une chambre sous combles avec deux lits
              jumeaux.
            </p>

            <p
              style={{
                lineHeight: "1.9",
                color: "#555",
              }}
            >
              Toutes les commodités sont accessibles à pied en moins de 3
              minutes : boulangerie, boucherie, pharmacie, librairie, bars,
              restaurants et commerces du village.
            </p>
          </div>

          <div
            style={{
              background: "#1f6f3d",
              color: "white",
              padding: "35px",
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
              En bref
            </h3>

            <div
              style={{
                display: "grid",
                gap: "18px",
              }}
            >
              <div>🏡 Maison rénovée sur 3 niveaux</div>
              <div>👨‍👩‍👧‍👦 Idéale pour 4 personnes</div>
              <div>🛏️ 2 chambres : 1 grand lit, 2 lits jumeaux</div>
              <div>☀️ Balcon exposé sud</div>
              <div>🚶 Commerces à pied</div>
              <div>⛷️ Situation centrale stratégique </div>
              <div>🚴 Hébergement idéal pour cyclistes</div>
              <div>🏍️ Accueil pratique pour motards</div>
              <div>🤝 Réservation directe propriétaire</div>
              <div>🐕 Animaux non acceptés</div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "45px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
            gap: "18px",
          }}
        >
          {[
            "Cuisine équipée",
            "Machine à laver",
            "Lave-vaisselle",
            "Mini congélateur",
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
            "Animaux non acceptés",
            "Réservation directe propriétaire",
            "Parking gratuit proche",
            "Impasse piétonne",
          ].map((item) => (
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
            href="/livret"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "16px 26px",
              borderRadius: "999px",
              background: "#eef7f0",
              color: "#1f6f3d",
              fontWeight: "700",
              textDecoration: "none",
              boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            }}
          >
            Consulter le livret d’accueil
          </a>

          <p
            style={{
              marginTop: "12px",
              color: "#666",
              lineHeight: "1.7",
            }}
          >
            Vous y trouverez toutes les informations utiles pour préparer votre séjour :
            fonctionnement du logement, bonnes adresses, activités et inventaire.
          </p>
        </div>
      </section>

      {/* GALERIE */}

      <section id="galerie" className="section">
        <h2>Galerie immersive</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
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
                boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
              }}
            >
              <img
                src={photo.src}
                alt={photo.caption}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                style={{
                  width: "100%",
                  height: "210px",
                  objectFit: "cover",
                  display: "block",
                  transition: "0.35s",
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
                  pointerEvents: "none",
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
        <h2>Avis voyageurs</h2>

        {/* AVIS DIRECTS SITE - désactivés temporairement, mais conservés dans le code */}

        {ENABLE_SITE_REVIEWS && (
        <div
          style={{
            background: "white",
            padding: "34px",
            borderRadius: "34px",
            boxShadow: "0 14px 40px rgba(0,0,0,0.08)",
            marginBottom: "34px",
          }}
        >
          <h3 style={{ marginBottom: "18px" }}>Avis clients La Maison Verte</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
              gap: "22px",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "3rem",
                  fontWeight: "700",
                  color: "#1f6f3d",
                }}
              >
                {publishedReviews.length > 0
                  ? `${getPublishedReviewAverage()}/5`
                  : "Vos avis"}
              </div>
              <p style={{ color: "#555", lineHeight: "1.7" }}>
                {publishedReviews.length > 0
                  ? `Basé sur ${publishedReviews.length} avis publiés sur le site.`
                  : "Les premiers avis directs seront bientôt affichés ici."}
              </p>
              <button
                type="button"
                onClick={() => setShowReviewForm(true)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#1f6f3d",
                  fontWeight: "700",
                  textDecoration: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: "1rem",
                }}
              >
                Laisser un avis →
              </button>
            </div>

            <div style={{ display: "grid", gap: "14px" }}>
              {publishedReviews.length === 0 ? (
                <p style={{ color: "#666", lineHeight: "1.7" }}>
                  Vous avez déjà séjourné à La Maison Verte ? Votre retour nous
                  aide beaucoup et rassure les futurs voyageurs.
                </p>
              ) : (
                publishedReviews.slice(0, 3).map((review) => (
                  <div
                    key={review.id}
                    style={{
                      background: "#f8fafc",
                      borderRadius: "20px",
                      padding: "18px",
                    }}
                  >
                    <div
                      style={{
                        color: "#f59e0b",
                        fontSize: "1.1rem",
                        marginBottom: "6px",
                      }}
                    >
                      {"★".repeat(Number(review.rating || 5))}
                    </div>
                    <p
                      style={{ margin: 0, color: "#334155", lineHeight: "1.6" }}
                    >
                      “{String(review.comment || "").slice(0, 180)}
                      {String(review.comment || "").length > 180 ? "…" : ""}”
                    </p>
                    <p
                      style={{
                        marginTop: "8px",
                        color: "#64748b",
                        fontSize: "0.9rem",
                      }}
                    >
                      {review.display_name ||
                        review.guest_first_name ||
                        "Voyageur"}
                      {review.stay_period ? ` · ${review.stay_period}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        )}

        {showReviewForm && (
          <div
            id="laisser-un-avis"
            style={{
              background: "white",
              padding: "34px",
              borderRadius: "34px",
              boxShadow: "0 14px 40px rgba(0,0,0,0.08)",
              marginBottom: "44px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                alignItems: "center",
              }}
            >
              <h3>Laisser un avis</h3>
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  borderRadius: "999px",
                  padding: "9px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Fermer
              </button>
            </div>
            <p
              style={{ color: "#555", lineHeight: "1.7", marginBottom: "22px" }}
            >
              Vous avez déjà séjourné à La Maison Verte ? Vous pouvez laisser un
              commentaire. Il sera publié uniquement après validation.
            </p>

            {reviewSubmitted && (
              <div
                style={{
                  background: "#eef7f0",
                  border: "1px solid #cde8d2",
                  borderRadius: "22px",
                  padding: "22px",
                  marginBottom: "24px",
                }}
              >
                <h4 style={{ marginTop: 0, color: "#1f6f3d" }}>Merci beaucoup pour votre retour.</h4>
                <p style={{ color: "#334155", lineHeight: "1.7" }}>
                  Votre avis a bien été enregistré et sera relu avant publication.
                  Si vous disposez d'un compte Google, vous pouvez également partager
                  votre expérience sur Google. Cela nous aide énormément à faire
                  connaître La Maison Verte.
                </p>
                <a
                  href={googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button"
                  style={{ textDecoration: "none", display: "inline-block" }}
                >
                  Donner aussi un avis Google
                </a>
              </div>
            )}

            <form onSubmit={submitGuestReview}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                  gap: "14px",
                }}
              >
                <input
                  value={reviewFirstName}
                  onChange={(event) => setReviewFirstName(event.target.value)}
                  placeholder="Prénom *"
                  style={{
                    padding: "15px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
                  }}
                />
                <input
                  value={reviewLastName}
                  onChange={(event) => setReviewLastName(event.target.value)}
                  placeholder="Nom (facultatif)"
                  style={{
                    padding: "15px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
                  }}
                />
                <input
                  type="email"
                  value={reviewEmail}
                  onChange={(event) => setReviewEmail(event.target.value)}
                  placeholder="Email (non publié)"
                  style={{
                    padding: "15px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
                  }}
                />
                <input
                  value={reviewPhone}
                  onChange={(event) => setReviewPhone(event.target.value)}
                  placeholder="Téléphone (non publié)"
                  style={{
                    padding: "15px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
                  }}
                />
                <select
                  value={reviewRating}
                  onChange={(event) => setReviewRating(event.target.value)}
                  style={{
                    padding: "15px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
                  }}
                >
                  <option value="5">5 étoiles</option>
                  <option value="4">4 étoiles</option>
                  <option value="3">3 étoiles</option>
                  <option value="2">2 étoiles</option>
                  <option value="1">1 étoile</option>
                </select>
                <input
                  value={reviewStayPeriod}
                  onChange={(event) => setReviewStayPeriod(event.target.value)}
                  placeholder="Période du séjour (ex : février 2026)"
                  style={{
                    padding: "15px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
                  }}
                />
              </div>

              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="Votre commentaire *"
                style={{
                  width: "100%",
                  minHeight: "130px",
                  marginTop: "14px",
                  padding: "15px",
                  borderRadius: "16px",
                  border: "1px solid #ddd",
                  resize: "vertical",
                  fontSize: "15px",
                }}
              />

              <label
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                  marginTop: "16px",
                  color: "#334155",
                  lineHeight: "1.6",
                }}
              >
                <input
                  type="checkbox"
                  checked={reviewConsent}
                  onChange={(event) => setReviewConsent(event.target.checked)}
                  style={{ marginTop: "5px", transform: "scale(1.2)" }}
                />
                <span>
                  J’autorise La Maison Verte à publier mon prénom, ma note et
                  mon commentaire sur le site. Mon email et mon téléphone ne
                  seront pas affichés.
                </span>
              </label>

              <button
                className="button"
                type="submit"
                disabled={reviewSubmitting}
                style={{
                  marginTop: "22px",
                  opacity: reviewSubmitting ? 0.6 : 1,
                }}
              >
                {reviewSubmitting ? "Envoi en cours..." : "Envoyer mon avis"}
              </button>
            </form>
          </div>
        )}

        {/* NOTES PLATEFORMES */}

        <div id="notes">
          <h3
            style={{
              marginBottom: "34px",
            }}
          >
            Un établissement très apprécié des voyageurs
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: "24px",
            }}
          >
            <div
              style={{
                background: "white",
                padding: "32px",
                borderRadius: "30px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                transition: "0.3s",
              }}
            >
              <h3>Google</h3>

              <div
                style={{
                  fontSize: "3rem",
                  fontWeight: "700",
                  color: "#1f6f3d",
                }}
              >
                ★★★★★
              </div>

              <p>
                Votre avis Google nous aide énormément. Les premiers avis Google
                apparaîtront prochainement.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                <a
                  href={googleProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#1f6f3d",
                    fontWeight: "600",
                    textDecoration: "none",
                  }}
                >
                  Voir la fiche →
                </a>
                <a
                  href={googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#1f6f3d",
                    fontWeight: "600",
                    textDecoration: "none",
                  }}
                >
                  Donner un avis →
                </a>
              </div>
            </div>

            <a
              href="https://www.booking.com/hotel/fr/la-maison-verte-arreau.fr.html#tab-reviews"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  background: "white",
                  padding: "32px",
                  borderRadius: "30px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  transition: "0.3s",
                  cursor: "pointer",
                }}
              >
                <h3>Booking.com</h3>

                <div
                  style={{
                    fontSize: "3rem",
                    fontWeight: "700",
                    color: "#1f6f3d",
                  }}
                >
                  9,5/10
                </div>

                <p>Basé sur 44 expériences vécues</p>

                <div
                  style={{
                    marginTop: "16px",
                    color: "#1f6f3d",
                    fontWeight: "600",
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
                color: "inherit",
              }}
            >
              <div
                style={{
                  background: "white",
                  padding: "32px",
                  borderRadius: "30px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  transition: "0.3s",
                  cursor: "pointer",
                }}
              >
                <h3>Airbnb</h3>

                <div
                  style={{
                    fontSize: "3rem",
                    fontWeight: "700",
                    color: "#1f6f3d",
                  }}
                >
                  4,89/5
                </div>

                <p>Basé sur 9 évaluations voyageurs</p>

                <div
                  style={{
                    marginTop: "16px",
                    color: "#1f6f3d",
                    fontWeight: "600",
                  }}
                >
                  Voir les avis →
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}

      <section id="faq" className="section">
        <h2>Questions fréquentes</h2>

        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          {faqCategories.map((category, categoryIndex) => (
            <div
              key={category.title}
              style={{
                background: "white",
                borderRadius: "22px",
                marginBottom: "18px",
                boxShadow: "0 8px 25px rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenFaqCategory(
                    openFaqCategory === categoryIndex ? null : categoryIndex,
                  )
                }
                style={{
                  width: "100%",
                  border: "none",
                  background: "white",
                  padding: "24px",
                  textAlign: "left",
                  fontSize: "1.15rem",
                  fontWeight: "700",
                  color: "#2f4f35",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{category.title}</span>
                <span>{openFaqCategory === categoryIndex ? "−" : "+"}</span>
              </button>

              {openFaqCategory === categoryIndex && (
                <div
                  style={{
                    padding: "0 18px 18px",
                  }}
                >
                  {category.items.map((item, index) => {
                    const itemKey = `${categoryIndex}-${index}`;

                    return (
                      <div
                        key={item.question}
                        style={{
                          background: "#f8f8f8",
                          borderRadius: "14px",
                          marginBottom: "10px",
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenFaqIndex(
                              openFaqIndex === itemKey ? null : itemKey,
                            )
                          }
                          style={{
                            width: "100%",
                            border: "none",
                            background: "#f8f8f8",
                            padding: "18px",
                            textAlign: "left",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{item.question}</span>

                          <span>{openFaqIndex === itemKey ? "−" : "+"}</span>
                        </button>

                        {openFaqIndex === itemKey && (
                          <div
                            style={{
                              padding: "0 18px 18px",
                              color: "#555",
                              lineHeight: "1.8",
                            }}
                          >
                            {item.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* RESERVATION */}

      <section id="reservation" className="section">
        <h2>Réserver votre séjour</h2>

        <p
          style={{
            textAlign: "center",
            color: "#666",
            marginBottom: "45px",
          }}
        >
          Sélectionnez vos dates d'arrivée et de départ.
          <br />
          Après acceptation de votre demande, un lien de paiement sécurisé, valable 24h, vous sera envoyé par email.
          <br />
          Votre réservation sera confirmée après règlement de l'acompte.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "30px",
            alignItems: "start",
            maxWidth: "980px",
            margin: "0 auto",
          }}
        >
          {/* CALENDRIER */}

          <div
            className="calendar-wrapper"
            style={{
              maxWidth: "920px",
              width: "100%",
              margin: "0 auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "35px",
              }}
            >
              <button className="button" onClick={previousMonth}>
                ←
              </button>

              <h3
                style={{
                  color: "#1f6f3d",
                  textTransform: "capitalize",
                  fontSize: "1.6rem",
                }}
              >
                {currentMonth.toLocaleDateString("fr-FR", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>

              <button className="button" onClick={nextMonth}>
                →
              </button>
            </div>

            {/* JOURS */}

            <div
              className="calendar"
              style={{
                marginBottom: "12px",
              }}
            >
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                <div
                  key={day}
                  style={{
                    textAlign: "center",
                    fontWeight: "700",
                    color: "#1f6f3d",
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* DATES */}

            <div className="calendar">
              {days.map((day, index) => {
                if (!day) {
                  return <div key={index}></div>;
                }

                const key = formatLocalDate(day);

                const todayKey = formatLocalDate(new Date());

                const isPastDate = key < todayKey;

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
                      pointerEvents: "auto",
                    }}
                  >
                    <div
                      style={{
                        pointerEvents: "none",
                      }}
                    >
                      <div>{day.getDate()}</div>

                      {!unavailableDates.includes(key) && (
                        <div
                          style={{
                            marginTop: "6px",
                            fontSize: "0.8rem",
                            opacity: 0.7,
                          }}
                        >
                          {pricingLoaded ? `${getPriceForDate(key)}€` : "..."}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARTE RESERVATION */}

          <div
            id="formulaire-reservation"
            ref={bookingFormRef}
            style={{
              width: "100%",
              maxWidth: "1000px",
              margin: "0 auto",
              scrollMarginTop: "110px",
            }}
          >
            <div
              style={{
                background: "white",
                padding: "35px",
                borderRadius: "35px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    fontSize: "2rem",
                    fontWeight: "700",
                  }}
                >
                  À partir de {defaultPrice}€
                  <span
                    style={{
                      fontSize: "1rem",
                      color: "#666",
                    }}
                  >
                    / nuit
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "14px",
                  marginBottom: "18px",
                }}
              >
                <input
                  type="text"
                  placeholder="Date d’arrivée sélectionnée"
                  value={selectedDates[0] || ""}
                  readOnly
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
                  }}
                />

                <input
                  type="text"
                  placeholder="Date de départ sélectionnée"
                  value={selectedDates[1] || ""}
                  readOnly
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
                  }}
                />

                <p
                  style={{
                    gridColumn: "1 / -1",
                    color: canRequestBooking ? "#1f6f3d" : "#9a5a2e",
                    background: canRequestBooking ? "#eef7f0" : "#fff3e8",
                    padding: "14px",
                    borderRadius: "16px",
                    fontSize: "0.95rem",
                    lineHeight: "1.5",
                    margin: 0,
                  }}
                >
                  {reservationMessage}
                </p>

                <input
                  ref={guestFirstNameRef}
                  type="text"
                  placeholder="Votre prénom"
                  value={guestFirstName}
                  onChange={(e) => setGuestFirstName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
                  }}
                />

                <input
                  type="text"
                  placeholder="Votre nom"
                  value={guestLastName}
                  onChange={(e) => setGuestLastName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
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
                    }}
                  />

                  {guestEmail !== "" && !isEmailValid && (
                    <div
                      style={{
                        color: "#d33",
                        fontSize: "0.85rem",
                        marginTop: "8px",
                      }}
                    >
                      Adresse email invalide.
                    </div>
                  )}
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
                    }}
                  />

                  {guestPhone !== "" && !isPhoneValid && (
                    <div
                      style={{
                        color: "#d33",
                        fontSize: "0.85rem",
                        marginTop: "8px",
                      }}
                    >
                      Numéro de téléphone invalide.
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  marginBottom: "16px",
                  padding: "16px",
                  borderRadius: "16px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontWeight: "700",
                    color: "#1f6f3d",
                    marginBottom: "12px",
                  }}
                >
                  Voyageurs
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: "12px",
                    alignItems: "end",
                  }}
                >
                  <label
                    style={{
                      display: "grid",
                      gap: "6px",
                      color: "#334155",
                      fontSize: "0.9rem",
                    }}
                  >
                    Adultes
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={guestAdults}
                      onChange={(event) => setGuestAdults(event.target.value)}
                      style={{
                        width: "100%",
                        padding: "14px",
                        borderRadius: "14px",
                        border: "1px solid #d1d5db",
                      }}
                    />
                  </label>

                  <label
                    style={{
                      display: "grid",
                      gap: "6px",
                      color: "#334155",
                      fontSize: "0.9rem",
                    }}
                  >
                    Enfants
                    <input
                      type="number"
                      min="0"
                      max="4"
                      value={guestChildren}
                      onChange={(event) => setGuestChildren(event.target.value)}
                      style={{
                        width: "100%",
                        padding: "14px",
                        borderRadius: "14px",
                        border: "1px solid #d1d5db",
                      }}
                    />
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "#334155",
                      lineHeight: "1.5",
                      paddingBottom: "13px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={babyBedNeeded}
                      onChange={(event) => setBabyBedNeeded(event.target.checked)}
                    />
                    Lit bébé / bébé à prévoir
                  </label>
                </div>

                {childrenCount > 0 && (
                  <input
                    type="text"
                    placeholder="Âge des enfants : ex. 4 ans, 8 ans"
                    value={childrenAges}
                    onChange={(event) => setChildrenAges(event.target.value)}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "14px",
                      border: childrenAges.trim()
                        ? "1px solid #d1d5db"
                        : "1px solid #d33",
                      marginTop: "12px",
                    }}
                  />
                )}

                {!isGuestCompositionValid && (
                  <div
                    style={{
                      color: "#d33",
                      fontSize: "0.85rem",
                      marginTop: "10px",
                    }}
                  >
                    Indiquez entre 1 et 4 voyageurs. Si des enfants sont
                    présents, précisez leurs âges.
                  </div>
                )}
              </div>

              <textarea
                value={guestMessage}
                onChange={(event) => setGuestMessage(event.target.value)}
                placeholder="Message optionnel : arrivée tardive, question particulière, ancien client, promo..."
                style={{
                  width: "100%",
                  minHeight: "120px",
                  marginBottom: "16px",
                  padding: "14px",
                  borderRadius: "16px",
                  border: "1px solid #d1d5db",
                  fontSize: "15px",
                  resize: "vertical",
                }}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "14px",
                  alignItems: "stretch",
                  marginBottom: "18px",
                }}
              >
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "16px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      cursor: "pointer",
                      lineHeight: "1.55",
                      color: "#334155",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      style={{
                        marginTop: "4px",
                        transform: "scale(1.2)",
                      }}
                    />
                    <span>
                      J’accepte de recevoir occasionnellement des nouvelles,
                      offres et informations de La Maison Verte (vos données restent confidentielles).
                    </span>
                  </label>
                </div>

                <div className="contract-acceptance-box" style={{ margin: 0 }}>
                  <label className="contract-acceptance-label">
                    <input
                      type="checkbox"
                      checked={contractAccepted}
                      onChange={(e) => setContractAccepted(e.target.checked)}
                      className="contract-acceptance-checkbox"
                    />

                    <span className="contract-acceptance-text">
                      J’ai lu et j’accepte le{" "}
                      <a
                        href="/documents/contrat-location.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contract-link"
                      >
                        contrat de location
                        <br />
                        et les conditions générales
                        <br />
                        de réservation
                      </a>.
                    </span>
                  </label>
                </div>

                <a
                  href="https://lamaisonverte65.fr/livret"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    padding: "16px",
                    borderRadius: "16px",
                    background: "#eef7f0",
                    border: "1px solid #cde8d2",
                    color: "#1f6f3d",
                    textDecoration: "none",
                    fontWeight: "700",
                    lineHeight: "1.5",
                  }}
                >
                  Préparer votre séjour
                  <br />
                  <span
                    style={{
                      color: "#475569",
                      fontWeight: "400",
                      fontSize: "0.9rem",
                    }}
                  >
                    Consulter le livret d’accueil
                  </span>
                </a>
              </div>

              <button
                className="button"
                disabled={!canSubmitRequest || bookingSubmitting}
                onClick={submitBookingRequest}
                style={{
                  width: "100%",
                  padding: "18px",
                  fontSize: "1rem",
                  fontWeight: "700",
                  opacity: canSubmitRequest && !bookingSubmitting ? 1 : 0.55,
                  cursor: canSubmitRequest && !bookingSubmitting ? "pointer" : "not-allowed",
                }}
              >
                {bookingSubmitting ? "Envoi en cours..." : "Faire une demande de réservation"}
              </button>

              <div
                style={{
                  marginTop: "30px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <span>Séjour x {numberOfNights} nuits</span>

                  <span>
                    {pricingLoaded && accommodationTotal > 0
                      ? `${accommodationTotal}€`
                      : "..."}
                  </span>
                </div>

                <hr
                  style={{
                    margin: "18px 0",
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: "700",
                    fontSize: "1.2rem",
                  }}
                >
                  <span>Total estimatif</span>

                  <span>
                    {pricingLoaded && total > 0 ? `${total}€` : "..."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ACTIVITES */}

      <section id="activites" className="section">
        <h2>Activités & expériences</h2>

        <p
          style={{
            textAlign: "center",
            maxWidth: "780px",
            margin: "0 auto 55px",
            lineHeight: "1.8",
            color: "#555",
          }}
        >
          Profitez de la centralité unique d'Arreau pour vous offir une
          multitude d'activités possibles. Au coeur d'un cadre naturel
          exceptionnel, organisez votre séjour sportif, culturel, récréatif ou
          bien-être selon vos envies.
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
            boxShadow: "0 20px 60px rgba(0,0,0,0.14)",
          }}
        >
          <div>
            <h3
              style={{
                color: "white",
                marginBottom: "16px",
              }}
            >
              Offre hiver : logement + cours de ski
            </h3>

            <p
              style={{
                lineHeight: "1.8",
                opacity: 0.95,
                marginBottom: "20px",
              }}
            >
              En hiver, combinez votre séjour à La Maison Verte avec des cours
              de ski et de snowboard personnalisés sur la station de Peyragudes
              avec un moniteur de ski diplômé.
            </p>

            <strong>
              Tarif préférentiel : jusqu’à 15% de réduction sur le logement pour
              une formule séjour + cours de ski. Nous contacter pour plus
              d'information.
            </strong>
          </div>

          <img
            src="/activite-ski.webp"
            alt="Cours de ski dans les Pyrénées"
            style={{
              width: "100%",
              height: "220px",
              objectFit: "cover",
              borderRadius: "28px",
            }}
          />
        </div>

        {/* CARTES ACTIVITES */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: "28px",
          }}
        >
          {[
            {
              title: "Nature & randonnées",
              image: "/activite-randonnee.webp",
              alt: "Randonnée dans les Pyrénées et réserve du Néouvielle",
              text: "Lacs d’altitude, panoramas exceptionnels au coeur du massif, depuis un «3000» ou un sommet surplombant le piémont, Parcs Nationaux des Pyrénées et d'Ordessa, réserve du Néouvielle, circuits avec nuités en refuge : une destination idéale pour découvrir les Pyrénées, respirer l'air pur des montagnes, se ressourcer.",
              links: [
                {
                  label: "Réserve du Néouvielle",
                  url: "https://www.visit-neouvielle.com/",
                },
                {
                  label: "Parc National Pyrénées",
                  url: "https://www.pyrenees-parcnational.fr/",
                },
                {
                  label: "Pyrénées 2 Vallées",
                  url: "https://www.pyrenees2vallees.com/la-randonnee-%C3%A0-pyrenees2vall%C3%A9es",
                },
                {
                  label: "Parc national d'Ordessa Mont Perdu",
                  url: "https://www.turismodearagon.com/fr/ficha/ordesa-y-monte-perdido/",
                },
                {
                  label: "Randonnée et activités outdoor",
                  url: "https://www.agence-outdoor.fr",
                },
                {
                  label: "Cabanes et refuges",
                  url: "https://www.pyrenees-refuges.com/",
                },
                {
                  label: "Guide de hte montagne",
                  url: "http://pierre.guide.free.fr/",
                },
              ],
            },
            {
              title: "Vélo & cols mythiques",
              image: "/activite-velo.webp",
              alt: "Cyclisme dans les cols des Hautes-Pyrénées",
              text: "Partez à la découverte des grands cols pyrénéens : Aspin, Peyresourde, Tourmalet, Hourquette d'Ancizan, Portet et Azet : un terrain de jeu rêvé pour les cyclistes. Dévalez en VTT les pistes de la Coupe du Monde Mountain Bike UCI de la vallée du Louron, mais aussi celles en vallée d'Aure et de la Zona Zero en Espagne.",
              links: [
                {
                  label: "Route des cols",
                  url: "https://www.tourisme-hautes-pyrenees.com/montagne-ete/velo/ascensions-cols-pyrenees/grande-route-cols/",
                },
                {
                  label: "Cols, cartes et profils",
                  url: "https://climbfinder.com/fr/carte#lnglat=0.359832/42.905098&position=11.22/42.905098/0.359832",
                },
                {
                  label: "Louron Bike & Trail",
                  url: "https://louronbikeandtrail.com/fr",
                },
                {
                  label: "VTT Aure Louron ",
                  url: "https://www.pyrenees2vallees.com/vtt",
                },
                {
                  label: "VTT Ainsa - Zona Zero ",
                  url: "https://zonazeropirineos.com/fr/",
                },
              ],
            },
            {
              title: "Eau vive & sensations",
              image: "/activite-eauvive.webp",
              alt: "Rafting canyoning eau vive dans les Pyrénées",
              text: "Descente en rafting de la Neste d'Aure, canyon sportif sur les flancs du Mont Perdu ou ludique dans les eaux turquoises de la Sierra de Guara, via ferrata, activités sportives familiales ou sensationnelles pour ajouter une dose d’aventure à votre séjour.",
              links: [
                {
                  label: "Rafting et Canyoning",
                  url: "https://pyragua.com/",
                },
                {
                  label: "Canyon Sierra de Guara",
                  url: "https://www.canyonsierradeguara.com/",
                },
                {
                  label: "Activités Louron",
                  url: "https://www.vallee-du-louron.com/fr/activites-2",
                },
                {
                  label: "Activités vallée d'Aure",
                  url: "https://www.tourisme-hautes-pyrenees.com/montagne-ete/lieux-de-sejour/saint-lary-et-la-vallee-aure/",
                },
                {
                  label: "Activités Piémont",
                  url: "https://coeurdespyrenees.com/office-de-tourisme-lannemezan-et-capvern/je-suis-touriste/",
                },
                {
                  label: "Baronnies - Barousse",
                  url: "https://tourisme-neste-barousse.fr/",
                },
                {
                  label: "Parapente",
                  url: "https://virevolte.net/",
                },
              ],
            },
            {
              title: "Bien-être & découvertes",
              image: "/activite-detente.webp",
              alt: "Balnéa Loudenvielle détente et patrimoine",
              text: "Après une journée en montagne, profitez d'un moment de détente à Balnéa, découvrez les villages pyrénéens, Saint-Lary, Loudenvielle, le patrimoine architectural, la gastronomie locale ou une escapade vers l’Espagne.",
              links: [
                {
                  label: "Balnéa",
                  url: "https://www.balnea.fr/",
                },
                {
                  label: "Arreau",
                  url: "https://www.mairie-arreau.fr/",
                },
                {
                  label: "Le patrimoine des vallées d’Aure et du Louron",
                  url: "https://patrimoine-aure-louron.fr/notre-patrimoine/focus-sur-les-monuments-incontournables/",
                },
                {
                  label: "Gastronomie et producteurs locaux",
                  url: "https://www.hapy-saveurs.com/",
                },
                {
                  label: "Infos locales",
                  url: "https://www.scoop.it.pyrenees-aure-louron.eu/",
                },
                {
                  label: "Le marché d'Arreau",
                  url: "https://www.paysdesnestes.fr/marche-de-arreau/",
                },
              ],
            },
          ].map((activity) => (
            <div
              key={activity.title}
              style={{
                background: "white",
                borderRadius: "32px",
                overflow: "hidden",
                boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
                transition: "0.35s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow =
                  "0 22px 55px rgba(0,0,0,0.13)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
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
                  objectFit: "cover",
                }}
              />

              <div
                style={{
                  padding: "28px",
                }}
              >
                <h3
                  style={{
                    marginBottom: "14px",
                  }}
                >
                  {activity.title}
                </h3>

                <p
                  style={{
                    lineHeight: "1.8",
                    color: "#555",
                    marginBottom: "24px",
                  }}
                >
                  {activity.text}
                </p>

                <details
                  style={{
                    marginTop: "18px",
                  }}
                >
                  <summary
                    style={{
                      color: "#1f6f3d",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    Liens utiles
                  </summary>

                  <div
                    style={{
                      display: "grid",
                      gap: "10px",
                      marginTop: "16px",
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
                          fontWeight: "500",
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

        <div
          style={{
            textAlign: "center",
            maxWidth: "900px",
            margin: "60px auto 0",
            padding: "0 24px",
          }}
        >
          <h3
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(2rem, 4vw, 2.8rem)",
              color: "#2f4f35",
              marginBottom: "16px",
              fontWeight: "600",
            }}
          >
            Découvrir la vallée d'Aure
          </h3>

          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: "1.8",
              color: "#555",
              maxWidth: "750px",
              margin: "0 auto 28px",
            }}
          >
            Stations de ski, cols mythiques des Pyrénées, lacs du Néouvielle,
            randonnées, patrimoine, villages de montagne et bien-être :
            découvrez notre guide complet pour préparer votre séjour à Arreau et
            explorer les incontournables de la vallée d'Aure.
          </p>

          <a
            href="/guide-vallees-aure-louron"
            style={{
              display: "inline-block",
              padding: "16px 34px",
              background: "#2f4f35",
              color: "white",
              borderRadius: "999px",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "1rem",
              boxShadow: "0 8px 25px rgba(47,79,53,0.25)",
              transition: "all 0.3s ease",
            }}
          >
            Voir le guide complet →
          </a>
        </div>

      </section>

      {/* METEO + CARTE */}

      <section id="meteo" className="section">
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

      {/* CONTACT */}

      <section id="contact" className="section">
        <div
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

          {/* TELEPHONE CLIQUABLE */}

          <div
            style={{
              textAlign: "center",
              marginBottom: "34px",
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
                boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
              }}
            >
              📞 06 63 07 63 14
            </a>
          </div>

          {/* BANNIERE CONTACT */}
          <a   href="mailto:lamaisonverte65@gmail.com"  title="Cliquez pour nous envoyer un email">   
          <img
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
            style={{
              textAlign: "center",
              marginTop: "34px",
            }}
          >
            <a
              href="https://www.google.com/maps?q=3+Impasse+Trassens+65240+Arreau"
              target="_blank"
              rel="noopener noreferrer"
              className="button"
              style={{
                textDecoration: "none",
              }}
            >
              Ouvrir dans Google Maps
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}

      <footer
        style={{
          background: "#1f6f3d",
          color: "white",
          padding: "54px 24px 42px",
          textAlign: "center",
        }}
      >
        

        <div
          
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "14px 22px",
              background: "transparent",
            }}
          >
            {[
              ["Livret d'accueil", "/livret"],
              ["Contrat & conditions de réservation", "/documents/contrat-location.pdf"],
              ["Mentions légales", "/mentions-legales"],
              ["Politique de confidentialité", "/politique-confidentialite"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                target={href.endsWith(".pdf") ? "_blank" : undefined}
                rel={href.endsWith(".pdf") ? "noopener noreferrer" : undefined}
                style={{
                  color: "rgba(255,255,255,0.92)",
                  textDecoration: "none",
                  background: "transparent",
                }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
        <br/>
        <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.8 }}>
          © 2026 La Maison Verte
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
            padding: "30px",
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
              cursor: "pointer",
            }}
          >
            ×
          </button>

          <button
            onClick={() =>
              setCurrentImageIndex(
                currentImageIndex === 0
                  ? galleryPhotos.length - 1
                  : currentImageIndex - 1,
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
              cursor: "pointer",
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
              boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
            }}
          />

          <button
            onClick={() =>
              setCurrentImageIndex(
                currentImageIndex === galleryPhotos.length - 1
                  ? 0
                  : currentImageIndex + 1,
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
              cursor: "pointer",
            }}
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}
