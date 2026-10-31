import "../components/home/homeResponsive.css";
import { HomeHero } from "../components/home/HomeHero";
import { HomePresentation } from "../components/home/HomePresentation";
import { HomeGallery } from "../components/home/HomeGallery";
import { HomeFaq } from "../components/home/HomeFaq";
import { HomeActivities } from "../components/home/HomeActivities";
import { HomeWeather } from "../components/home/HomeWeather";
import { HomeContact } from "../components/home/HomeContact";
import { galleryPhotos, faqCategories, faqSchema } from "../components/home/homeContent";
import { getHomeSecondaryCopy, localizeFaqCategories } from "../components/home/homeSecondaryTranslations.js";
import { getGuestReviewDisplay, localizeGuestReviewStayPeriod } from "../components/home/guestReviewTranslations.js";
import { getBookingFormCopy, interpolateBookingCopy, formatBookingMoney, formatBookingCalendarMoney, localizeBookingFailure } from "../components/home/bookingFormTranslations.js";
import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { getHomeSeo, HOME_ALTERNATES } from "../components/home/homeSeo.js";
import { submitPublicBooking } from "../utils/publicBookingSubmission";
import { isDepartureOnlyDate, selectionContainsUnavailableNight } from "../utils/publicCalendarSelection";
import PublicNavigation from "../components/PublicNavigation";
import { guestLanguageFromUrl } from "../../shared/guestLocale.js";
import { localizePublicHref } from "../../shared/publicSiteLocale.js";

const createEmptyAdditionalContact = (language = "fr") => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  postalCode: "",
  city: "",
  country: language === "fr" ? "France" : "",
});

function normalizeContactPhone(value) {
  const text = String(value ?? "").trim();
  const digits = text.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return `+33${digits.slice(1)}`;
  if (text.startsWith("+") && digits.startsWith("33")) return `+${digits}`;
  if (digits.startsWith("0033")) return `+33${digits.slice(4)}`;
  return digits;
}

