// V4.15 R4 — seuls les messages voyageurs EN/ES sont fournis ici.
// Les fonctions planifiées, critères J-30/J-2/J+1, prix, jetons et journaux
// restent leurs propres sources d'autorité. Les modèles FR sont intacts.
import { escapeHtml } from "./html.js";
import { formatGuestDate, formatGuestMoney, normalizeGuestLanguage } from "../../../shared/guestLocale.js";

const BALANCE = {
  en: {
    labels: {request: "Balance payment", reminder_1: "Balance payment reminder", reminder_2: "Important balance payment reminder", urgent: "Final balance payment reminder"},
    intros: {request: "The remaining balance for your stay is now due.", reminder_1: "According to our records, the balance for your stay is still outstanding.", reminder_2: "This is a reminder that the balance for your stay is still outstanding.", urgent: "The balance for your stay is still outstanding. Please pay as soon as possible or contact us."},
    hello: "Hello", arrival: "Arrival", departure: "Departure", balance: "Balance due", pay: "Pay the balance",
    remind: "Your reservation is still confirmed and your dates remain reserved. The balance is still due. If you have difficulties, questions, or wish to change your plans, please contact us.",
    urgent: "Your reservation remains confirmed and the dates remain reserved. The balance is still due. This is our last automated reminder; if you are having difficulties or your plans have changed, please contact us.",
    spam: "If you do not receive our next messages, please check your spam folder and add contact@lamaisonverte65.fr to your contacts.",
  },
  es: {
    labels: {request: "Pago del saldo", reminder_1: "Recordatorio del pago del saldo", reminder_2: "Recordatorio importante del pago del saldo", urgent: "Último recordatorio del pago del saldo"},
    intros: {request: "Ya puede abonar el saldo pendiente de su estancia.", reminder_1: "Según nuestros registros, el saldo de su estancia sigue pendiente de pago.", reminder_2: "Le recordamos que el saldo de su estancia sigue pendiente de pago.", urgent: "El saldo de su estancia sigue pendiente. Le rogamos que lo abone cuanto antes o que se ponga en contacto con nosotros."},
    hello: "Hola", arrival: "Llegada", departure: "Salida", balance: "Saldo pendiente", pay: "Pagar el saldo",
    remind: "Su reserva sigue confirmada y las fechas permanecen reservadas. El saldo sigue pendiente de pago. Si tiene alguna dificultad, pregunta o desea cambiar sus planes, póngase en contacto con nosotros.",
    urgent: "Su reserva sigue confirmada y las fechas permanecen reservadas. El saldo sigue pendiente de pago. Este es nuestro último recordatorio automático; si tiene alguna dificultad o sus planes han cambiado, póngase en contacto con nosotros.",
    spam: "Si no recibe nuestros próximos mensajes, compruebe la carpeta de correo no deseado y añada contact@lamaisonverte65.fr a sus contactos.",
  },
};
const ARRIVAL = {
 en: { subject: "Prepare for your arrival at La Maison Verte", title: "Your arrival at La Maison Verte", hello: "Hello", upcoming: "Your stay is coming up. Here is everything you need to prepare for your arrival.",
   address: "Address", keys: "Collecting the keys", keysInfo: "When you arrive, collect the keys from the key box using the code below.", code: "Key box code", unavailable: "temporarily unavailable — please contact us before your arrival.", picture: "Illustrated key box instructions",
   access: "Access and parking", accessInfo: "The house is located in a pedestrian-only lane. You can check the access and parking map before arriving:", map: "View access and parking map",
   time: "Your arrival time", stated: "Current arrival time", ask: "You can tell us your estimated arrival time.", change: "View or change my arrival time", choose: "Enter my arrival time",
   hours: "Check-in and check-out", checkin: "Check-in", checkout: "Check-out", after: "from 4 pm", before: "before 10 am", adaptable: "These times may be adjusted depending on other guests' arrivals and departures. Please contact us if you have a special request.",
   wifi: "Wi-Fi 7", network: "Network", wifiPassword: "Password",
   booklet: "Welcome booklet", bookletLink: "Read the welcome booklet", contact: "Any questions before your arrival? Reply to this email or call us at", },
 es: { subject: "Prepare su llegada a La Maison Verte", title: "Su llegada a La Maison Verte", hello: "Hola", upcoming: "Su estancia se acerca. Aquí encontrará toda la información útil para preparar su llegada.",
   address: "Dirección", keys: "Recogida de llaves", keysInfo: "Al llegar, recoja las llaves de la caja de seguridad usando el siguiente código.", code: "Código de la caja de llaves", unavailable: "temporalmente no disponible; póngase en contacto con nosotros antes de llegar.", picture: "Instrucciones ilustradas de la caja de llaves",
   access: "Acceso y aparcamiento", accessInfo: "La casa se encuentra en una calle peatonal sin salida. Puede consultar el plano de acceso y aparcamiento antes de su llegada:", map: "Ver el plano de acceso y aparcamiento",
   time: "Su hora de llegada", stated: "Hora indicada actualmente", ask: "Puede indicarnos su hora aproximada de llegada.", change: "Consultar o modificar mi hora de llegada", choose: "Indicar mi hora de llegada",
   hours: "Horarios de llegada y salida", checkin: "Llegada", checkout: "Salida", after: "a partir de las 16:00", before: "antes de las 10:00", adaptable: "Estos horarios pueden adaptarse según las salidas y llegadas de otros huéspedes. Consúltenos si tiene alguna petición especial.",
   wifi: "Wi-Fi 7", network: "Red", wifiPassword: "Contraseña",
   booklet: "Guía de bienvenida", bookletLink: "Consultar la guía de bienvenida", contact: "¿Alguna pregunta antes de su llegada? Responda a este correo o llámenos al", },
};
const REVIEW = {
 en: {subject:"Thank you for staying at La Maison Verte", title:"Thank you for staying at La Maison Verte", hello:"Hello", intro:"We hope you enjoyed your stay at La Maison Verte in Arreau and made the most of the Pyrenees.",
  feedback:"Your feedback matters", feedbackInfo:"If anything was missing, an item could be improved, or you have a suggestion, simply reply to this email. Your feedback helps us improve the house.",
  share:"Share your experience", shareInfo:"If you wish, you can also share your experience to help future guests.", ownReview:"Leave a review of La Maison Verte", googleReview:"Leave a Google review",
  loyalty:"10% off your next stay", loyaltyInfo:"For your next booking made directly on our website, you can enjoy a 10% discount on accommodation with this code:", loyaltyTerms:"This code has no expiry date. The discount applies to accommodation only; the cleaning fee and tourist tax are excluded.", thanks:"Thank you again for choosing us. We hope to welcome you back.",
 },
 es: {subject:"Gracias por su estancia en La Maison Verte", title:"Gracias por su estancia en La Maison Verte", hello:"Hola", intro:"Esperamos que haya disfrutado de su estancia en La Maison Verte, en Arreau, y de los Pirineos.",
  feedback:"Su opinión nos importa", feedbackInfo:"Si ha echado algo en falta, cree que se puede mejorar algún equipamiento o tiene una sugerencia, responda directamente a este correo. Sus comentarios nos ayudan a mejorar la casa.",
  share:"Comparta su experiencia", shareInfo:"Si lo desea, también puede compartir su experiencia para ayudar a futuros viajeros.", ownReview:"Dejar una opinión sobre La Maison Verte", googleReview:"Dejar una reseña en Google",
  loyalty:"10 % de descuento en su próxima estancia", loyaltyInfo:"En su próxima reserva realizada directamente en nuestra web, disfrutará de un 10 % de descuento en el alojamiento con el código:", loyaltyTerms:"Este código no tiene fecha de caducidad. El descuento solo se aplica al alojamiento, excluyendo la limpieza y la tasa turística.", thanks:"Muchas gracias de nuevo por confiar en nosotros. Esperamos volver a recibirle.",
 },
};
function words(lang, source) {
 const normalized = normalizeGuestLanguage(lang);
 if (normalized === "fr") throw new Error("Le modèle historique français doit être utilisé.");
 return { lang: normalized, t: source[normalized] };
}
function guestName(booking) { return [booking?.guest_first_name, booking?.guest_last_name].filter(Boolean).map(escapeHtml).join(" "); }
function button(href, label, color="#16a34a") {
 return `<a href="${escapeHtml(href)}" style="background:${color};color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">${escapeHtml(label)}</a>`;
}

