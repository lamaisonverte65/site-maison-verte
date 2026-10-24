// Published testimonials remain exactly as submitted in the database.
// Only manually reviewed excerpts are translated for display. Do not infer
// missing text or send guest comments to a third-party translation service.
const APPROVED_EXCERPTS = [
  {
    originalPrefix: "Un séjour parfait en famille (2 adultes et 2 enfants)",
    en: "A perfect family stay (2 adults and 2 children)! The house was completely renovated very recently: the result feels both authentic and modern",
    es: "¡Una estancia perfecta en familia (2 adultos y 2 niños)! La casa se ha renovado por completo hace muy poco: el resultado es auténtico y moderno a la vez",
  },
];

const FRENCH_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
  "septembre", "octobre", "novembre", "décembre",
];

export function getGuestReviewDisplay(comment, language = "fr") {
  const original = String(comment ?? "");
  const normalized = original.normalize("NFC").replace(/\s+/g, " ").trim();
  const excerpt = normalized.slice(0, 180);
  const fallback = {
    text: excerpt + (normalized.length > 180 ? "…" : ""),
    original,
    translated: false,
  };

  if (language !== "en" && language !== "es") return fallback;
  const approved = APPROVED_EXCERPTS.find(({ originalPrefix }) => normalized.startsWith(originalPrefix));
  if (!approved) return fallback;

  return { text: `${approved[language]}…`, original, translated: true };
}

export function localizeGuestReviewStayPeriod(period, language = "fr") {
  const original = String(period ?? "");
  if (language !== "en" && language !== "es") return original;
  const match = /^\s*([A-Za-zÀ-ÿ]+)\s+(\d{4})\s*$/.exec(original);
  if (!match) return original;
  const monthIndex = FRENCH_MONTHS.indexOf(match[1].toLocaleLowerCase("fr"));
  if (monthIndex < 0) return original;
  const year = Number(match[2]);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return original;
  return new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-GB", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1)));
}
