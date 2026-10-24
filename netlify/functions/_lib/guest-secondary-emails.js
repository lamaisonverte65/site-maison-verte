// V4.15 R8 — secondary guest emails only. FR remains authored in the original senders.
// This module is presentation-only and never creates Stripe sessions or changes booking data.
import { escapeHtml } from './html.js';
import { normalizeGuestLanguage, formatGuestDate, formatGuestMoney } from '../../../shared/guestLocale.js';

const WORDS = {
  en: {
    hello: 'Hello', arrival: 'Arrival', departure: 'Departure', amount: 'Amount', stay: 'Stay',
    reason: 'Reason (original wording)', original: 'Message (original wording)',
    contact: 'If you have any questions, please reply to this email.',
    spam: 'If you do not receive our next emails, please check your spam folder and add contact@lamaisonverte65.fr to your contacts.',
    extraSubject: 'Additional payment request - La Maison Verte', extraTitle: 'Additional payment request',
    extraIntro: 'This additional payment concerns your stay at La Maison Verte in Arreau.',
    extraPay: 'Pay', extraNote: 'This payment is separate from your initial contractual stay payment.',
    cleaningSubject: 'Post-stay cleaning payment - La Maison Verte', cleaningTitle: 'Post-stay cleaning',
    cleaningIntro: 'Following your stay at La Maison Verte in Arreau, a cleaning fee remains to be paid.',
    cleaningObservation: 'Observation (original wording)', cleaningPay: 'Pay the cleaning fee',
    recoverySubject: 'New secure arrival-time link - La Maison Verte', recoveryTitle: 'Your arrival time',
    recoveryIntro: 'Here is your new secure link to specify your arrival time at La Maison Verte.',
    recoveryButton: 'Enter my arrival time', recoveryIgnore: 'If you did not request this link, you can ignore this email.',
    expiredSubject: 'Your booking request has expired - La Maison Verte', expiredTitle: 'Your booking request has expired',
    expiredIntro: 'Your request for La Maison Verte in Arreau was accepted, but the requested initial payment was not received before the deadline.',
    expiredDates: 'The dates may therefore be made available again.',
    expiredContact: 'If you believe this is a mistake or would like to submit a new request, please reply to this email.',
    adminFullSubject: 'Payment for your stay - La Maison Verte', adminDepositSubject: 'Deposit payment - La Maison Verte',
    adminFullTitle: 'Payment for your stay', adminDepositTitle: 'Booking deposit',
    adminIntro: 'Your booking at La Maison Verte in Arreau was created by our team.',
    adminFullInfo: 'It will be confirmed once the full amount has been paid.',
    adminDepositInfo: 'It will be confirmed once the deposit has been paid. The balance will be requested approximately 30 days before arrival.',
    nights: 'Number of nights', total: 'Total stay price', dueNow: 'Amount due now',
    adminPayFull: 'Pay for the stay', adminPayDeposit: 'Pay the deposit',
    validUntil: 'This payment link is valid until',
    manualSubject: 'Payment request - La Maison Verte', manualTitle: 'Secure payment request',
    manualIntro: 'Here is a secure payment link for your stay at La Maison Verte in Arreau.',
    manualReason: 'Payment type', manualAmount: 'Amount to pay',
    fullTerms: 'This is the agreed full amount for your stay. Your booking will be considered fully paid once payment is received.',
    manualPay: 'Proceed to payment',
    reasons: {acompte:'Deposit',solde:'Balance',total:'Full payment / promotional rate',complement:'Additional payment'},
  },
  es: {
    hello: 'Hola', arrival: 'Llegada', departure: 'Salida', amount: 'Importe', stay: 'Estancia',
    reason: 'Motivo (texto original)', original: 'Mensaje (texto original)',
    contact: 'Si tiene alguna pregunta, puede responder directamente a este correo.',
    spam: 'Si no recibe nuestros próximos correos, compruebe la carpeta de spam y añada contact@lamaisonverte65.fr a sus contactos.',
    extraSubject: 'Solicitud de pago complementario - La Maison Verte', extraTitle: 'Solicitud de pago complementario',
    extraIntro: 'Este pago complementario corresponde a su estancia en La Maison Verte, en Arreau.',
    extraPay: 'Pagar', extraNote: 'Este pago es independiente del pago contractual inicial de su estancia.',
    cleaningSubject: 'Pago de limpieza después de la estancia - La Maison Verte', cleaningTitle: 'Limpieza después de la estancia',
    cleaningIntro: 'Tras su estancia en La Maison Verte, en Arreau, queda pendiente el pago del servicio de limpieza.',
    cleaningObservation: 'Observaciones (texto original)', cleaningPay: 'Pagar la limpieza',
    recoverySubject: 'Nuevo enlace seguro para la hora de llegada - La Maison Verte', recoveryTitle: 'Su hora de llegada',
    recoveryIntro: 'Aquí tiene un nuevo enlace seguro para indicar su hora de llegada a La Maison Verte.',
    recoveryButton: 'Indicar mi hora de llegada', recoveryIgnore: 'Si no ha solicitado este enlace, puede ignorar este correo.',
    expiredSubject: 'Su solicitud de reserva ha caducado - La Maison Verte', expiredTitle: 'Su solicitud de reserva ha caducado',
    expiredIntro: 'Habíamos aceptado su solicitud para La Maison Verte, en Arreau, pero no recibimos el pago inicial solicitado dentro del plazo previsto.',
    expiredDates: 'Por tanto, las fechas pueden volver a estar disponibles.',
    expiredContact: 'Si cree que se trata de un error o desea presentar una nueva solicitud, puede responder a este correo.',
    adminFullSubject: 'Pago de su estancia - La Maison Verte', adminDepositSubject: 'Pago del anticipo - La Maison Verte',
    adminFullTitle: 'Pago de su estancia', adminDepositTitle: 'Anticipo de reserva',
    adminIntro: 'Nuestro equipo ha creado su reserva en La Maison Verte, en Arreau.',
    adminFullInfo: 'Se confirmará una vez recibido el pago completo.',
    adminDepositInfo: 'Se confirmará después de recibir el anticipo. El saldo se solicitará aproximadamente 30 días antes de su llegada.',
    nights: 'Número de noches', total: 'Precio total de la estancia', dueNow: 'Importe a pagar ahora',
    adminPayFull: 'Pagar la estancia', adminPayDeposit: 'Pagar el anticipo',
    validUntil: 'Este enlace de pago es válido hasta el',
    manualSubject: 'Solicitud de pago - La Maison Verte', manualTitle: 'Solicitud de pago seguro',
    manualIntro: 'Le enviamos un enlace de pago seguro para su estancia en La Maison Verte, en Arreau.',
    manualReason: 'Tipo de pago', manualAmount: 'Importe a pagar',
    fullTerms: 'Este pago corresponde al importe total acordado para su estancia. Su reserva quedará totalmente pagada tras recibirlo.',
    manualPay: 'Realizar el pago',
    reasons: {acompte:'Anticipo',solde:'Saldo',total:'Pago total / tarifa promocional',complement:'Pago complementario'},
  },
};