export function buildLocalizedBalanceEmail({ language, booking, paymentLink, amount, step }) {
 const {lang,t} = words(language, BALANCE);
 if (!Object.hasOwn(t.labels, step)) throw new Error("Étape de solde invalide");
 const subject = `${t.labels[step]} - La Maison Verte`;
 const extra = step === "reminder_2" ? `<p>${t.remind}</p>` : step === "urgent" ? `<p>${t.urgent}</p>` : "";
 const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;">
 <h2>${t.labels[step]} — La Maison Verte</h2>
 <p>${t.hello} ${guestName(booking)},</p>
 <p>${t.intros[step]}</p>
 <p><strong>${t.arrival}:</strong> ${escapeHtml(formatGuestDate(booking.start_date,lang))}<br />
 <strong>${t.departure}:</strong> ${escapeHtml(formatGuestDate(booking.end_date,lang))}<br />
 <strong>${t.balance}:</strong> ${escapeHtml(formatGuestMoney(amount,lang))}</p>
 <p style="margin-top:30px;">${button(paymentLink,t.pay)}</p>${extra}
 <p style="margin-top:30px;font-size:13px;color:#666;">${t.spam}</p></div>`;
 return {subject, html};
}

export function buildLocalizedArrivalEmail({ language, booking, keyboxCode, arrivalUrl, siteUrl }) {
 const {lang,t} = words(language, ARRIVAL);
 const root = String(siteUrl || "https://lamaisonverte65.fr").replace(/\/$/, "");
 const name = guestName(booking);
 // Assets EN/ES validés V4.15. Le plan d'accès commun est déjà en français dans les 3 livrets.
 const imageUrl = `${root}/livret/procedure-boite-a-cles-${lang}.webp`;
 const mapUrl = `${root}/livret/plan-acces.jpg`;
 const bookletUrl = `${root}/livret?lang=${lang}`;
 const arrivalTime = booking.arrival_time
   ? `<p><strong>${t.stated}:</strong> ${escapeHtml(booking.arrival_time)}</p>`
   : `<p>${t.ask}</p>`;
 const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2933;">
 <h2>${t.title}</h2><p>${t.hello} ${name},</p><p>${t.upcoming}</p>
 <h3>${t.address}</h3><p><strong>La Maison Verte — 3 Impasse Trassens, 65240 Arreau</strong></p>
 <h3>${t.keys}</h3><p>${t.keysInfo}</p>
 <p><strong>${t.code}:</strong> ${keyboxCode ? escapeHtml(keyboxCode) : t.unavailable}</p>
 <p style="margin:24px 0;"><img src="${escapeHtml(imageUrl)}" alt="${t.picture}" style="display:block;width:100%;max-width:720px;height:auto;margin:0 auto;border:0;" /></p>
 <h3>${t.access}</h3><p>${t.accessInfo}</p><p><a href="${escapeHtml(mapUrl)}" style="color:#14532d;font-weight:bold;">${t.map}</a></p>
 <h3>${t.time}</h3>${arrivalTime}<p>${button(arrivalUrl, booking.arrival_time ? t.change : t.choose)}</p>
 <h3>${t.hours}</h3><p><strong>${t.checkin}:</strong> ${t.after}<br /><strong>${t.checkout}:</strong> ${t.before}</p><p>${t.adaptable}</p>
 <h3>${t.wifi}</h3><p><strong>${t.network}:</strong> Freebox-38AFFB<br /><strong>${t.wifiPassword}:</strong> lamaisonverte65</p>
 <h3>${t.booklet}</h3><p><a href="${escapeHtml(bookletUrl)}" style="color:#14532d;font-weight:bold;">${t.bookletLink}</a></p>
 <p style="margin-top:28px;">${t.contact} <a href="tel:+33695938315">06 95 93 83 15</a>.</p>
 <p style="margin-top:26px;">Raphaël &amp; Emmanuelle<br /><a href="tel:+33695938315">06 95 93 83 15</a><br />La Maison Verte — Arreau</p>
 </div>`;
 return {subject:t.subject, html};
}

