// V4.15 R5 — Texte des notifications de remboursement/annulation EN/ES.
// Les modèles FR restent dans refund-notification-outbox.js, sans aucune altération.
// Les labels de politiques et messages libres sont cités exactement : ne pas traduire
// un motif/règlement contractuel sans approbation explicite.
import { escapeHtml } from './html.js';
import { normalizeGuestLanguage, formatGuestDate, formatGuestMoney } from '../../../shared/guestLocale.js';

const TEXT = {
  en: {
    refundSubject: 'Refund initiated - La Maison Verte',
    ownerCancelSubject: 'Cancellation of your booking - La Maison Verte',
    guestCancelSubject: 'Booking cancellation confirmed - La Maison Verte',
    refundTitle: 'Refund initiated',
    hello: 'Hello',
    refundIntro: 'We confirm that a refund of',
    refundSuffix: 'has been initiated via Stripe for your stay at La Maison Verte in Arreau.',
    cancellationIntro: 'We confirm that your booking at La Maison Verte in Arreau has been cancelled.',
    arrival: 'Arrival', departure: 'Departure',
    message: 'Message from your host (original wording)',
    policy: 'Reason / applicable policy (original wording)',
    refundNotCancellation: 'This refund does not automatically change your booking.',
    bankDelay: 'The time it takes to appear in your bank account depends on your bank.',
    cancellationRefund: 'A refund of',
    cancellationRefundSuffix: 'has been initiated via Stripe.',
    noRefund: 'No Stripe refund has been initiated for this cancellation.',
    spam: 'If you do not receive further emails, please check your spam folder and add contact@lamaisonverte65.fr to your contacts.',
  },
  es: {
    refundSubject: 'Reembolso iniciado - La Maison Verte',
    ownerCancelSubject: 'Cancelación de su reserva - La Maison Verte',
    guestCancelSubject: 'Confirmación de cancelación - La Maison Verte',
    refundTitle: 'Reembolso iniciado',
    hello: 'Hola',
    refundIntro: 'Le confirmamos que se ha iniciado a través de Stripe un reembolso de',
    refundSuffix: 'correspondiente a su estancia en La Maison Verte, en Arreau.',
    cancellationIntro: 'Le confirmamos que su reserva en La Maison Verte, en Arreau, ha sido cancelada.',
    arrival: 'Llegada', departure: 'Salida',
    message: 'Mensaje del propietario (texto original)',
    policy: 'Motivo / política aplicada (texto original)',
    refundNotCancellation: 'Este reembolso no modifica automáticamente su reserva.',
    bankDelay: 'El plazo para que el reembolso aparezca en su cuenta depende de su banco.',
    cancellationRefund: 'Se ha iniciado a través de Stripe un reembolso de',
    cancellationRefundSuffix: '.',
    noRefund: 'No se ha iniciado ningún reembolso a través de Stripe para esta cancelación.',
    spam: 'Si no recibe más correos, compruebe la carpeta de spam y añada contact@lamaisonverte65.fr a sus contactos.',
  },
};

export function buildLocalizedRefundNotification({language,booking,refundOnly,cancellationType,amountEur,message,policyLabel}) {
  const lang = normalizeGuestLanguage(language);
  if (lang === 'fr') throw new Error('Le modèle de référence français doit être conservé');
  if (!booking || !Number.isFinite(amountEur) || amountEur < 0) throw new Error('Montant ou réservation invalide');
  if (!['owner','client'].includes(cancellationType)) throw new Error('Type d’annulation invalide');
  const t = TEXT[lang];
  const subject = refundOnly ? t.refundSubject
    : cancellationType === 'owner' ? t.ownerCancelSubject : t.guestCancelSubject;
  const name = [booking.guest_first_name,booking.guest_last_name].filter(Boolean).map(escapeHtml).join(' ');
  const money = escapeHtml(formatGuestMoney(amountEur,lang));
  const originalMessage = message ? `<p><strong>${t.message}:</strong><br />${escapeHtml(message)}</p>` : '';
  const policy = `<p><strong>${t.policy}:</strong><br />${escapeHtml(policyLabel || '')}</p>`;
  const bankDelay = `<p>${t.bankDelay}</p>`;
  const details = `<p><strong>${t.arrival}:</strong> ${escapeHtml(formatGuestDate(booking.start_date,lang))}<br />`+
    `<strong>${t.departure}:</strong> ${escapeHtml(formatGuestDate(booking.end_date,lang))}</p>`;
  const body = refundOnly
    ? `<h2>${t.refundTitle}</h2><p>${t.hello} ${name},</p>`+
      `<p>${t.refundIntro} <strong>${money}</strong> ${t.refundSuffix}</p>`+
      details+originalMessage+policy+`<p>${t.refundNotCancellation}</p>`+bankDelay
    : `<h2>${escapeHtml(subject)}</h2><p>${t.hello} ${name},</p>`+
      `<p>${t.cancellationIntro}</p>`+details+originalMessage+policy+
      (amountEur > 0
        ? `<p>${t.cancellationRefund} <strong>${money}</strong>${lang === 'es' ? t.cancellationRefundSuffix : ' '+t.cancellationRefundSuffix}</p>`+bankDelay
        : `<p>${t.noRefund}</p>`);
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;">${body}`+
    `<p style="margin-top:30px;font-size:13px;color:#666;">${t.spam}</p></div>`;
  return {subject,html};
}