const e = (value) => escapeHtml(String(value ?? ''));
function local(language) {
  const lang = normalizeGuestLanguage(language);
  if (lang === 'fr') throw new Error('The original French email must be retained');
  return { lang, t: WORDS[lang] };
}
const date = (value, lang) => e(formatGuestDate(String(value ?? ''), lang));
const money = (value, lang) => e(formatGuestMoney(value, lang));
const guestName = (booking) => [booking?.guest_first_name, booking?.guest_last_name].filter(Boolean).map(e).join(' ');
const lines = (booking, t, lang) => `<strong>${t.arrival}:</strong> ${date(booking?.start_date,lang)}<br /><strong>${t.departure}:</strong> ${date(booking?.end_date,lang)}`;
const paragraph = (label, value) => value ? `<p><strong>${label}:</strong><br />${e(value).replace(/\r?\n/g,'<br />')}</p>` : '';
const button = (url, label) => `<p style="margin-top:28px"><a href="${e(url)}" style="background:#16a34a;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block">${label}</a></p>`;
const wrap = (t, body) => `<div style="font-family:Arial,sans-serif;line-height:1.6">${body}<p style="margin-top:28px;font-size:13px;color:#666">${t.spam}</p></div>`;

export function buildLocalizedAdditionalChargeEmail({ language, booking, charge, paymentLink }) {
  const {lang,t}=local(language);
  const html=wrap(t,`<h2>${t.extraTitle} — La Maison Verte</h2><p>${t.hello} ${guestName(booking)},</p><p>${t.extraIntro}</p><p>${lines(booking,t,lang)}<br /><strong>${t.reason}:</strong> ${e(charge.reason_label)}<br /><strong>${t.amount}:</strong> ${money(charge.amount,lang)}</p>${paragraph(t.original,charge.customer_message)}${button(paymentLink, `${t.extraPay} ${money(charge.amount,lang)}`)}<p>${t.extraNote} ${t.contact}</p>`);
  return {subject:t.extraSubject,html};
}
export function buildLocalizedCleaningEmail({ language, booking, issue, paymentLink }) {
  const {lang,t}=local(language);
  const html=wrap(t,`<h2>${t.cleaningTitle} — La Maison Verte</h2><p>${t.hello} ${guestName(booking)},</p><p>${t.cleaningIntro}</p><p>${lines(booking,t,lang)}<br /><strong>${t.amount}:</strong> ${money(issue.amount_due,lang)}</p>${paragraph(t.cleaningObservation,issue.notes)}${button(paymentLink,t.cleaningPay)}<p>${t.contact}</p>`);
  return {subject:t.cleaningSubject,html};
}
export function buildLocalizedArrivalRecoveryEmail({ language, booking, url }) {
  const {t}=local(language);
  return {subject:t.recoverySubject,html:wrap(t,`<h2>${t.recoveryTitle}</h2><p>${t.hello} ${guestName(booking)},</p><p>${t.recoveryIntro}</p>${button(url,t.recoveryButton)}<p>${t.recoveryIgnore}</p>`)};
}
export function buildLocalizedExpiredEmail({ language, booking }) {
  const {lang,t}=local(language);
  return {subject:t.expiredSubject,html:wrap(t,`<h2>${t.expiredTitle}</h2><p>${t.hello} ${guestName(booking)},</p><p>${t.expiredIntro}</p><p>${lines(booking,t,lang)}</p><p>${t.expiredDates}</p><p>${t.expiredContact}</p>`)};
}
export function buildLocalizedAdminBookingPaymentEmail({ language, booking, paymentLink, paymentType, paymentAmount, acceptanceExpiresAt, message }) {
  const {lang,t}=local(language);
  const full=paymentType==='full';
  const deadline=new Date(acceptanceExpiresAt);
  const deadlineText=Number.isFinite(deadline.getTime()) ? new Intl.DateTimeFormat(lang==='es'?'es-ES':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Paris'}).format(deadline) : '';
  const subject=full?t.adminFullSubject:t.adminDepositSubject;
  const html=wrap(t,`<h2>${full?t.adminFullTitle:t.adminDepositTitle} — La Maison Verte</h2><p>${t.hello} ${guestName(booking)},</p><p>${t.adminIntro} ${full?t.adminFullInfo:t.adminDepositInfo}</p><p>${lines(booking,t,lang)}<br /><strong>${t.nights}:</strong> ${e(booking.nights??'-')}<br /><strong>${t.total}:</strong> ${money(booking.contract_total??booking.owner_price??booking.estimated_total,lang)}<br /><strong>${t.dueNow}:</strong> ${money(paymentAmount,lang)}</p>${paragraph(t.original,message)}${button(paymentLink,full?t.adminPayFull:t.adminPayDeposit)}<p>${t.validUntil} ${e(deadlineText)}.</p>`);
  return {subject,html};
}
export function buildLocalizedManualPaymentEmail({ language, booking, amount, reason, message, paymentLink }) {
  const {lang,t}=local(language);
  const reasonText=t.reasons[reason]??t.manualTitle;
  const html=wrap(t,`<h2>${t.manualTitle} — La Maison Verte</h2><p>${t.hello} ${guestName(booking)},</p><p>${t.manualIntro}</p><p>${lines(booking,t,lang)}<br /><strong>${t.manualReason}:</strong> ${reasonText}<br /><strong>${t.manualAmount}:</strong> ${money(amount,lang)}</p>${reason==='total'?`<p>${t.fullTerms}</p>`:''}${paragraph(t.original,message)}${button(paymentLink,t.manualPay)}`);
  return {subject:`${reasonText} — ${t.manualSubject}`,html};
}
