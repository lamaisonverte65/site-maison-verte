// Accusé de réception voyageur EN/ES. Les contenus financiers restent les
// valeurs déjà calculées et validées par le serveur, sans aucun recalcul ici.
import { escapeHtml } from "./html.js";
import { normalizeGuestLanguage, formatGuestDate, formatGuestMoney } from "../../../shared/guestLocale.js";

const COPY = Object.freeze({
  en: {
    subject: "Your booking request for La Maison Verte in Arreau",
    hello: "Hello", thanks: "Thank you for your booking request at La Maison Verte.",
    received: "We have received your request for a stay in Arreau from",
    to: "to", recap: "Summary of your request", arrival: "Arrival", departure: "Departure",
    guests: "Guests", adults: "adults", adult: "adult", children: "children", child: "child", ages: "ages",
    babyBed: "baby cot requested", nights: "Nights", accommodation: "Accommodation",
    discount: "Discount", accommodationNet: "Accommodation after discount", cleaning: "Cleaning option",
    yes: "Yes", no: "No", touristTax: "Tourist tax", total: "Total",
    payment: "Requested payment option", payFull: "Payment in full", deposit: "Deposit of",
    balance: "followed by the balance 30 days before arrival", depositUnknown: "Deposit followed by the balance 30 days before arrival",
    notFinal: "Your booking is not yet confirmed, but your dates are temporarily held.",
    next: "Once your request is accepted, we will send you a secure Stripe payment link. The link will be valid for 24 hours. If no payment is received within that period, the dates will be released.",
    signature: "We look forward to welcoming you,",
  },
  es: {
    subject: "Su solicitud de reserva para La Maison Verte en Arreau",
    hello: "Hola", thanks: "Gracias por su solicitud de reserva en La Maison Verte.",
    received: "Hemos recibido su solicitud de estancia en Arreau del",
    to: "al", recap: "Resumen de su solicitud", arrival: "Llegada", departure: "Salida",
    guests: "Huéspedes", adults: "adultos", adult: "adulto", children: "niños", child: "niño", ages: "edades",
    babyBed: "cuna solicitada", nights: "Noches", accommodation: "Alojamiento",
    discount: "Descuento", accommodationNet: "Alojamiento tras el descuento", cleaning: "Servicio de limpieza",
    yes: "Sí", no: "No", touristTax: "Tasa turística", total: "Total",
    payment: "Modalidad de pago elegida", payFull: "Pago completo", deposit: "Anticipo del",
    balance: "y saldo 30 días antes de la llegada", depositUnknown: "Anticipo y saldo 30 días antes de la llegada",
    notFinal: "Su reserva aún no está confirmada, pero las fechas están bloqueadas temporalmente.",
    next: "Una vez aceptada su solicitud, le enviaremos un enlace de pago seguro de Stripe. Este enlace tendrá una validez de 24 horas. Si no se recibe el pago en ese plazo, las fechas volverán a estar disponibles.",
    signature: "Esperamos recibirle pronto,",
  },
});

// Il s'agit exclusivement d'un modèle de présentation ; les montants ne sont
// jamais calculés depuis le navigateur ou modifiés par le rendu de l'email.
export function buildLocalizedGuestBookingReceipt(model) {
  const lang = normalizeGuestLanguage(model?.communication_language);
  if (lang === "fr") throw new Error("Le modèle FR doit utiliser l'email existant.");
  const c = COPY[lang];
  const firstName = escapeHtml(model.firstName);
  const start = escapeHtml(formatGuestDate(model.startDate, lang));
  const end = escapeHtml(formatGuestDate(model.endDate, lang));
  const money = (value) => escapeHtml(formatGuestMoney(value, lang));
  const line = (label, value) => `<strong>${label} :</strong> ${value}<br />`;
  const people = [`${Number(model.adults)} ${Number(model.adults) === 1 ? c.adult : c.adults}`];
  if (Number(model.children)) people.push(`${Number(model.children)} ${Number(model.children) === 1 ? c.child : c.children}`);
  if (model.childrenAges) people.push(`${c.ages}: ${escapeHtml(model.childrenAges)}`);
  if (model.babyBedNeeded) people.push(c.babyBed);
  const hasDiscount = model.promotionCode && Number(model.promotionDiscountAmount || 0) > 0;
  const discount = hasDiscount ? line(c.discount + ` ${escapeHtml(model.promotionCode)}`, `-${money(model.promotionDiscountAmount)}`) : "";
  const accomodation = hasDiscount
    ? line(c.accommodation, money(model.accommodationGross)) + discount + line(c.accommodationNet, money(model.accommodationTotal))
    : line(c.accommodation, money(model.accommodationTotal));
  const depositRate = Number(model.depositRate);
  const percentage = Number.isFinite(depositRate) ? Math.round(depositRate * 100) : null;
  const payment = model.paymentPreference === "full" ? c.payFull
    : percentage === null ? c.depositUnknown : `${c.deposit} ${percentage} % ${c.balance}`;
  const summary = `<p>${line(c.arrival, start)}${line(c.departure, end)}${line(c.guests, people.join(" · "))}${line(c.nights, escapeHtml(model.nights))}${accomodation}${line(c.cleaning, model.cleaningOption ? `${c.yes} (${money(model.cleaningFee)})` : c.no)}${line(c.touristTax, money(model.touristTaxAmount || 0))}${line(c.total, money(model.total))}<strong>${c.payment} :</strong> ${payment}</p>`;
  return {
    to: model.email,
    subject: c.subject,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7"><p>${c.hello} ${firstName},</p><p>${c.thanks}</p><p>${c.received} <strong>${start}</strong> ${c.to} <strong>${end}</strong>.</p><p><strong>${c.recap}</strong></p>${summary}<p><strong>${c.notFinal}</strong></p><p>${c.next}</p><p>${c.signature}<br /><strong>Raphaël &amp; Emmanuelle</strong><br /><a href="mailto:contact@lamaisonverte65.fr">contact@lamaisonverte65.fr</a><br /><strong>La Maison Verte — Arreau</strong></p></div>`,
  };
}
