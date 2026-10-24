// V4.15 R6 — Accusés de réception des paiements Stripe EN/ES.
// Les textes FR et le traitement Stripe restent dans stripe-webhook.js.
import { escapeHtml } from './html.js';
import { normalizeGuestLanguage, formatGuestDate, formatGuestMoney } from '../../../shared/guestLocale.js';

const COPY = {
  en: {
    subjects: { deposit: 'Deposit received - La Maison Verte', balance: 'Balance received - La Maison Verte', full: 'Payment received - La Maison Verte', manual: 'Payment received - La Maison Verte' },
    titles: { deposit: 'Deposit received — booking confirmed ✅', balance: 'Balance received — stay fully paid ✅', full: 'Payment received — stay fully paid ✅', manual: 'Payment received ✅' },
    hello: 'Hello', arrival: 'Arrival', departure: 'Departure', nights: 'Number of nights', total: 'Total booking amount',
    depositReceived: 'Deposit received', balanceRemaining: 'Remaining balance', balanceReceived: 'Balance received', totalPaid: 'Total paid',
    manualReceived: 'Payment received',
    intro: { deposit: 'Thank you. We have received the deposit for your stay at <strong>La Maison Verte in Arreau</strong>.', balance: 'We have received the outstanding balance for your stay at <strong>La Maison Verte in Arreau</strong>.', full: 'We have received the full payment for your stay at <strong>La Maison Verte in Arreau</strong>.', manual: 'We have received your payment for <strong>La Maison Verte in Arreau</strong>.' },
    paymentTypes: { acompte: 'Deposit', solde: 'Balance', total: 'Full payment', complement: 'Additional payment', cleaning: 'Post-stay cleaning', additional_charge: 'Additional charge' },
    due: 'The remaining balance will be requested approximately <strong>30 days before arrival</strong>.',
    followup: 'Once the balance is received, we will send you the information needed to prepare your stay.',
    linen: 'Bed linen and two towels per person (one large towel 70 × 140 cm and one small towel 33 × 50 cm) are provided.',
    keybox: 'Your keys will be available in a key safe. The code and final practical instructions will be emailed two days before your arrival.',
    keyAlt: 'Illustrated instructions for opening and closing the key safe',
    checkin: 'Usual check-in time', checkinValue: 'from 4:00 pm', checkout: 'Check-out time', checkoutValue: 'before 10:00 am',
    times: 'These times may be adjusted depending on the stays immediately before or after yours. Please contact us if you have a special request.',
    bookletIntro: 'You can already consult our welcome booklet for information about the house, access, parking and your stay.',
    booklet: 'View the welcome booklet', arrivalTime: 'Confirm my arrival time', farewell: 'We look forward to welcoming you to the Pyrenees 🌿',
    spam: 'Please check your spam folder if you do not receive our messages, and add contact@lamaisonverte65.fr to your contacts.',
  },
  es: {
    subjects: { deposit: 'Anticipo recibido - La Maison Verte', balance: 'Saldo recibido - La Maison Verte', full: 'Pago recibido - La Maison Verte', manual: 'Pago recibido - La Maison Verte' },
    titles: { deposit: 'Anticipo recibido — reserva confirmada ✅', balance: 'Saldo recibido — estancia pagada ✅', full: 'Pago recibido — estancia pagada ✅', manual: 'Pago recibido ✅' },
    hello: 'Hola', arrival: 'Llegada', departure: 'Salida', nights: 'Número de noches', total: 'Importe total de la reserva',
    depositReceived: 'Anticipo recibido', balanceRemaining: 'Saldo pendiente', balanceReceived: 'Saldo recibido', totalPaid: 'Total pagado',
    manualReceived: 'Pago recibido',
    intro: { deposit: 'Muchas gracias. Hemos recibido el anticipo de su estancia en <strong>La Maison Verte, en Arreau</strong>.', balance: 'Hemos recibido el pago del saldo pendiente de su estancia en <strong>La Maison Verte, en Arreau</strong>.', full: 'Hemos recibido el pago íntegro de su estancia en <strong>La Maison Verte, en Arreau</strong>.', manual: 'Hemos recibido su pago correspondiente a <strong>La Maison Verte, en Arreau</strong>.' },
    paymentTypes: { acompte: 'Anticipo', solde: 'Saldo', total: 'Pago íntegro', complement: 'Pago complementario', cleaning: 'Limpieza posterior a la estancia', additional_charge: 'Cargo adicional' },
    due: 'El saldo restante se solicitará aproximadamente <strong>30 días antes de su llegada</strong>.',
    followup: 'Una vez recibido el saldo, le enviaremos la información necesaria para preparar su estancia.',
    linen: 'Se proporcionan sábanas y dos toallas por persona (una grande de 70 × 140 cm y otra pequeña de 33 × 50 cm).',
    keybox: 'Las llaves estarán disponibles en una caja de seguridad. Recibirá el código y las últimas instrucciones prácticas dos días antes de su llegada.',
    keyAlt: 'Instrucciones ilustradas para abrir y cerrar la caja de llaves',
    checkin: 'Horario habitual de llegada', checkinValue: 'a partir de las 16:00', checkout: 'Hora de salida', checkoutValue: 'antes de las 10:00',
    times: 'Estos horarios pueden adaptarse en función de las estancias anteriores o posteriores. Contáctenos si necesita un horario especial.',
    bookletIntro: 'Ya puede consultar nuestra guía de bienvenida con información sobre la casa, el acceso, el aparcamiento y su estancia.',
    booklet: 'Consultar la guía de bienvenida', arrivalTime: 'Indicar mi hora de llegada', farewell: '¡Será un placer darle la bienvenida a los Pirineos! 🌿',
    spam: 'Si no recibe nuestros mensajes, compruebe la carpeta de correo no deseado y añada contact@lamaisonverte65.fr a sus contactos.',
  },
};

