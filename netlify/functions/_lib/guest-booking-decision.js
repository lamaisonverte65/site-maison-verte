// R3 : modèles des décisions voyageurs EN/ES uniquement.
// Les paiements et montants sont calculés dans send-booking-decision.js.
import { escapeHtml } from "./html.js";
import { formatGuestDate, formatGuestMoney, normalizeGuestLanguage } from "../../../shared/guestLocale.js";

const WORDS = Object.freeze({
  en: {
    acceptedSubject: "Your booking request has been accepted — La Maison Verte",
    acceptedTitle: "Your booking request has been accepted",
    refusedSubject: "Your booking request — La Maison Verte",
    refusedTitle: "We cannot accept your booking request",
    confirmedSubject: "Your booking is confirmed — La Maison Verte",
    confirmedTitle: "Your booking is confirmed 🎉",
    hello: "Hello", goodNews: "Good news! We can welcome you to <strong>La Maison Verte in Arreau</strong> on your requested dates.",
    recap: "Your stay summary", arrival: "Arrival", departure: "Departure", nights: "Nights", guests: "Guests",
    adult: "adult", adults: "adults", child: "child", children: "children", ages: "ages", cot: "baby cot requested", unspecified: "Not specified",
    accommodation: "Accommodation", discount: "Discount applied", cleaning: "Cleaning", touristTax: "Tourist tax", total: "Total stay price",
    deposit: "Deposit to pay", full: "Total amount to pay", payDeposit: "Pay the deposit", payFull: "Pay for the stay",
    depositExplanation: "To confirm your reservation, please pay the deposit using the button below.",
    fullExplanation: "You have chosen to pay for the entire stay in one payment. This payment will confirm your reservation.",
    fullShortNotice: "As your arrival date is less than 30 days away, full payment is required to confirm your reservation.",
    cancellation: "For cancellations made within 30 days of arrival, the deposit is retained and any balance already paid is refunded, as stated in the rental terms. The tourist tax is refunded if the stay does not take place.",
    link24: "This payment link is valid for <strong>24 hours</strong>", until: ", until <strong>", linkExpiry: ". If payment is not received in time, the dates will become available again.",
    afterPayment: "After payment, you will receive an email confirming your booking.", balance30: "The remaining balance will be requested automatically <strong>30 days before arrival</strong>.",
    contractBefore: "You can consult the", contract: "rental agreement", contractAfter: "at any time for your booking terms.",
    sign: "We look forward to welcoming you,", sorry: "Unfortunately, we cannot accept your booking request at <strong>La Maison Verte in Arreau</strong> for the stay from", to: "to",
    hope: "We hope to welcome you on another occasion.", confirmed: "Your booking at <strong>La Maison Verte</strong> is now confirmed.",
    amount: "Amount", plannedArrival: "Expected arrival time", askArrival: "Please let us know your estimated arrival time 🙂",
    message: "Message from the hosts (in the original language)", lookingForward: "We look forward to seeing you in Arreau 🌿",
  },
  es: {
    acceptedSubject: "Su solicitud de reserva ha sido aceptada — La Maison Verte",
    acceptedTitle: "Su solicitud de reserva ha sido aceptada",
    refusedSubject: "Su solicitud de reserva — La Maison Verte",
    refusedTitle: "No podemos aceptar su solicitud de reserva",
    confirmedSubject: "Su reserva está confirmada — La Maison Verte",
    confirmedTitle: "Su reserva está confirmada 🎉",
    hello: "Hola", goodNews: "¡Buenas noticias! Podemos recibirle en <strong>La Maison Verte, en Arreau</strong>, en las fechas solicitadas.",
    recap: "Resumen de su estancia", arrival: "Llegada", departure: "Salida", nights: "Noches", guests: "Huéspedes",
    adult: "adulto", adults: "adultos", child: "niño", children: "niños", ages: "edades", cot: "cuna solicitada", unspecified: "No indicado",
    accommodation: "Alojamiento", discount: "Descuento aplicado", cleaning: "Limpieza", touristTax: "Tasa turística", total: "Precio total de la estancia",
    deposit: "Anticipo a pagar", full: "Importe total a pagar", payDeposit: "Pagar el anticipo", payFull: "Pagar la estancia",
    depositExplanation: "Para confirmar su reserva, abone el anticipo mediante el botón siguiente.",
    fullExplanation: "Ha elegido pagar la estancia completa en un solo pago. Este pago confirmará su reserva.",
    fullShortNotice: "Como faltan menos de 30 días para su llegada, se requiere el pago completo para confirmar la reserva.",
    cancellation: "En caso de cancelación dentro de los 30 días anteriores a la llegada, se retiene el anticipo y se reembolsa cualquier saldo ya abonado, conforme a las condiciones de alquiler. La tasa turística se reembolsa si la estancia no tiene lugar.",
    link24: "Este enlace de pago es válido durante <strong>24 horas</strong>", until: ", hasta el <strong>", linkExpiry: ". Si no se recibe el pago a tiempo, las fechas volverán a estar disponibles.",
    afterPayment: "Después del pago, recibirá un correo de confirmación de la reserva.", balance30: "El saldo pendiente se solicitará automáticamente <strong>30 días antes de la llegada</strong>.",
    contractBefore: "Puede consultar el", contract: "contrato de alquiler", contractAfter: "en cualquier momento para conocer las condiciones de su reserva.",
    sign: "Esperamos recibirle pronto,", sorry: "Lamentablemente, no podemos aceptar su solicitud de reserva en <strong>La Maison Verte, en Arreau</strong>, para la estancia del", to: "al",
    hope: "Esperamos poder recibirle en otra ocasión.", confirmed: "Su reserva en <strong>La Maison Verte</strong> ya está confirmada.",
    amount: "Importe", plannedArrival: "Hora prevista de llegada", askArrival: "Le agradeceríamos que nos indicara su hora aproximada de llegada 🙂",
    message: "Mensaje de los anfitriones (en el idioma original)", lookingForward: "Esperamos recibirle en Arreau 🌿",
  },
});

