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

// Traduction des descriptions destinées aux lecteurs d'écran.
// Les attributs français proviennent des pages JSX FR, qui restent la source.
const accessibilityText = Object.freeze({
  en: {
    "Informations pratiques": "Practical information",
    "Accès et stationnement à La Maison Verte": "Directions and parking at La Maison Verte",
    "Plan général d'accès à Arreau et aux vallées environnantes": "Overview map of access to Arreau and the surrounding valleys",
    "Plan détaillé des accès et des parkings autour de La Maison Verte": "Detailed map of access routes and parking near La Maison Verte",
    "Fonctionnement du logement": "House information",
    "Avant votre départ": "Before you leave",
    "Couverture du livret d'accueil": "Welcome booklet cover",
    "La Maison Verte - Email : lamaisonverte65@gmail.com - Adresse : 3 Impasse Trassens, 65240 Arreau": "La Maison Verte – Email: lamaisonverte65@gmail.com – Address: 3 Impasse Trassens, 65240 Arreau",
    "Bienvenue à La Maison Verte": "Welcome to La Maison Verte",
    "Sommaire du livret": "Booklet contents",
    "QR codes utiles": "Useful QR codes",
    "QR code vers le site officiel La Maison Verte": "QR code for the official La Maison Verte website",
    "QR code pour écrire à La Maison Verte": "QR code to email La Maison Verte",
    "QR code pour appeler La Maison Verte": "QR code to call La Maison Verte",
    "QR code de connexion au Wi-Fi de La Maison Verte": "QR code to connect to the La Maison Verte Wi-Fi",
    "QR code vers le guide des vallées d'Aure et du Louron": "QR code for the Aure and Louron valleys guide",
    "QR code WhatsApp de La Maison Verte": "QR code for La Maison Verte WhatsApp",
    "Découvrir les vallées d'Aure et du Louron": "Explore the Aure and Louron valleys",
    "Votre avis compte beaucoup": "Your feedback matters",
    "QR Code vers les avis Google": "QR code for Google reviews",
    "QR Code vers les avis du site": "QR code for reviews on our website",
    "Inventaire — rez-de-chaussée": "Inventory – ground floor",
    "Inventaire — étages": "Inventory – upper floors",
    "Arrivée et boîte à clés": "Arrival and key safe",
    "Procédure d’ouverture et de fermeture de la boîte à clés": "Instructions for opening and closing the key safe",
  },
  es: {
    "Informations pratiques": "Información práctica",
    "Accès et stationnement à La Maison Verte": "Acceso y aparcamiento en La Maison Verte",
    "Plan général d'accès à Arreau et aux vallées environnantes": "Mapa general de acceso a Arreau y a los valles cercanos",
    "Plan détaillé des accès et des parkings autour de La Maison Verte": "Mapa detallado de los accesos y aparcamientos cerca de La Maison Verte",
    "Fonctionnement du logement": "Funcionamiento del alojamiento",
    "Avant votre départ": "Antes de salir",
    "Couverture du livret d'accueil": "Portada de la guía de bienvenida",
    "La Maison Verte - Email : lamaisonverte65@gmail.com - Adresse : 3 Impasse Trassens, 65240 Arreau": "La Maison Verte – Correo electrónico: lamaisonverte65@gmail.com – Dirección: 3 Impasse Trassens, 65240 Arreau",
    "Bienvenue à La Maison Verte": "Bienvenidos a La Maison Verte",
    "Sommaire du livret": "Índice de la guía",
    "QR codes utiles": "Códigos QR útiles",
    "QR code vers le site officiel La Maison Verte": "Código QR del sitio web oficial de La Maison Verte",
    "QR code pour écrire à La Maison Verte": "Código QR para escribir a La Maison Verte",
    "QR code pour appeler La Maison Verte": "Código QR para llamar a La Maison Verte",
    "QR code de connexion au Wi-Fi de La Maison Verte": "Código QR para conectarse al Wi-Fi de La Maison Verte",
    "QR code vers le guide des vallées d'Aure et du Louron": "Código QR de la guía de los valles de Aure y Louron",
    "QR code WhatsApp de La Maison Verte": "Código QR del WhatsApp de La Maison Verte",
    "Découvrir les vallées d'Aure et du Louron": "Descubrir los valles de Aure y Louron",
    "Votre avis compte beaucoup": "Su opinión es muy importante",
    "QR Code vers les avis Google": "Código QR para las reseñas de Google",
    "QR Code vers les avis du site": "Código QR para las reseñas de nuestra web",
    "Inventaire — rez-de-chaussée": "Inventario – planta baja",
    "Inventaire — étages": "Inventario – plantas superiores",
    "Arrivée et boîte à clés": "Llegada y caja de llaves",
    "Procédure d’ouverture et de fermeture de la boîte à clés": "Instrucciones para abrir y cerrar la caja de llaves",
  },
});

export function localizeBookletAccessibility(value, language) {
  const lang = normalizeBookletLanguage(language);
  // Ne jamais modifier les chaînes vides (images décoratives) ni les identifiants.
  return lang === "fr" || !value ? value : accessibilityText[lang]?.[value] ?? value;
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
  if (lang !== "fr") {
    for (const attribute of ["alt", "aria-label", "title"]) {
      if (typeof props[attribute] !== "string") continue;
      const translated = localizeBookletAccessibility(props[attribute], lang);
      if (translated !== props[attribute]) replacementProps[attribute] = translated;
    }
  }

  if (elementType === "img") {
    const source = props.src;
    const sourceName = sourceImageName(source);
    const resolvedSrc = bookletImageSrc(source, lang);
    if (resolvedSrc !== source) replacementProps.src = resolvedSrc;
    if (sourceName && clickImages.has(sourceName)) {
      replacementProps.role = "link";
      replacementProps.tabIndex = 0;
      replacementProps.title = lang === "en" ? "Open image in a new tab" : lang === "es" ? "Abrir imagen en una pestaña nueva" : "Ouvrir l’image dans un nouvel onglet";
      const description = replacementProps.alt || props.alt;
      replacementProps["aria-label"] = description ? `${description} — ${replacementProps.title}` : replacementProps.title;
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
