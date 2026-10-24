// Metadonnees de l'accueil : trois URL canoniques distinctes.
// Le noindex temporaire EN/ES est gere independamment dans App.jsx et Netlify.
export const HOME_SEO = Object.freeze({
  fr: Object.freeze({
    title: "Location vacances Arreau 3 étoiles – Gîte 4 personnes | La Maison Verte",
    description: "Meublé de tourisme classé 3 étoiles à Arreau pour 4 personnes. Réservation directe auprès du propriétaire, proche Saint-Lary, Peyragudes, Loudenvielle, Val Louron et du Néouvielle.",
    ogTitle: "La Maison Verte – Meublé de tourisme 3 étoiles à Arreau",
    ogDescription: "Maison rénovée classée meublé de tourisme 3 étoiles pour 4 personnes à Arreau. Réservation directe propriétaire, au cœur des Pyrénées.",
    twitterDescription: "Maison classée 3 étoiles pour 4 personnes à Arreau. Réservation directe propriétaire, au cœur des Pyrénées.",
    canonical: "https://lamaisonverte65.fr/",
    ogLocale: "fr_FR",
  }),
  en: Object.freeze({
    title: "3-star holiday home in Arreau for 4 guests | La Maison Verte",
    description: "Stay in a 3-star holiday rental for up to 4 guests in Arreau, in the French Pyrenees. Book directly near Saint-Lary, Peyragudes and Loudenvielle.",
    ogTitle: "La Maison Verte – 3-star holiday rental in Arreau",
    ogDescription: "A renovated 3-star holiday home for 4 guests in Arreau, close to the Aure and Louron valleys. Book directly with the owner.",
    twitterDescription: "3-star holiday rental in Arreau for 4 guests. Book directly with the owner in the French Pyrenees.",
    canonical: "https://lamaisonverte65.fr/en/",
    ogLocale: "en_GB",
  }),
  es: Object.freeze({
    title: "Casa de vacaciones de 3 estrellas en Arreau para 4 | La Maison Verte",
    description: "Alojamiento turístico de 3 estrellas para hasta 4 personas en Arreau, en los Pirineos franceses. Reserva directa cerca de Saint-Lary, Peyragudes y Loudenvielle.",
    ogTitle: "La Maison Verte – Alojamiento turístico de 3 estrellas en Arreau",
    ogDescription: "Casa renovada de 3 estrellas para 4 personas en Arreau, cerca de los valles de Aure y Louron. Reserva directamente con el propietario.",
    twitterDescription: "Alojamiento turístico de 3 estrellas en Arreau para 4 personas. Reserva directa en los Pirineos franceses.",
    canonical: "https://lamaisonverte65.fr/es/",
    ogLocale: "es_ES",
  }),
});

export const HOME_ALTERNATES = Object.freeze({
  fr: HOME_SEO.fr.canonical,
  en: HOME_SEO.en.canonical,
  es: HOME_SEO.es.canonical,
  "x-default": HOME_SEO.fr.canonical,
});

export function getHomeSeo(language = "fr") {
  return HOME_SEO[language] || HOME_SEO.fr;
}
