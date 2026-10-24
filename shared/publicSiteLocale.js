// Routage des seules pages publiques multilingues. Les endpoints de paiement,
// d'arrivee et l'administration conservent leurs URL historiques.
import { normalizeGuestLanguage, guestLanguageFromUrl } from "./guestLocale.js";

const PAGE_PATHS = Object.freeze({
  home: "/",
  guide: "/guide-vallees-aure-louron",
  booklet: "/livret",
  ski: "/ski-vallees-aure-louron",
});

export function resolvePublicPage(pathname) {
  const original = typeof pathname === "string" ? pathname : "";
  if (!original) return null;
  const withSlash = original.startsWith("/") ? original : `/${original}`;
  const match = /^\/(en|es)(?=\/|$)/.exec(withSlash);
  const language = match ? match[1] : "fr";
  const remainder = match ? withSlash.slice(match[0].length) || "/" : withSlash;
  const normalized = remainder.length > 1 ? remainder.replace(/\/$/, "") : remainder;

  if (normalized === "/") return { page: "home", language };
  if (normalized === "/livret-accueil" || normalized === PAGE_PATHS.booklet) {
    return { page: "booklet", language };
  }
  for (const page of ["guide", "ski"]) {
    if (normalized === PAGE_PATHS[page]) return { page, language };
  }
  return null;
}

function pagePath(page, language) {
  const base = PAGE_PATHS[page] || PAGE_PATHS.home;
  const lang = normalizeGuestLanguage(language);
  if (page === "booklet") return base; // Liens du livret existants + ?lang=...
  if (lang === "fr") return base;
  return base === "/" ? `/${lang}/` : `/${lang}${base}`;
}

// Navigue vers la meme page dans une autre langue, avec son ancre et ses
// parametres existants. Pas de stockage local ni de redirection implicite.
export function publicUrlForLanguage(currentUrl, targetLanguage) {
  let url;
  try { url = new URL(String(currentUrl || "/"), "https://lamaisonverte65.fr"); }
  catch { return pagePath("home", targetLanguage); }

  const route = resolvePublicPage(url.pathname);
  if (!route) return pagePath("home", targetLanguage);
  const language = normalizeGuestLanguage(targetLanguage);
  const search = new URLSearchParams(url.search);
  search.delete("lang");
  if (route.page === "booklet") {
    search.delete("print"); // Ne pas relancer une impression en changeant de langue.
    if (language !== "fr") search.set("lang", language);
  }
  const query = search.toString();
  return `${pagePath(route.page, language)}${query ? `?${query}` : ""}${url.hash}`;
}

export function localizePublicHref(href, language) {
  if (typeof href !== "string" || !href.startsWith("/")) return href;
  const parsed = new URL(href, "https://lamaisonverte65.fr");
  if (!resolvePublicPage(parsed.pathname)) return href;
  return publicUrlForLanguage(parsed, language);
}

export function languageForPublicPage(url) {
  return guestLanguageFromUrl(url);
}
