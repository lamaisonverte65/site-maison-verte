// Langue des communications voyageurs, indépendante des règles métier.
// FR reste la valeur de repli pour les réservations existantes.
export const GUEST_LANGUAGES = Object.freeze(["fr", "en", "es"]);
const LANGUAGE_TAGS = Object.freeze({ fr: "fr-FR", en: "en-GB", es: "es-ES" });

export function normalizeGuestLanguage(value, fallback = "fr") {
  const defaultCode = GUEST_LANGUAGES.includes(fallback) ? fallback : "fr";
  if (typeof value !== "string") return defaultCode;
  const input = value.trim().toLowerCase();
  // Autoriser fr, fr-FR, en-GB, es_ES, mais jamais des valeurs arbitraires.
  const match = /^(fr|en|es)(?:[-_][a-z]{2})?$/.exec(input);
  return match ? match[1] : defaultCode;
}

// Interprétation d'une URL publique : chemin /en/... ou /es/... en priorité,
// puis ?lang=... (routes existantes du livret). N'effectue aucune redirection.
export function guestLanguageFromUrl(url, fallback = "fr") {
  let parsed;
  try {
    parsed = new URL(String(url || "/"), "https://lamaisonverte65.fr");
  } catch {
    return normalizeGuestLanguage(null, fallback);
  }
  const pathLanguage = /^\/(en|es)(?:\/|$)/.exec(parsed.pathname)?.[1];
  if (pathLanguage) return pathLanguage;
  const queryLanguage = parsed.searchParams.get("lang");
  return normalizeGuestLanguage(queryLanguage, fallback);
}

// Un message propriétaire ne doit pas changer de langue avec le voyageur.
export function emailLanguageForAudience(booking, audience = "guest") {
  if (audience !== "guest") return "fr";
  return normalizeGuestLanguage(booking?.communication_language ?? booking?.communicationLanguage);
}

export function formatGuestDate(dateIso, language = "fr") {
  const input = String(dateIso ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const date = new Date(`${input}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input) return input;
  return new Intl.DateTimeFormat(LANGUAGE_TAGS[normalizeGuestLanguage(language)], {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(date);
}

export function formatGuestMoney(amount, language = "fr") {
  if (amount === null || amount === undefined || amount === "") return "–";
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "–";
  return new Intl.NumberFormat(LANGUAGE_TAGS[normalizeGuestLanguage(language)], {
    style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(numericAmount);
}

// Les anciennes URL Stripe et d'arrivee restent valides : seul un parametre
// facultatif indique la langue aux pages publiques (/success, /cancel, /arrival).
// Ne pas passer par URLSearchParams : Stripe attend le jeton literal
// {CHECKOUT_SESSION_ID} dans success_url.
export function appendGuestLanguage(url, language) {
  const input = String(url || "");
  const lang = normalizeGuestLanguage(language);
  if (lang === "fr" || !input || /(?:[?&])lang=/.test(input)) return input;
  const fragmentIndex = input.indexOf("#");
  const beforeHash = fragmentIndex === -1 ? input : input.slice(0, fragmentIndex);
  const afterHash = fragmentIndex === -1 ? "" : input.slice(fragmentIndex);
  return `${beforeHash}${beforeHash.includes("?") ? "&" : "?"}lang=${lang}${afterHash}`;
}