export default function MaisonVerte() {
  const siteLanguage = typeof window === "undefined" ? "fr" : guestLanguageFromUrl(window.location.href);
  const reviewCopy = getHomeSecondaryCopy(siteLanguage)?.reviews;
  const homeSeo = getHomeSeo(siteLanguage);
  const bookingCopy = getBookingFormCopy(siteLanguage);
  // PDFs publics traduits ; les contrats versionnés déjà attachés aux réservations restent inchangés.
  const contractPdfHref = siteLanguage === "en"
    ? "/documents/contrat-location-en.pdf"
    : siteLanguage === "es"
      ? "/documents/contrat-location-es.pdf"
      : "/documents/contrat-location.pdf";
  const bookingText = (template, values) => interpolateBookingCopy(template, values);
  const bookingMoney = (amount) => formatBookingMoney(amount, siteLanguage);
  const bookingCalendarMoney = (amount) => formatBookingCalendarMoney(amount, siteLanguage);
  const bookingFeeMoney = (amount) => siteLanguage === "fr" ? `${amount} €` : bookingMoney(amount);
  const bookingDisplayDate = (value) => {
    if (!value || siteLanguage === "fr") return value || "";
    return new Intl.DateTimeFormat(siteLanguage === "es" ? "es-ES" : "en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }).format(parseLocalDate(value));
  };
  const visibleFaqCategories = localizeFaqCategories(faqCategories, siteLanguage);
  const [selectedDates, setSelectedDates] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [departureOnlyDates, setDepartureOnlyDates] = useState([]);
  const [pricingRules, setPricingRules] = useState({
    defaultNightPrice: null,
    seasonPrices: [],
    priceOverrides: [],
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestPostalCode, setGuestPostalCode] = useState("");
  const [guestCity, setGuestCity] = useState("");
  const [guestCountry, setGuestCountry] = useState(() => siteLanguage === "fr" ? "France" : "");
  const [additionalContacts, setAdditionalContacts] = useState([]);
  const [guestAdults, setGuestAdults] = useState("2");
  const [guestChildren, setGuestChildren] = useState("0");
  const [childrenAges, setChildrenAges] = useState("");
  const [babyBedNeeded, setBabyBedNeeded] = useState(false);
  const [cleaningOption, setCleaningOption] = useState(true);
  const [payFullNow, setPayFullNow] = useState(false);
  const [cleaningObligationsAccepted, setCleaningObligationsAccepted] = useState(false);
  const [cleaningFee, setCleaningFee] = useState(null);
  const [promotionCode, setPromotionCode] = useState("");
  const [bookingQuote, setBookingQuote] = useState(null);
  const [bookingQuoteLoading, setBookingQuoteLoading] = useState(false);
  const [guestMessage, setGuestMessage] = useState("");
  const [bookingWebsite, setBookingWebsite] = useState("");
  const [contractAccepted, setContractAccepted] = useState(false);
  const [publishedReviews, setPublishedReviews] = useState([]);
  const [reviewFirstName, setReviewFirstName] = useState("");
  const [reviewLastName, setReviewLastName] = useState("");
  const [reviewEmail, setReviewEmail] = useState("");
  const [reviewPhone, setReviewPhone] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewStayPeriod, setReviewStayPeriod] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState(null);
  const bookingSubmitLockRef = useRef(false);
  const [bookingValidationErrors, setBookingValidationErrors] = useState([]);
  const [bookingValidationAttempted, setBookingValidationAttempted] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const bookingFormRef = useRef(null);
  const bookingErrorRef = useRef(null);
  const guestFirstNameRef = useRef(null);
  const guestLastNameRef = useRef(null);
  const guestEmailRef = useRef(null);
  const guestPhoneRef = useRef(null);
  const guestAddressRef = useRef(null);
  const guestPostalCodeRef = useRef(null);
  const guestCityRef = useRef(null);
  const guestCountryRef = useRef(null);
  const childrenAgesRef = useRef(null);
  const contractAcceptedRef = useRef(null);
  const [openFaqCategory, setOpenFaqCategory] = useState(null);
  const googleReviewUrl = "https://g.page/r/CasA-_8IxkGjEBM/review";
  const googleProfileUrl = "https://g.page/r/CasA-_8IxkGjEBM";
  const ENABLE_SITE_REVIEWS = true;
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

  async function fetchCalendar() {
    try {
      const response = await fetch("/.netlify/functions/calendar");

      if (!response.ok) throw new Error("Calendrier indisponible.");
      const data = await response.json();

      setUnavailableDates(data.unavailableDates || []);
      setDepartureOnlyDates(data.departureOnlyDates || []);

      setPricingRules({
        defaultNightPrice: Number(data.defaultNightPrice ?? 80),
        seasonPrices: data.seasonPrices || [],
        priceOverrides: data.priceOverrides || [],
      });
    } catch (error) {
      console.error("Erreur calendrier :", error);
    }
  }

  useEffect(() => {
    fetchCalendar();
  }, []);

  useEffect(() => {
    async function fetchCleaningFee() {
      try {
        const response = await fetch("/.netlify/functions/get-pricing", { cache: "no-store" });
        if (!response.ok) throw new Error("Tarification indisponible.");
        const data = await response.json();
        const value = Number(data.cleaningFee);
        if (!Number.isInteger(value) || value < 0) throw new Error("Forfait ménage invalide.");
        setCleaningFee(value);
      } catch (error) {
        console.error("Erreur forfait ménage :", error);
        setCleaningFee(null);
      }
    }

    fetchCleaningFee();
  }, []);

  useEffect(() => {
    if (selectedDates.length !== 2 || cleaningFee === null || Number(guestAdults || 0) < 1 || Number(guestAdults || 0) + Number(guestChildren || 0) > 4) {
      setBookingQuote(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBookingQuoteLoading(true);
      try {
        const response = await fetch("/.netlify/functions/booking-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: selectedDates[0],
            endDate: selectedDates[1],
            adultsCount: Number(guestAdults || 0),
            childrenCount: Number(guestChildren || 0),
            cleaningOption,
            promotionCode: promotionCode.trim(),
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Calcul du séjour indisponible.");
        setBookingQuote(await response.json());
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("Erreur calcul séjour :", error);
          setBookingQuote(null);
        }
      } finally {
        if (!controller.signal.aborted) setBookingQuoteLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedDates, guestAdults, guestChildren, cleaningOption, cleaningFee, promotionCode]);

  useEffect(() => {
    async function fetchPublishedReviews() {
      try {
        const response = await fetch("/.netlify/functions/public-reviews");
        if (!response.ok) throw new Error("Avis indisponibles.");
        const data = await response.json();
        setPublishedReviews(data.reviews || []);
      } catch (error) {
        console.error("Erreur avis publiés :", error);
      }
    }

    fetchPublishedReviews();
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

    const isUnavailable = unavailableDates.includes(key);
    const isDepartureOnly = isDepartureOnlyDate(
      key,
      unavailableDates,
      departureOnlyDates
    );

    if (isUnavailable && !(selectedDates.length === 1 && isDepartureOnly)) {
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

    // La date de départ n'est pas une nuit occupée : seule la plage [arrivée, départ[ est contrôlée.
    if (selectionContainsUnavailableNight(realStart, end, unavailableDates)) {
      alert(bookingCopy.unavailableDates);
      setSelectedDates([]);
      setContractAccepted(false);
      return;
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
      ? bookingCopy.selectDates
      : numberOfNights < minimumNights
        ? bookingText(bookingCopy.minimumStay, { nights: minimumNights })
        : activeStayRule
          ? bookingCopy.busyPeriod
          : bookingCopy.enterContact;

  const canRequestBooking =
    selectedDates.length === 2 && numberOfNights >= minimumNights;

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_PATTERN = /^[+\d][\d\s().-]{5,31}$/;

  function getRequiredTextError(value, label, maxLength, showRequired = bookingValidationAttempted) {
    const text = String(value ?? "").trim();
    if (!text) return showRequired ? bookingText(bookingCopy.errorRequired, { field: label }) : "";
    if (text.length > maxLength) return bookingText(bookingCopy.errorTooLong, { field: label, max: maxLength });
    return "";
  }

  function getEmailError(value, showRequired = bookingValidationAttempted) {
    const text = String(value ?? "").trim();
    if (!text) return showRequired ? bookingCopy.errorEmailRequired : "";
    if (text.length > 254 || !EMAIL_PATTERN.test(text)) return bookingCopy.errorEmailInvalid;
    return "";
  }

  function getPhoneError(value, showRequired = bookingValidationAttempted) {
    const text = String(value ?? "").trim();
    if (!text) return showRequired ? bookingCopy.errorPhoneRequired : "";
    if (text.length > 32 || !PHONE_PATTERN.test(text)) return bookingCopy.errorPhoneInvalid;
    return "";
  }

  const mainContactErrors = {
    firstName: getRequiredTextError(guestFirstName, bookingCopy.fieldFirstName, 80),
    lastName: getRequiredTextError(guestLastName, bookingCopy.fieldLastName, 80),
    email: getEmailError(guestEmail),
    phone: getPhoneError(guestPhone),
    address: getRequiredTextError(guestAddress, bookingCopy.fieldAddress, 200),
    postalCode: getRequiredTextError(guestPostalCode, bookingCopy.fieldPostalCode, 20),
    city: getRequiredTextError(guestCity, bookingCopy.fieldCity, 100),
    country: getRequiredTextError(guestCountry, bookingCopy.fieldCountry, 100),
  };

  const isEmailValid = mainContactErrors.email === "" && guestEmail.trim() !== "";
  const isPhoneValid = mainContactErrors.phone === "" && guestPhone.trim() !== "";

  function getAdditionalContactFieldErrors(contact, index, showRequired = bookingValidationAttempted) {
    const email = String(contact.email ?? "").trim().toLowerCase();
    const phone = normalizeContactPhone(contact.phone);
    const previousContacts = additionalContacts.slice(0, index);
    const emailDuplicate = Boolean(email) && (
      email === guestEmail.trim().toLowerCase()
      || previousContacts.some((candidate) => candidate.email.trim().toLowerCase() === email)
    );
    const phoneDuplicate = Boolean(phone) && (
      phone === normalizeContactPhone(guestPhone)
      || previousContacts.some((candidate) => normalizeContactPhone(candidate.phone) === phone)
    );

    const emailError = getEmailError(contact.email, showRequired);
    const phoneError = getPhoneError(contact.phone, showRequired);

    return {
      firstName: getRequiredTextError(contact.firstName, bookingCopy.fieldFirstName, 80, showRequired),
      lastName: getRequiredTextError(contact.lastName, bookingCopy.fieldLastName, 80, showRequired),
      email: emailError || (emailDuplicate ? bookingCopy.errorEmailDuplicate : ""),
      phone: phoneError || (phoneDuplicate ? bookingCopy.errorPhoneDuplicate : ""),
      address: contact.address.trim().length > 200 ? bookingText(bookingCopy.errorTooLong, { field: bookingCopy.fieldAddress, max: 200 }) : "",
      postalCode: contact.postalCode.trim().length > 20 ? bookingText(bookingCopy.errorTooLong, { field: bookingCopy.fieldPostalCode, max: 20 }) : "",
      city: contact.city.trim().length > 100 ? bookingText(bookingCopy.errorTooLong, { field: bookingCopy.fieldCity, max: 100 }) : "",
      country: contact.country.trim().length > 100 ? bookingText(bookingCopy.errorTooLong, { field: bookingCopy.fieldCountry, max: 100 }) : "",
    };
  }

  const areAdditionalContactsValid = additionalContacts.every((contact, index) => {
    const errors = getAdditionalContactFieldErrors(contact, index, true);
    return Object.values(errors).every((message) => !message);
  });

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
    guestAddress.trim() !== "" &&
    guestPostalCode.trim() !== "" &&
    guestCity.trim() !== "" &&
    guestCountry.trim() !== "" &&
    areAdditionalContactsValid &&
    isGuestCompositionValid;

  const canSubmitRequest =
    canRequestBooking &&
    isFormValid &&
    contractAccepted &&
    cleaningFee !== null &&
    bookingQuote !== null &&
    !bookingQuoteLoading &&
    (cleaningOption || cleaningObligationsAccepted);

  const displayedAccommodationTotal = bookingQuote?.accommodationGross ?? accommodationTotal;
  const touristTaxAmount = bookingQuote?.touristTax ?? 0;
  const total = bookingQuote?.total ?? (accommodationTotal + (cleaningOption ? Number(cleaningFee || 0) : 0));
  const depositRate = Number(bookingQuote?.depositRate ?? 0);
  const depositAmount = bookingQuote
    ? Number(bookingQuote.depositAmount || 0)
    : 0;
  const depositPercent = Math.round(depositRate * 100);
  const balanceAmount = Math.round((total - depositAmount) * 100) / 100;
  const daysBeforeArrival = selectedDates.length === 2
    ? Math.ceil((parseLocalDate(selectedDates[0]) - parseLocalDate(formatLocalDate(new Date()))) / 86400000)
    : null;
  const canChooseFullPayment = daysBeforeArrival !== null && daysBeforeArrival > 30;
  const daysUntilBalanceRequest = canChooseFullPayment ? daysBeforeArrival - 30 : null;

  function addAdditionalContact() {
    setAdditionalContacts((contacts) => (
      contacts.length >= 4 ? contacts : [...contacts, createEmptyAdditionalContact(siteLanguage)]
    ));
  }

  function updateAdditionalContact(index, field, value) {
    setAdditionalContacts((contacts) => contacts.map((contact, contactIndex) => (
      contactIndex === index ? { ...contact, [field]: value } : contact
    )));
  }

  function removeAdditionalContact(index) {
    setAdditionalContacts((contacts) => contacts.filter((_, contactIndex) => contactIndex !== index));
  }

  function previousMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
  }

  function getBookingValidationErrors() {
    const errors = [];

    if (selectedDates.length !== 2) {
      errors.push({
        message: bookingCopy.selectDates,
        ref: bookingFormRef,
      });
    } else if (numberOfNights < minimumNights) {
      errors.push({
        message: bookingText(bookingCopy.errorStayMinimum, { nights: minimumNights }),
        ref: bookingFormRef,
      });
    }

    const requiredContactChecks = [
      [getRequiredTextError(guestFirstName, bookingCopy.fieldFirstName, 80, true), guestFirstNameRef],
      [getRequiredTextError(guestLastName, bookingCopy.fieldLastName, 80, true), guestLastNameRef],
      [getEmailError(guestEmail, true), guestEmailRef],
      [getPhoneError(guestPhone, true), guestPhoneRef],
      [getRequiredTextError(guestAddress, bookingCopy.fieldAddress, 200, true), guestAddressRef],
      [getRequiredTextError(guestPostalCode, bookingCopy.fieldPostalCode, 20, true), guestPostalCodeRef],
      [getRequiredTextError(guestCity, bookingCopy.fieldCity, 100, true), guestCityRef],
      [getRequiredTextError(guestCountry, bookingCopy.fieldCountry, 100, true), guestCountryRef],
    ];
    for (const [message, ref] of requiredContactChecks) {
      if (message) errors.push({ message, ref });
    }

    additionalContacts.forEach((contact, index) => {
      const label = bookingText(bookingCopy.contactNumber, { number: index + 2 });
      const contactErrors = getAdditionalContactFieldErrors(contact, index, true);
      for (const message of Object.values(contactErrors)) {
        if (message) errors.push({ message: `${label} : ${message}`, ref: bookingFormRef });
      }
    });

    if (!isGuestCompositionValid) {
      errors.push({
        message:
          childrenCount > 0 && childrenAges.trim() === ""
            ? bookingCopy.errorChildrenAges
            : bookingCopy.errorGuestCount,
        ref: childrenCount > 0 ? childrenAgesRef : bookingFormRef,
      });
    }

    if (!contractAccepted) {
      errors.push({
        message: bookingCopy.errorContract,
        ref: contractAcceptedRef,
      });
    }

    return errors;
  }

  async function submitBookingRequest() {
    if (bookingSubmitLockRef.current || bookingSubmitting) {
      return;
    }

    setBookingValidationAttempted(true);
    const validationErrors = getBookingValidationErrors();

    if (validationErrors.length > 0) {
      setBookingValidationErrors(validationErrors.map((error) => error.message));

      setTimeout(() => {
        bookingErrorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        const firstErrorRef = validationErrors[0]?.ref;
        firstErrorRef?.current?.focus?.({ preventScroll: true });
      }, 100);

      return;
    }

    setBookingValidationErrors([]);
    bookingSubmitLockRef.current = true;
    setBookingSubmitting(true);

    try {
      const outcome = await submitPublicBooking({
        guestFirstName: guestFirstName.trim(),
        guestLastName: guestLastName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        guestAddress: guestAddress.trim(),
        guestPostalCode: guestPostalCode.trim(),
        guestCity: guestCity.trim(),
        guestCountry: guestCountry.trim(),
        additionalContacts: additionalContacts.map((contact) => ({
          firstName: contact.firstName.trim(),
          lastName: contact.lastName.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim(),
          address: contact.address.trim(),
          postalCode: contact.postalCode.trim(),
          city: contact.city.trim(),
          country: contact.country.trim(),
        })),
        adultsCount,
        childrenCount,
        childrenAges: childrenAges.trim(),
        babyBedNeeded,
        cleaningOption,
        cleaningObligationsAccepted,
        paymentPreference: canChooseFullPayment && payFullNow ? "full" : "deposit",
        guestMessage,
        communicationLanguage: guestLanguageFromUrl(window.location.href),
        startDate: selectedDates[0],
        endDate: selectedDates[1],
        nights: numberOfNights,
        accommodationTotal,
        promotionCode: promotionCode.trim(),
        marketingConsent,
        contractAccepted,
        website: bookingWebsite,
      });

      if (!outcome.success) {
        if (outcome.kind === "date_conflict") {
          setSelectedDates([]);
          setContractAccepted(false);
          if (outcome.refreshCalendar) await fetchCalendar();
        }
        setBookingValidationErrors([localizeBookingFailure(outcome.kind, siteLanguage, outcome.message)]);
        setTimeout(() => bookingErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
        return;
      }

      setBookingConfirmation({
        confirmationPending: Boolean(outcome.confirmationPending),
        additionalContactsPending: Boolean(outcome.additionalContactsPending),
      });

      setGuestFirstName("");
      setGuestLastName("");
      setPromotionCode("");
      setBookingQuote(null);

      setGuestEmail("");
      setGuestPhone("");
      setGuestAddress("");
      setGuestPostalCode("");
      setGuestCity("");
      setGuestCountry(siteLanguage === "fr" ? "France" : "");
      setAdditionalContacts([]);
      setGuestAdults("2");
      setGuestChildren("0");
      setChildrenAges("");
      setBabyBedNeeded(false);
      setPayFullNow(false);
      setMarketingConsent(false);
      setGuestMessage("");
      setBookingWebsite("");

      setSelectedDates([]);
      setContractAccepted(false);
      setBookingValidationErrors([]);
      setBookingValidationAttempted(false);

    } catch (err) {
      console.error(err);
      setBookingValidationErrors([bookingCopy.errorUnexpected]);
    } finally {
      bookingSubmitLockRef.current = false;
      setBookingSubmitting(false);
    }
  }

  function getPublishedReviewAverage() {
    if (!publishedReviews.length) return null;
    const total = publishedReviews.reduce(
      (sum, review) => sum + Number(review.rating || 0),
      0,
    );
    const average = (total / publishedReviews.length).toFixed(1);
    return siteLanguage === "en" ? average : average.replace(".", ",");
  }

  async function submitGuestReview(event) {
    event.preventDefault();
    setReviewSubmitted(false);

    const rating = Number(reviewRating);
    if (!reviewFirstName.trim()) {
      alert(reviewCopy?.alertFirstName || "Merci d’indiquer votre prénom.");
      return;
    }
    if (!rating || rating < 1 || rating > 5) {
      alert(reviewCopy?.alertRating || "Merci de sélectionner une note entre 1 et 5.");
      return;
    }
    if (!reviewComment.trim()) {
      alert(reviewCopy?.alertComment || "Merci d’écrire un petit commentaire.");
      return;
    }

    setReviewSubmitting(true);
    try {
      const response = await fetch("/.netlify/functions/submit-guest-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: reviewFirstName.trim(),
          lastName: reviewLastName.trim(),
          email: reviewEmail.trim(),
          phone: reviewPhone.trim(),
          rating,
          comment: reviewComment.trim(),
          stayPeriod: reviewStayPeriod.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(reviewCopy?.errorSending || data.error || "Erreur lors de l’envoi de l’avis.");

      setReviewSubmitted(true);
      setReviewFirstName("");
      setReviewLastName("");
      setReviewEmail("");
      setReviewPhone("");
      setReviewRating("5");
      setReviewComment("");
      setReviewStayPeriod("");
    } catch (error) {
      console.error(error);
      alert(siteLanguage === "fr" ? (error.message || "Erreur lors de l’envoi de l’avis. Vous pouvez aussi nous l’envoyer par email.") : reviewCopy?.errorFallback);
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <>
      <Helmet htmlAttributes={{ lang: siteLanguage }}>
        <title>{homeSeo.title}</title>
        <meta name="description" content={homeSeo.description} />
        <link rel="canonical" href={homeSeo.canonical} />
        <link rel="alternate" hrefLang="fr" href={HOME_ALTERNATES.fr} />
        <link rel="alternate" hrefLang="en" href={HOME_ALTERNATES.en} />
        <link rel="alternate" hrefLang="es" href={HOME_ALTERNATES.es} />
        <link rel="alternate" hrefLang="x-default" href={HOME_ALTERNATES["x-default"]} />
        <meta property="og:title" content={homeSeo.ogTitle} />
        <meta property="og:description" content={homeSeo.ogDescription} />
        <meta property="og:image" content="https://lamaisonverte65.fr/hero.webp" />
        <meta property="og:url" content={homeSeo.canonical} />
        <meta property="og:locale" content={homeSeo.ogLocale} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="La Maison Verte" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={homeSeo.ogTitle} />
        <meta name="twitter:description" content={homeSeo.twitterDescription} />
        <meta name="twitter:image" content="https://lamaisonverte65.fr/hero.webp" />

        {/* FAVICONS */}

        <link rel="icon" type="image/x-icon" href="/favicon.ico" />

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
              "Meublé de tourisme classé 3 étoiles à Arreau, proche de Saint-Lary, Loudenvielle, Peyragudes, Val Louron et de la réserve du Néouvielle. Une maison rénovée pour 4 personnes, avec réservation directe auprès du propriétaire, au cœur des Pyrénées.",
            starRating: {
              "@type": "Rating",
              ratingValue: 3,
              bestRating: 5,
            },
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
            telephone: "+33695938315",
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
                  name: "Wi-Fi 7",
                  value: true,
                },
                {
                  "@type": "LocationFeatureSpecification",
                  name: "Cuisine équipée",
                  value: true,
                },
                {
                  "@type": "LocationFeatureSpecification",
                  name: "Balcon sud-ouest",
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
            priceRange: `À partir de ${defaultPrice}€ par nuit`,
          })}
        </script>

        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>



      {bookingConfirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-confirmation-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "rgba(20, 30, 22, 0.62)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              background: "white",
              borderRadius: "28px",
              padding: "30px",
              boxShadow: "0 24px 70px rgba(0,0,0,0.24)",
              textAlign: "center",
            }}
          >
            <h2 id="booking-confirmation-title" style={{ marginTop: 0, color: "#1f6f3d" }}>
              {bookingCopy.confirmationTitle}
            </h2>

            {bookingConfirmation.confirmationPending ? (
              <p style={{ lineHeight: "1.7", color: "#444" }}>
                {bookingCopy.confirmationPending}
              </p>
            ) : (
              <>
                <p style={{ lineHeight: "1.7", color: "#444" }}>
                  {bookingCopy.confirmationEmail}
                </p>
                <p style={{ lineHeight: "1.7", color: "#444" }}>
                  <strong>{bookingCopy.confirmationSpamTitle}</strong>{" "}
                  {bookingCopy.confirmationSpamHelp}
                </p>
                <p style={{ lineHeight: "1.7", color: "#444" }}>
                  {bookingCopy.confirmationPayment}{" "}<strong>24 h</strong>.
                </p>
              </>
            )}

            {bookingConfirmation.additionalContactsPending && (
              <p style={{ lineHeight: "1.7", color: "#8a5a00", background: "#fff7df", padding: "12px", borderRadius: "14px" }}>
                {bookingCopy.confirmationAdditionalContacts}
              </p>
            )}

            <button
              type="button"
              className="button"
              onClick={() => {
                setBookingConfirmation(null);
                window.location.reload();
              }}
              style={{ marginTop: "10px", border: "none", cursor: "pointer", fontSize: "1rem" }}
            >
              {bookingCopy.confirmationClose}
            </button>
          </div>
        </div>
      )}

      {/* NAVIGATION PUBLIQUE */}
      <PublicNavigation solid={false} />

      {/* HERO PREMIUM */}

<HomeHero />


      {/* PRESENTATION + EQUIPEMENTS */}

      <HomePresentation />

      {/* GALERIE */}

      <HomeGallery galleryPhotos={galleryPhotos} setCurrentImageIndex={setCurrentImageIndex} setLightboxOpen={setLightboxOpen} />

      {/* AVIS */}

      <section id="avis" className="section">
        <h2>{reviewCopy?.title || "Avis voyageurs"}</h2>

        {/* AVIS DIRECTS SITE - désactivés temporairement, mais conservés dans le code */}

        {ENABLE_SITE_REVIEWS && (
        <div
          style={{
            background: "white",
            padding: "22px 28px",
            borderRadius: "34px",
            boxShadow: "0 14px 40px rgba(0,0,0,0.08)",
            marginBottom: "26px",
          }}
        >
          <p
            style={{
              margin: "0 0 16px",
              color: "#555",
              lineHeight: "1.5",
              textAlign: "center",
            }}
          >
            {reviewCopy?.introduction || "Vous avez déjà séjourné à La Maison Verte ? Votre retour nous aide beaucoup et rassure les futurs voyageurs."}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
              gap: "16px",
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
                  : (reviewCopy?.noReviewsHeading || "Vos avis")}
              </div>
              {publishedReviews.length > 0 && (
                <p style={{ color: "#555", lineHeight: "1.7" }}>
                  {reviewCopy?.siteReviewsCount?.(publishedReviews.length) || `Basé sur ${publishedReviews.length} avis publiés sur le site.`}
                </p>
              )}
            </div>

            <div style={{ display: "grid", gap: "14px" }}>
              {publishedReviews.length === 0 ? (
                <div>
                  <p style={{ color: "#555", lineHeight: "1.7", marginTop: 0 }}>
                    {reviewCopy?.noReviews || "Les premiers avis directs seront bientôt affichés ici."}
                  </p>
                </div>
              ) : (
                publishedReviews.slice(0, 3).map((review) => {
                  const displayedReview = getGuestReviewDisplay(review.comment, siteLanguage);
                  return (
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
                      “{displayedReview.text}”
                    </p>
                    {displayedReview.translated && (
                      <details style={{ marginTop: "8px", color: "#64748b", fontSize: "0.82rem" }}>
                        <summary style={{ cursor: "pointer" }}>
                          {siteLanguage === "es" ? "Extracto traducido del francés · Ver original" : "Excerpt translated from French · View original"}
                        </summary>
                        <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>“{displayedReview.original}”</p>
                      </details>
                    )}
                    <p
                      style={{
                        marginTop: "8px",
                        color: "#64748b",
                        fontSize: "0.9rem",
                      }}
                    >
                      {review.display_name ||
                        review.guest_first_name ||
                        (reviewCopy?.traveler || "Voyageur")}
                      {review.stay_period ? ` · ${localizeGuestReviewStayPeriod(review.stay_period, siteLanguage)}` : ""}
                    </p>
                  </div>
                  );
                })
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowReviewForm(true);
              setTimeout(() => document.getElementById("laisser-un-avis")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
            }}
            style={{
              display: "inline-block",
              marginTop: "20px",
              padding: "12px 20px",
              border: "none",
              borderRadius: "999px",
              background: "#1f6f3d",
              color: "white",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {reviewCopy?.leaveOnSite || "Laisser un avis sur notre site →"}
          </button>
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
              <h3>{reviewCopy?.formTitle || "Laisser un avis"}</h3>
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
                {reviewCopy?.close || "Fermer"}
              </button>
            </div>
            <p
              style={{ color: "#555", lineHeight: "1.7", marginBottom: "22px" }}
            >
              {reviewCopy?.formIntro || `Vous avez déjà séjourné à La Maison Verte ? Vous pouvez laisser un
              commentaire. Il sera publié uniquement après validation.`}
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
                <h4 style={{ marginTop: 0, color: "#1f6f3d" }}>{reviewCopy?.thankYou || "Merci beaucoup pour votre retour."}</h4>
                <p style={{ color: "#334155", lineHeight: "1.7" }}>
                  {reviewCopy?.submitted || `Votre avis a bien été enregistré et sera relu avant publication.
                  Si vous disposez d'un compte Google, vous pouvez également partager
                  votre expérience sur Google. Cela nous aide énormément à faire
                  connaître La Maison Verte.`}
                </p>
                <a
                  href={googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button"
                  style={{ textDecoration: "none", display: "inline-block" }}
                >
                  {reviewCopy?.alsoGoogle || "Donner aussi un avis Google"}
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
                  placeholder={reviewCopy?.firstName || "Prénom *"}
                  style={{
                    padding: "15px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
                  }}
                />
                <input
                  value={reviewLastName}
                  onChange={(event) => setReviewLastName(event.target.value)}
                  placeholder={reviewCopy?.lastName || "Nom (facultatif)"}
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
                  placeholder={reviewCopy?.email || "Email (non publié)"}
                  style={{
                    padding: "15px",
                    borderRadius: "16px",
                    border: "1px solid #ddd",
                  }}
                />
                <input
                  value={reviewPhone}
                  onChange={(event) => setReviewPhone(event.target.value)}
                  placeholder={reviewCopy?.phone || "Téléphone (non publié)"}
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
                  <option value="5">{reviewCopy?.stars?.(5) || "5 étoiles"}</option>
                  <option value="4">{reviewCopy?.stars?.(4) || "4 étoiles"}</option>
                  <option value="3">{reviewCopy?.stars?.(3) || "3 étoiles"}</option>
                  <option value="2">{reviewCopy?.stars?.(2) || "2 étoiles"}</option>
                  <option value="1">{reviewCopy?.stars?.(1) || "1 étoile"}</option>
                </select>
                <input
                  value={reviewStayPeriod}
                  onChange={(event) => setReviewStayPeriod(event.target.value)}
                  placeholder={reviewCopy?.stayPeriod || "Période du séjour (ex : février 2026)"}
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
                placeholder={reviewCopy?.comment || "Votre commentaire *"}
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

              <p
                style={{
                  marginTop: "16px",
                  color: "#64748b",
                  lineHeight: "1.6",
                  fontSize: "0.92rem",
                }}
              >
                {reviewCopy?.publicationConsent || `En envoyant cet avis, vous acceptez sa publication sur le site de
                La Maison Verte après validation. Seuls votre prénom, votre note et
                votre commentaire pourront être affichés ; votre email et votre
                téléphone resteront privés.`}
              </p>

              <button
                className="button"
                type="submit"
                disabled={reviewSubmitting}
                style={{
                  marginTop: "22px",
                  opacity: reviewSubmitting ? 0.6 : 1,
                }}
              >
                {reviewSubmitting ? (reviewCopy?.sending || "Envoi en cours...") : (reviewCopy?.send || "Envoyer mon avis")}
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
            {reviewCopy?.ratingsTitle || "Un établissement très apprécié des voyageurs"}
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
                <strong>{reviewCopy?.googleCount || "5,0/5 · 3 avis Google"}</strong>
                <br />
                {reviewCopy?.googleThanks || "Merci aux voyageurs qui ont déjà partagé leur expérience."}
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
                  {reviewCopy?.viewProfile || "Voir la fiche →"}
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
                  {reviewCopy?.giveReview || "Donner un avis →"}
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

                <p>{reviewCopy?.bookingCount || "Basé sur 50 expériences vécues"}</p>

                <div
                  style={{
                    marginTop: "16px",
                    color: "#1f6f3d",
                    fontWeight: "600",
                  }}
                >
                  {reviewCopy?.viewReviews || "Voir les avis →"}
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

                <p>{reviewCopy?.airbnbCount || "Basé sur 9 évaluations voyageurs"}</p>

                <div
                  style={{
                    marginTop: "16px",
                    color: "#1f6f3d",
                    fontWeight: "600",
                  }}
                >
                  {reviewCopy?.viewReviews || "Voir les avis →"}
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}

      <HomeFaq language={siteLanguage} faqCategories={visibleFaqCategories} setOpenFaqCategory={setOpenFaqCategory} openFaqCategory={openFaqCategory} setOpenFaqIndex={setOpenFaqIndex} openFaqIndex={openFaqIndex} />

      {/* RESERVATION */}

      <section id="reservation" className="section">
        <h2>{bookingCopy.title}</h2>

        <p
          style={{
            textAlign: "center",
            color: "#666",
            marginBottom: "45px",
          }}
        >
          {bookingCopy.intro1}
          <br />
          {bookingCopy.intro2}
          <br />
          {bookingCopy.intro3}
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
                {currentMonth.toLocaleDateString(siteLanguage === "es" ? "es-ES" : siteLanguage === "en" ? "en-GB" : "fr-FR", {
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
              {bookingCopy.weekdays.map((day) => (
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
                      isPastDate ||
                      (unavailableDates.includes(key) &&
                        !departureOnlyDates.includes(key))
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

                      {(!unavailableDates.includes(key) ||
                        departureOnlyDates.includes(key)) && (
                        <div
                          style={{
                            marginTop: "6px",
                            fontSize: "0.8rem",
                            opacity: 0.7,
                          }}
                        >
                          {pricingLoaded ? bookingCalendarMoney(getPriceForDate(key)) : "..."}
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
                  {bookingCopy.from} {bookingMoney(defaultPrice)}
                  <span
                    style={{
                      fontSize: "1rem",
                      color: "#666",
                    }}
                  >
                    {bookingCopy.perNight}
                  </span>
                </div>
              </div>

              <div
                className="booking-guest-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "14px",
                  marginBottom: "18px",
                }}
              >
                <input
                  type="text"
                  placeholder={bookingCopy.arrival}
                  value={bookingDisplayDate(selectedDates[0])}
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
                  placeholder={bookingCopy.departure}
                  value={bookingDisplayDate(selectedDates[1])}
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

                <div
                  style={{
                    gridColumn: "1 / -1",
                    fontWeight: "700",
                    color: "#1f6f3d",
                    marginTop: "2px",
                  }}
                >
                  {bookingCopy.contact}
                </div>

                <div className="booking-field">
                  <input
                    ref={guestFirstNameRef}
                    type="text"
                    placeholder={bookingCopy.firstName}
                    value={guestFirstName}
                    onChange={(e) => setGuestFirstName(e.target.value)}
                    aria-invalid={mainContactErrors.firstName ? "true" : undefined}
                    style={{ width: "100%", padding: "16px", borderRadius: "16px", border: mainContactErrors.firstName ? "1px solid #d33" : "1px solid #ddd" }}
                  />
                  {mainContactErrors.firstName && <div className="booking-field-error">{mainContactErrors.firstName}</div>}
                </div>

                <div className="booking-field">
                  <input
                    ref={guestLastNameRef}
                    type="text"
                    placeholder={bookingCopy.lastName}
                    value={guestLastName}
                    onChange={(e) => setGuestLastName(e.target.value)}
                    aria-invalid={mainContactErrors.lastName ? "true" : undefined}
                    style={{ width: "100%", padding: "16px", borderRadius: "16px", border: mainContactErrors.lastName ? "1px solid #d33" : "1px solid #ddd" }}
                  />
                  {mainContactErrors.lastName && <div className="booking-field-error">{mainContactErrors.lastName}</div>}
                </div>

                <div className="booking-field">
                  <input
                    ref={guestEmailRef}
                    type="email"
                    placeholder={bookingCopy.email}
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    aria-invalid={mainContactErrors.email ? "true" : undefined}
                    style={{ width: "100%", padding: "16px", borderRadius: "16px", border: mainContactErrors.email ? "1px solid #d33" : "1px solid #ddd" }}
                  />
                  {mainContactErrors.email && <div className="booking-field-error">{mainContactErrors.email}</div>}
                </div>

                <div className="booking-field">
                  <input
                    ref={guestPhoneRef}
                    type="tel"
                    placeholder={bookingCopy.phone}
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    aria-invalid={mainContactErrors.phone ? "true" : undefined}
                    style={{ width: "100%", padding: "16px", borderRadius: "16px", border: mainContactErrors.phone ? "1px solid #d33" : "1px solid #ddd" }}
                  />
                  {mainContactErrors.phone && <div className="booking-field-error">{mainContactErrors.phone}</div>}
                </div>

                <div className="booking-field booking-field--wide">
                  <input
                    ref={guestAddressRef}
                    type="text"
                    autoComplete="street-address"
                    placeholder={bookingCopy.address}
                    value={guestAddress}
                    onChange={(e) => setGuestAddress(e.target.value)}
                    aria-invalid={mainContactErrors.address ? "true" : undefined}
                    style={{ width: "100%", padding: "16px", borderRadius: "16px", border: mainContactErrors.address ? "1px solid #d33" : "1px solid #ddd" }}
                  />
                  {mainContactErrors.address && <div className="booking-field-error">{mainContactErrors.address}</div>}
                </div>

                <div className="booking-field">
                  <input
                    ref={guestPostalCodeRef}
                    type="text"
                    autoComplete="postal-code"
                    placeholder={bookingCopy.postalCode}
                    value={guestPostalCode}
                    onChange={(e) => setGuestPostalCode(e.target.value)}
                    aria-invalid={mainContactErrors.postalCode ? "true" : undefined}
                    style={{ width: "100%", padding: "16px", borderRadius: "16px", border: mainContactErrors.postalCode ? "1px solid #d33" : "1px solid #ddd" }}
                  />
                  {mainContactErrors.postalCode && <div className="booking-field-error">{mainContactErrors.postalCode}</div>}
                </div>

                <div className="booking-field">
                  <input
                    ref={guestCityRef}
                    type="text"
                    autoComplete="address-level2"
                    placeholder={bookingCopy.city}
                    value={guestCity}
                    onChange={(e) => setGuestCity(e.target.value)}
                    aria-invalid={mainContactErrors.city ? "true" : undefined}
                    style={{ width: "100%", padding: "16px", borderRadius: "16px", border: mainContactErrors.city ? "1px solid #d33" : "1px solid #ddd" }}
                  />
                  {mainContactErrors.city && <div className="booking-field-error">{mainContactErrors.city}</div>}
                </div>

                <div className="booking-field booking-field--wide">
                  <input
                    ref={guestCountryRef}
                    type="text"
                    autoComplete="country-name"
                    placeholder={bookingCopy.country}
                    value={guestCountry}
                    onChange={(e) => setGuestCountry(e.target.value)}
                    aria-invalid={mainContactErrors.country ? "true" : undefined}
                    style={{ width: "100%", padding: "16px", borderRadius: "16px", border: mainContactErrors.country ? "1px solid #d33" : "1px solid #ddd" }}
                  />
                  {mainContactErrors.country && <div className="booking-field-error">{mainContactErrors.country}</div>}
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
                <div style={{ fontWeight: "700", color: "#1f6f3d", marginBottom: "6px" }}>
                  {bookingCopy.additional} <span style={{ fontWeight: "400", color: "#64748b" }}>{bookingCopy.optional}</span>
                </div>
                <p style={{ margin: "0 0 14px", color: "#64748b", lineHeight: "1.45", fontSize: "0.9rem" }}>
                  {bookingCopy.additionalHelp}
                </p>

                {additionalContacts.map((contact, index) => {
                  const contactErrors = getAdditionalContactFieldErrors(contact, index);
                  return (
                    <div
                      key={`additional-contact-${index}`}
                      style={{
                        padding: "14px",
                        marginBottom: "12px",
                        borderRadius: "14px",
                        border: "1px solid #d9e4dc",
                        background: "white",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", marginBottom: "12px" }}>
                        <strong style={{ color: "#334155" }}>{bookingText(bookingCopy.contactNumber, { number: index + 2 })}</strong>
                        <button
                          type="button"
                          onClick={() => removeAdditionalContact(index)}
                          style={{ border: "none", background: "transparent", color: "#a33", cursor: "pointer", textDecoration: "underline" }}
                        >
                          {bookingCopy.removeContact}
                        </button>
                      </div>

                      <div className="booking-additional-contact-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
                        <div className="booking-field">
                          <input type="text" placeholder={bookingCopy.firstNameRequired} value={contact.firstName} onChange={(event) => updateAdditionalContact(index, "firstName", event.target.value)} aria-invalid={contactErrors.firstName ? "true" : undefined} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: contactErrors.firstName ? "1px solid #d33" : "1px solid #d1d5db" }} />
                          {contactErrors.firstName && <div className="booking-field-error">{contactErrors.firstName}</div>}
                        </div>
                        <div className="booking-field">
                          <input type="text" placeholder={bookingCopy.lastNameRequired} value={contact.lastName} onChange={(event) => updateAdditionalContact(index, "lastName", event.target.value)} aria-invalid={contactErrors.lastName ? "true" : undefined} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: contactErrors.lastName ? "1px solid #d33" : "1px solid #d1d5db" }} />
                          {contactErrors.lastName && <div className="booking-field-error">{contactErrors.lastName}</div>}
                        </div>
                        <div className="booking-field">
                          <input type="email" placeholder={bookingCopy.emailRequired} value={contact.email} onChange={(event) => updateAdditionalContact(index, "email", event.target.value)} aria-invalid={contactErrors.email ? "true" : undefined} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: contactErrors.email ? "1px solid #d33" : "1px solid #d1d5db" }} />
                          {contactErrors.email && <div className="booking-field-error">{contactErrors.email}</div>}
                        </div>
                        <div className="booking-field">
                          <input type="tel" placeholder={bookingCopy.phoneRequired} value={contact.phone} onChange={(event) => updateAdditionalContact(index, "phone", event.target.value)} aria-invalid={contactErrors.phone ? "true" : undefined} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: contactErrors.phone ? "1px solid #d33" : "1px solid #d1d5db" }} />
                          {contactErrors.phone && <div className="booking-field-error">{contactErrors.phone}</div>}
                        </div>
                        <div className="booking-field booking-field--wide">
                          <input type="text" autoComplete="street-address" placeholder={bookingCopy.addressOptional} value={contact.address} onChange={(event) => updateAdditionalContact(index, "address", event.target.value)} aria-invalid={contactErrors.address ? "true" : undefined} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: contactErrors.address ? "1px solid #d33" : "1px solid #d1d5db" }} />
                          {contactErrors.address && <div className="booking-field-error">{contactErrors.address}</div>}
                        </div>
                        <div className="booking-field">
                          <input type="text" autoComplete="postal-code" placeholder={bookingCopy.postalOptional} value={contact.postalCode} onChange={(event) => updateAdditionalContact(index, "postalCode", event.target.value)} aria-invalid={contactErrors.postalCode ? "true" : undefined} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: contactErrors.postalCode ? "1px solid #d33" : "1px solid #d1d5db" }} />
                          {contactErrors.postalCode && <div className="booking-field-error">{contactErrors.postalCode}</div>}
                        </div>
                        <div className="booking-field">
                          <input type="text" autoComplete="address-level2" placeholder={bookingCopy.cityOptional} value={contact.city} onChange={(event) => updateAdditionalContact(index, "city", event.target.value)} aria-invalid={contactErrors.city ? "true" : undefined} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: contactErrors.city ? "1px solid #d33" : "1px solid #d1d5db" }} />
                          {contactErrors.city && <div className="booking-field-error">{contactErrors.city}</div>}
                        </div>
                        <div className="booking-field booking-field--wide">
                          <input type="text" autoComplete="country-name" placeholder={bookingCopy.countryOptional} value={contact.country} onChange={(event) => updateAdditionalContact(index, "country", event.target.value)} aria-invalid={contactErrors.country ? "true" : undefined} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: contactErrors.country ? "1px solid #d33" : "1px solid #d1d5db" }} />
                          {contactErrors.country && <div className="booking-field-error">{contactErrors.country}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {additionalContacts.length < 4 && (
                  <button
                    type="button"
                    onClick={addAdditionalContact}
                    style={{
                      border: "1px solid #1f6f3d",
                      background: "white",
                      color: "#1f6f3d",
                      borderRadius: "999px",
                      padding: "10px 16px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    {bookingCopy.addContact}
                  </button>
                )}
              </div>

              <div
                className="booking-travellers-card"
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
                  {bookingCopy.travellers}
                </div>

                <div
                  className="booking-travellers-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: "12px",
                    alignItems: "end",
                  }}
                >
                  <label
                    className="booking-traveller-count"
                    style={{
                      display: "grid",
                      gap: "6px",
                      color: "#334155",
                      fontSize: "0.9rem",
                    }}
                  >
                    {bookingCopy.adults}
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
                    className="booking-traveller-count"
                    style={{
                      display: "grid",
                      gap: "6px",
                      color: "#334155",
                      fontSize: "0.9rem",
                    }}
                  >
                    {bookingCopy.children}
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
                    className="booking-baby-bed-option"
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
                    {bookingCopy.babyBed}
                  </label>
                </div>

                <label
                  className="booking-cleaning-option"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    color: "#334155",
                    lineHeight: "1.5",
                    marginTop: "14px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={cleaningOption}
                    onChange={(event) => {
                      setCleaningOption(event.target.checked);
                      setCleaningObligationsAccepted(false);
                    }}
                    disabled={cleaningFee === null}
                    style={{ marginTop: "4px" }}
                  />
                  <span>
                    {bookingCopy.cleaningOption}
                    {cleaningFee !== null ? ` (+${bookingFeeMoney(cleaningFee)})` : ` ${bookingCopy.cleaningLoading}`}
                  </span>
                </label>

                {selectedDates.length === 2 && (
                  <div
                    style={{
                      marginTop: "18px",
                      padding: "16px",
                      border: "1px solid #d1d5db",
                      borderRadius: "14px",
                      background: "#f8fafc",
                      color: "#334155",
                      lineHeight: "1.55",
                    }}
                  >
                    <p style={{ margin: "0 0 10px" }}>
                      <strong>{bookingCopy.paymentTitle}</strong>
                    </p>
                    {canChooseFullPayment ? (
                      <>
                        <p style={{ margin: "0 0 12px" }}>
                          {bookingText(bookingCopy.depositInfo, {
                            percent: depositPercent,
                            days: daysUntilBalanceRequest,
                            plural: daysUntilBalanceRequest > 1 ? "s" : "",
                          })}
                        </p>
                        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={payFullNow}
                            onChange={(event) => setPayFullNow(event.target.checked)}
                            style={{ marginTop: "4px" }}
                          />
                          <span>{bookingCopy.fullPaymentChoice}</span>
                        </label>
                      </>
                    ) : (
                      <p style={{ margin: 0 }}>
                        {bookingCopy.fullPaymentRequired}
                      </p>
                    )}
                  </div>
                )}

                {!cleaningOption && cleaningFee !== null && (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "14px",
                      border: "1px solid #d6b56c",
                      borderRadius: "8px",
                      background: "#fffaf0",
                      color: "#334155",
                      lineHeight: "1.55",
                    }}
                  >
                    <p style={{ margin: "0 0 10px" }}>
                      <strong>{bookingCopy.cleaningWarning}</strong>
                    </p>
                    <p style={{ margin: "0 0 10px" }}>
                      {bookingCopy.cleaningDuties}
                    </p>
                    <p style={{ margin: "0 0 12px" }}>
                      {bookingText(bookingCopy.cleaningInspection, { fee: bookingFeeMoney(cleaningFee) })}
                    </p>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={cleaningObligationsAccepted}
                        onChange={(event) => setCleaningObligationsAccepted(event.target.checked)}
                        style={{ marginTop: "4px" }}
                      />
                      <span>
                        {bookingText(bookingCopy.cleaningConsent, { fee: bookingFeeMoney(cleaningFee) })}
                      </span>
                    </label>
                  </div>
                )}

                {childrenCount > 0 && (
                  <input
                    ref={childrenAgesRef}
                    type="text"
                    placeholder={bookingCopy.childrenAges}
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
                    {bookingCopy.childrenWarning}
                  </div>
                )}
              </div>

              <textarea
                value={guestMessage}
                onChange={(event) => setGuestMessage(event.target.value)}
                placeholder={bookingCopy.message}
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

              <label style={{ position: "absolute", left: "-10000px" }} aria-hidden="true">
                Site internet
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={bookingWebsite}
                  onChange={(event) => setBookingWebsite(event.target.value)}
                />
              </label>

              <div
                className="booking-consent-grid"
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
                      {bookingCopy.marketingConsent}
                    </span>
                  </label>
                </div>

                <div ref={contractAcceptedRef} className="contract-acceptance-box" style={{ margin: 0 }} tabIndex={-1}>
                  <label className="contract-acceptance-label">
                    <input
                      type="checkbox"
                      checked={contractAccepted}
                      onChange={(e) => setContractAccepted(e.target.checked)}
                      className="contract-acceptance-checkbox"
                    />

                    <span className="contract-acceptance-text">
                      {bookingCopy.contractPrefix}{" "}
                      <a
                        href={contractPdfHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contract-link"
                      >
                        {bookingCopy.contractLink}
                        <br />
                        {bookingCopy.contractTerms}
                        <br />
                        {bookingCopy.contractEnd}
                      </a>.
                      {bookingCopy.contractFrenchNotice && (
                        <small style={{ display: "block", marginTop: "5px" }}>{bookingCopy.contractFrenchNotice}</small>
                      )}
                    </span>
                  </label>
                </div>

                <a
                  href={`https://lamaisonverte65.fr${localizePublicHref("/livret", siteLanguage)}`}
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
                  {bookingCopy.bookletTitle}
                  <br />
                  <span
                    style={{
                      color: "#475569",
                      fontWeight: "400",
                      fontSize: "0.9rem",
                    }}
                  >
                    {bookingCopy.bookletLink}
                  </span>
                </a>
              </div>

              {bookingValidationErrors.length > 0 && (
                <div
                  ref={bookingErrorRef}
                  role="alert"
                  style={{
                    marginTop: "18px",
                    marginBottom: "16px",
                    padding: "16px",
                    borderRadius: "16px",
                    background: "#fff3e8",
                    border: "1px solid #f2c69d",
                    color: "#7a3f12",
                    lineHeight: "1.55",
                  }}
                >
                  <strong>{bookingCopy.validationTitle}</strong>
                  <div style={{ marginTop: "8px", marginBottom: "6px" }}>
                    {bookingCopy.validationHelp}
                  </div>
                  <ul style={{ margin: "0", paddingLeft: "20px" }}>
                    {bookingValidationErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {bookingSubmitting && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    marginTop: "18px",
                    marginBottom: "16px",
                    padding: "14px 16px",
                    borderRadius: "16px",
                    background: "#eef7f0",
                    border: "1px solid #cde8d2",
                    color: "#1f6f3d",
                    fontWeight: "700",
                    lineHeight: "1.5",
                  }}
                >
                  {bookingCopy.sendingNotice}
                </div>
              )}

              <div style={{ marginTop: "18px", marginBottom: "18px" }}>
                <label htmlFor="promotion-code" style={{ display: "block", fontWeight: "700", marginBottom: "6px" }}>
                  {bookingCopy.loyaltyCode}
                </label>
                <input
                  id="promotion-code"
                  type="text"
                  value={promotionCode}
                  onChange={(event) => setPromotionCode(event.target.value.toUpperCase())}
                  placeholder={bookingCopy.loyaltyPlaceholder}
                  maxLength={40}
                  autoComplete="off"
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
                {promotionCode.trim() && bookingQuote && (
                  <div style={{ marginTop: "6px", color: bookingQuote.promotionCode ? "#1f6f3d" : "#7a3f12" }}>
                    {bookingQuote.promotionCode
                      ? bookingText(bookingCopy.loyaltyApplied, { code: bookingQuote.promotionCode, amount: bookingFeeMoney(bookingQuote.promotionDiscount) })
                      : bookingCopy.loyaltyNotApplied}
                  </div>
                )}
              </div>

              <button
                className="button"
                disabled={bookingSubmitting}
                onClick={submitBookingRequest}
                style={{
                  width: "100%",
                  padding: "18px",
                  fontSize: "1rem",
                  fontWeight: "700",
                  opacity: bookingSubmitting ? 0.7 : 1,
                  cursor: bookingSubmitting ? "wait" : "pointer",
                }}
              >
                {bookingSubmitting ? bookingCopy.sendingButton : bookingCopy.submitButton}
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
                  <span>{bookingText(bookingCopy.stayLine, { nights: numberOfNights })}</span>

                  <span>
                    {pricingLoaded && displayedAccommodationTotal > 0
                      ? bookingMoney(displayedAccommodationTotal)
                      : "..."}
                  </span>
                </div>

                {bookingQuote?.promotionCode && bookingQuote.promotionDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", color: "#1f6f3d" }}>
                    <span>{bookingText(bookingCopy.discount, { code: bookingQuote.promotionCode })}</span>
                    <span>-{bookingMoney(bookingQuote.promotionDiscount)}</span>
                  </div>
                )}

                {bookingQuote && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span>{bookingCopy.tax}</span>
                    <span>{bookingMoney(touristTaxAmount)}</span>
                  </div>
                )}

                {cleaningOption && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                    }}
                  >
                    <span>{bookingCopy.cleaningFee}</span>
                    <span>{cleaningFee !== null ? bookingMoney(cleaningFee) : "..."}</span>
                  </div>
                )}

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
                  <span>{canChooseFullPayment && !payFullNow ? bookingCopy.total : bookingCopy.totalToPay}</span>

                  <span>
                    {pricingLoaded && total > 0 ? bookingMoney(total) : "..."}
                  </span>
                </div>

                {canChooseFullPayment && !payFullNow && pricingLoaded && total > 0 && (
                  <div style={{ marginTop: "14px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                        fontWeight: "700",
                        color: "#1f6f3d",
                      }}
                    >
                      <span>{bookingText(bookingCopy.depositToPay, { percent: depositPercent })}</span>
                      <span>{bookingMoney(depositAmount)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        color: "#555",
                      }}
                    >
                      <span>{bookingCopy.balance}</span>
                      <span>{bookingMoney(balanceAmount)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ACTIVITES */}

      <HomeActivities />

      {/* METEO + CARTE */}

      <HomeWeather />

      {/* CONTACT */}

      <HomeContact />

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
            {(siteLanguage === "en" ? [
              ["Welcome booklet", "/livret"],
              ["Rental agreement & booking terms", contractPdfHref],
              ["Legal notice", "/mentions-legales"],
              ["Privacy policy", "/politique-confidentialite"],
            ] : siteLanguage === "es" ? [
              ["Guía de bienvenida", "/livret"],
              ["Contrato y condiciones de reserva", contractPdfHref],
              ["Aviso legal", "/mentions-legales"],
              ["Política de privacidad", "/politique-confidentialite"],
            ] : [
              ["Livret d'accueil", "/livret"],
              ["Contrat & conditions de réservation", contractPdfHref],
              ["Mentions légales", "/mentions-legales"],
              ["Politique de confidentialité", "/politique-confidentialite"],
            ]).map(([label, href]) => (
              <a
                key={href}
                href={siteLanguage !== "fr" && ["/mentions-legales", "/politique-confidentialite"].includes(href)
                  ? `/${siteLanguage}${href}`
                  : localizePublicHref(href, siteLanguage)}
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