function formatDeadline(value, lang) {
  if (!value) return "";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris",
  }).format(d);
}

export function buildLocalizedBookingDecision(model = {}) {
  const lang = normalizeGuestLanguage(model.language);
  if (lang === "fr") throw new Error("Le modèle français existant doit être conservé.");
  const t = WORDS[lang];
  if (!["accepted", "refused", "confirmed"].includes(model.type)) throw new Error("Type de décision invalide.");
  const e = escapeHtml;
  const start = e(formatGuestDate(model.startDate, lang));
  const end = e(formatGuestDate(model.endDate, lang));
  const money = (v) => e(formatGuestMoney(v, lang));
  const name = e(model.firstName || "");
  const fullName = [name, e(model.lastName || "")].filter(Boolean).join(" ");
  const ownerMsg = String(model.ownerMessage || "").trim()
    ? `<p><strong>${t.message}:</strong><br />${e(model.ownerMessage).replace(/\r?\n/g, "<br />")}</p>` : "";
  const signature = `<p>${t.sign}<br /><strong>Raphaël &amp; Emmanuelle</strong><br /><a href="mailto:contact@lamaisonverte65.fr">contact@lamaisonverte65.fr</a><br /><strong>La Maison Verte — Arreau</strong></p>`;
  const person = [`${e(model.adultsCount || 0)} ${Number(model.adultsCount) === 1 ? t.adult : t.adults}`];
  if (Number(model.childrenCount || 0) > 0) person.push(`${e(model.childrenCount)} ${Number(model.childrenCount) === 1 ? t.child : t.children}`);
  if (model.childrenAges) person.push(`${t.ages}: ${e(model.childrenAges)}`);
  if (model.babyBedNeeded) person.push(t.cot);
  const guests = person.join(" · ") || t.unspecified;
  const line = (label, value) => `${label}: ${value}<br />`;
  const recap = [
    line(t.arrival, start), line(t.departure, end), line(t.nights, e(model.nights || "")), line(t.guests, guests),
  ].join("");
  if (model.type === "refused") {
    return {
      subject: t.refusedSubject, title: t.refusedTitle,
      content: `<p>${t.hello} ${name},</p><p>${t.sorry} <strong>${start}</strong> ${t.to} <strong>${end}</strong>.</p>${ownerMsg}<p>${t.hope}</p>${signature}`,
    };
  }
  if (model.type === "confirmed") {
    return {
      subject: t.confirmedSubject, title: t.confirmedTitle,
      content: `<p>${t.hello} ${fullName},</p><p>${t.confirmed}</p><p>${recap}${line(t.amount, money(model.displayedPrice))}</p>${model.arrivalTime ? `<p><strong>${t.plannedArrival}:</strong> ${e(model.arrivalTime)}</p>` : `<p>${t.askArrival}</p>`}${ownerMsg}<p>${t.lookingForward}</p>`,
    };
  }
  const isFull = model.paymentType === "full";
  const discount = Number(model.actualDiscount) > 0
    ? line(t.discount, `-${money(model.actualDiscount)}${model.actualDiscountRate ? ` (${e(model.actualDiscountRate)} %)` : ""}`) : "";
  const breakdown = `${recap}${line(t.accommodation, money(model.accommodationNet))}${discount}${line(t.cleaning, money(model.cleaningApplied))}${line(t.touristTax, money(model.touristTax))}<strong>${line(t.total, money(model.displayedPrice))}</strong><strong>${line(isFull ? t.full : t.deposit, money(model.amountToPay))}</strong>`;
  const explanation = isFull
    ? Number(model.daysBeforeArrival) > 30 ? t.fullExplanation : `${t.fullShortNotice}<br />${t.cancellation}`
    : t.depositExplanation;
  const payButton = model.paymentLink
    ? `<p style="margin-top:30px;"><a href="${e(model.paymentLink)}" style="background:#16a34a;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">${isFull ? t.payFull : t.payDeposit}</a></p>`
    : "";
  const deadline = formatDeadline(model.acceptanceExpiresAt, lang);
  const expiry = `${t.link24}${deadline ? `${t.until}${e(deadline)}</strong>` : ""}${t.linkExpiry}`;
  const contract = `<p>${t.contractBefore} <a href="${e(model.contractUrl)}" style="color:#166534;font-weight:bold;text-decoration:none;">${t.contract}</a> ${t.contractAfter}</p>`;
  return {
    subject: t.acceptedSubject, title: t.acceptedTitle,
    content: `<p>${t.hello} ${name},</p><p>${t.goodNews}</p><p><strong>${t.recap}</strong><br />${breakdown}</p><p>${explanation}</p>${payButton}<p>${expiry}</p><p>${t.afterPayment}</p>${!isFull ? `<p>${t.balance30}</p>` : ""}${contract}${ownerMsg}${signature}`,
  };
}
