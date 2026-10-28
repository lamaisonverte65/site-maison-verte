import { Children, cloneElement, Fragment, isValidElement } from "react";
import { bookletText, inventoryText } from "./bookletTranslations";

export const SUPPORTED_BOOKLET_LANGUAGES = ["fr", "en", "es"];

export function normalizeBookletLanguage(candidate) {
  const lang = String(candidate || "fr").toLowerCase().slice(0, 2);
  return SUPPORTED_BOOKLET_LANGUAGES.includes(lang) ? lang : "fr";
}

export function guideUrlForLanguage(language) {
  const lang = normalizeBookletLanguage(language);
  const prefix = lang === "fr" ? "" : `/${lang}`;
  return `https://lamaisonverte65.fr${prefix}/guide-vallees-aure-louron`;
}

// Les deux plans de stationnement sont des documents géographiques :
// toujours afficher leurs originaux français, quelle que soit la langue.
// Seules la bannière et la procédure de boîte à clés ont des variantes localisées.
const sourceImages = new Set([
  "banniere-contacts.webp",
  "procedure-boite-a-cles.webp",
]);
const clickImages = new Set([
  "plan-parking-4.webp",
  "plan-parking-3.webp",
  "procedure-boite-a-cles.webp",
]);

function sourceImageName(src) {
  return typeof src === "string" && src.startsWith("/livret/") ? src.slice(8) : null;
}

export function bookletImageSrc(src, language) {
  const lang = normalizeBookletLanguage(language);
  const name = sourceImageName(src);
  if (lang !== "fr" && ["qr-guide.svg", "qr-site.svg", "qr-site-avis.svg"].includes(name)) {
    return `/livret/${name.replace(/\.svg$/, `-${lang}.svg`)}`;
  }
  if (!name || !sourceImages.has(name)) return src;
  if (lang === "fr" && name !== "banniere-contacts.webp") return src;
  return `/livret/${name.replace(/\.webp$/, `-${lang}.webp`)}`;
}

function textOf(children) {
  if (children === null || children === undefined || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join(" ");
  if (isValidElement(children)) return textOf(children.props.children);
  return "";
}

function normalizeText(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function richText(text) {
  // Interprétation limitée aux emphases des traductions validées, jamais en HTML brut.
  return String(text).split(/(\*\*[^*]+\*\*|\n)/g).map((part, index) => {
    if (part === "\n") return <br key={`line-${index}`} />;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return part.replace(/^\*([^*]+)\*$/, "$1");
  });
}

/**
 * Localise les éléments sémantiques du livret français sans dupliquer leurs onze
 * pages JSX ni toucher aux classes responsables de l'impression A4.
 * La clé est le contenu français : l'ordre des blocs peut donc évoluer librement.
 */
export function localizeBookletTree(node, language) {
  const lang = normalizeBookletLanguage(language);
  if (node === null || node === undefined || typeof node === "boolean") return node;
  if (Array.isArray(node)) return node.map((child) => localizeBookletTree(child, lang));
  if (!isValidElement(node)) return node;

  const props = node.props || {};
  const replacementProps = {};
  const elementType = typeof node.type === "string" ? node.type : "";

  if (elementType === "img") {
    const source = props.src;
    const sourceName = sourceImageName(source);
    const resolvedSrc = bookletImageSrc(source, lang);
    if (resolvedSrc !== source) replacementProps.src = resolvedSrc;
    if (sourceName && clickImages.has(sourceName)) {
      replacementProps.role = "link";
      replacementProps.tabIndex = 0;
      replacementProps.title = lang === "en" ? "Open image in a new tab" : lang === "es" ? "Abrir imagen en una pestaña nueva" : "Ouvrir l’image dans un nouvel onglet";
      replacementProps["aria-label"] = replacementProps.title;
      replacementProps.style = { ...props.style, cursor: "zoom-in" };
      replacementProps.onClick = () => window.open(resolvedSrc, "_blank", "noopener,noreferrer");
      replacementProps.onKeyDown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.open(resolvedSrc, "_blank", "noopener,noreferrer");
        }
      };
    }
  }

  if (elementType === "a") {
    if (props.href === guideUrlForLanguage("fr")) {
      replacementProps.href = guideUrlForLanguage(lang);
    } else if (props.href === "https://lamaisonverte65.fr/" && lang !== "fr") {
      replacementProps.href = `https://lamaisonverte65.fr/${lang}/`;
    } else if (props.href === "https://lamaisonverte65.fr/?review=1#laisser-un-avis" && lang !== "fr") {
      replacementProps.href = `https://lamaisonverte65.fr/${lang}/?review=1#laisser-un-avis`;
    }
  }

  // Les <li><span>quantité</span>libellé</li> préservent impérativement la quantité.
  if (elementType === "li") {
    const children = Children.toArray(props.children);
    const first = children.find((item) => isValidElement(item) && item.type === "span" && /^\d+$/.test(normalizeText(textOf(item))));
    if (first) {
      const frenchLabel = normalizeText(children.filter((item) => item !== first).map(textOf).join(" "));
      const translatedLabel = inventoryText[lang]?.[frenchLabel];
      if (translatedLabel) {
        return cloneElement(node, replacementProps, first, " ", ...richText(translatedLabel));
      }
    }
  }

  const french = normalizeText(textOf(props.children));
  const match = bookletText[lang]?.[french];
  if (lang !== "fr" && match !== undefined && ["h1", "h2", "h3", "p", "li", "span", "strong", "div", "a"].includes(elementType) &&
      (elementType !== "div" || !Children.toArray(props.children).some(isValidElement))) {
    // Conserve les deux lignes de la couverture si la traduction le demande.
    if (elementType === "h1" && props.className === "livret-cover-title") {
      return cloneElement(node, replacementProps,
        ...match.split("\n").map((part, index) => <span key={index}>{part}</span>));
    }
    return cloneElement(node, replacementProps, ...richText(match));
  }

  return cloneElement(node, replacementProps,
    ...Children.toArray(props.children).map((child) => localizeBookletTree(child, lang)));
}
