import { escapeHtml } from "./html.js";
import { normalizeGuestLanguage } from "../../../shared/guestLocale.js";

// Les pages de statut du solde ne donnent jamais d'autorisation de paiement :
// le contrôle Stripe et le montant restent dans pay-balance.js.
const copy = Object.freeze({
  fr: {
    invalid: ["Lien invalide", "Ce lien de paiement n’est pas valide. Contactez-nous si vous avez besoin d’aide."],
    notFound: ["Réservation introuvable", "Nous ne retrouvons pas cette réservation. Contactez-nous si nécessaire."],
    unavailable: ["Paiement indisponible", "Cette réservation n’est plus payable."],
    paid: ["Séjour déjà réglé", "Merci, le séjour est déjà entièrement payé. Aucun nouveau paiement n’est nécessaire."],
    verifying: ["Paiement en cours de vérification", "Un paiement peut être en cours de confirmation. Aucun nouveau paiement n'a été ouvert. Veuillez réessayer après quelques instants ou nous contacter."],
    refresh: ["Lien à actualiser", "La réservation vient d'être mise à jour. Merci de rouvrir votre lien de paiement dans quelques instants."],
    error: ["Paiement momentanément indisponible", "Le paiement n’a pas pu être ouvert. Réessayez dans quelques instants ou contactez-nous."],
    home: "Retour à La Maison Verte",
  },
  en: {
    invalid: ["Invalid link", "This payment link is not valid. Please contact us if you need assistance."],
    notFound: ["Booking not found", "We cannot find this booking. Please contact us if needed."],
    unavailable: ["Payment unavailable", "This booking can no longer be paid for."],
    paid: ["Stay already paid", "Thank you. Your stay has already been paid in full. No further payment is needed."],
    verifying: ["Payment being verified", "A payment may still be awaiting confirmation. No new payment has been started. Please try again shortly or contact us."],
    refresh: ["Link needs refreshing", "Your booking has just been updated. Please reopen your payment link in a few moments."],
    error: ["Payment temporarily unavailable", "We could not open the payment page. Please try again shortly or contact us."],
    home: "Back to La Maison Verte",
  },
  es: {
    invalid: ["Enlace no válido", "Este enlace de pago no es válido. Póngase en contacto con nosotros si necesita ayuda."],
    notFound: ["Reserva no encontrada", "No encontramos esta reserva. Póngase en contacto con nosotros si lo necesita."],
    unavailable: ["Pago no disponible", "Esta reserva ya no admite pagos."],
    paid: ["Estancia ya pagada", "Gracias. La estancia ya está pagada en su totalidad. No es necesario realizar otro pago."],
    verifying: ["Pago en verificación", "Puede que un pago esté pendiente de confirmación. No se ha iniciado otro pago. Inténtelo de nuevo dentro de unos momentos o contáctenos."],
    refresh: ["Enlace por actualizar", "Su reserva acaba de actualizarse. Vuelva a abrir el enlace de pago dentro de unos momentos."],
    error: ["Pago temporalmente no disponible", "No hemos podido abrir la página de pago. Inténtelo de nuevo dentro de unos momentos o contáctenos."],
    home: "Volver a La Maison Verte",
  },
});

export function balanceStatusPage(kind, language = "fr", siteUrl = "https://lamaisonverte65.fr") {
  const lang = normalizeGuestLanguage(language);
  const texts = copy[lang];
  const [title, message] = texts[kind] || texts.error;
  // SITE_URL est un paramètre serveur, pas une URL transmise par le visiteur.
  const origin = String(siteUrl || "https://lamaisonverte65.fr").replace(/\/+$/, "");
  const home = `${origin}${lang === "fr" ? "/" : `/${lang}/`}`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>${escapeHtml(title)}</title></head><body style="font-family:Arial,sans-serif;background:#f6f7f3;color:#1f2933;margin:0"><main style="max-width:680px;margin:8vh auto;background:white;padding:32px;border-radius:20px"><h1>${escapeHtml(title)}</h1><p style="line-height:1.6">${escapeHtml(message)}</p><p><a href="${escapeHtml(home)}" style="color:#166534">${escapeHtml(texts.home)}</a></p></main></body></html>`;
}