export function buildLocalizedReviewEmail({ language, booking, reviewUrl, googleReviewUrl }) {
 const {lang,t} = words(language, REVIEW);
 const first = escapeHtml(booking.guest_first_name || "");
 const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2933;">
 <h2>${t.title}</h2><p>${t.hello} ${first},</p><p>${t.intro}</p>
 <h3>${t.feedback}</h3><p>${t.feedbackInfo}</p>
 <h3>${t.share}</h3><p>${t.shareInfo}</p>
 <p>${button(reviewUrl,t.ownReview,"#1f6f3d")}</p><p><a href="${escapeHtml(googleReviewUrl)}" style="background:#fff;color:#1f6f3d;border:1px solid #1f6f3d;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">${t.googleReview}</a></p>
 <h3>${t.loyalty}</h3><p>${t.loyaltyInfo}</p><p style="font-size:22px;font-weight:bold;letter-spacing:1px;">CLIENTFIDELE</p>
 <p>${t.loyaltyTerms}</p><p>${t.thanks}</p>
 <p style="margin-top:26px;">Raphaël &amp; Emmanuelle<br /><a href="tel:+33695938315">06 95 93 83 15</a><br />La Maison Verte — Arreau</p></div>`;
 const text = [
 `${t.hello} ${booking.guest_first_name || ""},`,"",t.intro,"",`${t.feedback}: ${t.feedbackInfo}`,"",
 `${t.share}: ${t.shareInfo}`,`${t.ownReview}: ${reviewUrl}`,`${t.googleReview}: ${googleReviewUrl}`,"",
 `${t.loyalty}: ${t.loyaltyInfo}`,"CLIENTFIDELE",t.loyaltyTerms,"",t.thanks,"",
 "Raphaël & Emmanuelle","06 95 93 83 15","La Maison Verte — Arreau",
 ].join("\n");
 return {subject:t.subject, html, text};
}