export function buildLocalizedPaymentConfirmation({ language, booking, paymentType, total, deposit, balance, manualReason, manualAmount, arrivalUrl }) {
  const lang = normalizeGuestLanguage(language);
  if (lang === 'fr') throw new Error('Le modèle français de référence doit être conservé');
  if (!booking || !['full', 'balance', 'manual', 'deposit'].includes(paymentType)) throw new Error('Paiement ou réservation invalide');
  const t = COPY[lang];
  const money = (amount) => escapeHtml(formatGuestMoney(amount, lang));
  const kind = t.paymentTypes[manualReason] || t.manualReceived;
  const title = paymentType === 'manual' ? `${kind} — ${t.titles.manual}` : t.titles[paymentType];
  const subject = t.subjects[paymentType];
  const name = [booking.guest_first_name, booking.guest_last_name].filter(Boolean).map(escapeHtml).join(' ');
  const paymentLine = paymentType === 'full'
    ? `<strong>${t.totalPaid}:</strong> ${money(total)}<br />`
    : paymentType === 'balance'
      ? `<strong>${t.balanceReceived}:</strong> ${money(manualAmount)}<br /><strong>${t.totalPaid}:</strong> ${money(total)}<br />`
      : paymentType === 'manual'
        ? `<strong>${kind}:</strong> ${money(manualAmount)}<br />`
        : `<strong>${t.depositReceived}:</strong> ${money(deposit)}<br /><strong>${t.balanceRemaining}:</strong> ${money(balance)}`;
  const isSettled = paymentType === 'full' || paymentType === 'balance';
  const safeArrivalUrl = typeof arrivalUrl === 'string' && /^https:\/\/lamaisonverte65\.fr\/arrival\?/.test(arrivalUrl)
    ? escapeHtml(arrivalUrl) : null;
  const details = isSettled ? `
    <p>${t.linen}</p><p>${t.keybox}</p>
    <p style="margin:24px 0;"><img src="https://lamaisonverte65.fr/livret/procedure-boite-a-cles-${lang}.webp" alt="${t.keyAlt}" style="display:block;width:100%;max-width:720px;height:auto;margin:0 auto;border:0;" /></p>
    <p><strong>${t.checkin}:</strong> ${t.checkinValue}<br /><strong>${t.checkout}:</strong> ${t.checkoutValue}</p>
    <p>${t.times}</p><p>${t.bookletIntro}</p>
    <p style="margin-top:20px;"><a href="https://lamaisonverte65.fr/livret?lang=${lang}" style="background:#2f4f35;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">${t.booklet}</a></p>
    ${safeArrivalUrl ? `<p style="margin-top:24px;"><a href="${safeArrivalUrl}" style="background:#2f4f35;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">${t.arrivalTime}</a></p>` : ''}
  ` : '';
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;">
    <h2>${title}</h2><p>${t.hello} ${name},</p><p>${t.intro[paymentType]}</p>
    <p><strong>${t.arrival}:</strong> ${escapeHtml(formatGuestDate(booking.start_date,lang))}<br />
    <strong>${t.departure}:</strong> ${escapeHtml(formatGuestDate(booking.end_date,lang))}<br />
    <strong>${t.nights}:</strong> ${escapeHtml(String(booking.nights || '-'))}<br />
    <strong>${t.total}:</strong> ${money(total)}<br />${paymentLine}</p>
    ${paymentType === 'deposit' ? `<p>${t.due}</p><p>${t.followup}</p>` : ''}
    ${details}<p>${t.farewell}</p>
    <p style="margin-top:30px;font-size:13px;color:#666;">${t.spam}</p></div>`;
  return { subject, html };
}
